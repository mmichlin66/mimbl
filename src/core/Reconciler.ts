import {
    DN, ScheduledFuncType, CallbackWrappingParams, TickSchedulingType, IComponent,
} from "../api/CompTypes"
import {
    ChildrenUpdateRequest, ChildrenUpdateOperation, SetRequest, SpliceRequest, MoveRequest,
    SwapRequest, SliceRequest, TrimRequest, GrowRequest, ReverseRequest, VNDisp, VNDispAction,
    VNDispGroup, IVN
} from "./VNTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { enterMutationScope, exitMutationScope } from "../api/TriggerAPI";



// Set of nodes that should be updated on the next UI cycle. We use Set in order to not include
// the same node more than once - which can happen if the node's requestUpdate method is called
// more than once during a single run (e.g. during event processing).
let s_vnsScheduledForUpdate = new Map<IVN,any>();

// Map of functions that have been scheduled to be called upon a new animation frame before
// components scheduled for update are updated. The keys in this map are the original functions and
// the values are the wrapper functions that will be executed in the context of a given virtual node.
let s_callsScheduledBeforeUpdate = new Map<ScheduledFuncType,ScheduledFuncType>();

// Map of functions that have been scheduled to be called upon a new animation frame after
// components scheduled for update are updated. The keys in this map are the original functions and
// the values are the wrapper functions that will be executed in the context of a given virtual node.
let s_callsScheduledAfterUpdate = new Map<ScheduledFuncType,ScheduledFuncType>();

// Handle of the animation frame request (in case it should be canceled).
let s_scheduledFrameHandle: number = 0;

// Flag indicating whether the Mimbl tick is scheduled to be executed in a microtask.
let s_isMicrotaskScheduled = false;

// State of the scheduler.
let s_schedulerState: SchedulerState = SchedulerState.Idle;

// Number that serves as a unique ID of an update cycle. Each update cycle the root node
// increments this number. Each node being updated in this cycle is assigned this number.
// This helps prevent double-rendering of when both a component and its parent are
// updated in the same cycle.
let s_currentTick: number = 0;

// Flag indicating that the request to schedule an animation frame should be ignored. This flag is
// set while inside the callback wrapper function if a Mimbl tick is going to happen right after
// the callback finishes.
let s_ignoreSchedulingRequest: boolean = false;



// Current object that is set as "creator" during rendering when instantiating certain virtual nodes.
let s_currentClassComp: IComponent | undefined | null = null;

// Sets the given object as the current "creator" object.
export const getCurrentClassComp = (): IComponent | undefined | null => s_currentClassComp;

// Sets the given object as the current "creator" object.
export const setCurrentClassComp = (comp: IComponent | undefined | null): IComponent | undefined | null =>
{
    let prevComp = s_currentClassComp;
    s_currentClassComp = comp;
    return prevComp;
}



// State of the scheduler indicating in what phase of the update cycle we currently reside.
const enum SchedulerState
{
	// The scheduler is not within the update cycle
	Idle = 0,

	// The scheduler is executing functions before updating nodes
	BeforeUpdate,

	// The scheduler is updating nodes
	Update,

	// The scheduler is executing functions after updating nodes
	AfterUpdate,
}



/**
 * The CallbackWrapper function is used to wrap callbacks in order to have it executed in a Mimbl
 * context.
 */
export function CallbackWrapper( this: CallbackWrappingParams): any
{
    // if some scheduling type is set (that is, we are going to schedule a Mimbl tick after
    // the callback), we should ignore requests to schedule a tick made during the callback
    // execution
    let schedulingType = this.schedulingType;
    s_ignoreSchedulingRequest = !!schedulingType;

    // set the current component while remembering the previously set one
    let prevComponent = s_currentClassComp;
    s_currentClassComp = this.comp;

    // we don't want the triggers encountered during the callback execution to cause the watchers
    // to run immediately, so we enter mutation scope
    enterMutationScope();

    let retVal: any;
    try
	{
		retVal = this.func.call( this.thisArg, ...arguments, this.arg);
	}
	finally
	{
        // restore the previous component as the current one (if any)
        s_currentClassComp = prevComponent;

        // run all the accumulated trigger watchers
        exitMutationScope();
        s_ignoreSchedulingRequest = false;
    }

    // schedule a Mimbl tick if instructed to do so
    if (schedulingType)
        scheduleTick(schedulingType);

    return retVal;
}



/**
 * Schedule (or executes) Mimbl tick according to the given type.
 */
const scheduleTick = (schedulingType: TickSchedulingType = TickSchedulingType.AnimationFrame): void =>
{
    switch (schedulingType)
    {
        case TickSchedulingType.Sync:
            performMimbleTick();
            break;

        case TickSchedulingType.Microtask:
            if (!s_isMicrotaskScheduled)
            {
                queueMicrotask( performMimbleTick);
                s_isMicrotaskScheduled = true;
            }
            break;

        case TickSchedulingType.AnimationFrame:
            if (s_scheduledFrameHandle === 0)
                s_scheduledFrameHandle = requestAnimationFrame( onAnimationFrame);
            break;
    }
}



// Schedules an update for the given node.
export const requestNodeUpdate = (vn: IVN, req?: ChildrenUpdateRequest, schedulingType?: TickSchedulingType): void =>
{
    if (!vn.anchorDN)
    {
        /// #if DEBUG
            console.warn( `Update requested for virtual node '${getVNPath(vn).join("->")}' that is not mounted`)
        /// #endif

        return;
    }

	// add this node to the map of nodes for which either update or replacement or
	// deletion is scheduled. Note that a node will only be present once in the map no
	// matter how many times it calls requestUpdate().
	s_vnsScheduledForUpdate.set( vn, req);

    // schedule Mimbl tick using animation frame. If this call comes from a wrapped callback, the
    // callback might schedule a tick using microtask. In this case, the animation frame will be
    // canceled. The update is scheduled in the next tick unless the request is made during a
    // "before update" function execution.
    if (!s_ignoreSchedulingRequest && s_schedulerState !== SchedulerState.BeforeUpdate)
        scheduleTick( schedulingType || TickSchedulingType.AnimationFrame);
}



// Schedules to call the given function either before or after all the scheduled components
// have been updated.
export const scheduleFuncCall = (func: ScheduledFuncType, beforeUpdate: boolean,
    thisArg?: any, comp?: IComponent, schedulingType?: TickSchedulingType): void =>
{
	/// #if DEBUG
	if (!func)
	{
		console.error( "Trying to schedule undefined function for update");
		return;
	}
	/// #endif

	if (beforeUpdate)
	{
		if (!s_callsScheduledBeforeUpdate.has( func))
		{
			s_callsScheduledBeforeUpdate.set( func, CallbackWrapper.bind({func, thisArg, comp}));

			// a "before update" function is always scheduled in the next frame even if the
			// call is made from another "before update" function.
            if (!s_ignoreSchedulingRequest)
                scheduleTick( schedulingType || TickSchedulingType.AnimationFrame);
		}
	}
	else
	{
		if (!s_callsScheduledAfterUpdate.has( func))
		{
			s_callsScheduledAfterUpdate.set( func, CallbackWrapper.bind({func, thisArg, comp}));

			// an "after update" function is scheduled in the next cycle unless the request is made
			// either from a "before update" function execution or during a node update.
            if (!s_ignoreSchedulingRequest &&
                s_schedulerState !== SchedulerState.BeforeUpdate && s_schedulerState !== SchedulerState.Update)
            {
                scheduleTick( schedulingType || TickSchedulingType.AnimationFrame);
            }
		}
	}
}



// Callback that is called on a new UI cycle when there is a need to update UI components
const onAnimationFrame = (): void =>
{
	// clear the scheduled frame handle so that new update requests will
	// schedule a new frame.
	s_scheduledFrameHandle = 0;

    performMimbleTick();
}



