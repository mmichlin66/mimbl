import {
    ScheduledFuncType, Component, Fragment, FuncProxy, PromiseProxy, CallbackWrappingParams,
    TickSchedulingType, UpdateStrategy
} from "../api/mim"
import {
    VN, DN, ElmVN, TextVN, IndependentCompVN, PromiseProxyVN, ClassCompVN, FuncProxyVN,
    ManagedCompVN, enterMutationScope, exitMutationScope, ChildrenUpdateRequest,
    ChildrenUpdateOperation, GrowRequest, MoveRequest, SetRequest, SpliceRequest, SwapRequest,
    TrimRequest, SliceRequest
} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif


// Set of nodes that should be updated on the next UI cycle. We use Set in order to not include
// the same node more than once - which can happen if the node's requestUpdate method is called
// more than once during a single run (e.g. during event processing).
let s_vnsScheduledForUpdate = new Map<VN,any>();

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
let s_currentClassComp: Component = null;

// Sets the given object as the current "creator" object.
export function setCurrentClassComp( comp: Component): Component
{
    let prevComp = s_currentClassComp;
    s_currentClassComp = comp;
    return prevComp;
}



// Parameter that was passed when a callback was wrapped and which is set during the callback execution.
let s_currentCallbackArg: any;

// Retrieves the argumnet that was passed when a callback was wrapped. This function can only be called
// from the callback itself while it is executing.
export function s_getCallbackArg(): any
{
    return s_currentCallbackArg;
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
 * Wraps the given callback and returns a wrapper function which does the following things:
 *   - Sets the given "creator" object as the current creator so that JSX execution can use it.
 *   - Sets "current callback argument" to the one passed when the callback was wrapped.
 *   - Enters mutation scope for the duration of the callback execution.
 * @param func Callback to be wrapped.
 * @param funcThisArg Object that will be the value of "this" when the callback is executed.
 * @param creator Object that is set as the current creator to be used when JSX is parsed..
 * @param schedulingType Type of scheduling a Mimbl tick.
 * @returns The wrapper function that should be used instead of the original callback.
 */
// export function s_wrapCallback<T extends Function>( func: T, funcThisArg?: any,
//     creator?: any, schedulingType?: TickSchedulingType): T
// {
//     return CallbackWrapper.bind( creator, func, funcThisArg, schedulingType);
// }
export function s_wrapCallback<T extends Function>( params: CallbackWrappingParams<T>): T
{
    return CallbackWrapper.bind( params);
}



/**
 * The CallbackWrapper function is used to wrap callbacks in order to have it executed in a Mimbl
 * context.
 */
function CallbackWrapper( this: CallbackWrappingParams<Function>): any
{
    // remember the current creator and set the new one
    let prevCreator = s_currentClassComp;
    s_currentClassComp = this.creator;

    // we don't want the triggers encountered during the callback execution to cause the watchers
    // to run immediately, so we enter mutation scope
    enterMutationScope();

    // if some scheduling type is set (that is, we are going to schedule a Mimbl tick after
    // the callback), we should ignore requests to schedule a tick made during the callback
    // execution
    let schedulingType = this.schedulingType || TickSchedulingType.Sync;
    s_ignoreSchedulingRequest = schedulingType !== TickSchedulingType.None;

    // params.arg will be available inside the callback via the getCurrentCallbackArg call.
    s_currentCallbackArg = this.arg;

    let retVal: any;
    try
	{
		retVal = this.func.apply( this.funcThisArg, arguments);
	}
	finally
	{
        exitMutationScope();
        s_currentCallbackArg = undefined;
        s_ignoreSchedulingRequest = false;
        s_currentClassComp = prevCreator;
    }

    // schedule a Mimbl tick if instructed to do so
    if (schedulingType)
        scheduleTick(schedulingType);

    return retVal;
}



/**
 * Schedule (or executes) Mimbl tick according to the given type.
 */
function scheduleTick( schedulingType: TickSchedulingType = TickSchedulingType.AnimationFrame): void
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
export function requestNodeUpdate( vn: VN, req?: ChildrenUpdateRequest, schedulingType?: TickSchedulingType): void
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

	// if this is a class-based component and it has beforeUpdate and/or afterUpdate methods
	// implemented, schedule their executions. Note that the "beforeUpdate" method is not
	// scheduled if the current scheduler state is BeforeUpdate. This is because the component
	// will be updated in the current cycle and there is already no time to execute the "before
	// update" method.
	if (vn instanceof ClassCompVN)
	{
        let comp = vn.comp;
        let func = comp.afterUpdate;
		if (func)
            s_callsScheduledAfterUpdate.set( func, s_wrapCallback( {func, funcThisArg: comp, creator: comp}));

        if (s_schedulerState !== SchedulerState.BeforeUpdate)
        {
            func = comp.beforeUpdate;
            if (func)
                s_callsScheduledBeforeUpdate.set( func, s_wrapCallback( {func, funcThisArg: comp, creator: comp}));
        }
	}

    // schedule Mimbl tick using animation frame. If this call comes from a wrapped callback, the
    // callback might schedule a tick using microtask. In this case, the animation frame will be
    // canceled. The update is scheduled in the next tick unless the request is made during a
    // "before update" function execution.
    if (!s_ignoreSchedulingRequest && s_schedulerState !== SchedulerState.BeforeUpdate)
        scheduleTick( schedulingType || TickSchedulingType.AnimationFrame);
}



// Schedules to call the given function either before or after all the scheduled components
// have been updated.
export function scheduleFuncCall( func: ScheduledFuncType, beforeUpdate: boolean,
    funcThisArg?: any, creator?: any, schedulingType?: TickSchedulingType): void
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
			s_callsScheduledBeforeUpdate.set( func, s_wrapCallback( {func, funcThisArg, creator}));

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
			s_callsScheduledAfterUpdate.set( func, s_wrapCallback( {func, funcThisArg, creator}));

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



// Performs the specified operation on the sub-nodes of the given node. This function is called
// when the operation is invoked synchronously; that is, without going through the Mimbl tick.
export function syncUpdate( vn: VN, req: ChildrenUpdateRequest)
{
    // it can happen that we encounter already unmounted virtual nodes - ignore them
    if (!vn.anchorDN)
        return;

    /// #if USE_STATS
        DetailedStats.start( `Sync update: `);
    /// #endif

    try
    {
        performChildrenOperation( vn, req);
    }
    catch( err)
    {
        // find the nearest error handling service. If nobody else, it is implemented
        // by the RootVN object.
        let errorService = vn.getService( "StdErrorHandling");
        if (errorService)
            errorService.reportError( err);
        else
            console.error( "BUG: updateNode threw exception but StdErrorHandling service was not found.", err);
    }

    /// #if USE_STATS
        DetailedStats.stop( true);
    /// #endif
}



// Callback that is called on a new UI cycle when there is a need to update UI components
function onAnimationFrame(): void
{
	// clear the scheduled frame handle so that new update requests will
	// schedule a new frame.
	s_scheduledFrameHandle = 0;

    performMimbleTick();
}



