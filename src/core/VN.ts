import * as mim from "../api/mim"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



// Use type DN to refer to DOM's Node class. The DOM nodes that we are dealing with are
// either of type Element or Text.
export type DN = Node;



/**
 * The VN interface defines properties and methods that are optionally implemented by all
 * types of virtual nodes.
 */
export interface VN extends mim.IVNode
{
	/// #if USE_STATS
		readonly statsCategory: StatsCategory;
	/// #endif

	/** Level of nesting at which the node resides relative to the root node. */
	depth?: number;

	/** DOM node under which all content of this virtual node is rendered. */
	anchorDN?: DN;

	/**
	 * Node's key. The derived classes set it based on their respective content. A key can be of
	 * any type.
	 */
	key?: any;

	/**
	 * Flag indicating whether this node (more precisely, nodes of this type) should always
	 * re-render during update even it is the same physical node instance. This is needed for
	 * nodes that serve as a proxy to a rendering function and that function must be invoked
	 * even none of the node parameters have changed.
	 */
	alwaysRenderOnUpdate?: boolean;

	/** Gets node's parent. This is undefined for the top-level (root) nodes. */
	parent?: VN;

	// Component that created this node as part of its rendering tree.
	creator?: mim.IComponent;

	// Reference to the next sibling node or undefined for the last sibling.
	next?: VN;

	// Reference to the previous sibling node or undefined for the first sibling.
	prev?: VN;

	/** List of sub-nodes. */
	subNodes?: VN[];

	// Map of keyed sub-nodes - defined only if the number of sub-nodes is greater than 1.
	keyedSubNodes?: Map<any,VN>;

	/**
	 * Update strategy object that determines different aspects of node behavior
	 * during updates.
	 */
	updateStrategy?: mim.UpdateStrategy;

	// Returns DOM node corresponding to the virtual node itself (if any) and not to any of its
	// sub-nodes.
	ownDN?: DN;

	// Flag indicating that update has been requested but not yet performed. This flag is needed
	// to prevent trying to add the node to the global map every time the requestUpdate method
	// is called. 
	updateRequested: boolean;

	// "Tick number" during which the node was last updated. If this node's tick number equals
	// the current tick number maintained by the root node, this indicates that this node was
	// already updated in this update cycle. This helps prevent double-rendering of a
	// component if both the component and its parent are updated in the same cycle.
	lastUpdateTick: number;



	// Initializes the node by passing the parent node to it. After this, the node knows its
	// place in the hierarchy and gets access to the root of it - the RootVN object.
	init( parent: VN, creator: mim.IComponent): void;

	// Cleans up the node object before it is released.
	term(): void;



	///////////////////////////////////////////////////////////////////////////////////////////////
	//
	// Life cycle methods
	//
	///////////////////////////////////////////////////////////////////////////////////////////////

	// Returns content that comprises the children of the node. If the node doesn't have
	// sub-nodes, null should be returned. If this method is not implemented that means the node
	// never has children - for example text nodes.
	// This method is part of the Render phase.
	render?(): any;

	// Initializes internal stuctures of the virtual node. This method is called right after the
	// node has been constructed.
	// This method is part of the Render phase.
	willMount?(): void;

	// Clears internal structures of the virtual node. This method is called before the content
	// of node and all its sub-nodes is removed from the DOM tree.
	// This method is part of the Commit phase.
	willUnmount?(): void;

	// Creates and returns DOM node corresponding to this virtual node. This method is implemented
	// only on nodes that have their own DOM nodes.
	// This method is part of the Commit phase.
	mount?(): DN;

	// Clears DOM node corresponding to this virtual node. This method is implemented only on nodes
	// that have their own DOM nodes. This method should only release the internally held reference
	// to the DOM node - the actual removal of the node from DOM is done by the infrastructure.
	// This method is part of the Commit phase.
	unmount?(): void;

	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node. If this method is
	// not implemented the update is considered possible - e.g. for text nodes.
	// This method is part of the Render phase.
	isUpdatePossible?( newVN: VN): boolean;

	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	prepareUpdate?( newVN: VN): VNUpdateDisp;

	// Commits updates made to this node to DOM.
	// This method is part of the Commit phase.
	commitUpdate?( newVN: VN): void;

	// Determines whether the node supports handling of errors; that is, exception thrown during
	// rendering of the node itself and/or its sub-nodes. If this method is not implemented the node
	// doesn't support error handling.
	// This method is part of the Render phase.
	supportsErrorHandling?(): boolean;