// Reconciler main entrance point
const performMimbleTick = (): void =>
{
    // clear a scheduled frame (if any). This can happen if we were invoked from the callback
    // wrapper while a frame has been previously scheduled.
    if (s_scheduledFrameHandle !== 0)
    {
		cancelAnimationFrame( s_scheduledFrameHandle);
        s_scheduledFrameHandle = 0;
    }

    // clear the flag that the tick is scheduled in a microtsk
    s_isMicrotaskScheduled = false;

    // call functions scheduled to be invoked before updating components. If this function
	// calls the requestUpdate method or schedules a function to be invoked after updates,
	// they will be executed in this cycle. However, if it schedules a function to be invoked
	// before updates, it will be executed in the next cycle.
	if (s_callsScheduledBeforeUpdate.size > 0)
	{
		s_schedulerState = SchedulerState.BeforeUpdate;
		let callsScheduledBeforeUpdate = s_callsScheduledBeforeUpdate;
		s_callsScheduledBeforeUpdate = new Map<ScheduledFuncType,ScheduledFuncType>();
		callScheduledFunctions( callsScheduledBeforeUpdate, true);
	}

	if (s_vnsScheduledForUpdate.size > 0)
	{
        // increment tick number.
        s_currentTick++;

        /// #if USE_STATS
            DetailedStats.start( `Mimbl tick ${s_currentTick}: `);
        /// #endif

		// remember the internal set of nodes and re-create it so that it is ready for new
		// update requests. Arrange scheduled nodes by their nesting depths and perform updates.
		s_schedulerState = SchedulerState.Update;
		let vnsScheduledForUpdate = s_vnsScheduledForUpdate;
        s_vnsScheduledForUpdate = new Map<IVN,any>();

        vnsScheduledForUpdate.forEach( (req: ChildrenUpdateRequest, vn: IVN) =>
        {
            // it can happen that we encounter already unmounted virtual nodes - ignore them
            if (!vn.anchorDN)
                return;

            try
            {
                // first perform partial update if requested
                if (vn.partialUpdateRequested)
                {
                    vn.partialUpdateRequested = false;
                    vn.performPartialUpdate!();
                }

                // then perform normal update if requested
                if (vn.updateRequested)
                {
                    // clear the flag that update has been requested for the node
                    vn.updateRequested = false;

                    // if the component was already updated in this cycle, don't update it again
                    if (vn.lastUpdateTick === s_currentTick)
                        return;

                    performChildrenOperation( vn, req);
                }
            }
            catch( err)
            {
                // find the nearest error handling service.
                let errorService = vn.getService( "ErrorBoundary");
                if (errorService)
                    errorService.reportError( err);

                /// #if DEBUG
                else
                    console.error( "BUG: performChildrenOperation threw exception but ErrorBoundary service was not found.", err);
                /// #endif
            }
        });

        /// #if USE_STATS
            DetailedStats.stop( true);
        /// #endif
	}

	// call functions scheduled to be invoked after updating components
	if (s_callsScheduledAfterUpdate.size > 0)
	{
		s_schedulerState = SchedulerState.AfterUpdate;
		let callsScheduledAfterUpdate = s_callsScheduledAfterUpdate;
		s_callsScheduledAfterUpdate = new Map<ScheduledFuncType,ScheduledFuncType>();
		callScheduledFunctions( callsScheduledAfterUpdate, false);
	}

	s_schedulerState = SchedulerState.Idle;
};



// Call functions scheduled before or after update cycle.
const callScheduledFunctions = (funcs: Map<ScheduledFuncType,ScheduledFuncType>, beforeUpdate: boolean) =>
	funcs.forEach( wrapper =>
	{
		try
		{
			wrapper();
		}
		catch( err)
		{
            /// #if DEBUG
			console.error( `Exception while invoking function ${beforeUpdate ? "before" : "after"} updating components\n`, err);
            /// #endif
		}
	});



// Performs the specified operation on the sub-nodes of the given node.
const performChildrenOperation = (vn: IVN, req: ChildrenUpdateRequest): void =>
{
    s_currentClassComp = vn.comp ?? vn.creator;

    if (!req)
    {
        // We call the render method without try/catch. If it throws, the control goes to either the
        // ancestor node that supports error handling or the Mimbl tick loop (which has try/catch).
        reconcile( vn, {oldVN: vn}, vn.render?.());
    }
    else
    {
        switch( req.op)
        {
            case ChildrenUpdateOperation.Set: setNodeChildren( vn, req); break;
            case ChildrenUpdateOperation.Splice: spliceNodeChildren( vn, req); break;
            case ChildrenUpdateOperation.Move: moveNodeChildren( vn, req); break;
            case ChildrenUpdateOperation.Swap: swapNodeChildren( vn, req); break;
            case ChildrenUpdateOperation.Slice: sliceNodeChildren( vn, req); break;
            case ChildrenUpdateOperation.Trim: trimNodeChildren( vn, req); break;
            case ChildrenUpdateOperation.Grow: growNodeChildren( vn, req); break;
            case ChildrenUpdateOperation.Reverse: reverseNodeChildren( vn, req); break;
        }
    }

    s_currentClassComp = null;
}



// Unmounts existing sub-nodes of the given node and mounts the new ones obtained from the given
// new content.
const setNodeChildren = (vn: IVN, req: SetRequest): void =>
{
    let oldSubNodes = vn.subNodes;
    let oldLen = oldSubNodes ? oldSubNodes.length : 0;

    let startIndex = req.startIndex || 0;
    let endIndex = req.endIndex || oldLen;
    if (endIndex < 0 || endIndex > oldLen)
        endIndex = oldLen;

    /// #if DEBUG
        // validate request parameters
        if (startIndex < 0 || startIndex > oldLen || endIndex < startIndex)
        {
            console.error( `Parameters for SetChildren operation are incorrect`, req);
        }
    /// #endif

    if (req.update)
    {
        reconcile( vn, {oldVN: vn, oldStartIndex: startIndex, oldEndIndex: endIndex,
            updateStrategy: req.updateStrategy}, req.content);

        return;
    }

    // if the range of old sub-nodes is only a portion of all sub-nodes, we call the Splice
    // operation; otherwise, we need to remove all old sub-nodes and add new
    let rangeLen = endIndex - startIndex;
    if (rangeLen < oldLen)
        spliceNodeChildren( vn, {index: startIndex, countToDelete: rangeLen, contentToInsert: req.content});
    else
    {
        if (oldSubNodes)
            removeAllSubNodes(vn);

        let newSubNodes = req.content != null ? content2VNs( req.content) : null;
        if (newSubNodes)
        {
            let anchorDN = vn.ownDN ?? vn.anchorDN;
            let beforeDN = vn.ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN!);
            mountSubNodes( vn, newSubNodes, anchorDN!, beforeDN);
        }

        vn.subNodes = newSubNodes;
    }
}



// At the given index, removes a given number of sub-nodes and then inserts the new content.
const spliceNodeChildren = (vn: IVN, req: SpliceRequest): void =>
{
    let oldSubNodes = vn.subNodes;
    let oldLen = oldSubNodes ? oldSubNodes.length : 0;

    // validate request parameters
    let index = req.index;
    let countToDelete = req.countToDelete || 0;

    /// #if DEBUG
        if (index < 0 || index > oldLen || countToDelete < 0)
        {
            console.error( `Parameters for SpliceChildren operation are incorrect`, req);
        }
    /// #endif

    // calculate the number of sub-nodes to delete
    countToDelete = Math.min( countToDelete, oldLen - index);

    let newSubNodes = req.contentToInsert != null ? content2VNs( req.contentToInsert) : null;
    if (countToDelete === 0 && !newSubNodes)
        return;

    // unmount nodes if necessary - note that it is OK if req.countToDelete is negative - it is
    // the same as if it was set to 0 because we only use >0 comparisons.
    if (countToDelete > 0)
    {
        let stopIndex = index + countToDelete;
        for( let i = index; i < stopIndex; i++)
            oldSubNodes![i].unmount( true);
    }

    if (!newSubNodes)
    {
        // if we don't have new sub-nodes, we just delete the old ones (if any)
        if (countToDelete > 0)
            oldSubNodes!.splice( index, countToDelete);
    }
    else
    {
        // insert new nodes into the old list at the given index
        if (oldSubNodes)
            oldSubNodes.splice( index, countToDelete, ...newSubNodes);
        else
            vn.subNodes = oldSubNodes = newSubNodes;

        // determine the node before which the new nodes should be mounted
        let ownDN = vn.ownDN;
        let anchorDN = ownDN ? ownDN : vn.anchorDN;
        let beforeDN = index + newSubNodes.length < oldSubNodes.length
            ? oldSubNodes[index + newSubNodes.length].getFirstDN()
            : ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN!);

        // mount new nodes
        let stopIndex = index + newSubNodes.length;
        for( let i = index; i < stopIndex; i++)
            oldSubNodes[i].mount( vn, i, anchorDN!, beforeDN);
    }
}

