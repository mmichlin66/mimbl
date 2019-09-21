import {DN, VN, VNUpdateDisp} from "./VN"
import {createVNChainFromContent} from "./ContentFuncs"



/**
 * The VNAction enumeration specifies possible actions to perform for new nodes during
 * reconciliation process.
 */
export const enum VNDispAction
{
	/**
	 * Either it is not yet known what to do with the node itself or this is a stem node; that is,
	 * only the node's children should be updated.
	 */
	Unknown = 0,

	/**
	 * The new node should be inserted. This means that either there was no counterpart old node
	 * found or the found node cannot be used to update the old one nor can the old node be reused
	 * by the new one (e.g. they are of different type).
	 */
	Insert = 1,

	/**
	 * The new node should be used to update the old node. This value is also used for InstanceVN
	 * nodes if the old and the new are the same node.
	 */
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
		let disp: VNDisp;
		let vn: VN;
		for( let i = this.first; i <= this.last; i++)
		{
			disp = this.parentDisp.subNodeDisps[i];
			vn = this.action === VNDispAction.Update ? disp.oldVN : disp.newVN;
			this.firstDN = vn.getFirstDN();
			if (this.firstDN)
				break;
		}

		for( let i = this.last; i >= this.first; i--)
		{
			disp = this.parentDisp.subNodeDisps[i];
			vn = this.action === VNDispAction.Update ? disp.oldVN : disp.newVN;
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

	/** Old virtual node to be updated. This is only used for the Update action. */
	public oldVN: VN;

	/** Disposition flags for the Update action. This is not used for the Insert actions. */
	public updateDisp: VNUpdateDisp;

	/**
	 * Array of disposition objects for sub-nodes. This includes nodes to be updated
	 * and to be inserted.
	 */
	public subNodeDisps: VNDisp[];

	/** Array of sub-nodes that should be removed during update of the sub-nodes. */
	public subNodesToRemove: VN[];

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
		// render the new content
		let newChain = createVNChainFromContent( this.oldVN.render());
		let newLen = newChain ? newChain.length : 0;

		let oldChain = this.oldVN.subNodes;
		let oldLen = oldChain ? oldChain.length : 0;

		// if either old or new or both chains are empty, we do special things
		if (newLen === 0 && oldLen === 0)
		{
			// both chain are empty - do nothing
			return;
		}
		else if (newLen === 0)
		{
			// new chain is empty - just delete all old nodes
			this.subNodesToRemove = oldChain;
			return;
		}
		else if (oldLen === 0)
		{
			// old chain is empty - just insert all new nodes
			this.subNodeDisps = newChain.map( newVN => new VNDisp( newVN, VNDispAction.Insert));
			return;
		}

		// determine whether recycling of non-matching old keyed sub-nodes by non-matching new
		// keyed sub-nodes is allowed. If update strategy is not defined for the node, the
		// recycling is allowed.
		let allowKeyedNodeRecycling = true;
		let updateStrategy = this.oldVN ? this.oldVN.getUpdateStrategy() : undefined;
		if (updateStrategy && updateStrategy.allowKeyedNodeRecycling !== undefined)
			allowKeyedNodeRecycling = updateStrategy.allowKeyedNodeRecycling;

		// declare variables that will be used throughout the following code
		let disp: VNDisp, oldVN: VN, newVN: VN, key: any;

		// process the special case with a single sub-node in both old and new chains just
		// to avoid creating temporary structures
		if (newLen === 1 && oldLen === 1)
		{
			newVN = newChain[0];
			oldVN = oldChain[0];
			disp = new VNDisp( newVN);
			this.subNodeDisps = [disp];
			if ((oldVN === newVN ||
				(allowKeyedNodeRecycling || newVN.key === oldVN.key) &&
					(oldVN.type === newVN.type && oldVN.isUpdatePossible( newVN))))
			{
				disp.action = VNDispAction.Update;
				disp.oldVN = oldVN;
			}
			else
			{
				disp.action = VNDispAction.Insert;
				this.subNodesToRemove = [oldVN];
			}

			return;
		}

		// we are here if both old and new chains contain more than one node; therefore, the map of
		// keyed sub-nodes exists.
		let oldMap = this.oldVN.keyedSubNodes;

		// Loop over new nodes, create VNDisp structures try to match new nodes to old ones and
		// put unmatched new nodes aside
		this.subNodeDisps = new Array( newLen);
		let newUnmatchedDisps: VNDisp[] = [];
		this.subNodesToRemove = [];
		for( let i = 0; i < newLen; i++)
		{
			newVN = newChain[i];
			disp = this.subNodeDisps[i] = new VNDisp( newVN);
			key = newVN.key;

			if (key === undefined)
			{
				// put the unkeyed new node aside
				newUnmatchedDisps.push( disp);
			}
			else
			{
				oldVN = oldMap.get( key)
				if (oldVN === undefined)
				{
					// if recycling allowed we put unmatched node aside; otherwise, we indicate that
					// it should be inserted
					if (allowKeyedNodeRecycling)
						newUnmatchedDisps.push( disp);
					else
						disp.action = VNDispAction.Insert;
				}
				else
				{
					if (oldVN === newVN || oldVN.type === newVN.type && oldVN.isUpdatePossible( newVN))
					{
						disp.action = VNDispAction.Update;
						disp.oldVN = oldVN;
					}
					else
					{
						disp.action = VNDispAction.Insert;
						this.subNodesToRemove.push(oldVN);
					}

					// remove the old node from the map - this way the old nodes remaining in the
					// map are those that are unmatched.
					oldMap.delete( key);
				}
			}
		}

		// loop over old sub-nodes, skip already matched ones and try to match others to the
		// yet-unmatched new nodes. Unmatched old nodes are those that are either unkeyed or
		// the keyed ones that are still in the oldMap.
		let iOld = 0, iNew = 0, newUnmatchedLen = newUnmatchedDisps.length;
		while( iOld < oldLen && iNew < newUnmatchedLen)
		{
			// skip already matched keyed nodes
			oldVN = oldChain[iOld++];
			if (oldVN.key !== undefined && !oldMap.has( oldVN.key))
				continue;

			disp = newUnmatchedDisps[iNew++];
			newVN = disp.newVN;

			// if recycling is not allowed and either old or new nodes is keyed, insert new and remove old
			if (!allowKeyedNodeRecycling && (oldVN.key !== undefined || newVN.key !== undefined))
			{
				disp.action = VNDispAction.Insert;
				this.subNodesToRemove.push( oldVN);
			}
			else if (oldVN.type === newVN.type && oldVN.isUpdatePossible( newVN))
			{
				disp.action = VNDispAction.Update;
				disp.oldVN = oldVN;
			}
			else
			{
				disp.action = VNDispAction.Insert;
				this.subNodesToRemove.push(oldVN);
			}
		}

		// if we have old nodes left, they should be removed
		for( let j = iOld; j < oldLen; j++)
		{
			// skip already matched keyed nodes
			oldVN = oldChain[j];
			if (oldVN.key !== undefined && !oldMap.has( oldVN.key))
				continue;

			this.subNodesToRemove.push( oldVN);
		}

		// if we have new nodes left, they should be inserted
		for( let j = iNew; j < newUnmatchedLen; j++)
			newUnmatchedDisps[j].action = VNDispAction.Insert;

		if (this.subNodesToRemove.length === 0)
			this.subNodesToRemove = undefined;

		if (newLen > VNDisp.NO_GROUP_THRESHOLD)
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
			else if (group.action !== VNDispAction.Insert)
			{
				// an "update" or "none" node is out-of-order and should close the current group if
				// its next sibling in the new list is different from the next sibling in the old list.
				// The last node will close the last group after the loop.
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



