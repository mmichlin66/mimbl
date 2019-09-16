import {DN, VN, VNUpdateDisp} from "./VN"
import {createVNChainFromContent} from "./ContentFuncs"
import { VNType, UpdateStrategy } from "./mim";



/**
 * The VNAction enumeration specifies possible actions to perform for new nodes during
 * reconciliation process.
 */
export const enum VNDispAction
{
	/**
	 * Either it is not yet known what to do with the node itself or this is a component node,
	 * for which an update was requested; that is, only the node's children should be updated.
	 */
	Unknown = 0,

	/**
	 * The new node should be inserted. This means that either there was no counterpart old node
	 * found or the found node cannot be used to update the old one nor can the old node be reused
	 * by the new one (e.g. of different type).
	 */
	Insert = 1,

	/** The new node should be used to update the old node. */
	Update = 2,
}



/**
 * The VNDispGroup class describes a group of consecutive VNDisp objects correspponding to the
 * sequence of sub-nodes. The group is described using indices of VNDisp objects in the
 * subNodeDisp field of the parent VNDisp object.
 */
export class VNDispGroup
{
	/** parent VNDisp to which this group belongs */
	public parentDisp: VNDisp;
	
	/** Action to be performed on the nodes in the group */
	public action: VNDispAction;

	/** Index of the first VNDisp in the group */
	public first: number;

	/** Index of the last VNDisp in the group */
	public last: number;

	/** Number of nodes in the group. */
	public get count(): number { return this.last - this.first + 1 };

	/** First DOM node in the group - will be known after the nodes are physically updated */
	public firstDN: DN;

	/** First DOM node in the group - will be known after the nodes are physically updated */
	public lastDN: DN;



	constructor( parentDisp: VNDisp, action: VNDispAction)
	{
		this.parentDisp = parentDisp;
		this.action = action;
	}



	/**
	 * Determines first and last DOM nodes for the group. This method is invoked only after the
	 * nodes were phisically updated/inserted and we can obtain their DOM nodes.
	 */
	public determineDNs()
	{
		for( let i = this.first; i <= this.last; i++)
		{
			let disp = this.parentDisp.subNodeDisps[i];
			let vn = this.action === VNDispAction.Insert ? disp.newVN : disp.oldVN;
			this.firstDN = vn.getFirstDN();
			if (this.firstDN)
				break;
		}

		for( let i = this.last; i >= this.first; i--)
		{
			let disp = this.parentDisp.subNodeDisps[i];
			let vn = this.action === VNDispAction.Insert ? disp.newVN : disp.oldVN;
			this.lastDN = vn.getLastDN();
			if (this.lastDN)
				break;
		}
	}
}



/**
 * The VNDisp class is a recursive structure that describes a disposition for a node and its
 * sub-nodes during the reconciliation process.
 */
export class VNDisp
{
	constructor( newVN: VN, action = VNDispAction.Unknown, oldVN?: VN)
	{
		this.action = action;
		this.newVN = newVN;
		this.oldVN = oldVN;
	}

	/** Action to be performed on the node */
	public action: VNDispAction;

	/** New virtual node to insert or to update an old node */
	public newVN: VN;

	/** Old virtual node to be updated. This is not used for the Insert action. */
	public oldVN: VN;

	/**
	 * Next virtual node after the old virtual node to be updated. This is not used to understand
	 * whether and where the DOM node should be moved.. This is not used for the Update action.
	 */
	public oldNextVN: VN;

	/** Disposition flags for the Update action. This is not used for the Insert actions. */
	public updateDisp: VNUpdateDisp;

	/** Array of sub-nodes that should be removed during update of the sub-nodes. */
	public subNodesToRemove: VN[];

	/**
	 * Array of disposition objects for sub-nodes. This includes nodes to be updated
	 * and to be inserted.
	 */
	public subNodeDisps: VNDisp[];

	/** Array of groups of sub-nodes that should be updated or inserted. */
	public subNodeGroups: VNDispGroup[];

	/**
	 * If the node has more than this number of sub-nodes, then we build groups. The idea is that
	 * otherwise, the overhead of building groups is not worth it.
	 */
	private static readonly NO_GROUP_THRESHOLD = 10;



