import {IComponent, RefPropType, IVNode, UpdateStrategy, TickSchedulingType, RefType} from "../api/CompTypes";

/// #if USE_STATS
    import {StatsCategory} from "../utils/Stats"
/// #endif

import {
    notifyServiceUnpublished, notifyServiceUnsubscribed, requestNodeUpdate,
    notifyServicePublished, notifyServiceSubscribed, getCurrentClassComp
} from "../internal";





// Use type DN to refer to DOM's Node class. The DOM nodes that we are dealing with are
// either of type Element or Text.
export type DN = Node;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VNBase class is a base class for all types of virtual nodes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/// #if DEBUG
    let g_nextVNDebugID = 1;
/// #endif

export abstract class VN implements IVNode
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
	public isUpdatePossible?( newVN: VN): boolean;

	/**
     * Recursively updates this node from the given node. This method is invoked only if update
     * happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
     * point to a VN of the same type as this node.
     */
	public abstract update( newVN: VN, disp: VNDisp): void;

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



/**
 * The VNAction enumeration specifies possible actions to perform for sub-nodes during
 * reconciliation process.
 */
export const enum VNDispAction
{
	/**
	 * The new node should be inserted. This means that either there was no counterpart old node
	 * found or the found node cannot be used to update the old one nor can the old node be reused
	 * by the new one (e.g. they are of different type).
	 */
	Insert = 1,

	/**
	 * The new node should be used to update the old node.
	 */
	Update = 2,

	/**
	 * The new node is the same as the old node.
	 */
	NoChange = 3,
}



/**
 * The VNDisp class is a recursive structure that describes a disposition for a node and its
 * sub-nodes during the reconciliation process.
 */
export type VNDisp =
{
	/** Old virtual node to be updated. This can be null only for the Insert action. */
	oldVN?: VN;

	/** New virtual node to insert or from which to update an old node. */
	newVN?: VN;

	/** Action to be performed on the node */
	action?: VNDispAction;

    /** Start index in the old array of sub-nodes; if undefined, 0 is used. */
    oldStartIndex?: number;

    /** End index in the old array of sub-nodes; if undefined, the array length is used. */
    oldEndIndex?: number;

    /** Length of the (sub-)array of old sub-nodes. */
    oldLength?: number;

    /** Update strategy object; if undefined, the update strategy from the oldVN is used. */
    updateStrategy?: UpdateStrategy;

    /**
     * Flag indicating that no action should be taken; that is, the new sub-nodes are the same
     * as old ones.
     */
	noChanges?: boolean;

    /**
     * Flag indicating that all old sub-nodes are being updated or removed. This is true if
     * oldLength === oldSubNodes.length
     */
    allProcessed?: boolean;

    /**
     * Flag indicating that all old sub-nodes should be deleted and all new sub-nodes inserted.
     * If this flag is set, the subNodeDisps, subNodesToRemove and subNodeGroups fields are
     * ignored.
     */
	replaceAll?: boolean;

	/**
	 * Array of disposition objects for sub-nodes. This includes nodes to be updated
	 * and to be inserted.
	 */
	subDisps?: VNDisp[];

	/** Array of sub-nodes that should be removed during update of the sub-nodes. */
	toRemove?: VN[];

	/** Array of groups of sub-nodes that should be updated or inserted. */
	subGroups?: VNDispGroup[];
}



/**
 * The VNDispGroup class describes a group of consecutive VNDisp objects correspponding to the
 * sequence of sub-nodes. The group is described using indices of VNDisp objects in the
 * subNodeDisp field of the parent VNDisp object.
 */
export interface VNDispGroup
{
	/** Action to be performed on the nodes in the group */
	action: VNDispAction;

	/** Index of the first VNDisp in the group */
	first: number;

	/** Index of the last VNDisp in the group */
	last?: number;

	/** Number of nodes in the group. */
	count?: number;

	/** First DOM node in the group - will be known after the nodes are physically updated */
	firstDN?: DN;

	/** First DOM node in the group - will be known after the nodes are physically updated */
	lastDN?: DN;
}



/**
 * The UpdateOperation enumeration lists various operations of how the sub-nodes of a virtual
 * node can be updated. When nodes request update they specify the operation and if needed provide
 * operation specific parameters.
 */
