import {DN, VN, VNUpdateDisp, getFirstDN, getLastDN} from "./VN"
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



	constructor( parentDisp: VNDisp, action: VNDispAction, first: number)
	{
		this.parentDisp = parentDisp;
		this.action = action;
		this.first = first;
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
			this.firstDN = getFirstDN( vn);
			if (this.firstDN)
				break;
		}

		for( let i = this.last; i >= this.first; i--)
		{
			disp = this.parentDisp.subNodeDisps[i];
			vn = this.action === VNDispAction.Update ? disp.oldVN : disp.newVN;
			this.lastDN = getLastDN( vn);
			if (this.lastDN)
				break;
		}
	}
}



/**
 * If a node has more than this number of sub-nodes, then we build groups. The idea is that
 * otherwise, the overhead of building groups is not worth it.
 */
const NO_GROUP_THRESHOLD = 4;



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
			// new chain is empty - delete all old nodes
			this.subNodesToRemove = oldChain;
			return;
		}
		else if (oldLen === 0)
		{
			// old chain is empty - insert all new nodes
			this.subNodeDisps = newChain.map( newVN => new VNDisp( newVN, VNDispAction.Insert));
			return;
		}

		// determine whether recycling of non-matching old keyed sub-nodes by non-matching new
		// keyed sub-nodes is allowed. If update strategy is not defined for the node, the
		// recycling is allowed.
		let allowKeyedNodeRecycling = true;
		let updateStrategy = this.oldVN ? this.oldVN.updateStrategy : undefined;
		if (updateStrategy && updateStrategy.allowKeyedNodeRecycling !== undefined)
			allowKeyedNodeRecycling = updateStrategy.allowKeyedNodeRecycling;

		// process the special case with a single sub-node in both old and new chains just
		// to avoid creating temporary structures
		if (newLen === 1 && oldLen === 1)
		{
			let newVN = newChain[0];
			let oldVN = oldChain[0];
			let disp = new VNDisp( newVN);
			this.subNodeDisps = [disp];
			if (oldVN === newVN ||
				((allowKeyedNodeRecycling || newVN.key === oldVN.key) && isUpdatePossible( oldVN, newVN)))
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
		// keyed sub-nodes exists (although it might be empty).
		let oldMap = this.oldVN.keyedSubNodes;
		let oldMapSize = oldMap ? oldMap.size : 0;

		// prepare arrays for VNDisp objects for new nodes and for old nodes to be removed
		this.subNodeDisps = new Array( newLen);
		this.subNodesToRemove = [];

		// if the number of nodes in the old map is equal to the total number of old nodes, that
		// means that all old nodes are keyed. If this is the case AND recycling of keyed nodes
		// is not allowed, we will not need to put unkeyed or keyed but unmatched new nodes aside.
		// We know that they will have to be inserted.
		if (oldMapSize === oldLen && !allowKeyedNodeRecycling)
			this.matchOldKeyedOnly( oldMap, newChain, newLen, newLen > NO_GROUP_THRESHOLD);
		else if (oldMapSize === 0 && allowKeyedNodeRecycling)
			this.matchOldNonKeyedOnly( oldChain, oldLen, newChain, newLen, newLen > NO_GROUP_THRESHOLD);
		else
			this.matchOldMixed( oldChain, oldLen, oldMap, newChain, newLen, allowKeyedNodeRecycling, newLen > NO_GROUP_THRESHOLD);

		if (this.subNodesToRemove.length === 0)
			this.subNodesToRemove = undefined;
	}



	/**
	 * This method is invoked when we know that all old nodes have keys and the recycling of keyed
	 * nodes is NOT allowed. Therefore, when we try to match new nodes to old ones we know that
	 * non-keyed or keyed but unmatched new nodes will be marked for insertion. We also can build
	 * groups (if requested) in the same loop.
	 */
	private matchOldKeyedOnly( oldMap: Map<any,VN>, newChain: VN[], newLen: number, buildGroups: boolean): void
	{
		// declare variables that will be used throughout the following code
		let disp: VNDisp, oldVN: VN, newVN: VN, key: any, action: VNDispAction, group: VNDispGroup;

		// if we need to build groups, prepare array of groups
		if (buildGroups)
			this.subNodeGroups = [];

		// Loop over new nodes, create VNDisp structures try to match new nodes to old ones and
		// mark unkeyed or keyed but unmatched new nodes for insertion. On each iteration decide
		// whether we need to open a new group or put the new node into the existing group or
		// close the existing group and open a new one.
		for( let i = 0; i < newLen; i++)
		{
			newVN = newChain[i];
			disp = this.subNodeDisps[i] = new VNDisp( newVN);
			key = newVN.key;

			// decide what to do with the new node
			if (key === undefined)
				action = VNDispAction.Insert;
			else
			{
				oldVN = oldMap.get( key)
				if (oldVN === undefined)
					action = VNDispAction.Insert;
				else
				{
					if (oldVN === newVN || isUpdatePossible( oldVN, newVN))
					{
						action = VNDispAction.Update;
						disp.oldVN = oldVN;
					}
					else
					{
						action = VNDispAction.Insert;
						this.subNodesToRemove.push(oldVN);
					}

					// remove the old node from the map - this way the old nodes remaining in the
					// map are those that are unmatched.
					oldMap.delete( key);
				}
			}

			disp.action = action;

			if (buildGroups)
			{
				if (!group)
				{
					// open a new group
					group = new VNDispGroup( this, action, i);
					this.subNodeGroups.push( group);
				}

				if (action !== group.action)
				{
					// close the group with the previous index and open a new group. Note that we
					// cannot be here for a node that starts a new group because for such node
					// disp.action === groupAction.
					group.last = i - 1;
					group = new VNDispGroup( this, action, i);
					this.subNodeGroups.push( group);
				}
				else if (action === VNDispAction.Update)
				{
					// an "update" or "none" node is out-of-order and should close the current group if
					// its next sibling in the new list is different from the next sibling in the old list.
					// The last node will close the last group after the loop.
					if (i > 0 && this.subNodeDisps[i-1].oldVN !== oldVN.prev)
					{
						// close the group with the previous index and open new group.
						group.last = i - 1;
						group = new VNDispGroup( this, action, i);
						this.subNodeGroups.push( group);
					}
				}

				// all consecutive "insert" nodes belong to the same group so we just wait for the
				// next node
			}
		}

		// close the last group if requested to build groups (only in this case we may have a group object)
		if (group)
			group.last = newLen - 1;

		// if we have old nodes left, they should be removed
		oldMap.forEach( oldVN => this.subNodesToRemove.push( oldVN));
	}



	/**
	 * This method is invoked when we know that none of the old nodes have keys and the recycling of keyed
	 * nodes IS allowed. Therefore, we try to match new nodes to old ones by index. We also can build
	 * groups (if requested) in the same loop.
	 */
	private matchOldNonKeyedOnly( oldChain: VN[], oldLen: number, newChain: VN[], newLen: number, buildGroups: boolean): void
	{
		// declare variables that will be used throughout the following code
		let disp: VNDisp, oldVN: VN, newVN: VN, key: any;

		// Loop over new nodes, create VNDisp structures and try to match new and old nodes by
		// index.
		let i = 0;
		for( ; i < newLen && i < oldLen; i++)
		{
			newVN = newChain[i];
			disp = this.subNodeDisps[i] = new VNDisp( newVN);
			oldVN = oldChain[i];

			// decide what to do with the new node
			if (oldVN === newVN || isUpdatePossible( oldVN, newVN))
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

		// remaining new nodes should be inserted
		for( let j = i; j < newLen; j++)
			this.subNodeDisps[j] = new VNDisp( newChain[j], VNDispAction.Insert);

		// remaining old nodes should be removed
		for( let j = i; j < oldLen; j++)
			this.subNodesToRemove.push( oldChain[j]);

		if (buildGroups)
			this.buildSubNodeGroups();
	}



	/**
	 * This method is invoked when we know that not all old nodes have keys or the recycling of
	 * keyed nodes is allowed. Therefore, when we have a non-keyed or keyed but unmatched new
	 * node, we first put it aside and only after we went over all new nodes we can decide
	 * what to do with those that we put aside. Also, only after we went over all new nodes we
	 * can build groups if requested.
	 */
	private matchOldMixed( oldChain: VN[], oldLen: number, oldMap: Map<any,VN>, newChain: VN[],
					newLen: number, allowKeyedNodeRecycling: boolean, buildGroups: boolean): void
	{
			// declare variables that will be used throughout the following code
		let disp: VNDisp, oldVN: VN, newVN: VN, key: any;

		// Loop over new nodes, create VNDisp structures try to match new nodes to old ones and
		// put unmatched new nodes aside
		let newUnmatchedDisps: VNDisp[] = [];
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
					if (oldVN === newVN || isUpdatePossible( oldVN, newVN))
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
			else if (isUpdatePossible( oldVN, newVN))
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

		// if we have new nodes left, they should be inserted
		for( let j = iNew; j < newUnmatchedLen; j++)
			newUnmatchedDisps[j].action = VNDispAction.Insert;

		// if we have old nodes left, they should be removed
		for( let j = iOld; j < oldLen; j++)
		{
			// skip already matched keyed nodes
			oldVN = oldChain[j];
			if (oldVN.key !== undefined && !oldMap.has( oldVN.key))
				continue;

			this.subNodesToRemove.push( oldVN);
		}

		if (buildGroups)
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
			if (count <= NO_GROUP_THRESHOLD || count === 0)
				return;
		/// #endif

		// create array of groups and create the first group starting from the first node
		this.subNodeGroups = [];
		let group: VNDispGroup = new VNDispGroup( this, this.subNodeDisps[0].action, 0);
		this.subNodeGroups.push( group);

		// loop over sub-nodes and on each iteration decide whether we need to open a new group
		// or put the current node into the existing group or close the existing group and open
		// a new one.
		let action: VNDispAction;
		let disp: VNDisp;
		for( let i = 1; i < count; i++)
		{
			disp = this.subNodeDisps[i];
			action = disp.action;
			if (action !== group.action)
			{
				// close the group with the previous index. Decrement the iterating index so that
				// the next iteration will open a new group. Note that we cannot be here for a node
				// that starts a new group because for such node disp.action === groupAction.
				group.last = i - 1;
				group = new VNDispGroup( this, action, i);
				this.subNodeGroups.push( group);
			}
			else if (action === VNDispAction.Update)
			{
				// an "update" or "none" node is out-of-order and should close the current group if
				// its next sibling in the new list is different from the next sibling in the old list.
				// The last node will close the last group after the loop.
				if (this.subNodeDisps[i-1].oldVN !== disp.oldVN.prev)
				{
					// close the group with the current index.
					group.last = i - 1;
					group = new VNDispGroup( this, action, i);
					this.subNodeGroups.push( group);
				}
			}

			// all consecutive "insert" nodes belong to the same group so we just wait for the
			// next node
		}

		// close the last group
		if (group !== undefined)
			group.last = count - 1;
	}
}






/**
 * Determines whether update of the given old node from the given new node is possible. Update
 * is possible if the types of nodes are the same and either the isUpdatePossible method is not
 * defined on the old node or it returns true.
 */
function isUpdatePossible( oldVN: VN, newVN: VN): boolean
{
	return (oldVN.type === newVN.type &&
			(oldVN.isUpdatePossible === undefined || oldVN.isUpdatePossible( newVN)));

}