	/**
	 * Compares old and new chains of sub-nodes and determines what nodes should be created, deleted
	 * or updated. The result is remembered as an array of VNDisp objects for each sub-node and as
	 * array of old sub-nodes that should be deleted. In addition, the new sub-nodes are divided
	 * into groups of consecutive nodes that should be updated and of nodes that should be inserted.
	 * The groups are built in a way so that if a node should be moved, its entire group is moved.
	 */
	public buildSubNodeDispositions(): void
	{
		// render the new content. Whether we use the old or the new node for rendering depends on
		// several factors
		//  - if it is an Insert action, then use the new node (old node isn't even available).
		//  - if it is an Update operation, then for all types of nodes except InstanceVN, use
		//    the old node. For InstanceVN use the new node because the old node is still pointing
		//    to the old component instance. We also rely on the fact that for the stem nodes, we
		//    have both old and new nodes pointing to the same node.
		let newChain = createVNChainFromContent(
				this.action === VNDispAction.Insert || this.oldVN.type === VNType.InstanceComp
					? this.newVN.render() : this.oldVN.render());
		let oldChain = this.oldVN.subNodes;

		// if either old or new or both chains are empty, we do special things
		if ((!newChain || newChain.length === 0) && (!oldChain || oldChain.length === 0))
		{
			// both chain are empty - do nothing
			return;
		}
		else if (!newChain || newChain.length === 0)
		{
			// new chain is empty - just delete all old nodes
			this.subNodesToRemove = oldChain.slice();
			return;
		}
		else if (!oldChain || oldChain.length === 0)
		{
			// old chain is empty - just insert all new nodes
			this.subNodeDisps = newChain.map( newVN => new VNDisp( newVN, VNDispAction.Insert));
			return;
		}

		// we are here if both old and new chains contain some nodes. Loop over new nodes and fill
		// an array of VNDisp objects for subNodes. At the same time, build a map that includes all
		// new nodes that have keys. The values are VNDisp objects.
		this.subNodeDisps = new Array( newChain.length);
		let newKeyedNodeMap: Map<any,VNDisp>;
		let i = 0;
		for( let newVN of newChain)
		{
			let subNodeDisp = new VNDisp( newVN);
			this.subNodeDisps[i++] = subNodeDisp;
			if (newVN.key !== undefined)
			{
				if (!newKeyedNodeMap)
					newKeyedNodeMap = new Map<any,VNDisp>();

				newKeyedNodeMap.set( newVN.key, subNodeDisp);
			}
		}

		// determine whether replacement of non-matching old keyed sub-nodes by non-matching new
		// keyed sub-nodes is allowed. If update strategy is not defined for the node, the
		// replacement is allowed.
		let allowKeyedSubNodeReplacement = true;
		let updateStrategy = this.oldVN ? this.oldVN.getUpdateStrategy() : undefined;
		if (updateStrategy && updateStrategy.allowKeyedSubNodeReplacement !== undefined)
			allowKeyedSubNodeReplacement = updateStrategy.allowKeyedSubNodeReplacement;

		// loop over old nodes and put those that have keys matching new nodes into the new nodes' VNDisp
		// objects. Put those that don't have keys or that have keys that don't match any new node to
		// an array of non-matching old nodes. Note that even when we find old and new nodes with
		// matching keys, we still check whether they are of the same type and update is possible. This
		// is to handle situations when developers erroneously put matching keys on different types
		// of nodes.
		let oldNonMatchingNodeList: VN[];
		let matchedNewNodesCount = 0;
		for( let i = 0; i < oldChain.length; i++)
		{
			let oldVN = oldChain[i];
			if (oldVN.key === undefined)
			{
				if (!oldNonMatchingNodeList)
					oldNonMatchingNodeList = [];

				oldNonMatchingNodeList.push( oldVN);
			}
			else
			{
				let subNodeDisp = newKeyedNodeMap ? newKeyedNodeMap.get( oldVN.key) : undefined;
				if (subNodeDisp && (oldVN === subNodeDisp.newVN ||
					oldVN.type === subNodeDisp.newVN.type && oldVN.isUpdatePossible( subNodeDisp.newVN)))
				{
					subNodeDisp.oldVN = oldVN;
					subNodeDisp.action = VNDispAction.Update;

					// remember the next old node after the old node being updated - this will be
					// needed to understand whether the DOM node needs to be moved
					if (i < oldChain.length - 1)
						subNodeDisp.oldNextVN = oldChain[i+1];

					matchedNewNodesCount++;
				}
				else if (allowKeyedSubNodeReplacement)
				{
					if (!oldNonMatchingNodeList)
						oldNonMatchingNodeList = [];
						
					oldNonMatchingNodeList.push( oldVN);
				}
				else
				{
					// if replacement of keyed nodes is not allowed, the non-matched old node is removed
					if (!this.subNodesToRemove)
						this.subNodesToRemove = [];

					this.subNodesToRemove.push( oldVN);
				}
			}
		}

		// By now we have all old and new nodes with the same keys matched to one another. If not all
		// new nodes are matched yet, we either try to match them with non-keyed ald nodes if the
		// update strategy allows this or mark them for insertion. Replacement of unkeyed old nodes by
		// unkeyed new nodes is always allowed. If replacement of keyed nodes is allowed, we match the
		// not-yet-matched ones (those with Unknown action) to old nodes sequentially from the list
		// of non-matched old nodes. Replacement matching only works if the types of the old and
		// the new nodes are the same and the old node's isUpdatePossible returns true. If
		// replacement of keyed nodes is not allowed, the new ones are inserted. Note that in this
		// case, the oldNonMatchingNodeList doesn't contain keyed old nodes - they were already
		// placed into the subNodesToRemove array.
		if (matchedNewNodesCount < this.subNodeDisps.length)
		{
			let oldNonMatchingNodeListLength = !oldNonMatchingNodeList ? 0 : oldNonMatchingNodeList.length;
			let oldNonMatchingNodeListIndex = 0;
			for( let subNodeDisp of this.subNodeDisps)
			{
				// skip already matched nodes
				if (subNodeDisp.action)
					continue;

				// we allow replcement by non-keyed nodes or by keyed nodes if the "allow replacement"
				// flag is true.
				if ((!subNodeDisp.newVN.key || allowKeyedSubNodeReplacement) &&
					oldNonMatchingNodeListIndex < oldNonMatchingNodeListLength)
				{
					let oldVN = oldNonMatchingNodeList[oldNonMatchingNodeListIndex];
					if (oldVN.type === subNodeDisp.newVN.type && oldVN.isUpdatePossible( subNodeDisp.newVN))
					{
						// we are here if the new node can update the old one
						subNodeDisp.oldVN = oldVN;
						subNodeDisp.action = VNDispAction.Update;
					}
					else
					{
						// we are here if the new node cannot update the old one and should completely
						// replace it. We add the old node to the list of those to be removed and indicate
						// that the new node should be inserted.
						if (!this.subNodesToRemove)
							this.subNodesToRemove = [];

						this.subNodesToRemove.push( oldVN);
						subNodeDisp.action = VNDispAction.Insert;
					}

					oldNonMatchingNodeListIndex++;
				}
				else
				{
					// we are here if there are no non-matched old nodes left. Indicate that the new node
					// should be mounted.
					subNodeDisp.action = VNDispAction.Insert;
				}
			}

			// old non-matched nodes from the current index to the end of the list will be unmounted
			if (oldNonMatchingNodeListIndex < oldNonMatchingNodeListLength)
			{
				if (!this.subNodesToRemove)
					this.subNodesToRemove = [];
					
				for( let i = oldNonMatchingNodeListIndex; i < oldNonMatchingNodeListLength; i++)
					this.subNodesToRemove.push( oldNonMatchingNodeList[i]);
			}
		}

		if (this.subNodeDisps.length > VNDisp.NO_GROUP_THRESHOLD)
			this.buildSubNodeGroups();
	}