export const enum ChildrenUpdateOperation
{
    /**
     * The node's existing sub-nodes are reconciled with new content. The parameters contain the
     * new content.
     */
    Update = 0,

    /**
     * The new content is replacing existing children. No parameters are required. The existing
     * sub-nodes are unmounted and the new sub-nodes are mounted (no updates are performed).
     */
    Set = 1,

    /**
     * Retains the given range of the sub-nodes unmounting the sub-nodes outside the given range.
     */
    Slice = 2,

    /**
     * A range of existing sub-nodes is removed and the new ones added. The parameters contain the
     * new content that is used to generate the new list of sub-nodes and, optionally, a range of
     * indices defining the sub-nodes that are replaced. An additional flag determines whether the
     * existing nodes are unmounted or updates are allowed.
     */
    Splice = 3,

    /**
     * A range of existing sub-nodes is moved to a new location. The parameters contain the index
     * and the length of the range and the index of the new location. The new index cannot be
     * within the range.
     */
    Move = 4,

    /**
     * Two ranges of existing sub-nodes change their locations. The parameters contain the indices
     * and the lengths of the two ranges. The ranges cannot intersect.
     */
    Swap = 5,

    /**
     * Remove sub-nodes from the start and/or the end of the list. The parameters contain
     * the number of nodes to remove from the start and the number of nodes to remove from the end.
     * If only single number is give it is used for both the start and the end.
     */
    Trim = 6,

    /**
     * Add sub-nodes at the start and/or the end of the list. The parameters contain
     * the content to add at the start and the content to add at the end.
     */
    Grow = 7,

    /**
     * Reverse sub-nodes within the given range. The parameter define the start and end indices
     * of the range.
     */
    Reverse = 8,
}



/** Parameters for the Set request */
export type SetRequest =
{
    op?: ChildrenUpdateOperation.Set;

    // Content to replace the given range.
    content?: any;

    // Index of the first sub-node in the range to be replaced by the new content. If undefined,
    // the default value is 0.
    startIndex?: number;

    // Index after the last sub-node in the range to be replaced by the new content. If undefined,
    // the range includes all sub-nodes from startIndex to the end.
    endIndex?: number;

    // Flag indicating whether the old sub-nodes are unmounted or are allowed to be updated
    update?: boolean

    // Update strategy to use when updating nodes. If this parameter is undefined, the update
    // strategy of the node itself is used.
    updateStrategy?: UpdateStrategy;
}



/** Parameters for the Splice request */
export type SpliceRequest =
{
    op?: ChildrenUpdateOperation.Splice;

    // Index at which splicing starts
    index: number;

    // Number of sub-nodes to be deleted (or updated)
    countToDelete?: number;

    // New content to insert (or update the old sub-nodes)
    contentToInsert?: any;
}



/** Parameters for the Move request */
export type MoveRequest =
{
    op?: ChildrenUpdateOperation.Move;

    /** Starting index of the region being moved */
    index: number;

    /** Number of nodes in the region being moved */
    count: number;

    /** Positive or negative distance of the move */
    shift: number;
}



/** Parameters for the Swap request */
export type SwapRequest =
{
    op?: ChildrenUpdateOperation.Swap;

    /** Start index of the first range */
    index1: number;

    /** Number of sub-nodes in the first range */
    count1: number;

    /** Start index of the second range */
    index2: number

    /** Number of sub-nodes in the second range */
    count2: number;
}



/** Parameters for the Slice request */
export type SliceRequest =
{
    op?: ChildrenUpdateOperation.Slice;

    // Index of the first sub-node in the range
    startIndex: number;

    // Index after the last sub-node in the range
    endIndex?: number;
}



/** Parameters for the Trim request */
export type TrimRequest =
{
    op?: ChildrenUpdateOperation.Trim;

    /** Number of sub-nodes to remove at the start */
    startCount: number;

    /** Number of sub-nodes to remove at the end */
    endCount: number;
}



/** Parameters for the Grow request */
export type GrowRequest =
{
    op?: ChildrenUpdateOperation.Grow;

    /** Content to add at the start */
    startContent?: any;

    /** Content to add at the end */
    endContent?: any;
}



/** Parameters for the Reverse request */
export type ReverseRequest =
{
    op?: ChildrenUpdateOperation.Reverse;

    // Index of the first sub-node in the range
    startIndex: number;

    // Index after the last sub-node in the range
    endIndex?: number;
}



/** Parameters for the Grow request */
export type ChildrenUpdateRequest = SetRequest | SpliceRequest | MoveRequest | SwapRequest |
    SliceRequest | TrimRequest | GrowRequest | ReverseRequest;



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



/**
 * Symbol used to set a "toVNs" function to certain classes. This function converts the instances
 * of these classes to a VN or an array of VNs.
 */
export let symToVNs = Symbol("toVNs");



/**
 * Symbol used to set a "jsxToVNs" function to certain classes. This function converts the instances
 * of these classes to a VN or an array of VNs.
 */
export let symJsxToVNs = Symbol("jsxToVNs");



