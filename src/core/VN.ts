import {
    DN, IComponent, UpdateStrategy, TickSchedulingType, RefType, ISubscription, IPublication
} from "../api/CompTypes";
import { IEventSlot, IEventSlotOwner } from "../api/EventSlotTypes";
import { createTrigger } from "../api/TriggerAPI";
import { ITrigger } from "../api/TriggerTypes";
import { ChildrenUpdateRequest, IVN } from "./VNTypes";

/// #if USE_STATS
    import {StatsCategory} from "../utils/Stats"
/// #endif

import { getCurrentClassComp, requestNodeUpdate } from "./Reconciler";





///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VNBase class is a base class for all types of virtual nodes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/// #if DEBUG
    let g_nextVNDebugID = 1;
/// #endif

export abstract class VN implements IVN
{
	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public abstract get name(): string;

	// Parent node. This is null for the top-level (root) nodes.
	public parent?: VN | null;

    /** Class component that created this node in its render method. */
    public creator?: IComponent | null;

	/**
     * Zero-based index of this node in the parent's list of sub-nodes. This is zero for the
     * root nodes that don't have parents.
     */
	public index: number;

	// DOM node under which all content of this virtual node is rendered.
	public anchorDN?: DN;

	/**
	 * Node's key. The derived classes set it based on their respective content. A key can be of
	 * any type.
	 */
	public key?: any;

	// List of sub-nodes - both keyed and unkeyed - defined only if there are some sub-nodes.
	public subNodes?: VN[];

	/**
	 * Update strategy object that determines different aspects of node behavior
	 * during updates.
	 */
	public updateStrategy?: UpdateStrategy;

	// Returns DOM node corresponding to the virtual node itself (if any) and not to any of its
	// sub-nodes.
	public ownDN?: DN;

	// Flag indicating that update has been requested but not yet performed. This flag is needed
	// to prevent trying to add the node to the global map every time the requestUpdate method
	// is called.
	public updateRequested?: boolean;

    // Flag indicating thata partial update has been requested but not yet performed. This flag is
    // different from the updateRequested since it controls node-type-specific "partial" updates,
    // which are treated by the rconciler by calling the performPartialUpdate method. Different
    // virtual node types can support different kinds of partial updates; for example, the ElmVN
    // allows updating the element properties without re-rendering its children.
	public partialUpdateRequested?: boolean;

	// "Tick number" during which the node was last updated. If this node's tick number equals
	// the current tick number maintained by the root node, this indicates that this node was
	// already updated in this update cycle. This helps prevent double-rendering of a
	// component if both the component and its parent are updated in the same cycle.
	public lastUpdateTick?: number;



    /// #if USE_STATS
    public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif

    /// #if DEBUG
    public debugID: number;
    constructor()
    {
        this.debugID = g_nextVNDebugID++;
    }
	/// #endif

	///////////////////////////////////////////////////////////////////////////////////////////////
	//
	// Life cycle methods
	//
	///////////////////////////////////////////////////////////////////////////////////////////////

	/**
     * Recursively inserts the content of this virtual node to DOM under the given parent (anchor)
     * and before the given node.
     */
	public mount( parent: VN | null, index: number, anchorDN: DN, beforeDN: DN = null): void
    {
        this.creator = getCurrentClassComp();
        this.parent = parent;
        this.index = index;
        this.anchorDN = anchorDN;
    }

    /**
     * Recursively removes the content of this virtual node from DOM.
     */
	public unmount( removeFromDOM: boolean): void
    {
        this.parent = null;
        this.anchorDN = null;
        this.creator = undefined;
    }

    /**
     * Removes all publications and subscriptions
     */
	public clearPubSub(): void
    {
        if (this.pubs)
        {
            this.pubs?.forEach( publication => publication.unpublish());
            this.pubs = undefined;
        }

        if (this.subs)
        {
            this.subs.forEach( subscription => subscription.unsubscribe());
            this.subs = undefined;
        }
    }



    /** Determines whether the node is currently mounted */
	public get isMounted(): boolean { return this.anchorDN != null; }