// Moves a range of sub-nodes to a new location. Moving a region to a new index is the same as
// swapping two adjacent regions - the region being moved and the region from either the new index
// to the beginning of the first region or the end of the first region to the new index.
const moveNodeChildren = (vn: IVN, req: MoveRequest): void =>
{
    if (req.shift  === 0 || req.count === 0)
        return;

    let oldSubNodes = vn.subNodes;
    let oldLen = oldSubNodes ? oldSubNodes.length : 0;

    /// #if DEBUG
        if (oldLen < 2)
        {
            console.error( `Parameters for MoveChildren operation are incorrect`, req);
        }
    /// #endif

    // we will use 1 for the range residing lower in the list
    let index1: number, count1: number, index2: number, count2: number;
    if (req.shift < 0)
    {
        index1 = req.index + req.shift;
        count1 = -req.shift;
        index2 = req.index;
        count2 = req.count;
    }
    else
    {
        index1 = req.index;
        count1 = req.count;
        index2 = index1 + count1;
        count2 = req.shift;
    }

    swapNodeChildren( vn, { index1, count1, index2, count2 })
}



// Swaps two ranges of the element's sub-nodes. The ranges cannot intersect.
const swapNodeChildren = (vn: IVN, req: SwapRequest): void =>
{
    let oldSubNodes = vn.subNodes;
    let oldLen = oldSubNodes ? oldSubNodes.length : 0;

    // we will use 1 for the range residing lower in the list
    let index1: number, count1: number, index2: number, count2: number;
    if (req.index1 < req.index2)
    {
        index1 = req.index1;
        count1 = req.count1;
        index2 = req.index2;
        count2 = req.count2;
    }
    else
    {
        index1 = req.index2;
        count1 = req.count2;
        index2 = req.index1;
        count2 = req.count1;
    }

    /// #if DEBUG
        if (oldLen < 2 || index1 < 0 || index2 > oldLen || count1 <= 0 || count2 <= 0 ||
            index1 + count1 > index2 || index2 + count2 > oldLen)
        {
            console.error( `Parameters for SwapChildren operation are incorrect`, req);
        }
    /// #endif

    // the third range is the range between the two input ones - it might be empty
    let index3 = index1 + count1;
    let count3 = index2 - index3;

    // first stage is to move actual DOM nodes
    let ownDN = vn.ownDN;
    let anchorDN = ownDN ? ownDN : vn.anchorDN;

    // determine whether both ranges should be moved or just one - the latter can happen if the
    // ranges are adjacent.
    if (count3 === 0)
    {
        // only one range should be moved - move the smaller one: 1 after 2 or 2 before 1
        if (count1 < count2)
            moveDOMRange( vn, oldSubNodes!, index1, count1, index2 + count2, anchorDN!);
        else
            moveDOMRange( vn, oldSubNodes!, index2, count2, index1, anchorDN!);
    }
    else
    {
        // we are here if a non-empty range exists between the two input ranges. Having these
        // three ranges we will need to move only two of them, so we need to find the two smaller
        // ones.
        if (count1 <= count2 && count2 <= count3)
        {
            // 3 is the biggest: move 1 before 2 and move 2 before 3
            moveDOMRange( vn, oldSubNodes!, index1, count1, index2, anchorDN!);
            moveDOMRange( vn, oldSubNodes!, index2, count2, index3, anchorDN!);
        }
        else if (count1 <= count2 && count3 <= count2)
        {
            // 2 is the biggest: move 1 after 2 and move 3 before 1
            moveDOMRange( vn, oldSubNodes!, index1, count1, index2 + count2, anchorDN!);
            moveDOMRange( vn, oldSubNodes!, index3, count3, index1, anchorDN!);
        }
        else
        {
            // 1 is the biggest: move 2 before 1 and move 3 before 1
            moveDOMRange( vn, oldSubNodes!, index2, count2, index1, anchorDN!);
            moveDOMRange( vn, oldSubNodes!, index3, count3, index1, anchorDN!);
        }
    }

    // second stage is to swap nodes in the list of sub-nodes and change their indices. If the
    // ranges are equal in length, just swap the nodes betwen them; otherwise, go from the smallest
    // index to the biggest, swap nodes if needed and change all indices.
    if (count1 === count2)
    {
        for( let i = 0; i < count1; i++)
        {
            let i1 = index1 + i, i2 = index2 + i;
            let svn1 = oldSubNodes![i1], svn2 = oldSubNodes![i2];
            oldSubNodes![i1] = svn2; svn2.index = i1;
            oldSubNodes![i2] = svn1; svn1.index = i2;
        }
    }
    else
    {
        // allocate new array of the length enough to hold all three ranges and copy nodes to it
        // in the order: 2, 3, 1. Then copy nodes from this array back into the original one.
        let totalLen = count1 + count2 + count3;
        let arr = new Array( totalLen);
        let targetIndex = 0;

        // copy range 2
        let stopIndex = index2 + count2;
        for( let i = index2; i < stopIndex; i++)
            arr[targetIndex++] = oldSubNodes![i];

        // copy range 3 if not empty
        if (count3 > 0)
        {
            stopIndex = index3 + count3;
            for( let i = index3; i < stopIndex; i++)
                arr[targetIndex++] = oldSubNodes![i];
        }

        // copy range 1
        stopIndex = index1 + count1;
        for( let i = index1; i < stopIndex; i++)
            arr[targetIndex++] = oldSubNodes![i];

        // copy everything back and adjust indices
        let svn: IVN;
        targetIndex = index1;
        for( let i = 0; i < totalLen; i++)
        {
            svn = arr[i];
            svn.index = targetIndex;
            oldSubNodes![targetIndex++] = svn;
        }
    }
}


// Moves the DOM nodes corresponding to the given range of sub-nodes. This function doesn't move
// the virtual node objects themselves within the list - only their corresponding DOM nodes.
const moveDOMRange = (vn: IVN, subNodes: IVN[], index: number, count: number, indexBefore: number, anchorDN: DN) =>
{
    let beforeDN: DN;
    if (indexBefore == subNodes.length)
        beforeDN = vn.ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN);
    else
        beforeDN = subNodes[indexBefore].getFirstDN();

    for( let i = 0; i < count; i++)
        moveNode( subNodes[index + i], anchorDN, beforeDN);
}



// At the given index, removes a given number of sub-nodes and then inserts the new content.
const sliceNodeChildren = (vn: IVN, req: SliceRequest): void =>
{
    let oldSubNodes = vn.subNodes;
    if (!oldSubNodes)
        return;

    let oldLen = oldSubNodes.length;
    let startIndex = req.startIndex || 0;

    /// #if DEBUG
        if (startIndex < 0 || startIndex > oldLen)
        {
            console.error( `Parameters for SliceChildren operation are incorrect`, req);
        }
    /// #endif

    let endIndex = req.endIndex != null ? Math.min( req.endIndex, oldLen) : oldLen;
    if (endIndex - startIndex === oldLen)
        return;

    // if the range is empty unmount all sub-nodes
    if (endIndex <= startIndex)
    {
        removeAllSubNodes(vn);
        vn.subNodes = null;
        return;
    }

    // trim at start
    if (startIndex > 0)
    {
        for( let i = 0; i < startIndex; i++)
            oldSubNodes[i].unmount(true);
    }

    // trim at end
    if (endIndex < oldLen)
    {
        for( let i = endIndex; i < oldLen; i++)
            oldSubNodes[i].unmount(true);
    }

    // extract only remaining nodes and change their indices
    vn.subNodes = oldSubNodes.slice( startIndex, endIndex);
    vn.subNodes.forEach( (svn, i) => { svn.index = i });
}