// Reconciler main entrance point
function performMimbleTick(): void
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
        s_vnsScheduledForUpdate = new Map<VN,any>();

        vnsScheduledForUpdate.forEach( (req: ChildrenUpdateRequest, vn: VN) =>
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
                    vn.performPartialUpdate();
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
                // find the nearest error handling service. If nobody else, it is implemented
                // by the RootVN object.
                let errorService = vn.getService( "StdErrorHandling");
                if (errorService)
                    errorService.reportError( err);
                else
                    console.error( "BUG: updateNode threw exception but StdErrorHandling service was not found.", err);
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
function callScheduledFunctions( funcs: Map<ScheduledFuncType,ScheduledFuncType>, beforeUpdate: boolean)
{
	funcs.forEach( wrapper =>
	{
		try
		{
			wrapper();
		}
		catch( err)
		{
			console.error( `Exception while invoking function ${beforeUpdate ? "before" : "after"} updating components\n`, err);
		}
	});
}



// Performs the specified operation on the sub-nodes of the given node.
function performChildrenOperation( vn: VN, req: ChildrenUpdateRequest)
{
    if (!req)
        rerenderNode( {oldVN: vn});
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
        }
    }

    s_currentClassComp = null;
}



// Updates the sub-nodes of the given node using new sub-nodes. New sub-nodes are obtained either
// by rendering the old node or by getting them from the new node.
function rerenderNode( disp: VNDisp): void
{
    // The render method is invoked on the old node assuming that the old node already has the
    // updated information from the new node. If, however, the old node doesn't have the render
    // method, we get the sub-nodes from the new node. For example, ElmVN doesn't have the render
    // method but it has the sub-nodes filled in during the JSX operations.
    // We call the render method without try/catch. If it throws, the control goes to either the
    // ancestor node that supports error handling or the Mimbl tick loop (which has try/catch).
	let oldVN = disp.oldVN;
    let fn: Function = oldVN.render;
    reconcileAndUpdateSubNodes( oldVN, disp,
        fn ? createVNChainFromContent( fn.call( oldVN)) : disp.newVN.subNodes);
}



// Unmounts existing sub-nodes of the given node and mounts the new ones obtained from the given
// new content.
function setNodeChildren( vn: VN, req: SetRequest): void
{
    if (req.update)
    {
        reconcileAndUpdateSubNodes( vn,
            {oldVN: vn, oldStartIndex: req.startIndex, odlEndIndex: req.endIndex, updateStrategy: req.updateStrategy},
            createVNChainFromContent( req.content));

        return;
    }

    let oldSubNodes = vn.subNodes;
    let oldLen = oldSubNodes ? oldSubNodes.length : 0;

    // validate request parameters
    let startIndex = req.startIndex || 0;
    if (startIndex < 0 || startIndex > oldLen)
    {
        /// #if DEBUG
            console.error( `Parameters for SetChildren operation are incorrect`, req);
        /// #endif

        return;
    }

    let endIndex = req.endIndex || oldLen;
    if (endIndex < 0 || endIndex > oldLen)
        endIndex = oldLen;
    else if (endIndex < startIndex)
    {
        /// #if DEBUG
            console.error( `Parameters for SetChildren operation are incorrect`, req);
        /// #endif

        return;
    }

    // if the range of old sub-nodes is only a portion of all sub-nodes, we call the Splice
    // operation; otherwise, we need to remove all old sub-nodes and add new
    let rangeLen = endIndex - startIndex;
    if (rangeLen < oldLen)
        spliceNodeChildren( vn, {index: startIndex, countToDelete: rangeLen, contentToInsert: req.content});
    else
    {
        let ownDN = vn.ownDN;
        if (oldSubNodes)
        {
            // if we are removing all sub-nodes under an element, we can optimize by setting
            // textContent to null;
            if (ownDN)
                (ownDN as Element).textContent = null;

            oldSubNodes.forEach( svn => { unmountNode( svn, !ownDN) });
        }

        let newSubNodes = req.content && createVNChainFromContent( req.content);
        if (newSubNodes)
        {
            let anchorDN = ownDN ? ownDN : vn.anchorDN;
            let beforeDN = ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN);
            newSubNodes.forEach( (svn, i) => { svn.index = i; mountNode( svn, vn, anchorDN, beforeDN); });
        }

        vn.subNodes = newSubNodes;
    }
}



// At the given index, removes a given number of sub-nodes and then inserts the new content.
function spliceNodeChildren( vn: VN, req: SpliceRequest): void
{
    let oldSubNodes = vn.subNodes;
    let oldLen = oldSubNodes ? oldSubNodes.length : 0;

    // validate request parameters
    let index = req.index;
    if (index < 0 || index > oldLen)
    {
        /// #if DEBUG
            console.error( `Parameters for SpliceChildren operation are incorrect`, req);
        /// #endif

        return;
    }

    // calculate the number of sub-nodes to delete
    let countToDelete = req.countToDelete || 0;
    if (countToDelete < 0)
    {
        /// #if DEBUG
            console.error( `Parameters for SpliceChildren operation are incorrect`, req);
        /// #endif

        return;
    }
    else
        countToDelete = Math.min( req.countToDelete, oldLen - index);

    let newSubNodes = req.contentToInsert && createVNChainFromContent( req.contentToInsert);
    if (countToDelete === 0 && !newSubNodes)
        return;

    // unmount nodes if necessary - note that it is OK if req.countToDelete is negative - it is
    // the same as if it was set to 0 because we only use >0 comparisons.
    if (countToDelete > 0)
    {
        let stopIndex = index + countToDelete;
        for( let i = index; i < stopIndex; i++)
            unmountNode( oldSubNodes[i], true);
    }

    if (!newSubNodes)
    {
        // if we don't have new sub-nodes, we just delete the old ones (if any)
        if (countToDelete > 0)
            oldSubNodes.splice( index, countToDelete);
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
            ? getFirstDN( oldSubNodes[index + newSubNodes.length])
            : ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN);

        // mount new nodes
        let stopIndex = index + newSubNodes.length;
        for( let i = index; i < stopIndex; i++)
        {
            oldSubNodes[i].index = i;
            mountNode( oldSubNodes[i], vn, anchorDN, beforeDN);
        }
    }
}

// Moves a range of sub-nodes to a new location. Moving a region to a new index is the same as
// swapping two adjacent regions - the region being moved and the region from either the new index
// to the beginning of the first region or the end of the first region to the new index.
function moveNodeChildren( vn: VN, req: MoveRequest): void
{
    if (req.shift  === 0 || req.count === 0)
        return;

    let oldSubNodes = vn.subNodes;
    let oldLen = oldSubNodes ? oldSubNodes.length : 0;
    if (oldLen < 2)
    {
        /// #if DEBUG
            console.error( `Parameters for MoveChildren operation are incorrect`);
        /// #endif

        return;
    }

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

    // validate request parameters
    if (index1 < 0 || index2 + count2 > oldLen)
    {
        /// #if DEBUG
            console.error( `Parameters for MoveChildren operation are incorrect`, req);
        /// #endif

        return;
    }

    swapNodeChildren( vn, { index1, count1, index2, count2 })
}