    // Returns the first DOM node defined by either this virtual node or one of its sub-nodes.
    // This method is only called on the mounted nodes.
    public getFirstDN(): DN
    {
        if (this.ownDN)
            return this.ownDN;
        if (!this.subNodes)
            return null;

        // recursively call this method on the sub-nodes from first to last until a valid node
        // is returned
        let dn: DN;
        for( let svn of this.subNodes)
        {
            if (dn = svn.getFirstDN())
                return dn;
        }

        return null;
    }

    // Returns the last DOM node defined by either this virtual node or one of its sub-nodes.
    // This method is only called on the mounted nodes.
    public getLastDN(): DN
    {
        if (this.ownDN)
            return this.ownDN;
        if (!this.subNodes)
            return null;

        // recursively call this method on the sub-nodes from last to first until a valid node
        // is returned
        let dn: DN;
        for( let i = this.subNodes.length - 1; i >= 0; i--)
        {
            if (dn = this.subNodes[i].getLastDN())
                return dn;
        }

        return null;
    }

    // Returns the list of DOM nodes that are immediate children of this virtual node; that is, are
    // NOT children of sub-nodes that have their own DOM node. May return null but never returns
    // empty array.
    public getImmediateDNs(): DN | DN[] | null
    {
        if (this.ownDN)
            return this.ownDN;
        if (!this.subNodes)
            return null;

        let arr: DN[] = [];
        this.subNodes.forEach( svn => svn.collectImmediateDNs( arr));
        return arr.length === 0 ? null : arr;
    }

    // Collects all DOM nodes that are the immediate children of this virtual node (that is,
    // are NOT children of sub-nodes that have their own DOM node) into the given array.
    private collectImmediateDNs( arr: DN[]): void
    {
        if (this.ownDN)
            arr.push( this.ownDN);
        else if (this.subNodes)
            this.subNodes.forEach( svn => svn.collectImmediateDNs( arr));
    }



	// // Level of nesting at which the node resides relative to the root node.
	// public get depth(): number
    // {
    //     let depth = 0;
    //     for( let p = this.parent; p; p = p.parent)
    //         depth++;

    //     return depth;
    // }



    // Schedules an update for this node.
	public requestUpdate( req?: ChildrenUpdateRequest, schedulingType?: TickSchedulingType): void
	{
		if (!this.updateRequested)
		{
			requestNodeUpdate( this, req, schedulingType);
			this.updateRequested = true;
		}
	}



	// Schedules an update for this node.
	public requestPartialUpdate( schedulingType?: TickSchedulingType): void
	{
		if (!this.partialUpdateRequested)
		{
			requestNodeUpdate( this, undefined, schedulingType);
			this.partialUpdateRequested = true;
		}
	}



    /**
	 * Registers the given value as a service with the given ID that will be available for
     * consumption by descendant components.
     */
	public publishService( id: string, value: any, depth?: number): Publication
	{
		if (!this.pubs)
			this.pubs = new Map<string,any>();
        else
        {
            let publication = this.pubs.get( id);
            if (publication)
            {
                publication.value = value;
                return publication;
            }
        }

        let publication = new Publication( id, this, value, depth);
        this.pubs.set(id, publication);
        return publication;
	}



	/**
	 * Subscribes to a service with the given ID. If the service with the given ID is registered
	 * by this or one of the ancestor components, the returned subscription object's `value`
     * property will reference it; otherwise, the value will be set to the defaultValue (if
     * specified) or will remain undefined. Whenever the value of the service that is registered by
     * this or a closest ancestor component is changed, the subscription's `value` property will
     * receive the new value.
	 */
    public subscribeService( id: string, defaultValue?: any, useSelf?: boolean): ISubscription<any>
    {
		if (!this.subs)
			this.subs = new Map();
        else
        {
            let subscription = this.subs.get( id);
            if (subscription)
                return subscription;
        }

        // find the service and create the subscription object
        let publication = findPublication( this, id, useSelf);
        let subscription = new Subscription( id, this, publication, defaultValue, useSelf);
		this.subs.set( id, subscription);

        return subscription;
    }



