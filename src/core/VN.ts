import {IComponent, RefPropType, IVNode, UpdateStrategy, TickSchedulingType, RefType} from "../api/CompTypes";

/// #if USE_STATS
    import {StatsCategory} from "../utils/Stats"
/// #endif

import { notifyServicePublished, notifyServiceUnpublished, notifyServiceSubscribed, notifyServiceUnsubscribed } from "./PubSub";
import { getCurrentClassComp, requestNodeUpdate } from "./Reconciler";
import { ChildrenUpdateRequest, DN, IVN, VNDisp } from "./VNTypes";





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
    constructor()
    {
        /// #if DEBUG
        this.debugID = g_nextVNDebugID++;
        /// #endif

        this.creator = getCurrentClassComp();
    }

	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public abstract get name(): string;

	// Parent node. This is null for the top-level (root) nodes.
	public parent?: VN;

    /** Only defined for class component nodes. */
    public comp?: IComponent;

    /** Class component that created this node in its render method (or undefined). */
    public creator?: IComponent;

	/**
     * Zero-based index of this node in the parent's list of sub-nodes. This is zero for the
     * root nodes that don't have parents.
     */
	public index?: number;

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



	///////////////////////////////////////////////////////////////////////////////////////////////
	//
	// Life cycle methods
	//
	///////////////////////////////////////////////////////////////////////////////////////////////

	/**
     * Recursively inserts the content of this virtual node to DOM under the given parent (anchor)
     * and before the given node.
     */
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN?: DN | null): void
    {
        if (!this.creator)
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
    }

	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node. If this method is
	// not implemented the update is considered possible - e.g. for text nodes.
	public isUpdatePossible?( newVN: IVN): boolean;

	/**
     * Recursively updates this node from the given node. This method is invoked only if update
     * happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
     * point to a VN of the same type as this node.
     */
	public abstract update( newVN: IVN, disp: VNDisp): void;

	// Returns content that comprises the children of the node. If the node doesn't have
	// sub-nodes, null should be returned. If this method is not implemented that means the node
	// never has children - for example text nodes.
	public render?(): any;

    // This method is called if the node requested a "partial" update. Different types of virtual
    // nodes can keep different data for the partial updates; for example, ElmVN can keep new
    // element properties that can be updated without re-rendering its children.
	public performPartialUpdate?(): void;



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



	// Level of nesting at which the node resides relative to the root node.
	public get depth(): number
    {
        let depth = 0;
        for( let p = this.parent; p; p = p.parent)
            depth++;

        return depth;
    }



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



	// Registers an object of any type as a service with the given ID that will be available for
	// consumption by descendant nodes.
	public publishService( id: string, service: any): void
	{
		if (this.publishedServices === undefined)
			this.publishedServices = new Map<string,any>();

		let existingService: any = this.publishedServices.get( id);
		if (existingService !== service)
		{
			this.publishedServices.set( id, service);
			notifyServicePublished( id, this);
		}
	}



	// Unregisters a service with the given ID.
	public unpublishService( id: string): void
	{
		if (this.publishedServices === undefined)
			return;

		this.publishedServices.delete( id);
		notifyServiceUnpublished( id, this);

		if (this.publishedServices.size === 0)
			this.publishedServices = undefined;
	}



	// Subscribes for a service with the given ID. If the service with the given ID is registered
	// by one of the ancestor nodes, the passed Ref object will reference it; otherwise,
	// the Ref object will be set to the defaultValue (if specified) or will remain undefined.
	// Whenever the value of the service that is registered by a closest ancestor node is
	// changed, the Ref object will receive the new value.
	public subscribeService( id: string, ref: RefPropType, defaultService?: any, useSelf?: boolean): void
	{
		if (this.subscribedServices === undefined)
			this.subscribedServices = new Map<string,VNSubscribedServiceInfo>();

		this.subscribedServices.set( id, { ref, defaultService, useSelf: useSelf ? true : false });
		notifyServiceSubscribed( id, this);
		setRef( ref, this.getService( id, defaultService));
}



	// Unsubscribes from a service with the given ID. The Ref object that was used to subscribe,
	// will be set to undefined.
	public unsubscribeService( id: string): void
	{
		let info = this.subscribedServices?.get( id);
		if (info === undefined)
			return;

        setRef( info.ref, undefined);
		this.subscribedServices.delete( id);
		notifyServiceUnsubscribed( id, this);

		if (this.subscribedServices.size === 0)
			this.subscribedServices = undefined;
	}



	// Retrieves the value for a service with the given ID registered by a closest ancestor
	// node or the default value if none of the ancestor nodes registered a service with
	// this ID. This method doesn't establish a subscription and only reflects the current state.
	public getService( id: string, defaultService?: any, useSelf?: boolean): any
	{
        // not that only undefined return value serves as the indication that the service was not
        // found. All other values including empty string, zero and false are valid service values.
		let service = this.findService( id, useSelf);
		return service ?? defaultService;
	}



	// Goes up the chain of nodes looking for a published service with the given ID. Returns
	// undefined if the service is not found. Note that null might be a valid value.
	private findService( id: string, useSelf?: boolean): any
	{
		if (useSelf)
		{
            let service = this.publishedServices?.get( id);
            if (service !== undefined)
                return service;
		}

		// go up the chain; note that we don't pass the useSelf parameter on.
		return this.parent?.findService( id, true);
	}



	// Notifies the node that publication information about the given service (to which the node
	// has previously subscribed) has changed.
	public notifyServiceChanged( id: string): void
	{
		let info = this.subscribedServices?.get( id);
		if (info === undefined)
			return;

		setRef( info.ref, this.getService( id, info.defaultService));
	}



	// Map of service IDs to service objects published by this node.
	private publishedServices: Map<string,any>;

	// Map of service IDs to objects constituting subscriptions made by this node.
	private subscribedServices: Map<string,VNSubscribedServiceInfo>;

	/// #if USE_STATS
    public abstract get statsCategory(): StatsCategory;
	/// #endif

    /// #if DEBUG
    private debugID: number;
	/// #endif
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



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VNSubscribedServiceInfo class keeps information about a subscription of a node to a service.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
type VNSubscribedServiceInfo =
{
	// Reference that will be filled in with the service value
	ref: RefPropType<any>;

	// Default value of the service that is used if none of the ancestor nodes publishes the
	// service
	defaultService: any;

	// Flag indicating whether a node can subscribe to a service that it implements itself. This
	// is useful in case where a service that is implemented by a component can chain to a service
	// implemented by an ancestor component.
	useSelf: boolean;
}



/**
 * Symbol that is attached to a render function to indicate that it should not be wrapped in a
 * watcher.
 */
export let symRenderNoWatcher = Symbol();



