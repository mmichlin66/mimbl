import {DN, VN, VNUpdateDisp} from "./VN"
import {createVNChainFromContent} from "./VNChainFuncs"



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
	/** Action to be performed on the node */
	public action: VNDispAction;

	/** New virtual node to insert or to update an old node */
	public newVN: VN;

	/** Old virtual node to be updated. This is not used for the Insert action. */
	public oldVN: VN;

	/** Disposition flags for the Update action. This is not used for the Insert actions. */
	public updateDisp: VNUpdateDisp;

	/** Array of sub-nodes that should be removed during update of the sub-nodes. */
	public subNodesToRemove: VN[] = [];

	/**
	 * Array of disposition objects for sub-nodes. This includes nodes to be updated
	 * and to be inserted.
	 */
	public subNodeDisps: VNDisp[] = [];

	/** Array of groups of sub-nodes that should be updated or inserted. */
	public subNodeGroups: VNDispGroup[];

	/**
	 * If the node has more than this number of sub-nodes, then we build groups. The idea is that
	 * otherwise, the overhead of building the groups is not worth it.
	 */
	private static readonly NO_GROUP_THRESHOLD = 1;



	/**
	 * Compares old and new chains of sub-nodes and determines what nodes should be created, deleted
	 * or updated. The result is remembered as an array of VNDisp objects for each sub-node and as
	 * array of old sub-nodes that should be deleted. In addition, the new sub-nodes are divided
	 * into groups of consecutive nodes that should be updated and of nodes that should be inserted.
	 * The groups are built in a way so that if a node should be moved, its entire group is moved.
	 */
	public buildSubNodeDispositions(): void
	{
		// render the new content;
		let newChain = createVNChainFromContent( this.action === VNDispAction.Insert
						? this.newVN.render() : this.oldVN.render());

		// loop over new nodes and fill an array of VNDisp objects in the parent disp. At the same
		// time, build a map that includes all new nodes that have keys. The values are VNDisp objects.
		let newKeyedNodeMap = new Map<any,VNDisp>();
		for( let newVN = newChain.first; newVN !== null; newVN = newVN.next)
		{
			let subNodeDisp = new VNDisp();
			subNodeDisp.newVN = newVN;
			this.subNodeDisps.push( subNodeDisp);
			if (newVN.key !== undefined)
				newKeyedNodeMap.set( newVN.key, subNodeDisp);
		}

		// loop over old nodes and put those that have keys matching new nodes into the new nodes' VNDisp
		// objects. Put those that don't have keys or that have keys that don't match any new node to
		// an array of non-matching old nodes
		let oldNonMatchingNodeList: VN[] = [];
		let oldChain = this.oldVN.subNodes;
		for( let oldVN = oldChain.first; oldVN !== null; oldVN = oldVN.next)
		{
			if (oldVN.key === undefined)
				oldNonMatchingNodeList.push( oldVN);
			else
			{
				let subNodeDisp = newKeyedNodeMap.get( oldVN.key);
				if (subNodeDisp)
				{
					subNodeDisp.oldVN = oldVN;
					subNodeDisp.action = VNDispAction.Update;
				}
				else
					oldNonMatchingNodeList.push( oldVN);
			}
		}

		// by now we have all old and new nodes with the same keys matched to one another. Now loop
		// over new node dispositions and match the not-yet-matched ones (those with Unknown action)
		// to old nodes sequentially from the list of non-matched old nodes.
		let oldNonMatchingNodeListLength: number = oldNonMatchingNodeList.length;
		let oldNonMatchingNodeListIndex: number = 0;
		for( let subNodeDisp of this.subNodeDisps)
		{
			if (subNodeDisp.action)
				continue;

			let oldVN: VN;
			if (oldNonMatchingNodeListIndex < oldNonMatchingNodeListLength)
			{
				let oldVN = oldNonMatchingNodeList[oldNonMatchingNodeListIndex];
				let newVN = subNodeDisp.newVN;
				if (oldVN.type === newVN.type && oldVN.isUpdatePossible( newVN))
				{
					// we are here if the new node can update the old one
					subNodeDisp.oldVN = oldVN;
					subNodeDisp.action = VNDispAction.Update;
				}
				else
				{
					// we are here if the new node cannot update the old one and shold completely
					// replace it. We add the old node to the list of those to be removed and indicate
					// that the new node should be mounted.
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
		for( let i = oldNonMatchingNodeListIndex; i < oldNonMatchingNodeListLength; i++)
			this.subNodesToRemove.push( oldNonMatchingNodeList[i]);

		if (this.subNodeDisps.length > VNDisp.NO_GROUP_THRESHOLD)
			this.buildSubNodeGroups();
	}



	/**
	 * From a flat list of new sub-nodes builds groups of consecutive nodes that should be either
	 * updated or inserted.
	 */
	private buildSubNodeGroups(): void
	{
		let count = this.subNodeDisps.length;

		/// #if DEBUG
			// this method is not supposed to be called if the number of sub-nodes is less then
			// the pre-determined threshold
			if (count === VNDisp.NO_GROUP_THRESHOLD)
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
				// the nex iteration will open a new group. Note that we cannot be here for a node
				// that starts a new group because for such node disp.action === groupAction.
				group.last = --i;
				group = undefined;
			}
			else if (group.action === VNDispAction.Update)
			{
				// an "update" node is out-of-order and should close the current group if its next
				// sibling in the new list is different from the next sibling in the old list. The
				// last node will close the last group after the loop.
				if (i !== lastDispIndex && this.subNodeDisps[i+1].oldVN !== disp.oldVN.next)
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