	// Retrieves the value for a service with the given ID registered by a closest ancestor
	// node or the default value if none of the ancestor nodes registered a service with
	// this ID. This method doesn't establish a subscription and only reflects the current state.
	public getService( id: string, defaultService?: any, useSelf?: boolean): any
	{
        // not that only undefined return value serves as the indication that the service was not
        // found. All other values including empty string, zero and false are valid service values.
        let publication = findPublication( this, id, useSelf);
		return publication?.value ?? defaultService;
	}



	// Map of service IDs to objects constituting publications made by this node.
	public pubs?: Map<string,Publication>;

	// Map of service IDs to objects constituting subscriptions made by this node.
	private subs?: Map<string,Subscription>;
}



/**
 * Helper function to set the value of the reference that takes care of the different types of
 * references. The optional `onlyIf` parameter may specify a value so that only if the reference
 * currently has the same value it will be replaced. This might be needed to not clear a
 * reference if it already points to a different object.
 * @param ref [[Ref]] object to which the new value will be set
 * @param val Reference value to set to the Ref object
 * @param onlyIf An optional value to which to compare the current (old) value of the reference.
 * The new value will be set only if the old value equals the `onlyIf` value.
 */
export function setRef<T>( ref: RefType<T>, val: T, onlyIf?: T): void
{
	if (typeof ref === "function")
		ref(val);
	else if (!onlyIf || ref.r === onlyIf)
        ref.r = val;
}



/**
 * Symbol that is attached to a render function to indicate that it should not be wrapped in a
 * watcher.
 */
export let symRenderNoWatcher = Symbol();



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Pub/Sub mechanism
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Represents a publication of a service held by a virtual node.
 */
class Publication implements IPublication<any>
{
    constructor( id: string, vn: VN, value?: any, depth?: number)
    {
        this.id = id;
        this.vn = vn;
        this.trigger = createTrigger( value, depth);
        notifyServicePublished( this);
    }

    /** Returns the current value of the service */
    public get value(): any { return this.trigger?.get(); }

    /** Sets the new value of the service */
    public set value( v: any) { this.trigger?.set(v); }

    /** Deletes this publication */
    public unpublish(): void
    {
        if (this.trigger)
        {
            // delete all attached callbacks from the publication's trigger.
            (this.trigger as IEventSlot as IEventSlotOwner).clear();
            notifyServiceUnpublished( this);
            this.vn.pubs!.delete(this.id);
            this.trigger = null;
        }
    }



    /** ID of the published service */
    public id: string;

    /** Virtual node that created the publication */
    public vn: VN;

    /** Trigger containing the current service value */
    public trigger: ITrigger | null;
}



/**
 * Represents a subscription to a service held by a virtual node.
 */
class Subscription implements ISubscription<any>
{
    public constructor( id: string, vn: VN,
        publication: Publication | undefined, defaultValue?: any, useSelf?: boolean)
    {
        this.id = id;
        this.vn = vn;
        this.defaultValue = defaultValue;
        this.useSelf = useSelf;
        this.setPublication(publication);
        notifyServiceSubscribed( this);
    }

    /** Sets the trigger either from the given publication or creates a new one with the default value */
    public setPublication( publication: Publication | undefined): void
    {
        if (this.trigger === publication?.trigger)
            return;

        // if we have callbacks attached to the trigger, detach them now and re-attach them to
        // the new trigger
        if (this.trigger && this.callbacks.size > 0)
            this.callbacks.forEach( callback => this.trigger!.detach(callback));

        this.trigger = publication?.trigger;
        if (this.trigger)
            this.callbacks.forEach( callback => this.trigger!.attach(callback));
    }

    /** Returns the current value of the service */
    public get value(): any { return this.trigger?.get() ?? this.defaultValue; }

	/**
     * Notifies the node that publication information about the given service (to which the node
     * has previously subscribed) has changed.
     */
	public notifyServiceChanged(): void
	{
        this.setPublication( findPublication( this.vn, this.id, this.useSelf));
	}

    /**
     * Attaches the given callback to the "change" event.
     * @param callback Function that will be called when the value of the service changes.
     */
    public attach( callback: (value?: any) => void): void
    {
        this.callbacks.add(callback);
        this.trigger?.attach(callback);
    }