// Swaps two ranges of the element's sub-nodes. The ranges cannot intersect.
function swapNodeChildren( vn: VN, req: SwapRequest): void
{
    let oldSubNodes = vn.subNodes;
    let oldLen = oldSubNodes ? oldSubNodes.length : 0;
    if (oldLen < 2)
    {
        /// #if DEBUG
            console.error( `Parameters for SwapChildren operation are incorrect`, req);
        /// #endif

        return;
    }

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

    // validate request parameters
    if (index1 < 0 || index2 > oldLen || count1 <= 0 || count2 <= 0 ||
        index1 + count1 > index2 || index2 + count2 > oldLen)
    {
        /// #if DEBUG
            console.error( `Parameters for SwapChildren operation are incorrect`, req);
        /// #endif

        return;
    }

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
            moveDOMRange( vn, oldSubNodes, index1, count1, index2 + count2, anchorDN);
        else
            moveDOMRange( vn, oldSubNodes, index2, count2, index1, anchorDN);
    }
    else
    {
        // we are here if a non-empty range exists between the two input ranges. Having these
        // three ranges we will need to move only two of them, so we need to find the two smaller
        // ones.
        if (count1 <= count2 && count2 <= count3)
        {
            // 3 is the biggest: move 1 before 2 and move 2 before 3
            moveDOMRange( vn, oldSubNodes, index1, count1, index2, anchorDN);
            moveDOMRange( vn, oldSubNodes, index2, count2, index3, anchorDN);
        }
        else if (count1 <= count2 && count3 <= count2)
        {
            // 2 is the biggest: move 1 after 2 and move 3 before 1
            moveDOMRange( vn, oldSubNodes, index1, count1, index2 + count2, anchorDN);
            moveDOMRange( vn, oldSubNodes, index3, count3, index1, anchorDN);
        }
        else
        {
            // 1 is the biggest: move 2 before 1 and move 3 before 1
            moveDOMRange( vn, oldSubNodes, index2, count2, index1, anchorDN);
            moveDOMRange( vn, oldSubNodes, index3, count3, index1, anchorDN);
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
            let svn1 = oldSubNodes[i1], svn2 = oldSubNodes[i2];
            oldSubNodes[i1] = svn2; svn2.index = i1;
            oldSubNodes[i2] = svn1; svn1.index = i2;
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
            arr[targetIndex++] = oldSubNodes[i];

        // copy range 3 if not empty
        if (count3 > 0)
        {
            stopIndex = index3 + count3;
            for( let i = index3; i < stopIndex; i++)
                arr[targetIndex++] = oldSubNodes[i];
        }

        // copy range 1
        stopIndex = index1 + count1;
        for( let i = index1; i < stopIndex; i++)
            arr[targetIndex++] = oldSubNodes[i];

        // copy everything back and adjust indices
        let svn: VN;
        targetIndex = index1;
        for( let i = 0; i < totalLen; i++)
        {
            svn = arr[i];
            svn.index = targetIndex;
            oldSubNodes[targetIndex++] = svn;
        }
    }
}


// Moves the DOM nodes corresponding to the given range of sub-nodes. This function doesn't move
// the virtual node objects themselves within the list - only their corresponding DOM nodes.
function moveDOMRange( vn: VN, subNodes: VN[], index: number, count: number, indexBefore: number, anchorDN: DN)
{
    let beforeDN: DN;
    if (indexBefore == subNodes.length)
        beforeDN = vn.ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN);
    else
        beforeDN = getFirstDN( subNodes[indexBefore]);

    for( let i = 0; i < count; i++)
        moveNode( subNodes[index + i], anchorDN, beforeDN);
}



// At the given index, removes a given number of sub-nodes and then inserts the new content.
function sliceNodeChildren( vn: VN, req: SliceRequest): void
{
    let oldSubNodes = vn.subNodes;
    if (!oldSubNodes)
        return;

    let oldLen = oldSubNodes.length;

    // validate request parameters
    let startIndex = req.startIndex;
    if (startIndex < 0 || startIndex > oldLen)
    {
        /// #if DEBUG
            console.error( `Parameters for SliceChildren operation are incorrect`, req);
        /// #endif

        return;
    }

    let endIndex = req.endIndex != null ? Math.min( req.endIndex, oldLen) : oldLen;
    if (endIndex - startIndex === oldLen)
        return;

    // if the range is empty unmount all sub-nodes
    if (endIndex <= startIndex)
    {
        // if we are removing all sub-nodes under an element, we can optimize by setting
        // textContent to null;
        let ownDN = vn.ownDN;
        if (ownDN)
            (ownDN as Element).textContent = null;

        oldSubNodes.forEach( svn => { unmountNode( svn, !ownDN) });
        vn.subNodes = null;
        return;
    }

    // trim at start
    if (startIndex > 0)
    {
        for( let i = 0; i < startIndex; i++)
            unmountNode( oldSubNodes[i], true);
    }

    // trim at end
    if (endIndex < oldLen)
    {
        for( let i = endIndex; i < oldLen; i++)
            unmountNode( oldSubNodes[i], true);
    }

    // extract only remaining nodes and change their indices
    vn.subNodes = oldSubNodes.slice( startIndex, endIndex);
    vn.subNodes.forEach( (svn, i) => { svn.index = i });
}



// Removes the given number of nodes from the start and/or the end of the list of sub-nodes.
function trimNodeChildren( vn: VN, req: TrimRequest): void
{
    let oldSubNodes = vn.subNodes;
    if (!oldSubNodes)
        return;

    sliceNodeChildren( vn, { startIndex: req.startCount, endIndex: oldSubNodes.length - req.endCount })
}



// Adds new content before and/or after the existing children of the given node
function growNodeChildren( vn: VN, req: GrowRequest): void
{
    // convert content to arrays of sub-nodes. Note that arrays cannot be empty but can be null.
    let newStartSubNodes = req.startContent && createVNChainFromContent( req.startContent);
    let newEndSubNodes = req.endContent && createVNChainFromContent( req.endContent);
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
            : newStartSubNodes || newEndSubNodes;

        let beforeDN = ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN);
        vn.subNodes.forEach( (svn, i) => { svn.index = i; mountNode( svn, vn, anchorDN, beforeDN); });
        return;
    }

    // we are here if the array of old sub-nodes is not empty. Now create new array combining
    // new and old sub-nodes in the correct order.
    let newSubNodes = newStartSubNodes ? newStartSubNodes.concat( oldSubNodes) : oldSubNodes;
    if (newEndSubNodes)
        newSubNodes = newSubNodes.concat( newEndSubNodes);

    vn.subNodes = newSubNodes;

    // mount new sub-nodes at the start
    if (newStartSubNodes)
    {
        let beforeDN = getFirstDN( oldSubNodes[0]);
        newStartSubNodes.forEach( (svn, i) => { svn.index = i; mountNode( svn, vn, anchorDN, beforeDN); });

        // change indices of the old nodes
        let startIndex = newStartSubNodes.length;
        oldSubNodes.forEach( (svn, i) => { svn.index = startIndex + i });
    }

    // mount new sub-nodes at the end
    if (newEndSubNodes)
    {
        let beforeDN = ownDN ? null : getLastDN( oldSubNodes[oldSubNodes.length - 1]);
        if (beforeDN)
            beforeDN = beforeDN.nextSibling;

        let startIndex = newSubNodes.length - newEndSubNodes.length;
        newEndSubNodes.forEach( (svn, i) => { svn.index = startIndex + i; mountNode( svn, vn, anchorDN, beforeDN); });
    }
}