// Removes the given number of nodes from the start and/or the end of the list of sub-nodes.
const trimNodeChildren = (vn: IVN, req: TrimRequest): void =>
{
    let oldSubNodes = vn.subNodes;
    if (oldSubNodes)
        sliceNodeChildren( vn, { startIndex: req.startCount, endIndex: oldSubNodes.length - req.endCount })
}



// Adds new content before and/or after the existing children of the given node
const growNodeChildren = (vn: IVN, req: GrowRequest): void =>
{
    // convert content to arrays of sub-nodes. Note that arrays cannot be empty but can be null.
    let newStartSubNodes = req.startContent != null ? content2VNs( req.startContent) : null;
    let newEndSubNodes = req.endContent != null ? content2VNs( req.endContent) : null;
    if (!newStartSubNodes && !newEndSubNodes)
        return;

    let oldSubNodes = vn.subNodes;
    let ownDN = vn.ownDN;
    let anchorDN = ownDN ? ownDN : vn.anchorDN;

    // if the node didn't have any nodes before, we just mount all new nodes
    if (!oldSubNodes)
    {
        vn.subNodes = newStartSubNodes && newEndSubNodes
            ? newStartSubNodes.concat( newEndSubNodes)
            : newStartSubNodes ?? newEndSubNodes;

        let beforeDN = ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN!);
        mountSubNodes( vn, vn.subNodes!, anchorDN!, beforeDN);
        return;
    }

    // we are here if the array of old sub-nodes is not empty. Now create new array combining
    // new and old sub-nodes in the correct order.
    vn.subNodes = newStartSubNodes && newEndSubNodes
        ? newStartSubNodes.concat( oldSubNodes, newEndSubNodes)
        : newStartSubNodes
            ? newStartSubNodes.concat( oldSubNodes)
            : oldSubNodes.concat( newEndSubNodes!);

    // mount new sub-nodes at the start
    if (newStartSubNodes)
    {
        let beforeDN = oldSubNodes[0].getFirstDN();
        mountSubNodes( vn, newStartSubNodes, anchorDN!, beforeDN);

        // change indices of the old nodes
        let shift = newStartSubNodes.length;
        oldSubNodes.forEach( svn => svn.index += shift);
    }

    // mount new sub-nodes at the end
    if (newEndSubNodes)
    {
        mountSubNodes( vn, newEndSubNodes, anchorDN!,
            ownDN ? null : getNextDNUnderSameAnchorDN(vn, anchorDN!),
            vn.subNodes.length - newEndSubNodes.length);
    }
}



// Reverses the given range of sub-nodes.
const reverseNodeChildren = (vn: IVN, req: ReverseRequest): void =>
{
    let oldSubNodes = vn.subNodes;
    if (!oldSubNodes)
        return;

    let oldLen = oldSubNodes.length;
    let startIndex = req.startIndex || 0;
    let endIndex = req.endIndex != null ? Math.min( req.endIndex, oldLen) : oldLen;

    /// #if DEBUG
        if (oldLen < 2 || startIndex < 0 || startIndex > oldLen || endIndex <= startIndex)
        {
            console.error( `Parameters for ReverseChildren operation are incorrect`, req);
            return;
        }
    /// #endif

    // find the DOM node after the last element in the range - this will be the node before which
    // we will move all our nodes from one before last back to the first
    let ownDN = vn.ownDN;
    let anchorDN = ownDN ? ownDN : vn.anchorDN;
    let beforeDN = endIndex === oldLen
        ? ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN!)
        : oldSubNodes[endIndex].getFirstDN();

    let svn: IVN;
    for( let i = endIndex - 2; i >= startIndex; i--)
    {
        svn = oldSubNodes[i];
        moveNode( svn, anchorDN!, beforeDN);
    }

    // now swap virtual nodes and update their indices
    let svn2: IVN, tempIndex: number;
    for( let i1 = startIndex, i2 = endIndex - 1; i1 < i2; i1++, i2--)
    {
        svn = oldSubNodes[i1];
        svn2 = oldSubNodes[i2];
        oldSubNodes[i1] = svn2;
        oldSubNodes[i2] = svn;
        tempIndex = svn.index;
        svn.index = svn2.index;
        svn2.index = tempIndex;
    }
}



// Recursively mounts sub-nodes.
export const mountContent = (vn: IVN, content: any, anchorDN: DN, beforeDN: DN = null, startIndex?: number): void =>
{
    let subNodes = content2VNs(content);
    if (subNodes)
        mountSubNodes( vn, subNodes, anchorDN, beforeDN, startIndex);

    vn.subNodes = subNodes;
}



// Recursively mounts sub-nodes.
export const mountSubNodes = (vn: IVN, subNodes: IVN[], anchorDN: DN, beforeDN: DN = null, startIndex?: number): void =>
        subNodes.forEach( (svn, i) => svn.mount( vn, startIndex ? startIndex + i : i, anchorDN, beforeDN));



/**
 * Recursively unmounts nodes from the given array.
 */
export const unmountSubNodes = (subNodes: IVN[], removeFromDOM: boolean): void =>
    subNodes.forEach( svn => svn.unmount( removeFromDOM));



export const reconcile = (vn: IVN, disp: VNDisp, content: any): void =>
    reconcileSubNodes( vn, disp, content2VNs(content));



/**
 * Unmounts all sub-nodes under the given node
 */
function removeAllSubNodes( vn: IVN)
{
    // if we are removing all sub-nodes under an element, we can optimize by setting
    // textContent to null;
    let ownDN = vn.ownDN;
    if (ownDN)
        (ownDN as Element).textContent = null;

    vn.subNodes?.forEach( svn => svn.unmount( !ownDN));

}



export const reconcileSubNodes = (vn: IVN, disp: VNDisp, newSubNodes: IVN[] | null | undefined): void =>
{
    // reconcile old and new sub-nodes
    buildSubNodeDispositions( disp, newSubNodes);
    if (disp.noChanges)
        return;

    // remove from DOM the old nodes designated to be removed (that is, those for which there
    // was no counterpart new node that would either update or replace it). We need to remove
    // old nodes first before we start inserting new - one reason is to properly maintain
    // references.
    let oldSubNodes = vn.subNodes;
    if (oldSubNodes)
    {
        if (disp.replaceAll)
        {
            if (disp.allProcessed)
                removeAllSubNodes(vn);
            else
            {
                for( let i = disp.oldStartIndex!; i < disp.oldEndIndex!; i++)
                    oldSubNodes[i].unmount(true);
            }
        }
        else if (disp.toRemove)
        {
            for( let i = 0, len = disp.toRemove.length; i < len; i++)
                disp.toRemove[i].unmount(true);
        }

        if (!newSubNodes)
        {
            if (disp.allProcessed)
                vn.subNodes = null;
            else
            {
                // remove the portion of the sub-nodes that was updated and update indices
                oldSubNodes.splice( disp.oldStartIndex!, disp.oldLength)
                for( let i = disp.oldStartIndex!, len = oldSubNodes.length; i < len; i++)
                    oldSubNodes[i].index = i;
            }
        }
    }

    if (newSubNodes)
    {
        // determine the anchor node to use when inserting new or moving existing sub-nodes. If
        // our node has its own DN, it will be the anchor for the sub-nodes; otherwise, our node's
        // anchor will be the anchor for the sub-nodes too.
        let ownDN = vn.ownDN;
        let anchorDN = ownDN || vn.anchorDN;

        // if this virtual node doesn't define its own DOM node (true for components), we will
        // need to find a DOM node before which to start inserting new nodes. Null means
        // append to the end of the anchor node's children.
        let beforeDN = ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN!);

        // since we have sub-nodes, we need to create nodes for them and render. If our node
        // knows to handle errors, we do it under try/catch; otherwise, the exceptions go to
        // either the uncestor node that knows to handle errors or to the Mimbl tick loop.
        updateSubNodes( vn, disp, newSubNodes, anchorDN!, beforeDN);
    }

    // indicate that the node was updated in this cycle - this will prevent it from
    // rendering again in this cycle.
    vn.lastUpdateTick = s_currentTick;
}