	// This method is called after an exception was thrown during rendering of the node itself
	// and/or its sub-nodes. The render method will be called after this method returns.
	// This method is part of the Render phase.
	handleError?( vnErr: any, path: string[]): void;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VNUpdateDisp type describes whether certain actions should be performed on the node
// during update. This object is returned from the node's prepareUpdate method.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class VNUpdateDisp
{
	// Falg indicatng whether the node has changes that should be applied to the DOM tree. If this
	// flag is true, then the commitUpdate method will be clled on the node during the Commit
	// phase.
	public readonly shouldCommit: boolean;

	// Falg indicatng whether the sub-nodes should be updated. If this flag is true, then the
	// node's render method will be immediately called.
	public readonly shouldRender: boolean;

	constructor( shouldCommit: boolean, shouldRender: boolean)
	{
		this.shouldCommit = shouldCommit;
		this.shouldRender = shouldRender;
	}

	public static DoCommitDoRender = new VNUpdateDisp( true, true);
	public static DoCommitNoRender = new VNUpdateDisp( true, false);
	public static NoCommitDoRender = new VNUpdateDisp( false, true);
	public static NoCommitNoRender = new VNUpdateDisp( false, false);

	public static getStockValue( shouldCommit: boolean, shouldRender: boolean)
	{
		return shouldCommit
			? shouldRender ? VNUpdateDisp.DoCommitDoRender : VNUpdateDisp.DoCommitNoRender
			: shouldRender ? VNUpdateDisp.NoCommitDoRender : VNUpdateDisp.NoCommitNoRender;
	}
};



// Returns the first DOM node defined by either this virtual node or one of its sub-nodes.
// This method is only called on the mounted nodes.
export function getFirstDN( vn: VN): DN
{
	if (vn.ownDN)
		return vn.ownDN;
	else if (!vn.subNodes)
		return null;

	// recursively call this method on the sub-nodes from first to last until a valid node
	// is returned
	let dn;
	for( let svn of vn.subNodes)
	{
		dn = getFirstDN( svn);
		if (dn)
			return dn;
	}

	return null;
}



// Returns the last DOM node defined by either this virtual node or one of its sub-nodes.
// This method is only called on the mounted nodes.
export function getLastDN( vn: VN): DN
{
	if (vn.ownDN)
		return vn.ownDN;
	else if (!vn.subNodes)
		return null;

	// recursively call this method on the sub-nodes from last to first until a valid node
	// is returned
	let dn;
	for( let i = vn.subNodes.length - 1; i >= 0; i--)
	{
		dn = getLastDN( vn.subNodes[i]);
		if (dn != null)
			return dn;
	}

	return null;
}



// Returns the list of DOM nodes that are immediate children of this virtual node; that is,
// are NOT children of sub-nodes that have their own DOM node. Never returns null.
export function getImmediateDNs( vn: VN): DN[]
{
	let arr: DN[] = [];
	collectImmediateDNs( vn, arr);
	return arr;
}



// Collects all DOM nodes that are immediate children of this virtual node (that is,
// are NOT children of sub-nodes that have their own DOM node) into the given array.
function collectImmediateDNs( vn: VN, arr: DN[]): void
{
	if (vn.ownDN)
		arr.push( vn.ownDN);
	else if (vn.subNodes)
	{
		// recursively call this method on the sub-nodes from first to last
		for( let svn of vn.subNodes)
			collectImmediateDNs( svn, arr);
	}
}



// Finds the first DOM node in the tree of virtual nodes that comes after our node that is a
// child of our own anchor element. We use it as a node before which to insert/move nodes of
// our sub-nodes during the reconciliation process. The algorithm first goes to the next
// siblings of our node and then to the next siblings of our parent node recursively. It stops
// when we either find a DOM node (then it is returned) or find a different anchor element
// (then null is returned). This method is called before the reconciliation process for our
// sub-nodes starts and, therefore, it only traverses mounted nodes.
export function getNextDNUnderSameAnchorDN( vn: VN, anchorDN: DN): DN
{
	// check if we have sibling DOM nodes after our last sub-node - that might be elements
	// not controlled by our component.
	if (vn.subNodes && vn.subNodes.length > 0)
	{
		let dn = getLastDN( vn.subNodes[vn.subNodes.length - 1]);
		if (dn)
		{
			let nextSibling = dn.nextSibling;
			if (nextSibling !== null)
				return nextSibling;
		}
	}

	// loop over our next siblings
	for( let nvn = vn.next; nvn !== undefined; nvn = nvn.next)
	{
		if (!nvn.anchorDN)
			return null;

		// note that getLastDN call traverses the hierarchy of nodes. Note also that it
		// cannot find a node under a different anchor element because the first different
		// anchor element will be returned as a wanted node.
		const dn = getLastDN( nvn);
		if (dn)
			return dn;
	}

	// recurse to our parent if exists
	return vn.parent && vn.parent.anchorDN === anchorDN ? getNextDNUnderSameAnchorDN( vn.parent, anchorDN) : null;
}



// Returns array of node names starting with this node and up until the top-level node.
export function getVNPath( vn: VN): string[]
{
	let depth = vn.depth;
	let path = Array<string>( depth);
	for( let i = 0, nvn: VN = vn; i < depth; i++, nvn = nvn.parent)
	{
		path[i] = nvn.name;
	}

	return path;
}