// Recursively creates and renders this node and its sub-nodes. This method is invoked
// when a node is first mounted. If an exception is thrown during the execution of this
// method (which can be only from components' willMount or render methods),
// the component is asked to handle the error. If the component handles the error, the
// content returned from the error handling method is rendered; otherwise, the exception
// is re-thrown. Thus, the exception is propagated up until it is handled by a node that
// handles it or up to the root node.
function mountNode( vn: VN, parent: VN, anchorDN: DN, beforeDN: DN): VN
{
    // if the node is already mounted, call its clone method if implemented.
    if (vn.anchorDN)
    {
        let fn = vn.clone;
        let clone = fn ? fn.call(vn) : vn;
        if (clone === vn)
        {
            // if the clone method is not implemented or if it returns the same node, we move the
            // node into the new position and indicate that we will not need to call unmount.
            vn.ignoreUnmount = true;
            vn.parent = parent;
            vn.anchorDN = anchorDN;
            moveNode( vn, anchorDN, beforeDN);
            return vn;
        }
        else
        {
            // if the clone method returns a new node, we replace the old node in the parent's
            // list of subnodes. Then we proceed with the mounting. We know that parent exists
            // because this method is not called on the RootVN.
            parent.subNodes[vn.index] = clone;
            vn = clone;
        }
    }

	// initialize the node
    vn.parent = parent;
	vn.anchorDN = anchorDN;

	/// #if VERBOSE_NODE
		console.debug( `Calling mount() on node ${vn.name}`);
	/// #endif
    let fn = vn.mount;
	fn && fn.call(vn);
	let ownDN = vn.ownDN;

    // some nodes don't implement the render method; for example, TextVNs don't have any sub-nodes
    // while ElmVNs have subNodes filed populated during JSX
    fn = vn.render;
    if (fn)
    {
        // we call the render method without try/catch
        vn.subNodes = createVNChainFromContent( fn.call(vn));
    }

    // a node may have sub-nodes even if it doesn't implement the render method - e.g. ElmVN
    if (vn.subNodes)
    {
        // determine what nodes to use as anchor and "before" for the sub-nodes
        let newAnchorDN = ownDN ? ownDN : anchorDN;
        let newBeforeDN = ownDN ? null : beforeDN;

        // since we have sub-nodes, we need to create nodes for them and render. If our node
        // knows to handle errors, we do it under try/catch; otherwise, the exceptions go to
        // either the ancestor node that knows to handle errors or to the Mimbl tick loop.
        if (!vn.supportsErrorHandling)
            vn.subNodes.forEach( (svn, i) => { svn.index = i; mountNode( svn, vn, newAnchorDN, newBeforeDN); });
        else
        {
            try
            {
                vn.subNodes.forEach( (svn, i) => { svn.index = i; mountNode( svn, vn, newAnchorDN, newBeforeDN); });
            }
            catch( err)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling handleError() on node ${vn.name}. Error:`, err);
                /// #endif

                // let the node handle the error and re-render; then we render the new
                // content but we do it without try/catch this time; otherwise, we may end
                // up in an infinite loop
                let newSubNodes = createVNChainFromContent( vn.handleError( err));

                // unmount existing sub-nodes (that were mounted so far)
                if (vn.subNodes)
                    vn.subNodes.forEach( svn => unmountNode( svn, true));

                // mount the new ones
                if (newSubNodes)
                {
                    vn.subNodes = newSubNodes;
                    vn.subNodes.forEach( (svn, i) => { svn.index = i; mountNode( svn, vn, newAnchorDN, newBeforeDN); });
                }
            }
        }
    }

	// if we have our own DOM node, add it under the anchor node
	if (ownDN)
		anchorDN.insertBefore( ownDN, beforeDN);

	/// #if VERBOSE_NODE
		console.debug( `Calling didMount() on node ${vn.name}`);
	/// #endif

    return vn;
}



// Recursively removes DOM nodes corresponding to this VN and its sub-nodes.
function unmountNode( vn: VN, removeOwnNode: boolean)
{
    if (vn.ignoreUnmount)
    {
        vn.ignoreUnmount = false;
        return;
    }

	// get the DOM node before we call unmount, because unmount will clear it.
	let ownDN = vn.ownDN;

    // call unmount on our node - regardless whether it has its own DN or not
    let fn: Function = vn.unmount;
    if (fn)
    {
        /// #if VERBOSE_NODE
            console.debug( `Calling unmount() on node ${vn.name}`);
        /// #endif
        fn.call(vn);
    }

    // If the virtual node has its own DOM node, remove it from the DOM tree unless the
    // removeOwnNode parameter is false, which means this node is removed when the upper
    // node is removed.
    if (ownDN)
    {
        vn.ownDN = null;
        if (removeOwnNode)
            (ownDN as any as ChildNode).remove();
    }

    if (vn.subNodes)
	{
        // DOM nodes of sub-nodes don't need to be removed if either the upper DOM node has
        // already been removed or our own DOM node is removed (true is only passed further if
        // our parameter was true and we don't have own DN). It can happen that if errors occur,
        // some elements in the VN.subNodes array are left empty. The forEach function skips
        // over empty slots.
        let removeSubNodeOwnNodes = removeOwnNode && !ownDN;
        vn.subNodes.forEach( svn => unmountNode( svn, removeSubNodeOwnNodes));
        vn.subNodes = null;
    }

    // mark the node as unmounted
	vn.anchorDN = null;
    vn.parent = null;
}



function reconcileAndUpdateSubNodes( vn: VN, disp: VNDisp, newSubNodes: VN[],
    catchErrors: boolean = true): void
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
        if (disp.replaceAllSubNodes)
        {
            if (disp.allSubNodesProcessed)
            {
                // if we are removing all sub-nodes under an element, we can optimize by setting
                // textContent to null;
                let ownDN = vn.ownDN;
                if (ownDN)
                    (ownDN as Element).textContent = null;

                oldSubNodes.forEach( svn => { unmountNode( svn, !ownDN) });
            }
            else
            {
                for( let i = disp.oldStartIndex; i < disp.odlEndIndex; i++)
                    unmountNode( oldSubNodes[i], true);
            }
        }
        else if (disp.subNodesToRemove)
        {
            for( let i = 0, len = disp.subNodesToRemove.length; i < len; i++)
                unmountNode( disp.subNodesToRemove[i], true);
        }

        if (!newSubNodes)
        {
            if (disp.allSubNodesProcessed)
                vn.subNodes = null;
            else
            {
                // remove the portion of the sub-nodes that was updated and update indices
                oldSubNodes.splice( disp.oldStartIndex, disp.oldLength)
                for( let i = disp.oldStartIndex, len = oldSubNodes.length; i < len; i++)
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
        let beforeDN = ownDN ? null : getNextDNUnderSameAnchorDN( vn, anchorDN);

        // since we have sub-nodes, we need to create nodes for them and render. If our node
        // knows to handle errors, we do it under try/catch; otherwise, the exceptions go to
        // either the uncestor node that knows to handle errors or to the Mimbl tick loop.
        if (!catchErrors! || vn.supportsErrorHandling)
            updateSubNodes( vn, disp, newSubNodes, anchorDN, beforeDN);
        else
        {
            try
            {
                updateSubNodes( vn, disp, newSubNodes, anchorDN, beforeDN);
            }
            catch( err)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling handleError() on node ${vn.name}. Error`, err);
                /// #endif

                // let the node handle its own error and re-render; then we render the new
                // content but we do it without try/catch this time; otherwise, we may end
                // up in an infinite loop
                newSubNodes = vn.handleError( err);

                // update sub-nodes with the new data without catching errors
                reconcileAndUpdateSubNodes( vn, {oldVN: disp.oldVN}, newSubNodes, false);
            }
        }
    }

    if (disp.action === VNDispAction.Update)
    {
        // notify the new component that it replaced the old component. If components cache some
        // JSX-produced nodes, this is the opportunity to copy them from the old to the new. This
        // is because the old nodes are updated from the new ones and the new ones discarded.
        let fn = disp.newVN.didUpdate;
        fn && fn.call( vn);
    }

    // indicate that the node was updated in this cycle - this will prevent it from
    // rendering again in this cycle.
    vn.lastUpdateTick = s_currentTick;
}