// Performs rendering phase of the update on the sub-nodes of the node, which is passed as
// the oldVN member of the VNDisp structure.
const updateSubNodes = (vn: IVN, disp: VNDisp, newSubNodes: IVN[],
    anchorDN: DN, beforeDN: DN): void =>
{
    let oldSubNodes = vn.subNodes;
    if (disp.replaceAll)
    {
        if (disp.allProcessed)
        {
            vn.subNodes = newSubNodes;
            mountSubNodes( vn, newSubNodes, anchorDN, beforeDN);
        }
        else
        {
            // replace the portion of the sub-nodes that was updated and update indices
            let oldStartIndex = disp.oldStartIndex;
            oldSubNodes!.splice( oldStartIndex!, disp.oldLength)
            for( let i = disp.oldStartIndex! + newSubNodes.length, len = oldSubNodes!.length; i < len; i++)
                oldSubNodes![i].index = i;

            mountSubNodes( vn, newSubNodes, anchorDN, beforeDN, oldStartIndex);
        }

    }
    else
    {
        // re-create our current list of sub-nodes - we will populate it while updating them. If
        // the number of nodes in the new list is the same as the previous number of nodes, we
        // don't re-allocate the array. This can also help if there are old nodes that should not
        // be changed
        if (!oldSubNodes)
            vn.subNodes = new Array<IVN>(newSubNodes.length);
        else if (disp.oldLength! > newSubNodes.length)
            oldSubNodes.splice( newSubNodes.length);

        // perform updates and inserts by either groups or individual nodes.
        if (disp.subGroups)
            updateSubNodesByGroups( vn, disp, anchorDN, beforeDN);
        else
            updateSubNodesByNodes( vn, disp, anchorDN, beforeDN);
    }
}



// Performs updates and inserts by individual nodes.
const updateSubNodesByNodes = (parentVN: IVN, disp: VNDisp, anchorDN: DN, beforeDN: DN): void =>
{
    let parentSubNodes = parentVN.subNodes!;
    let subNodeDisps = disp.subDisps!;

	// perform DOM operations according to sub-node disposition. We need to decide for each
	// node what node to use to insert or move it before. We go from the end of the list of
	// new nodes and on each iteration we decide the value of the "beforeDN".
    for( let i = subNodeDisps.length - 1; i >= 0; i--)
    {
        let subNodeDisp = subNodeDisps[i];
        let newVN = subNodeDisp.newVN!;

        // since we might be updating only a portion of the old sub-nodes, get the real index
        let index = disp.oldStartIndex! + i;

        // for the Update operation, the old node becomes a sub-node; for the Insert operation
        // the new node become a sub-node.
        let svn: IVN;
        if (subNodeDisp.action === VNDispAction.Insert)
        {
            // we must put the node in the list of sub-nodes before calling mountNode because it
            // may use this info if the node is cloned
            parentSubNodes[index] = svn = newVN;

            // if mountNode clones the node, it puts the new node into the list of sub-nodes
            // and returns it; otherwise, it returns the original node.
            newVN!.mount( parentVN, index, anchorDN, beforeDN);
        }
        else // Update or NoChange
        {
            let oldVN = subNodeDisp.oldVN!;
            parentSubNodes[index] = svn = oldVN;
            if (oldVN !== newVN)
            {
                // // if the creator for the new element is not determined yet, use current component
                // if (!newVN.creator)
                //     newVN.creator = s_currentClassComp;

                /// #if VERBOSE_NODE
                    console.debug( `Calling update() on node ${oldVN.name}`);
                /// #endif

                // update method must exists for nodes with action Update
                oldVN.update!( newVN, subNodeDisp);
            }

            // determine whether all the nodes under this VN should be moved.
            if (index !== oldVN.index)
                moveNode( oldVN, anchorDN, beforeDN);

            // we must assign the new index after the comparison above because otherwise the
            // comparison will not work
            svn.index = index;
        }


        // if the virtual node defines a DOM node, it becomes the DOM node before which
        // next components should be inserted/moved
        beforeDN = svn.getFirstDN() || beforeDN;
    }
}



// Performs updates and inserts by groups. We go from the end of the list of update groups
// and on each iteration we decide the value of the "beforeDN".
const updateSubNodesByGroups = (parentVN: IVN, disp: VNDisp, anchorDN: DN, beforeDN: DN): void =>
{
    let parentSubNodes = parentVN.subNodes!;
    let subNodeDisps = disp.subDisps!;
    let groups = disp.subGroups!;

    let currBeforeDN = beforeDN;
    let subNodeDisp: VNDisp;
    let newVN: IVN;
    let oldVN: IVN;
    let group: VNDispGroup;
	for( let i = groups.length - 1; i >= 0; i--)
	{
        group = groups[i];
        if (group.action === VNDispAction.Insert)
        {
            // mount every sub-node in the group and its sub-sub-nodes
            let groupLast = group.last;
            for( let j = group.first; j <= groupLast; j++)
            {
                subNodeDisp = subNodeDisps[j];
                newVN = subNodeDisp.newVN!;

                // since we might be updating only a portion of the old sub-nodes, get the real index
                let index = disp.oldStartIndex! + j;

                // we must put the node in the list of sub-nodes before calling
                // mountNode because it may use this info if the node is cloned
                parentSubNodes[index] = newVN;
                newVN.mount( parentVN, index, anchorDN, currBeforeDN);
            }
        }
        else if (group.action === VNDispAction.Update)
        {
            // update every sub-node in the group and its sub-sub-nodes
            let groupFirst = group.first;
            for( let j = group.last; j >= groupFirst; j--)
            {
                subNodeDisp = subNodeDisps[j];
                oldVN = subNodeDisp.oldVN!;
                newVN = subNodeDisp.newVN!;

                // since we might be updating only a portion of the old sub-nodes, get the real index
                let index = disp.oldStartIndex! + j;
                oldVN.index = index;
                parentSubNodes[index] = oldVN;

                if (oldVN !== newVN)
                {
                    // // if the creator for the new element is not determined yet, use current component
                    // if (!newVN.creator)
                    //     newVN.creator = s_currentClassComp;

                    /// #if VERBOSE_NODE
                        console.debug( `Calling update() on node ${oldVN.name}`);
                    /// #endif

                    // update method must exists for nodes with action Update
                    oldVN.update!( newVN, subNodeDisp);
                }
            }
        }
        else // NoChange)
        {
            // we can have nodes already in place - we check it by testing whether the first node
            // of the group is the same as the corresponding node in the old list of sub-nodes.
            // If this is not true, we just place every sub-node in the group into the parent's
            // sub-node array
            let groupFirst = group.first;
            if (parentSubNodes[disp.oldStartIndex! + groupFirst] !== subNodeDisps[groupFirst].oldVN)
            {
                for( let j = group.last; j >= groupFirst; j--)
                {
                    oldVN = subNodeDisps[j].oldVN!;
                    let index = disp.oldStartIndex! + j;
                    oldVN.index = index;
                    parentSubNodes[index] = oldVN;
                }
            }
        }

		// now that all nodes in the group have been updated or inserted, we can determine
		// first and last DNs for the group
		determineGroupDNs( group, subNodeDisps);

		// if the group has at least one DN, its first DN becomes the node before which the next
        // group of new nodes (if any) should be inserted.
		currBeforeDN = group.firstDN || currBeforeDN;
	}

    // Arrange the groups in order as in the new sub-node list, moving them if necessary.
	// We go from the last group to the second group in the list because as soon as we moved all
	// groups except the first one into their right places, the first group will be automatically
	// in the right place. We always have two groups (i and i-1), which allows us to understand
	// whether we need to swap them. If we do we move the smaller group.
    currBeforeDN = beforeDN;
	for( let i = groups.length - 1; i > 0; i--)
	{
		let group = groups[i];

		// determine whether the group should move. We take the last node from the group
		// and compare its DN's next sibling to the current "beforeDN".
		if (group.lastDN != null)
		{
			if (group.lastDN.nextSibling !== currBeforeDN)
			{
				// if the current group now resides before the previous group, then that means
				// that we are swapping two groups. In this case we want to move the shorter one.
                let prevGroup = groups[i-1];
				if (group.lastDN.nextSibling === prevGroup.firstDN && group.count > prevGroup.count)
					moveGroup( prevGroup, subNodeDisps, anchorDN, group.firstDN!);
				else
					moveGroup( group, subNodeDisps, anchorDN, currBeforeDN);
			}

			// the group's first DN becomes the new beforeDN. Note that firstDN cannot be null
			// because lastDN is not null
			currBeforeDN = group.firstDN!;
		}
	}
}



