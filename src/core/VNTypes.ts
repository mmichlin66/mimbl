import {DN, IComponent, IVNode, UpdateStrategy, TickSchedulingType} from "../api/CompTypes";

/// #if USE_STATS
    import {StatsCategory} from "../utils/Stats"
/// #endif



export interface IVN extends IVNode
{
	/** Gets node's parent. This is undefined for the top-level (root) nodes. */
	parent?: IVN | null;

	/** Component that created this node in its render method (or undefined). */
	creator?: IComponent | null;

	/**
     * Zero-based index of this node in the parent's list of sub-nodes. This is zero for the
     * root nodes that don't have parents.
     */
	index: number;

	/** List of sub-nodes. */
	subNodes?: IVN[] | null;

    /** Only defined for class component nodes. */
    comp?: IComponent | null;

	// DOM node under which all content of this virtual node is rendered.
	anchorDN?: DN;

	/**
	 * Node's key. The derived classes set it based on their respective content. A key can be of
	 * any type.
	 */
    key?: any;

	/**
	 * Update strategy object that determines different aspects of node behavior
	 * during updates.
	 */
    updateStrategy?: UpdateStrategy;

	/**
     * Returns DOM node corresponding to the virtual node itself (if any) and not to any of its
     * sub-nodes.
     */
	ownDN?: DN;

	/**
     * Flag indicating that update has been requested but not yet performed. This flag is needed
     * to prevent trying to add the node to the global map every time the requestUpdate method
     * is called.
     */
	updateRequested?: boolean;

	/**
     * "Tick number" during which the node was last updated. If this node's tick number equals
     * the current tick number maintained by the root node, this indicates that this node was
     * already updated in this update cycle. This helps prevent double-rendering of a
     * component if both the component and its parent are updated in the same cycle.
     */
	lastUpdateTick?: number;



	/**
     * Recursively inserts the content of this virtual node to DOM under the given parent (anchor)
     * and before the given node.
     */
	mount(parent: IVN | null, index: number, anchorDN: DN, beforeDN: DN): void;

    /**
     * Recursively removes the content of this virtual node from DOM.
     */
	unmount(removeFromDOM: boolean): void;

    /**
     * This method is called if the node requested an update. Different types of virtual
     * nodes can keep different data for updates; for example, ElmVN can keep new element
     * properties that can be updated without re-rendering its children.
     */
	update?(): void;

	/**
     * Determines whether the this node can be reconciled with the given node. The newVN parameter
     * is guaranteed to point to a VN of the same type as this node. If this method is not
     * implemented the update is considered possible - e.g. for text nodes.
     */
	canReconcile?(newVN: IVN): boolean;

	/**
     * Recursively updates this node from the given node. This method is invoked only if update
     * happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
     * point to a VN of the same type as this node.
     */
	reconcile?(newVN: IVN, disp: VNDisp): void;

	/**
     * Returns content that comprises the children of the node. If the node doesn't have
     * sub-nodes, null should be returned. If this method is not implemented that means the node
     * never has children - for example text nodes.
     */
	render?(): any;



    /** Determines whether the node is currently mounted */
	readonly isMounted: boolean;



    /**
     * Returns the first DOM node defined by either this virtual node or one of its sub-nodes.
     * This method is only called on the mounted nodes.
     */
    getFirstDN(): DN;

    /**
     * Returns the last DOM node defined by either this virtual node or one of its sub-nodes.
     * This method is only called on the mounted nodes.
     */
    getLastDN(): DN;

    /**
     * Returns the list of DOM nodes that are immediate children of this virtual node; that is, are
     * NOT children of sub-nodes that have their own DOM node. May return null but never returns
     * empty array.
     */
    getImmediateDNs(): DN[] | null;



    /**
     * Schedules an update for this node.
     */
	requestUpdate(schedulingType?: TickSchedulingType): void;



	/// #if USE_STATS
    statsCategory: StatsCategory;
	/// #endif
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
	oldVN?: IVN;

	/** New virtual node to insert or from which to update an old node. */
	newVN?: IVN;

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
	toRemove?: IVN[];

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
	last: number;

	/** Number of nodes in the group. */
	count: number;

	/** First DOM node in the group - will be known after the nodes are physically updated */
	firstDN?: DN;

	/** First DOM node in the group - will be known after the nodes are physically updated */
	lastDN?: DN;
}