// Performs rendering phase of the update on the sub-nodes of the node, which is passed as
// the oldVN member of the VNDisp structure.
function updateSubNodes( vn: VN, disp: VNDisp, newSubNodes: VN[], anchorDN: DN, beforeDN: DN): void
{
    let oldSubNodes = vn.subNodes;
    if (disp.replaceAllSubNodes)
    {
        if (disp.allSubNodesProcessed)
        {
            vn.subNodes = newSubNodes;
            newSubNodes.forEach( (svn, i) => { svn.index = i; mountNode( svn, vn, anchorDN, beforeDN); });
        }
        else
        {
            // replace the portion of the sub-nodes that was updated and update indices
            let oldStartIndex = disp.oldStartIndex;
            oldSubNodes.splice( oldStartIndex, disp.oldLength)
            for( let i = disp.oldStartIndex + newSubNodes.length, len = oldSubNodes.length; i < len; i++)
                oldSubNodes[i].index = i;

            newSubNodes.forEach( (svn, i) => { svn.index = oldStartIndex + i; mountNode( svn, vn, anchorDN, beforeDN); });
        }

    }
    else
    {
        // re-create our current list of sub-nodes - we will populate it while updating them. If
        // the number of nodes in the new list is the same as the previous number of nodes, we
        // don't re-allocate the array. This can also help if there are old nodes that should not
        // be changed
        if (!oldSubNodes)
            vn.subNodes = new Array<VN>(newSubNodes.length);
        else if (disp.oldLength > newSubNodes.length)
            oldSubNodes.splice( newSubNodes.length);

        // perform updates and inserts by either groups or individual nodes.
        if (disp.subNodeGroups)
            updateSubNodesByGroups( vn, disp, anchorDN, beforeDN);
        else
            updateSubNodesByNodes( vn, disp, anchorDN, beforeDN);
    }
}