// Moves the given virtual node  so that all its immediate DNs reside before the given DN.
export const moveNode = (vn: IVN, anchorDN: DN, beforeDN: DN): void =>
{
    // check whether the last of the DOM nodes already resides right before the needed node
    let dns = vn.getImmediateDNs();
    if (!dns)
        return;
    else if (Array.isArray(dns))
    {
        if (dns[dns.length - 1]!.nextSibling === beforeDN)
            return;

        for( let dn of dns)
        {
            anchorDN!.insertBefore( dn!, beforeDN);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Elm, StatsAction.Moved);
            /// #endif
        }
    }
    else
    {
        if (dns.nextSibling === beforeDN)
            return;

        anchorDN!.insertBefore( dns, beforeDN);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Elm, StatsAction.Moved);
        /// #endif
    }

    /// #if USE_STATS
        if (!vn.ownDN)
            DetailedStats.log( vn.statsCategory, StatsAction.Moved);
    /// #endif
}



// Moves all the nodes in the given group before the given DOM node.
const moveGroup = (group: VNDispGroup, disps: VNDisp[], anchorDN: DN, beforeDN: DN): void =>
{
    let dns: DN | DN[] | null;
    let useNewVN = group.action === VNDispAction.Insert;
	for( let i = group.first, last = group.last; i <= last; i++)
	{
        dns = (useNewVN ? disps[i].newVN! : disps[i].oldVN!).getImmediateDNs();
        if (!dns)
            continue;
        else if (Array.isArray(dns))
        {
            for( let dn of dns)
            {
                anchorDN!.insertBefore( dn!, beforeDN);

                /// #if USE_STATS
                    DetailedStats.log( StatsCategory.Elm, StatsAction.Moved);
                /// #endif
            }
        }
        else
        {
            if (dns.nextSibling === beforeDN)
                return;

            anchorDN!.insertBefore( dns, beforeDN);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Elm, StatsAction.Moved);
            /// #endif
        }

        /// #if USE_STATS
            DetailedStats.log( (useNewVN ? disps[i].newVN! : disps[i].oldVN!).statsCategory, StatsAction.Moved);
        /// #endif
	}
}



/**
 * If a node has more than this number of sub-nodes, then we build groups. The idea is that
 * otherwise, the overhead of building groups is not worth it.
 */
const NO_GROUP_THRESHOLD = 8;



/**
 * Compares old and new chains of sub-nodes and determines what nodes should be created, deleted
 * or updated. The result is remembered as an array of VNDisp objects for each sub-node and as
 * array of old sub-nodes that should be deleted. In addition, the new sub-nodes are divided
 * into groups of consecutive nodes that should be updated and of nodes that should be inserted.
 * The groups are built in a way so that if a node should be moved, its entire group is moved.
 */
const buildSubNodeDispositions = (disp: VNDisp, newChain: IVN[] | null | undefined): void =>
{
    let oldChain = disp.oldVN?.subNodes;
    let oldStartIndex = disp.oldStartIndex || (disp.oldStartIndex = 0);
    let oldEndIndex = disp.oldEndIndex || (disp.oldEndIndex = (oldChain ? oldChain.length : 0));

    // oldLen is the length of the portion of the old sub-nodes that will be reconciled.
    let oldLen = disp.oldLength = oldEndIndex - oldStartIndex;
    let newLen = newChain ? newChain.length : 0;

    // if either old or new or both chains are empty, we do special things
    if (newLen === 0 && oldLen === 0)
    {
        // both chains are empty - do nothing
        disp.noChanges = true;
        return;
    }

    disp.allProcessed = oldLen === (oldChain ? oldChain.length : 0);
    if (newLen === 0 || oldLen === 0)
    {
        // either old or new chain is empty - either delete all old nodes or insert all new nodes
        disp.replaceAll = true;
        return;
    }

    let updateStrategy = disp.updateStrategy ?? disp.oldVN?.updateStrategy;

    // determine whether recycling of non-matching old keyed sub-nodes by non-matching new
    // keyed sub-nodes is allowed. If update strategy is not defined for the node, the
    // recycling is allowed.
    let allowKeyedNodeRecycling = !updateStrategy?.disableKeyedNodeRecycling;

    // determine whether we can ignore keys; if yes, we don't need to create a map of old sub-nodes;
    // instead, we can update old sub-nodes with new sub-nodes sequentially.
    let ignoreKeys = updateStrategy?.ignoreKeys;

    // process the special case with a single sub-node in both old and new chains just
    // to avoid creating temporary structures
    if (newLen === 1 && oldLen === 1)
    {
        let oldVN = oldChain![oldStartIndex]
        let newVN = newChain![0];
        if (oldVN === newVN)
            disp.noChanges = true;
        else if ((allowKeyedNodeRecycling || ignoreKeys || newVN.key === oldVN.key) &&
                    oldVN.constructor === newVN.constructor &&
                    (!oldVN.isUpdatePossible || oldVN.isUpdatePossible( newVN)
                ))
        {
            // old node can be updated with information from the new node
            disp.subDisps = [{ oldVN, newVN, action: VNDispAction.Update}];
        }
        else
        {
            // old node cannot be updated, so the new node will be inserted and the old node will
            // be removed
            disp.replaceAll = true;
        }

        return;
    }

    // prepare array for VNDisp objects for new nodes
    disp.subDisps = new Array( newLen);
    let hasUpdates: boolean;

    // if we can ignore keys, we don't need to create a map of old sub-nodes; instead, we can
    // update old sub-nodes with new sub-nodes sequentially.
    if (ignoreKeys)
        hasUpdates = reconcileWithoutKeys( disp, oldChain!, newChain!);
    else
    {
        // we are here if either old and new chains contain more than one node and we need to
        // reconcile the chains. First go over the old nodes and build a map of keyed ones and a
        // list of non-keyed ones. If there are more than one node with the same key, the first one
        // goes to the map and the rest to the unkeyed list.
        let oldKeyedMap = new Map<any,IVN>();
        let oldUnkeyedList: IVN[] = [];
        let oldVN: IVN;
        let key: any;
        for( let i = oldStartIndex; i < oldEndIndex; i++)
        {
            oldVN = oldChain![i];
            key = oldVN.key;
            if (key != null && !oldKeyedMap.has( key))
                oldKeyedMap.set( key, oldVN);
            else
                oldUnkeyedList.push( oldVN);
        }

        // if we didn't find any keys, we can run reconciliation that doesn't look at keys
        hasUpdates = oldKeyedMap.size === 0
            ? reconcileWithoutKeys( disp, oldUnkeyedList, newChain!)
            : allowKeyedNodeRecycling
                ? reconcileWithRecycling( disp, oldKeyedMap, oldUnkeyedList, newChain!)
                : reconcileWithoutRecycling( disp, oldKeyedMap, oldUnkeyedList, newChain!);
    }

    // if we don't have any updates, this means that all old nodes should be deleted and all new
    // nodes should be inserted.
    if (!hasUpdates)
    {
        disp.replaceAll = true;
        // disp.subNodeDisps = null;
        // disp.subNodesToRemove = null;
        // disp.subNodeGroups = null;
    }
    else
    {
        // if the number of sub-nodes is big enough and groups were not built yet, built them now.
        // The sequential reconciliation that ignores keys can build the groups as it iterate over
        // the sub-nodes, while reconciliations that look at keys cannot do it that way, so we'll
        // do it here.
        if (newLen > NO_GROUP_THRESHOLD && !disp.subGroups)
            disp.subGroups = buildSubNodeGroups( disp.subDisps);
    }
}