	/**
	 * From a flat list of new sub-nodes builds groups of consecutive nodes that should be either
	 * updated or inserted.
	 */
	private buildSubNodeGroups(): void
	{
		// we are here only if we have some number of sub-node dispositions
		let count = this.subNodeDisps.length;

		/// #if DEBUG
			// this method is not supposed to be called if the number of sub-nodes is less then
			// the pre-determined threshold
			if (count <= VNDisp.NO_GROUP_THRESHOLD)
				return;
		/// #endif

		this.subNodeGroups = [];

		// loop over sub-nodes and on each iteration decide whether we need to open a new group
		// or put the current node into the existing group or close the existing group and open
		// a new one.
		let group: VNDispGroup;
		let lastDispIndex = count - 1;
		for( let i = 0; i < count; i++)
		{
			let disp = this.subNodeDisps[i];
			if (!group)
			{
				// open a new group
				group = new VNDispGroup( this, disp.action);
				group.first = i;
				this.subNodeGroups.push( group);
			}

			if (disp.action !== group.action)
			{
				// close the group with the previous index. Decrement the iterating index so that
				// the next iteration will open a new group. Note that we cannot be here for a node
				// that starts a new group because for such node disp.action === groupAction.
				group.last = --i;
				group = undefined;
			}
			else if (group.action === VNDispAction.Update)
			{
				// an "update" node is out-of-order and should close the current group if its next
				// sibling in the new list is different from the next sibling in the old list. The
				// last node will close the last group after the loop.
				if (i !== lastDispIndex && this.subNodeDisps[i+1].oldVN !== disp.oldNextVN)
				{
					// close the group with the current index.
					group.last = i;
					group = undefined;
				}
			}

			// all consecutive "insert" nodes belong to the same group so we just wait for the
			// next node
		}

		// close the last group
		group.last = count - 1;
	}
}