// Performs updates and inserts by individual nodes.
function updateSubNodesByNodes( parentVN: VN, disp: VNDisp, anchorDN: DN, beforeDN: DN): void
{
    let parentSubNodes = parentVN.subNodes;
    let subNodeDisps = disp.subNodeDisps;

	// perform DOM operations according to sub-node disposition. We need to decide for each
	// node what node to use to insert or move it before. We go from the end of the list of
	// new nodes and on each iteration we decide the value of the "beforeDN".
    for( let i = subNodeDisps.length - 1; i >= 0; i--)
    {
        let subNodeDisp = subNodeDisps[i];
        let newVN = subNodeDisp.newVN;
        let oldVN = subNodeDisp.oldVN;

        // since we might be updating only a portion of the old sub-nodes, get the real index
        let index = disp.oldStartIndex + i;

        // for the Update operation, the old node becomes a sub-node; for the Insert operation
        // the new node become a sub-node.
        let svn: VN;
        if (subNodeDisp.action === VNDispAction.Insert)
        {
            // we must assign the index and put the node in the list of sub-nodes before calling
            // mountNode because it may use this info if the node is cloned
            newVN.index = index;
            parentSubNodes[index] = newVN;

            // if mountNode clones the node, it puts the new node into the list of sub-nodes
            // and returns it; otherwise, it returns the original node.
            svn = mountNode( newVN, parentVN, anchorDN, beforeDN);
        }
        else // Update or NoChange
        {
            parentSubNodes[index] = svn = oldVN;
            if (oldVN !== newVN)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling update() on node ${oldVN.name}`);
                /// #endif

                // update method must exists for nodes with action Update
                if (oldVN.update( newVN))
                    rerenderNode( subNodeDisp);
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
        beforeDN = getFirstDN( svn) || beforeDN;
    }
}



// Performs updates and inserts by groups. We go from the end of the list of update groups
// and on each iteration we decide the value of the "beforeDN".
function updateSubNodesByGroups( parentVN: VN, disp: VNDisp, anchorDN: DN, beforeDN: DN): void
{
    let parentSubNodes = parentVN.subNodes;
    let subNodeDisps = disp.subNodeDisps;
    let groups = disp.subNodeGroups;

    let currBeforeDN = beforeDN;
    let subNodeDisp: VNDisp;
    let newVN: VN;
    let oldVN: VN;
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
                newVN = subNodeDisp.newVN;

                // since we might be updating only a portion of the old sub-nodes, get the real index
                let index = disp.oldStartIndex + j;

                // we must assign the index and put the node in the list of sub-nodes before calling
                // mountNode because it may use this info if the node is cloned
                newVN.index = index;
                parentSubNodes[index] = newVN;
                mountNode( newVN, parentVN, anchorDN, currBeforeDN);
            }
        }
        else if (group.action === VNDispAction.Update)
        {
            // update every sub-node in the group and its sub-sub-nodes
            let groupFirst = group.first;
            for( let j = group.last; j >= groupFirst; j--)
            {
                subNodeDisp = subNodeDisps[j];
                newVN = subNodeDisp.newVN;
                oldVN = subNodeDisp.oldVN;

                // since we might be updating only a portion of the old sub-nodes, get the real index
                let index = disp.oldStartIndex + j;
                oldVN.index = index;
                parentSubNodes[index] = oldVN;

                /// #if VERBOSE_NODE
                    console.debug( `Calling update() on node ${oldVN.name}`);
                /// #endif

                // update method must exists for nodes with action Update
                if (oldVN.update( newVN))
                    rerenderNode( subNodeDisp);
            }
        }
        else // NoChange)
        {
            // we can have nodes already in place - we check it by testing whether the first node
            // of the group is the same as the corresponding node in the old list of sub-nodes.
            // If this is not true, we just place every sub-node in the group into the parent's
            // sub-node array
            let groupFirst = group.first;
            if (parentSubNodes[disp.oldStartIndex + groupFirst] !== subNodeDisps[groupFirst].oldVN)
            {
                for( let j = group.last; j >= groupFirst; j--)
                {
                    oldVN = subNodeDisps[j].oldVN;
                    let index = disp.oldStartIndex + j;
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
					moveGroup( prevGroup, subNodeDisps, anchorDN, group.firstDN);
				else
					moveGroup( group, subNodeDisps, anchorDN, currBeforeDN);
			}

			// the group's first DN becomes the new beforeDN. Note that firstDN cannot be null
			// because lastDN is not null
			currBeforeDN = group.firstDN;
		}
	}
}



// Moves the given virtual node  so that all its immediate DNs reside before the given DN.
function moveNode( vn: VN, anchorDN: DN, beforeDN: DN): void
{
    // check whether the last of the DOM nodes already resides right before the needed node
    let dns = getImmediateDNs( vn);
    if (!dns || dns[dns.length - 1].nextSibling === beforeDN)
        return;

    for( let dn of dns)
    {
        anchorDN.insertBefore( dn, beforeDN);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Elm, StatsAction.Moved);
        /// #endif
    }

    /// #if USE_STATS
        DetailedStats.log( vn.statsCategory, StatsAction.Moved);
    /// #endif
}



// Moves all the nodes in the given group before the given DOM node.
function moveGroup( group: VNDispGroup, disps: VNDisp[], anchorDN: DN, beforeDN: DN): void
{
    let dns: DN[];
    let useNewVN = group.action === VNDispAction.Insert;
	for( let i = group.first; i <= group.last; i++)
	{
        if (dns = getImmediateDNs( useNewVN ? disps[i].newVN : disps[i].oldVN))
        {
            for( let dn of dns)
            {
                anchorDN.insertBefore( dn, beforeDN);

                /// #if USE_STATS
                    DetailedStats.log( StatsCategory.Elm, StatsAction.Moved);
                /// #endif
            }

            /// #if USE_STATS
                DetailedStats.log( (useNewVN ? disps[i].newVN : disps[i].oldVN).statsCategory, StatsAction.Moved);
            /// #endif
        }
	}
}



/**
 * The VNAction enumeration specifies possible actions to perform for sub-nodes during
 * reconciliation process.
 */
const enum VNDispAction
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
type VNDisp =
{
	/** Old virtual node to be updated. This can be null only only for the Insert action. */
	oldVN?: VN;

	/** New virtual node to insert or to update an old node. */
	newVN?: VN;

	/** Action to be performed on the node */
	action?: VNDispAction;

    /** Start index in the old array of sub-nodes; if undefined, 0 is used. */
    oldStartIndex?: number;

    /** End index in the old array of sub-nodes; if undefined, the array length is used. */
    odlEndIndex?: number;

    /** Update strategy object; if undefined, the update strategy from the oldVN is used. */
    updateStrategy?: UpdateStrategy;

    /** Length of the (sub-)array of old sub-nodes. */
    oldLength?: number;

    /** Flag indicating that all old sub-nodes are being updated. This is true if oldLength === oldSubNodes.length */
    allSubNodesProcessed?: boolean;

    /**
     * Flag indicating that no action should be taken; that is, the new sub-nodes are the same as old ones.
     */
	noChanges?: boolean;

    /**
     * Flag indicating that all old sub-nodes should be deleted and all new sub-nodes inserted.
     * If this flag is set, the subNodeDisps, subNodesToRemove and subNodeGroups fields are
     * ignored.
     */
	replaceAllSubNodes?: boolean;

	/**
	 * Array of disposition objects for sub-nodes. This includes nodes to be updated
	 * and to be inserted.
	 */
	subNodeDisps?: VNDisp[];

	/** Array of sub-nodes that should be removed during update of the sub-nodes. */
	subNodesToRemove?: VN[];

	/** Array of groups of sub-nodes that should be updated or inserted. */
	subNodeGroups?: VNDispGroup[];
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
function buildSubNodeDispositions( disp: VNDisp, newChain: VN[]): void
{
    let oldChain = disp.oldVN.subNodes;
    let oldStartIndex = disp.oldStartIndex || (disp.oldStartIndex = 0);
    let oldEndIndex = disp.odlEndIndex || (disp.odlEndIndex = (oldChain ? oldChain.length : 0));

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

    disp.allSubNodesProcessed = oldLen === (oldChain ? oldChain.length : 0);
    if (newLen === 0 || oldLen === 0)
    {
        // either old or new chain is empty - either delete all old nodes or insert all new nodes
        disp.replaceAllSubNodes = true;
        return;
    }

    let updateStrategy = disp.updateStrategy || disp.oldVN.updateStrategy;

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
        let oldVN = oldChain[oldStartIndex]
        let newVN = newChain[0];
        if (oldVN === newVN)
            disp.noChanges = true;
        else if ((allowKeyedNodeRecycling || ignoreKeys || newVN.key === oldVN.key) &&
                    oldVN.constructor === newVN.constructor &&
                    (!oldVN.isUpdatePossible || oldVN.isUpdatePossible( newVN)
                ))
        {
            // old node can be updated with information from the new node
            disp.subNodeDisps = [{ oldVN, newVN, action: VNDispAction.Update}];
        }
        else
        {
            // old node cannot be updated, so the new node will be inserted and the old node will
            // be removed
            disp.replaceAllSubNodes = true;
        }

        return;
    }

    // prepare array for VNDisp objects for new nodes
    disp.subNodeDisps = new Array( newLen);
    let subNodesToRemove: VN[] = [];
    let hasUpdates: boolean;

    // if we can ignore keys, we don't need to create a map of old sub-nodes; instead, we can
    // update old sub-nodes with new sub-nodes sequentially.
    if (ignoreKeys)
    {
        hasUpdates = reconcileWithoutKeys( oldChain, oldStartIndex, oldEndIndex, newChain,
            disp.subNodeDisps, subNodesToRemove);
    }
    else
    {
        // we are here if either old and new chains contain more than one node and we need to
        // reconcile the chains. First go over the old nodes and build a map of keyed ones and a
        // list of non-keyed ones. If there are more than one node with the same key, the first one
        // goes to the map and the rest to the unkeyed list.
        let oldKeyedMap = new Map<any,VN>();
        let oldUnkeyedList: VN[] = [];
        let oldVN: VN;
        let key: any;
        for( let i = oldStartIndex; i < oldEndIndex; i++)
        {
            oldVN = oldChain[i];
            key = oldVN.key;
            if (key != null && !oldKeyedMap.has( key))
                oldKeyedMap.set( key, oldVN);
            else
                oldUnkeyedList.push( oldVN);
        }

        hasUpdates = allowKeyedNodeRecycling
            ? reconcileWithRecycling( oldKeyedMap, oldUnkeyedList, newChain, disp.subNodeDisps, subNodesToRemove)
            : reconcileWithoutRecycling( oldKeyedMap, oldUnkeyedList, newChain, disp.subNodeDisps, subNodesToRemove);
    }

    // if we don't have any updates, this means that all old nodes should be deleted and all new
    // nodes should be inserted.
    if (!hasUpdates)
    {
        disp.replaceAllSubNodes = true;
        disp.subNodeDisps = null;
    }
    else
    {
        if (subNodesToRemove.length > 0)
            disp.subNodesToRemove = subNodesToRemove;

        if (newLen > NO_GROUP_THRESHOLD)
            disp.subNodeGroups = buildSubNodeGroups( disp.subNodeDisps);
    }
}



/**
 * Reconciles new and old nodes without paying attention to keys.
 */
function reconcileWithoutKeys( oldChain: VN[], oldStartIndex: number, oldEndIndex: number,
    newChain: VN[], subNodeDisps: VNDisp[], subNodesToRemove: VN[]): boolean
{
    let oldLen = oldEndIndex - oldStartIndex;
    let newLen = newChain.length;
    let commonLen = Math.min( oldLen, newLen);

    // loop over new nodes and determine which ones should be updated, inserted or deleted
    let subDisp: VNDisp;
    let hasUpdates = false;
    let oldVN: VN, newVN: VN;
    for( let i = 0; i < commonLen; i++)
    {
        oldVN = oldChain[oldStartIndex + i];
        newVN = newChain[i];
        subDisp = { newVN };
        if (oldVN === newVN)
        {
            subDisp.action = VNDispAction.NoChange;
            subDisp.oldVN = oldVN;

            // we still need to indicate that "update" happens, so that the replaceAllSubNodes
            // flag will not be set
            hasUpdates = true;
        }
        else if (oldVN.constructor === newVN.constructor &&
                (oldVN.isUpdatePossible === undefined || oldVN.isUpdatePossible( newVN)))
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

        subNodeDisps[i] = subDisp;
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

    return hasUpdates;
}



/**
 * Reconciles new and old nodes without recycling non-matching keyed nodes.
 */
function reconcileWithoutRecycling( oldKeyedMap: Map<any,VN>, oldUnkeyedList: VN[], newChain: VN[],
    subNodeDisps: VNDisp[], subNodesToRemove: VN[]): boolean
{
    // remember the length of the unkeyed list;
    let oldUnkeyedListLength = oldUnkeyedList.length;

    // loop over new nodes and determine which ones should be updated, inserted or deleted
    let oldUnkeyedListIndex = 0;
    let subDisp: VNDisp;
    let hasUpdates = false;
    let oldVN: VN;
    let key: any;
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

        subDisp = { newVN };
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
                (oldVN.isUpdatePossible === undefined || oldVN.isUpdatePossible( newVN)))
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

        subNodeDisps[subNodeIndex] = subDisp;
    });

    if (hasUpdates)
    {
        // old nodes remaining in the keyed map and in the unkeyed list will be removed
        oldKeyedMap.forEach( oldVN => subNodesToRemove.push( oldVN));
        for( let i = oldUnkeyedListIndex; i < oldUnkeyedListLength; i++)
            subNodesToRemove.push( oldUnkeyedList[i]);
    }

    return hasUpdates;
}



/**
 * Reconciles new and old nodes with recycling non-matching keyed nodes.
 */
function reconcileWithRecycling( oldKeyedMap: Map<any,VN>, oldUnkeyedList: VN[], newChain: VN[],
    subNodeDisps: VNDisp[], subNodesToRemove: VN[]): boolean
{
    // remember the length of the unkeyed list;
    let oldUnkeyedListLength = oldUnkeyedList.length;

    // loop over new nodes and determine which ones should be updated, inserted or deleted
    let oldUnkeyedListIndex = 0;
    let subDisp: VNDisp;
    let hasUpdates = false;
    let oldVN: VN;
    let key: any;

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

        subDisp = { newVN };
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
                (oldVN.isUpdatePossible === undefined || oldVN.isUpdatePossible( newVN)))
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

        subNodeDisps[subNodeIndex] = subDisp;
    });

    // if we have unmatched new nodes and the map of old keyed nodes is not empty, try using the
    // old nodes for updates
    if (oldKeyedMap.size > 0)
    {
        let unmatchedDispsLength = unmatchedDisps.length;
        let unmatchedDispsIndex = 0;
        let newVN: VN;
        oldKeyedMap.forEach( oldVN =>
        {
            subDisp = unmatchedDispsIndex < unmatchedDispsLength ? unmatchedDisps[unmatchedDispsIndex++] : null;
            if (!subDisp)
                subNodesToRemove.push( oldVN);
            else
            {
                newVN = subDisp.newVN;
                if (oldVN === newVN)
                {
                    subDisp.action = VNDispAction.NoChange;
                    subDisp.oldVN = oldVN;

                    // we still need to indicate that "update" happens, so that the replaceAllSubNodes
                    // flag will not be set
                    hasUpdates = true;
                }
                else if (oldVN.constructor === newVN.constructor &&
                        (oldVN.isUpdatePossible === undefined || oldVN.isUpdatePossible( newVN)))
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

        oldKeyedMap.clear();
    }

    if (hasUpdates)
    {
        // old nodes remaining in the keyed map and in the unkeyed list will be removed
        // oldKeyedMap.forEach( oldVN => subNodesToRemove.push( oldVN));
        for( let i = oldUnkeyedListIndex; i < oldUnkeyedListLength; i++)
            subNodesToRemove.push( oldUnkeyedList[i]);
    }

    return hasUpdates;
}



/**
 * The VNDispGroup class describes a group of consecutive VNDisp objects correspponding to the
 * sequence of sub-nodes. The group is described using indices of VNDisp objects in the
 * subNodeDisp field of the parent VNDisp object.
 */
interface VNDispGroup
{
	// /** parent VNDisp to which this group belongs */
	// parentDisp: VNDisp;

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
 * Determines first and last DOM nodes for the group. This method is invoked only after the
 * nodes were physically updated/inserted and we can obtain their DOM nodes.
 */
function determineGroupDNs( group: VNDispGroup, disps: VNDisp[])
{
    let useNewVN = group.action === VNDispAction.Insert;
    if (group.count === 1)
    {
        let vn = useNewVN ? disps[group.first].newVN : disps[group.first].oldVN;

        group.firstDN = getFirstDN(vn);
        group.lastDN = getLastDN( vn);
    }
    else
    {
        for( let i = group.first; i <= group.last; i++)
        {
            if (group.firstDN = getFirstDN( useNewVN ? disps[i].newVN : disps[i].oldVN))
                break;
        }

        for( let i = group.last; i >= group.first; i--)
        {
            if (group.lastDN = getLastDN( useNewVN ? disps[i].newVN : disps[i].oldVN))
                break;
        }
    }
}



/**
 * From a flat list of new sub-nodes builds groups of consecutive nodes that should be either
 * updated or inserted.
 */
function buildSubNodeGroups( disps: VNDisp[]): VNDispGroup[]
{
    // we are here only if we have some number of sub-node dispositions
    let count = disps.length;

    /// #if DEBUG
        // this method is not supposed to be called if the number of sub-nodes is less then
        // the pre-determined threshold
        if (count <= NO_GROUP_THRESHOLD || count === 0)
            return;
    /// #endif

    // create array of groups and create the first group starting from the first node
    let group: VNDispGroup = { action: disps[0].action, first: 0 };
    let subNodeGroups = [group];

    // loop over sub-nodes and on each iteration decide whether we need to open a new group
    // or put the current node into the existing group or close the existing group and open
    // a new one.
    let action: VNDispAction;
    let disp: VNDisp;
    let prevOldVN: VN;
    for( let i = 1; i < count; i++)
    {
        disp = disps[i];
        action = disp.action;
        if (action !== group.action)
        {
            // close the group with the previous index. Decrement the iterating index so that
            // the next iteration will open a new group. Note that we cannot be here for a node
            // that starts a new group because for such node disp.action === groupAction.
            group.last = i - 1;
            group.count = i - group.first;

            // open new group
            group = { action, first: i };
            subNodeGroups.push( group);
        }
        else if (action !== VNDispAction.Insert)
        {
            // an "update" sub-node is out-of-order and should close the current group if the index
            // of its previous sibling + 1 isn't equal to the index of this sub-node.
            // The last node will close the last group after the loop.
            prevOldVN = disps[i-1].oldVN;
            if (!prevOldVN || prevOldVN.index + 1 !== disp.oldVN.index)
            {
                // close the group with the current index.
                group.last = i - 1;
                group.count = i - group.first;

                // open new group
                group = { action, first: i };
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



// Returns the first DOM node defined by either this virtual node or one of its sub-nodes.
// This method is only called on the mounted nodes.
function getFirstDN( vn: VN): DN
{
	if (vn.ownDN)
		return vn.ownDN;
	else if (!vn.subNodes)
		return null;

	// recursively call this method on the sub-nodes from first to last until a valid node
	// is returned
	let dn: DN;
	for( let svn of vn.subNodes)
	{
		if (dn = getFirstDN( svn))
			return dn;
	}

	return null;
}



// Returns the last DOM node defined by either this virtual node or one of its sub-nodes.
// This method is only called on the mounted nodes.
function getLastDN( vn: VN): DN
{
	if (vn.ownDN)
		return vn.ownDN;
	else if (!vn.subNodes)
		return null;

	// recursively call this method on the sub-nodes from last to first until a valid node
	// is returned
	let dn: DN;
	for( let i = vn.subNodes.length - 1; i >= 0; i--)
	{
		if (dn = getLastDN( vn.subNodes[i]))
			return dn;
	}

	return null;
}



// Returns the list of DOM nodes that are immediate children of this virtual node; that is, are
// NOT children of sub-nodes that have their own DOM node. May return null but never returns
// empty array.
function getImmediateDNs( vn: VN): DN[] | null
{
	if (vn.ownDN)
        return [vn.ownDN];
    else if (!vn.subNodes)
        return null;

	let arr: DN[] = [];
    vn.subNodes.forEach( svn => collectImmediateDNs( svn, arr));
	return arr.length === 0 ? null : arr;
}



// Collects all DOM nodes that are the immediate children of this virtual node (that is,
// are NOT children of sub-nodes that have their own DOM node) into the given array.
function collectImmediateDNs( vn: VN, arr: DN[]): void
{
	if (vn.ownDN)
		arr.push( vn.ownDN);
	else if (vn.subNodes)
		vn.subNodes.forEach( svn => collectImmediateDNs( svn, arr));
}



// Finds the first DOM node in the tree of virtual nodes that comes after our node that is a
// child of our own anchor element. We use it as a node before which to insert/move nodes of
// our sub-nodes during the reconciliation process. The algorithm first goes to the next
// siblings of our node and then to the next siblings of our parent node recursively. It stops
// when we either find a DOM node (then it is returned) or find a different anchor element
// (then null is returned). This method is called before the reconciliation process for our
// sub-nodes starts and, therefore, it only traverses mounted nodes.
function getNextDNUnderSameAnchorDN( vn: VN, anchorDN: DN): DN
{
	// check if we have sibling DOM nodes after our last sub-node - that might be elements
	// not controlled by our component. Note that we have either null or non-empty array.
	if (vn.subNodes)
	{
		let dn = getLastDN( vn.subNodes[vn.subNodes.length - 1]);
		if (dn)
		{
			let nextSibling = dn.nextSibling;
			if (nextSibling)
				return nextSibling;
		}
	}

    // if we don't have parent, this means that it is a root node and it doesn't have siblings
    if (!vn.parent)
        return null;

    // loop over our next siblings
    let siblings = vn.parent.subNodes;
	for( let i = vn.index + 1; i < siblings.length; i++)
	{
        let nvn = siblings[i];
		if (!nvn.anchorDN)
			return null;

		// note that getLastDN call traverses the hierarchy of nodes. Note also that it
		// cannot find a node under a different anchor element because the first different
		// anchor element will be returned as a wanted node.
		const dn = getLastDN( nvn);
		if (dn)
			return dn;
	}

	// recurse to our parent if it has the same anchor element
	return vn.parent.anchorDN !== anchorDN ? null : getNextDNUnderSameAnchorDN( vn.parent, anchorDN);
}



// Returns array of node names starting with this node and up until the top-level node.
function getVNPath( vn: VN): string[]
{
	let path: string[] = [];
	for( let currVN = vn; currVN; currVN = currVN.parent)
		path.push( currVN.name);

	return path;
}



// Creates an array of virtual nodes from the given content. Calls the createNodesFromContent and
// if it returns a single node, wraps it in an array.
function createVNChainFromContent( content: any): VN[] | null
{
    if (content == null)
        return null;
    else
    {
        let vns = content[symToVNs]();
        return !vns ? null : Array.isArray(vns) ? vns.length === 0 ? null : vns : [vns];
    }
}



/**
 * Symbol used to set a "toVNs" function to certain classes. This function converts the instances
 * of these classes to a VN or an array of VNs.
 */
export let symToVNs = Symbol();



// Add toVNs method to the String class. This method is invoked to convert rendered content to
// virtual node or nodes.
Boolean.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    return null;
};



// Add toVNs method to the String class. This method is invoked to convert rendered content to
// virtual node or nodes.
String.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    if (this.length === 0)
        return null;

    let vn = new TextVN( this);
    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add toVNs method to the Component class. This method is invoked to convert rendered content to
// virtual node or nodes.
Component.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    // if the component (this can only be an Instance component) is already attached to VN,
    // return this existing VN; otherwise create a new one.
    let vn = this.vn ? this.vn : new IndependentCompVN( this);
    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add toVNs method to the Function class. This method is invoked to convert rendered content to
// virtual node or nodes.
Function.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    let vn = new FuncProxyVN( s_currentClassComp, this);
    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add toVNs method to the Array class. This method is invoked to convert rendered content to
// virtual node or nodes.
Array.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    if (this.length === 0)
        return null;

    if (!nodes)
        nodes = [];

    this.forEach( item =>
    {
        if (item != null)
        {
            if (item instanceof VN)
                nodes.push( item)
            else
                item[symToVNs]( nodes);
        }
    });

    return nodes.length > 0 ? nodes : null;
};



// Add toVNs method to the VN class. This method is invoked to convert rendered content to
// virtual node or nodes.
(VN.prototype as any)[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    if (nodes)
        nodes.push( this);

    return this;
};



// Add toVNs method to the Promise class. This method is invoked to convert rendered content to
// virtual node or nodes.
Promise.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    let vn = new PromiseProxyVN( { promise: this});
    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add toVNs method to the Object class. This method is invoked to convert rendered content to
// virtual node or nodes.
Object.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    let s = this.toString();
    if (!s)
        return null;

    let vn = new TextVN( s);
    if (nodes)
        nodes.push( vn);

    return vn;
};



/**
 * Symbol used to set a "jsxToVNs" function to certain classes. This function converts the instances
 * of these classes to a VN or an array of VNs.
 */
export let symJsxToVNs = Symbol();



// Add jsxToVNs method to the String class, which creates ElmVN with the given parameters. This
// method is invoked by the JSX mechanism.
String.prototype[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    if (children.length === 0)
        return new ElmVN( s_currentClassComp, this, props, null);

    // if we have children we process them right away so that we can create ElmVN with  list
    // of sub-nodes.
    let nodes: VN[] = [];
    children.forEach( item =>
    {
        if (item != null)
        {
            if (item instanceof VN)
                nodes.push( item)
            else
                item[symToVNs]( nodes);
        }
    });

    return new ElmVN( s_currentClassComp, this, props, nodes.length > 0 ? nodes : null);
};



// Add jsxToVNs method to the Fragment class object. This method is invoked by the JSX mechanism.
Fragment[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    if (children.length === 0)
        return new ElmVN( s_currentClassComp, this, props, null);

    let nodes: VN[] = [];
    children.forEach( item =>
    {
        if (item != null)
        {
            if (item instanceof VN)
                nodes.push( item)
            else
                item[symToVNs]( nodes);
        }
    });

    return nodes.length > 0 ? nodes : null;
};



// Add jsxToVNs method to the FuncProxy class object. This method is invoked by the JSX mechanism.
FuncProxy[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    /// #if DEBUG
    if (!props || !props.func)
    {
        console.error("FuncProxy component doesn't have 'func' property");
        return null;
    }
    /// #endif

    return new FuncProxyVN( s_currentClassComp, props.func, props.funcThisArg, props.arg, props.key);
};



// Add jsxToVNs method to the PromiseProxy class object. This method is invoked by the JSX mechanism.
PromiseProxy[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    return props && props.promise ? new PromiseProxyVN( props, children) : null;
};



// Add jsxToVNs method to the Component class object, which creates virtual node for managed
// components. This method is invoked by the JSX mechanism.
// The children parameter is always an array. A component can specify that its children are
// an array of a certain type, e.g. class A extends Component<{},T[]>. In this case
// there are two ways to specify children in JSX that would be accepted by the TypeScript
// compiler:
//	1) <A>{t1}{t2}</A>. In this case, children will be [t1, t2] (as expected by A).
//	2) <A>{[t1, t2]}</A>. In this case, children will be [[t1,t2]] (as NOT expected by A).
//		This looks like a TypeScript bug.
// The realChildren variable accommodates both cases.
Component[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    return new ManagedCompVN( this, props,
        children.length === 1 && Array.isArray( children[0]) ? children[0] : children);
};



// Add jsxToVNs method to the Function class, which works for functional components. This method
// is invoked by the JSX mechanism.
Function.prototype[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    // invoke the function right away. The return value is treated as rendered content. This way,
    // the function runs under the current Mimbl context (e.g. creator object used as "this" for
    // event handlers).
    let content = this( props, children.length === 1 && Array.isArray( children[0]) ? children[0] : children);
    return content && content[symToVNs]();
};