/**
 * Reconciles new and old nodes without paying attention to keys.
 */
const reconcileWithoutKeys = (disp: VNDisp, oldChain: IVN[], newChain: IVN[]): boolean =>
{
    let oldStartIndex = disp.oldStartIndex!;
    let oldLen = disp.oldLength!;
    let newLen = newChain.length;
    let commonLen = Math.min( oldLen, newLen);

    let subNodeDisps = disp.subDisps!;
    let subNodesToRemove: IVN[] = [];

    // loop over new nodes and determine which ones should be updated, inserted or deleted
    let hasUpdates = false;
    let subDisp: VNDisp, oldVN: IVN, newVN: IVN;
    for( let i = 0; i < commonLen; i++)
    {
        oldVN = oldChain[oldStartIndex + i];
        newVN = newChain[i];
        subNodeDisps[i] = subDisp = { newVN };
        if (oldVN === newVN)
        {
            subDisp.action = VNDispAction.NoChange;
            subDisp.oldVN = oldVN;

            // we still need to indicate that "update" happens, so that the replaceAllSubNodes
            // flag will not be set
            hasUpdates = true;
        }
        else if (oldVN.constructor === newVN.constructor && (!oldVN.isUpdatePossible || oldVN.isUpdatePossible( newVN)))
        {
            // old node can be updated with information from the new node
            subDisp.action = VNDispAction.Update;
            subDisp.oldVN = oldVN;
            hasUpdates = true;
        }
        else
        {
            // old node cannot be updated, so the new node will be inserted and the old node will
            // be removed
            subDisp.action = VNDispAction.Insert;
            subNodesToRemove.push( oldVN);
        }
    }

    if (hasUpdates)
    {
        // remaining new nodes will be inserted
        if (newLen > commonLen)
        {
            for( let i = commonLen; i < newLen; i++)
                subNodeDisps[i] = { newVN: newChain[i], action: VNDispAction.Insert };
        }

        // remaining old nodes will be removed
        if (oldLen > commonLen)
        {
            for( let i = commonLen; i < oldLen; i++)
                subNodesToRemove.push( oldChain[oldStartIndex + i]);
        }
    }

    if (subNodesToRemove.length > 0)
        disp.toRemove = subNodesToRemove;

    return hasUpdates;
}



/**
 * Reconciles new and old nodes without recycling non-matching keyed nodes.
 */
const reconcileWithoutRecycling = ( disp: VNDisp, oldKeyedMap: Map<any,IVN>,
    oldUnkeyedList: IVN[], newChain: IVN[]): boolean =>
{
    let subNodeDisps = disp.subDisps!;
    let subNodesToRemove: IVN[] = [];
    let oldUnkeyedListLength = oldUnkeyedList.length;

    // loop over new nodes and determine which ones should be updated, inserted or deleted
    let oldUnkeyedListIndex = 0;
    let hasUpdates = false;
    let subDisp: VNDisp, oldVN: IVN | null | undefined, key: any;
    newChain.forEach( (newVN, subNodeIndex) =>
    {
        // try to look up the old node by the new node's key if exists
        key = newVN.key;
        oldVN = null;
        if (key != null)
        {
            oldVN = oldKeyedMap.get( key);

            // if we find the old node by the key, remove it from the map; after the
            // reconciliation, all old nodes remaining in this map will be marked for removal.
            if (oldVN)
                oldKeyedMap.delete( key);
        }

        // if we have old nodes in the unkeyed list and the new node doesn't have key, use the
        // next old unkeyed node
        if (!oldVN && !key && oldUnkeyedListIndex != oldUnkeyedListLength)
            oldVN = oldUnkeyedList[oldUnkeyedListIndex++];

        subNodeDisps[subNodeIndex] = subDisp = { newVN };
        if (!oldVN)
            subDisp.action = VNDispAction.Insert;
        else if (oldVN === newVN)
        {
            subDisp.action = VNDispAction.NoChange;
            subDisp.oldVN = oldVN;

            // we still need to indicate that "update" happens, so that the replaceAllSubNodes
            // flag will not be set
            hasUpdates = true;
        }
        else if (key === oldVN.key && oldVN.constructor === newVN.constructor &&
                (!oldVN.isUpdatePossible || oldVN.isUpdatePossible( newVN)))
        {
            // old node can be updated with information from the new node
            subDisp.action = VNDispAction.Update;
            subDisp.oldVN = oldVN;
            hasUpdates = true;
        }
        else
        {
            // old node cannot be updated, so the new node will be inserted and the old node will
            // be removed
            subDisp.action = VNDispAction.Insert;
            subNodesToRemove.push( oldVN);
        }

        subDisp;
    });

    if (hasUpdates)
    {
        // old nodes remaining in the keyed map and in the unkeyed list will be removed
        oldKeyedMap.forEach( oldVN => subNodesToRemove.push( oldVN));
        for( let i = oldUnkeyedListIndex; i < oldUnkeyedListLength; i++)
            subNodesToRemove.push( oldUnkeyedList[i]);
    }

    if (subNodesToRemove.length > 0)
        disp.toRemove = subNodesToRemove;

    return hasUpdates;
}



/**
 * Reconciles new and old nodes with recycling non-matching keyed nodes.
 */