    /**
     * Detaches the given callback from the "change" event.
     * @param callback Function that was attached to the "change" event by the [[attach]] method.
     */
    public detach( callback: (value?: any) => void): void
    {
        this.trigger?.detach(callback);
        this.callbacks.delete(callback);
    }

    /** Deletes this subscription */
    public unsubscribe(): void
    {
        if (this.trigger)
        {
            // detach all our callbacks from the trigger (which belongs to the publication)
            this.callbacks.forEach( callback => this.trigger!.detach(callback));
            this.callbacks.clear();
            notifyServiceUnsubscribed( this);
            this.trigger = null;
        }
    }



    /** ID of the subscribed service */
    public id: string;

    /** Virtual node that created the subscription */
    public vn: VN;

	/**
     * Default value of the service that is used if none of the ancestor nodes publishes the
     * service
     */
	public defaultValue: any;

	/**
     * Flag indicating whether a node can subscribe to a service that it implements itself. This
     * is useful in case where a service that is implemented by a component can chain to a service
     * implemented by an ancestor component.
     */
    public useSelf?: boolean;

    /** Trigger containing the current service value */
    public trigger?: ITrigger | null;

    /**
     * Set of attached callbacks. We need this in order to detach them from the publication's trigger.
     */
    private callbacks = new Set<(value?: any) => void>();
}



/**
 * Goes up the chain of nodes looking for a published service with the given ID. Returns undefined
 * if the service is not found. Note that null might be a valid value.
 */
function findPublication( vn: VN, id: string, useSelf?: boolean): Publication | undefined
{
    if (useSelf)
    {
        let publication = vn.pubs?.get( id);
        if (publication !== undefined)
            return publication;
    }

    // go up the chain; note that we don't pass the useSelf parameter on bus pass `true`. If the
    // parent is undefined (that is, this is a root VN), check whether it has a creator. If it
    // does, this means that there is another, higher-level, component hierarchy, so we keep
    // looking there.
    let higherVN = vn.parent ?? vn.creator?.vn;
    return higherVN ? findPublication( higherVN as VN, id, true) : undefined;
}



/**
 * Information about service publications and subscriptions. The same service can be published
 * and subscribed to by multiple nodes.
 */
class ServiceInfo
{
	pubs = new Map<VN,Publication>();
	subs = new Map<VN,Subscription>();
}

// Map of service IDs to sets of virtual nodes that subscribed to this service.
let s_serviceInfos = new Map<string,ServiceInfo>();



/** Retrieves existing or creates new ServiceInfo object for the given service ID */
function getOrCreateServiceInfo( id: string): ServiceInfo
{
	let info = s_serviceInfos.get( id);
	if (!info)
	{
		info = new ServiceInfo();
		s_serviceInfos.set( id, info);
	}

    return info;
}



/** Informs that a service with the given ID was published by the given node. */
function notifyServicePublished( publication: Publication): void
{
	let info = getOrCreateServiceInfo( publication.id);
	info.pubs.set( publication.vn, publication);

	// notify all subscriptions that information about the service has changed
	info.subs.forEach( subscription => subscription.notifyServiceChanged());
}



/** Informs that a service with the given ID was unpublished by the given node. */
function notifyServiceUnpublished( publication: Publication): void
{
	let info = s_serviceInfos.get( publication.id);
	if (!info)
		return;

	info.pubs.delete( publication.vn);

    // notify all subscribed nodes that information about the service has changed
	info.subs.forEach( subscription => subscription.notifyServiceChanged());
}



/** Informs that the given node has subscribed to a service with the given ID. */
function notifyServiceSubscribed( subscription: Subscription): void
{
	let info = getOrCreateServiceInfo( subscription.id);
	info.subs.set( subscription.vn, subscription);
}



/** Informs that the given node has unsubscribed from a service with the given ID. */
function notifyServiceUnsubscribed( subscription: Subscription): void
{
	let info = s_serviceInfos.get( subscription.id);
	if (!info)
		return;

	info.subs.delete( subscription.vn);
}