const reconcileWithRecycling = (disp: VNDisp, oldKeyedMap: Map<any,IVN>,
    oldUnkeyedList: IVN[], newChain: IVN[]): boolean =>
{
    let subNodeDisps = disp.subDisps!;
    let subNodesToRemove: IVN[] = [];
    let oldUnkeyedListLength = oldUnkeyedList.length;

    // loop over new nodes and determine which ones should be updated, inserted or deleted
    let oldUnkeyedListIndex = 0;
    let hasUpdates = false;
    let subDisp: VNDisp | null, oldVN: IVN | null | undefined, key: any;

    // the array of unmatched disps will point to the VNDisp objects already in the subNodesDisps
    let unmatchedDisps: VNDisp[] = [];
    newChain.forEach( (newVN, subNodeIndex) =>
    {
        // try to look up the old node by the new node's key if exists
        key = newVN.key;
        oldVN = null;
        if (key != null)
        {
            oldVN = oldKeyedMap.get( key);

            // if we find the old node by the key, remove it from the map; after the
            // reconciliation, all old nodes remaining in this map will be marked for removal.
            if (oldVN)
                oldKeyedMap.delete( key);
        }

        // if we have old nodes in the unkeyed list, use the next old unkeyed node
        if (!oldVN && oldUnkeyedListIndex != oldUnkeyedListLength)
            oldVN = oldUnkeyedList[oldUnkeyedListIndex++];

        subNodeDisps[subNodeIndex] = subDisp = { newVN };
        if (!oldVN)
        {
            // temporarily set the action to Insert but put the unmatched disp aside so that we can
            // later try to reconcile it with an unmatched old VN
            subDisp.action = VNDispAction.Insert;
            unmatchedDisps.push( subDisp);
        }
        else if (oldVN === newVN)
        {
            subDisp.action = VNDispAction.NoChange;
            subDisp.oldVN = oldVN;

            // we still need to indicate that "update" happens, so that the replaceAllSubNodes
            // flag will not be set
            hasUpdates = true;
        }
        else if (oldVN.constructor === newVN.constructor &&
                (!oldVN.isUpdatePossible || oldVN.isUpdatePossible( newVN)))
        {
            // old node can be updated with information from the new node
            subDisp.action = VNDispAction.Update;
            subDisp.oldVN = oldVN;
            hasUpdates = true;
        }
        else
        {
            // old node cannot be updated, so the new node will be inserted and the old node will
            // be removed
            subDisp.action = VNDispAction.Insert;
            subNodesToRemove.push( oldVN);
        }
    });

    // if we have unmatched new nodes and the map of old keyed nodes is not empty, try using the
    // old nodes for updates
    if (oldKeyedMap.size > 0)
    {
        let unmatchedDispsLength = unmatchedDisps.length;
        let unmatchedDispsIndex = 0;
        let newVN: IVN;
        oldKeyedMap.forEach( oldVN =>
        {
            subDisp = unmatchedDispsIndex < unmatchedDispsLength ? unmatchedDisps[unmatchedDispsIndex++] : null;
            if (!subDisp)
                subNodesToRemove.push( oldVN);
            else
            {
                newVN = subDisp.newVN!;
                if (oldVN === newVN)
                {
                    subDisp.action = VNDispAction.NoChange;
                    subDisp.oldVN = oldVN;

                    // we still need to indicate that "update" happens, so that the replaceAllSubNodes
                    // flag will not be set
                    hasUpdates = true;
                }
                else if (oldVN.constructor === newVN.constructor &&
                        (!oldVN.isUpdatePossible || oldVN.isUpdatePossible( newVN)))
                {
                    // old node can be updated with information from the new node
                    subDisp.action = VNDispAction.Update;
                    subDisp.oldVN = oldVN;
                    hasUpdates = true;
                }
                else
                {
                    // old node cannot be updated, so it will be removed (the action on the subDisp is already Insert)
                    subNodesToRemove.push( oldVN);
                }
            }
        });
    }

    if (hasUpdates)
    {
        // old nodes remaining in the keyed map and in the unkeyed list will be removed
        // oldKeyedMap.forEach( oldVN => subNodesToRemove.push( oldVN));
        for( let i = oldUnkeyedListIndex; i < oldUnkeyedListLength; i++)
            subNodesToRemove.push( oldUnkeyedList[i]);
    }

    if (subNodesToRemove.length > 0)
        disp.toRemove = subNodesToRemove;

    return hasUpdates;
}



/**
 * Determines first and last DOM nodes for the group. This method is invoked only after the
 * nodes were physically updated/inserted and we can obtain their DOM nodes.
 */
const determineGroupDNs = (group: VNDispGroup, disps: VNDisp[]) =>
{
    let useNewVN = group.action === VNDispAction.Insert;
    if (group.count === 1)
    {
        let vn = useNewVN ? disps[group.first].newVN! : disps[group.first].oldVN!;

        group.firstDN = vn.getFirstDN();
        group.lastDN = vn.getLastDN();
    }
    else
    {
        for( let i = group.first; i <= group.last; i++)
        {
            if (group.firstDN = (useNewVN ? disps[i].newVN! : disps[i].oldVN!).getFirstDN())
                break;
        }

        for( let i = group.last; i >= group.first; i--)
        {
            if (group.lastDN = (useNewVN ? disps[i].newVN! : disps[i].oldVN!).getLastDN())
                break;
        }
    }
}



/**
 * From a flat list of new sub-nodes builds groups of consecutive nodes that should be either
 * updated or inserted.
 */
const buildSubNodeGroups = (disps: VNDisp[]): VNDispGroup[] | undefined =>
{
    // we are here only if we have some number of sub-node dispositions
    let count = disps.length;

    // create array of groups and create the first group starting from the first node
    let group: VNDispGroup = { action: disps[0].action!, first: 0, last: 0, count: 1 };
    let subNodeGroups = [group];

    // loop over sub-nodes and on each iteration decide whether we need to open a new group
    // or put the current node into the existing group or close the existing group and open
    // a new one.
    let action: VNDispAction;
    let disp: VNDisp;
    let prevOldVN: IVN;
    for( let i = 1; i < count; i++)
    {
        disp = disps[i];
        action = disp.action!;
        if (action !== group.action)
        {
            // close the group with the previous index. Decrement the iterating index so that
            // the next iteration will open a new group. Note that we cannot be here for a node
            // that starts a new group because for such node disp.action === groupAction.
            group.last = i - 1;
            group.count = i - group.first;

            // open new group
            group = { action, first: i, last: i, count: 1 };
            subNodeGroups.push( group);
        }
        else if (action !== VNDispAction.Insert)
        {
            // an "update" sub-node is out-of-order and should close the current group if the index
            // of its previous sibling + 1 isn't equal to the index of this sub-node.
            // The last node will close the last group after the loop.
            prevOldVN = disps[i-1].oldVN!;
            if (!prevOldVN || prevOldVN.index + 1 !== disp.oldVN!.index)
            {
                // close the group with the current index.
                group.last = i - 1;
                group.count = i - group.first;

                // open new group
                group = { action, first: i, last: i, count: 1 };
                subNodeGroups.push( group);
            }
        }

        // all consecutive "insert" nodes belong to the same group so we just wait for the
        // next node
    }

    // close the last group
    group.last = count - 1;
    group.count = count - group.first;

    return subNodeGroups;
}



// Finds the first DOM node in the tree of virtual nodes that comes after our node that is a
// child of our own anchor element. We use it as a node before which to insert/move nodes of
// our sub-nodes during the reconciliation process. The algorithm first goes to the next
// siblings of our node and then to the next siblings of our parent node recursively. It stops
// when we either find a DOM node (then it is returned) or find a different anchor element
// (then null is returned). This method is called before the reconciliation process for our
// sub-nodes starts and, therefore, it only traverses mounted nodes.
const getNextDNUnderSameAnchorDN = (vn: IVN, anchorDN: DN): DN =>
{
    if (vn.ownDN)
        return null;

    // if we don't have parent, this means that it is a root node and it doesn't have siblings
    let parent = vn.parent;
    if (!parent)
        return null;

    // loop over our next siblings
    let siblings = parent.subNodes!;
	for( let i = vn.index + 1; i < siblings.length; i++)
	{
        let nvn = siblings[i];
		if (!nvn.anchorDN)
			return null;

		// note that getFirstDN call traverses the hierarchy of nodes. Note also that it
		// cannot find a node under a different anchor element because the first different
		// anchor element will be returned as a wanted node.
		const dn = nvn.getFirstDN();
		if (dn)
			return dn;
	}

	// recurse to our parent if it has the same anchor element
	return parent.anchorDN !== anchorDN ? null : parent.ownDN ? null : getNextDNUnderSameAnchorDN( parent, anchorDN);
}



// Returns array of node names starting with this node and up until the top-level node.
const getVNPath = (vn: IVN): string[] =>
{
	let path: string[] = [];
	for( let currVN: IVN | null | undefined = vn; currVN; currVN = currVN.parent)
		path.push( currVN.name ?? "");

	return path;
}



/**
 * Symbol used to set a "toVNs" function to certain classes. This function converts the instances
 * of these classes to a VN or an array of VNs. The signature of the function should be:
 * ```typescript
 * () => IVN | IVN[] | null | undefined
 * ```
 */
export let symToVNs = Symbol("toVNs");



/**
 * Symbol used to set a "jsxToVNs" function to certain classes. This function converts the instances
 * of these classes to a VN or an array of VNs. The signature of the function should be:
 * ```typescript
 * (props: Record<string,any> | undefined, children: IVN[] | null) => IVN | IVN[] | null | undefined
 * ```
 */
export let symJsxToVNs = Symbol("jsxToVNs");



// Creates an array of virtual nodes from the given content. Calls the createNodesFromContent and
// if it returns a single node, wraps it in an array.
export const content2VNs = (content: any): IVN[] | null =>
{
    let vns = content?.[symToVNs]();
    return !vns ? null : Array.isArray(vns) ? vns.length === 0 ? null : vns : [vns];
}



