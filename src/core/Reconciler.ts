﻿import {
    ScheduledFuncType, IComponent, IVNode, Fragment, FuncProxy,
    PromiseProxy, IComponentClass, FuncCompType, IClassCompVN
} from "../api/mim"
import {
    VN, DN, ElmVN, TextVN, IndependentCompVN, PromiseProxyVN, ClassCompVN,
    FuncProxyVN, ManagedCompVN, FuncVN, enterMutationScope, exitMutationScope
} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif


// Set of nodes that should be updated on the next UI cycle. We use Set in order to not include
// the same node more than once - which can happen if the node's requestUpdate method is called
// more than once during a single run (e.g. during event processing).
let s_vnsScheduledForUpdate = new Set<VN>();

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

// State of the scheduler.
let s_schedulerState: SchedulerState = SchedulerState.Idle;

// Number that serves as a unique ID of an update cycle. Each update cycle the root node
// increments this number. Each node being updated in this cycle is assigned this number.
// This helps prevent double-rendering of when both a component and its parent are
// updated in the same cycle.
let s_currentTick: number = 0;

// Node currently being processed. During creation and updating process, this value is set
// every time we recurse into sub-nodes and restored when we return back to the node. If
// during creation or updating process an exception is thrown and is caught by some upper
// level node, this value will still point at the node that caused the exception.
let s_currentVN: VN = null;



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
 * Wraps the given callback and returns a wrapper function which is executed in the context of the
 * given virtual node. The given "that" object will be the value of "this" when the callback is
 * executed. If the original callback throws an exception, it is processed by the Mimbl error
 * handling mechanism so that the exception bubles from this virtual node up the hierarchy until a
 * node/component that knows to handle errors is found.
 * @param callback Callback to be wrapped.
 * @param thisCallback Object that will be the value of "this" when the callback is executed.
 * @param vn Virtual node in whose context the callback will be executed.
 * @returns The wrapper function that should be used instead of the original callback.
 */
export function wrapCallbackWithVN<T extends Function>( callback: T, thisCallback?: object,
    vn?: IVNode, dontDoMimblTick?: boolean): T
{
    // if "this" for the callback was not passed but vn was, check whether the vn is a component;
    // if yes, use it as "this"; otherwise, use vn's creator component.
    if (!thisCallback && vn)
        thisCallback = (vn as any).comp != null ? (vn as any).comp : vn.creator;

    return CallbackWrapper.bind( vn, thisCallback, callback, dontDoMimblTick);
}



/**
 * Flag thast is true while the callback wrapper is being executed. This is need to not schedule
 * animation frame from inside the wrapper because the Mimbl tick will be performed right after
 * the callback is done.
 */
let s_insideCallbackWrapper = false;



/**
 * The CallbackWrapper function is used to wrap callbacks in order to have it executed in a Mimbl
 * context. The function is usually bound to a virtual node as "this" and to two parameters: the
 * object that will be the value of "this" when the original callback is executed and the original
 * callback itself. These two parameters are accessed as the first and second elements of the
 * `arguments` array). The rest of parameters in the `arguments` array are passed to the original
 * callback and the value returned by the callback is returned from the wrapper. Note that "this"
 * can be undefined if the function was scheduled without being in the context of any virtual node.
 *
 * The proper Mimbl context establishes the following:
 * - executes in a mutation scope, so that if any trigger valriable is changed during the execution
 *   of the callback, watchers will be only notified after the callback has finished its execution.
 * - If the wrapping has been done in the context of a virtual node (e.g. from a Mimbl component),
 *   the "current virtual node" and the "current component" are set to the node and component under
 *   which the callback was wrapped. This allows for proper JSX execution and for using the Mimbl
 *   error handling mechanism.
 *
 */
function CallbackWrapper(): any
{
	// remember the current VN and set the current VN to be the VN from the "this" value. Note
	// that this can be undefined if the wrapping was created without the VN context.
    let vn: VN = this;

    let retVal: any;
    let [thisOrgCallback, orgCallback, dontDoMimblTick, ...rest] = arguments;
	try
	{
        s_insideCallbackWrapper = true;
        enterMutationScope();
		retVal = orgCallback.apply( thisOrgCallback, rest);
	}
	catch( err)
	{
        let errorService = vn?.getService( "StdErrorHandling");
        if (errorService)
            errorService.reportError( err, getVNPath( vn));
        else
            throw err;
	}
	finally
	{
        exitMutationScope();
        s_insideCallbackWrapper = false;
    }

    // If requested, schedule to perform Mimble tick at the end of the event loop.
    if (!dontDoMimblTick)
        queueMicrotask( performMimbleTick);

    return retVal;
}



// Schedules an update for the given node.
export function requestNodeUpdate( vn: VN): void
{
	if (!vn.anchorDN)
		console.warn( `Update requested for virtual node '${getVNPath(vn).join("->")}' that doesn't have anchor DOM node`)

    addNodeToScheduler( vn);

	// the update is scheduled in the next tick unless the request is made during a
	// "before update" function execution.
	if (s_schedulerState !== SchedulerState.BeforeUpdate)
		requestFrameIfNeeded();
}



// Schedules to call the given function either before or after all the scheduled components
// have been updated.
export function scheduleFuncCall( func: ScheduledFuncType, beforeUpdate: boolean,
    funcThisArg?: object, vn?: IVNode): void
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
			s_callsScheduledBeforeUpdate.set( func, wrapCallbackWithVN( func, funcThisArg, vn));

			// a "before update" function is always scheduled in the next frame even if the
			// call is made from another "before update" function.
			requestFrameIfNeeded();
		}
	}
	else
	{
		if (!s_callsScheduledAfterUpdate.has( func))
		{
			s_callsScheduledAfterUpdate.set( func, wrapCallbackWithVN( func, funcThisArg, vn));

			// an "after update" function is scheduled in the next cycle unless the request is made
			// either from a "before update" function execution or during a node update.
			if (s_schedulerState !== SchedulerState.BeforeUpdate && s_schedulerState !== SchedulerState.Update)
				requestFrameIfNeeded();
		}
	}
}



// Adds the given node and related information into the internal structures so that it will be
// updated during the next Mimbl tick.
function addNodeToScheduler( vn: VN): void
{
	// add this node to the map of nodes for which either update or replacement or
	// deletion is scheduled. Note that a node will only be present once in the map no
	// matter how many times it calls requestUpdate().
	s_vnsScheduledForUpdate.add( vn);

	// if this is a class-based component and it has beforeUpdate and/or afterUpdate methods
	// implemented, schedule their executions. Note that the "beforeUpdate" method is not
	// scheduled if the current scheduler state is BeforeUpdate. This is because the component
	// will be updated in the current cycle and there is already no time to execute the "before
	// update" method.
	if (vn instanceof ClassCompVN)
	{
		let comp = vn.comp;
		if (comp.beforeUpdate && s_schedulerState !== SchedulerState.BeforeUpdate)
			s_callsScheduledBeforeUpdate.set( comp.beforeUpdate, wrapCallbackWithVN( comp.beforeUpdate, comp, vn));

		if (comp.afterUpdate)
			s_callsScheduledAfterUpdate.set( comp.afterUpdate, wrapCallbackWithVN( comp.beforeUpdate, comp, vn));
	}
}



// Determines whether the call to requestAnimationFrame should be made or the frame has already
// been scheduled.
function requestFrameIfNeeded(): void
{
	if (!s_insideCallbackWrapper && s_scheduledFrameHandle === 0)
		s_scheduledFrameHandle = requestAnimationFrame( onScheduledFrame);
}



// Callback that is called on a new UI cycle when there is a need to update UI components
function onScheduledFrame(): void
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
            let statsAlreadyExisted = DetailedStats.stats != null;
            if (!statsAlreadyExisted)
            {
                DetailedStats.stats = new DetailedStats( `Mimbl tick ${s_currentTick}: `);
                DetailedStats.stats.start();
            }
        /// #endif

		// remember the internal set of nodes and re-create it so that it is ready for new
		// update requests. Arrange scheduled nodes by their nesting depths and perform updates.
		s_schedulerState = SchedulerState.Update;
		let vnsScheduledForUpdate = s_vnsScheduledForUpdate;
		s_vnsScheduledForUpdate = new Set<VN>();
		performUpdate( vnsScheduledForUpdate);

        /// #if USE_STATS
            if (DetailedStats.stats && !statsAlreadyExisted)
            {
                DetailedStats.stats.stop( true);
                DetailedStats.stats = null;
            }
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



// Performs rendering phase for all components scheduled for update and recursively for their
// sub-nodes where necessary. Returns array of VNDisp structures for each updated node.
function performUpdate( vnsScheduledForUpdate: Set<VN>): void
{
    // Arranges the scheduled nodes by their nesting depths so that we update "upper" nodes before
    // the lower ones. This can help avoid two conditions:
    //	- rendering a child component twice: first because it called updateMe, and second
    //		because its parent was also updated.
    //	- unnecessary rendering a child component before it is removed by the parent
    // We allocate contiguous array where indices correspond to depth. Each element in this
    // array will either be undefined or contain an array of nodes at this depth.
	let vnsByDepth: VN[][] = [];
	vnsScheduledForUpdate.forEach( (vn: VN) =>
	{
        // it can happen that we encounter already unmounted virtual nodes - ignore them
        if (!vn.anchorDN)
            return;

        let depth = vn.depth;
		let arr = vnsByDepth[depth];
		if (!arr)
			vnsByDepth[depth] = [vn];
        else
		    arr.push(vn);
	});

    for( let index in vnsByDepth)
	{
        let vns = vnsByDepth[index];
        vns.forEach( vn =>
        {
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
                    if (vn.lastUpdateTick !== s_currentTick)
                    {
                        s_currentVN = vn;
                        updateNodeChildren( {oldVN: vn});
                    }
                }
            }
            catch( err)
            {
                // find the nearest error handling service. If nobody else, it is implemented
                // by the RootVN object.
                let errorService = vn.getService( "StdErrorHandling", undefined, false);
                if (errorService)
                    errorService.reportError( err, s_currentVN ? getVNPath( s_currentVN) : null);
                else
                    console.error( "BUG: updateNode threw exception but StdErrorHandling service was not found.", err);
            }

            s_currentVN = null;
        });
	}
}



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
        let clone = vn;
        let fn = vn.clone;
        if (fn)
            clone = fn.call(vn);

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
            vn.parent.subNodes[vn.index] = clone;
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

    // if the node doesn't implement render(), the node never has any sub-nodes (e.g. text nodes)
    fn = vn.render;
	if (fn)
	{
        // keep track of the node that is being currently processed.
        let prevVN = s_currentVN;
        s_currentVN = vn;

        // we call the render method without try/catch
        vn.subNodes = createVNChainFromContent( fn.call(vn));
        if (vn.subNodes)
        {
            // determine what nodes to use as anchor and "before" for the sub-nodes
            let newAnchorDN = ownDN ? ownDN : anchorDN;
            let newBeforeDN = ownDN ? null : beforeDN;

            // since we have sub-nodes, we need to create nodes for them and render. If our node
            // knows to handle errors, we do it under try/catch; otherwise, the exceptions go to
            // either the ancestor node that knows to handle errors or to the Mimbl tick loop.
            if (!vn.supportsErrorHandling)
                vn.subNodes.forEach( (svn, i) => { vn.index = i; mountNode( svn, vn, newAnchorDN, newBeforeDN); });
            else
            {
                try
                {
                    vn.subNodes.forEach( (svn, i) => { vn.index = i; mountNode( svn, vn, newAnchorDN, newBeforeDN); });
                }
                catch( err)
                {
                    /// #if VERBOSE_NODE
                        console.debug( `Calling handleError() on node ${vn.name}. Error:`, err);
                    /// #endif

                    // let the node handle the error and re-render; then we render the new
                    // content but we do it without try/catch this time; otherwise, we may end
                    // up in an infinite loop
                    vn.handleError( err, getVNPath( s_currentVN));
                    vn.subNodes = createVNChainFromContent( fn.call(vn));
                    if (vn.subNodes)
                        vn.subNodes.forEach( (svn, i) => { vn.index = i; mountNode( svn, vn, newAnchorDN, newBeforeDN); });
                }
            }
        }

        // restore pointer to the previous current node.
        s_currentVN = prevVN;
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
    if (ownDN && removeOwnNode)
        (ownDN as any as ChildNode).remove();

    if (vn.subNodes)
	{
        // DOM nodes of sub-nodes don't need to be removed if either the upper DOM node has
        // already been removed or our own DOM node is removed (true is only passed further if
        // our parameter was true and we don't have own DN).
		for( let svn of vn.subNodes)
            unmountNode( svn, removeOwnNode && !ownDN);

        vn.subNodes = null;
    }

    // mark the node as unmounted
	vn.anchorDN = null;
    vn.parent = null;
    vn.ownDN = null;
}



// Recursively renders this node and updates its sub-nodes if necessary. This method is
// invoked when a node is being updated either as a result of updateMe invocation or because
// the parent node was updated.
function updateNode( disp: VNDisp): void
{
    // keep track of the node that is being currently processed.
    let prevVN = s_currentVN;
    s_currentVN = disp.oldVN;

    updateNodeChildren( disp);

	// restore pointer to the currently being processed node after processing its sub-nodes
	s_currentVN = prevVN;
}



// Recursively renders this node and updates its sub-nodes if necessary. This method is
// invoked when a node is being updated either as a result of updateMe invocation or because
// the parent node was updated.
function updateNodeChildren( disp: VNDisp): void
{
	let vn = disp.oldVN;

    // we call the render method without try/catch. If it throws, the control goes to either the
    // ancestor node that supports error handling or the Mimbl tick loop (which has try/catch).
    let subNodes = createVNChainFromContent( vn.render());
    buildSubNodeDispositions( disp, subNodes);

	// remove from DOM the old nodes designated to be removed (that is, those for which there
	// was no counterpart new node that would either update or replace it). We need to remove
	// old nodes first before we start inserting new - one reason is to properly maintain
	// references.
	if (disp.subNodesToRemove)
	{
        // // if we are removing all sub-nodes under an element, we can optimize by setting
        // // innerHTML to null;
        // let removeAll = ownDN && disp.subNodesToRemove.length === vn.subNodes.length;
        // if (removeAll)
        //     (ownDN as Element).innerHTML = null;

		// for( let svn of disp.subNodesToRemove)
		// 	unmountNode( svn, !removeAll);

		disp.subNodesToRemove.forEach( svn => { unmountNode( svn, true) });
	}

    if (!subNodes)
        vn.subNodes = null;
    else
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
        if (!vn.supportsErrorHandling)
            updateSubNodes( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
        else
        {
            try
            {
                updateSubNodes( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
            }
            catch( err)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling handleError() on node ${vn.name}. Error`, err);
                /// #endif

                // let the node handle its own error and re-render; then we render the new
                // content but we do it without try/catch this time; otherwise, we may end
                // up in an infinite loop
                vn.handleError( err, getVNPath( s_currentVN));
                subNodes = createVNChainFromContent( vn.render());
                buildSubNodeDispositions( disp, subNodes);
                if (!subNodes)
                    vn.subNodes = null;
                else
                    updateSubNodes( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
            }
        }
    }

    // indicate that the node was updated in this cycle - this will prevent it from
    // rendering again in this cycle.
    vn.lastUpdateTick = s_currentTick;
}



// Performs rendering phase of the update on the sub-nodes of the node, which is passed as
// the oldVN member of the VNDisp structure.
function updateSubNodes( parentVN: VN, disps: VNDisp[], groups: VNDispGroup[], anchorDN: DN, beforeDN: DN): void
{
	// re-create our current list of sub-nodes - we will populate it while updating them
	parentVN.subNodes = new Array<VN>(disps.length);

	// perform updates and inserts by either groups or individual nodes.
    if (groups)
		updateSubNodesByGroups( parentVN, disps, groups, anchorDN, beforeDN);
	else
		updateSubNodesByNodes( parentVN, disps, anchorDN, beforeDN);
}



// Performs updates and inserts by individual nodes.
function updateSubNodesByNodes( parentVN: VN, disps: VNDisp[], anchorDN: DN, beforeDN: DN): void
{
	// perform DOM operations according to sub-node disposition. We need to decide for each
	// node what node to use to insert or move it before. We go from the end of the list of
	// new nodes and on each iteration we decide the value of the "beforeDN".
	for( let i = disps.length - 1; i >= 0; i--)
        beforeDN = processNode( parentVN, disps[i], i, anchorDN, beforeDN, true);
}



// Performs updates and inserts by groups. We go from the end of the list of update groups
// and on each iteration we decide the value of the "beforeDN".
function updateSubNodesByGroups( parentVN: VN, disps: VNDisp[], groups: VNDispGroup[], anchorDN: DN, beforeDN: DN): void
{
    let currSubNodeIndex = disps.length - 1;
    let currBeforeDN = beforeDN;
	for( let i = groups.length - 1; i >= 0; i--)
	{
		let group = groups[i];

		// first update every sub-node in the group and its sub-sub-nodes
		for( let j = group.last; j >= group.first; j--)
            currBeforeDN = processNode( parentVN, disps[j], currSubNodeIndex--, anchorDN, currBeforeDN, false);

		// now that all nodes in the group have been updated or inserted, we can determine
		// first and last DNs for the group
		group.determineDNs();

		// if the group has at least one DN, its first DN becomes the node before which the next
		// group of new nodes (if any) should be inserted.
		currBeforeDN = group.firstDN || beforeDN;
	}

    // Arrange the groups in order as in the new sub-node list, moving them if necessary.
	// We go from the last group to the second group in the list because as soon as we moved all
	// groups except the first one into their right places, the first group will be automatically
	// in the right place. We always have two groups (i and i-1), which allows us to understand
	// whether we need to swap them. If we do we move the shorter group.
    currBeforeDN = beforeDN;
	for( let i = groups.length - 1; i > 0; i--)
	{
		let group = groups[i];
		let prevGroup = groups[i-1];

		// determine whether the group should move. We take the last node from the group
		// and compare its DN's next sibling to the current "beforeDN".
		if (group.lastDN != null)
		{
			if (group.lastDN.nextSibling !== currBeforeDN)
			{
				// if the current group now resides before the previous group, then that means
				// that we are swapping two groups. In this case we want to move the shorter one.
				if (group.lastDN.nextSibling === prevGroup.firstDN && group.count > prevGroup.count)
					moveGroup( disps, prevGroup, anchorDN, group.firstDN);
				else
					moveGroup( disps, group, anchorDN, currBeforeDN);
			}

			// the group's first DN becomes the new beforeDN. Note that firstDN cannot be null
			// because lastDN is not null
			currBeforeDN = group.firstDN;
		}
	}
}



/**
 * Updates or inserts the node pointed to by the given VNDisp structure.
 * @param parentVN
 * @param disp
 * @param index
 * @param anchorDN
 * @param beforeDN
 * @returns The new "beforeDN" value, which is the first DOM node vehind this virtual node
 */
function processNode( parentVN: VN, disp: VNDisp, index: number, anchorDN: DN, beforeDN: DN, moveIfNeeded?: boolean): DN
{
    let newVN = disp.newVN;
    let oldVN = disp.oldVN;

    // for the Update operation, the old node becomes a sub-node; for the Insert operation
    // the new node become a sub-node.
    let svn: VN;
    if (disp.action === VNDispAction.Insert)
    {
        // we must assign the index and put the node in the list of sub-nodes before calling
        // mountNode because it may use this info if the node is cloned
        newVN.index = index;
        parentVN.subNodes[index] = newVN;

        // if mountNode clones the node, it puts the new node into the list of sub-nodes
        // and returns it; otherwise, it returns the original node.
        svn = mountNode( newVN, parentVN, anchorDN, beforeDN);
    }
    else // if (disp.action === VNDispAction.Update)
    {
        svn = parentVN.subNodes[index] = oldVN;
        if (oldVN !== newVN)
        {
            /// #if VERBOSE_NODE
                console.debug( `Calling update() on node ${oldVN.name}`);
            /// #endif

            // update method must exists for nodes with action Update
            if (oldVN.update( newVN))
                updateNode( disp);
        }

        // determine whether all the nodes under this VN should be moved.
        if (moveIfNeeded && index !== oldVN.index)
            moveNode( oldVN, anchorDN, beforeDN);

        // we must assign the new index after the comparison above because otherwise the
        // comparison will not work
        svn.index = index;
    }


    // if the virtual node defines a DOM node, it becomes the DOM node before which
    // next components should be inserted/moved
    return getFirstDN( svn) || beforeDN;
}



// Moves the given virtual node  so that all its immediate DNs reside before the given DN.
function moveNode( vn: VN, anchorDN: DN, beforeDN: DN): void
{
    // check whether the last of the DOM nodes already resides right before the needed node
    let immediateDNs = getImmediateDNs( vn);
    if (immediateDNs.length === 0 || immediateDNs[immediateDNs.length - 1].nextSibling === beforeDN)
        return;

    for( let immediateDN of immediateDNs)
    {
        anchorDN.insertBefore( immediateDN, beforeDN);

        /// #if USE_STATS
            DetailedStats.stats.log( StatsCategory.Elm, StatsAction.Moved);
        /// #endif
    }

    /// #if USE_STATS
        DetailedStats.stats.log( vn.statsCategory, StatsAction.Moved);
    /// #endif
}



// // Arrange the groups in order as in the new sub-node list, moving them if necessary.
// function arrangeGroups( disps: VNDisp[], groups: VNDispGroup[], anchorDN: DN, beforeDN: DN): void
// {
// 	// We go from the last group to the second group in the list because as soon as we moved all
// 	// groups except the first one into their right places, the first group will be automatically
// 	// in the right place. We always have two groups (i and i-1), which allows us to understand
// 	// whether we need to swap them. If we do we move the shorter group.
// 	for( let i = groups.length - 1; i > 0; i--)
// 	{
// 		let group = groups[i];
// 		let prevGroup = groups[i-1];

// 		// determine whether the group should move. We take the last node from the group
// 		// and compare its DN's next sibling to the current "beforeDN".
// 		if (group.lastDN != null)
// 		{
// 			if (group.lastDN.nextSibling !== beforeDN)
// 			{
// 				// if the current group now resides before the previous group, then that means
// 				// that we are swapping two groups. In this case we want to move the shorter one.
// 				if (group.lastDN.nextSibling === prevGroup.firstDN && group.count > prevGroup.count)
// 					moveGroup( disps, prevGroup, anchorDN, group.firstDN);
// 				else
// 					moveGroup( disps, group, anchorDN, beforeDN);
// 			}

// 			// the group's first DN becomes the new beforeDN. Note that firstDN cannot be null
// 			// because lastDN is not null
// 			beforeDN = group.firstDN;
// 		}
// 	}
// }



// Moves all the nodes in the given group before the given DOM node.
function moveGroup( disps: VNDisp[], group: VNDispGroup, anchorDN: DN, beforeDN: DN): void
{
	for( let j = group.first; j <= group.last; j++)
	{
		let subNodeVN = group.action === VNDispAction.Update ? disps[j].oldVN : disps[j].newVN;
		let subNodeDNs = getImmediateDNs( subNodeVN);
		for( let subNodeDN of subNodeDNs)
		{
			anchorDN.insertBefore( subNodeDN, beforeDN);

			/// #if USE_STATS
				DetailedStats.stats.log( StatsCategory.Elm, StatsAction.Moved);
			/// #endif
		}

		/// #if USE_STATS
			DetailedStats.stats.log( subNodeVN.statsCategory, StatsAction.Moved);
		/// #endif

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
class VNDispGroup
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



	constructor( parentDisp: VNDisp, action: VNDispAction, first: number, last?: number)
	{
		this.parentDisp = parentDisp;
		this.action = action;
		this.first = first;
		this.last = last;
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
const NO_GROUP_THRESHOLD = 8;



/**
 * The VNDisp class is a recursive structure that describes a disposition for a node and its
 * sub-nodes during the reconciliation process.
 */
type VNDisp =
{
	/** Old virtual node to be updated. This is only used for the Update action. */
	oldVN?: VN;

	/** New virtual node to insert or to update an old node */
	newVN?: VN;

	/** Action to be performed on the node */
	action?: VNDispAction;

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
 * Compares old and new chains of sub-nodes and determines what nodes should be created, deleted
 * or updated. The result is remembered as an array of VNDisp objects for each sub-node and as
 * array of old sub-nodes that should be deleted. In addition, the new sub-nodes are divided
 * into groups of consecutive nodes that should be updated and of nodes that should be inserted.
 * The groups are built in a way so that if a node should be moved, its entire group is moved.
 */
function buildSubNodeDispositions( disp: VNDisp, newChain: VN[]): void
{
    let newLen = newChain ? newChain.length : 0;
    let oldChain = disp.oldVN.subNodes;
    let oldLen = oldChain ? oldChain.length : 0;

    // if either old or new or both chains are empty, we do special things
    if (newLen === 0 && oldLen === 0)
    {
        // both chains are empty - do nothing
        return;
    }
    else if (newLen === 0)
    {
        // new chain is empty - delete all old nodes
        disp.subNodesToRemove = oldChain;
        return;
    }
    else if (oldLen === 0)
    {
        // old chain is empty - insert all new nodes
        disp.subNodeDisps = newChain.map( newVN => { return { newVN, action: VNDispAction.Insert} });
        return;
    }

    // determine whether recycling of non-matching old keyed sub-nodes by non-matching new
    // keyed sub-nodes is allowed. If update strategy is not defined for the node, the
    // recycling is allowed.
    let allowKeyedNodeRecycling = disp.oldVN.updateStrategy?.allowKeyedNodeRecycling;
    if (allowKeyedNodeRecycling === undefined)
        allowKeyedNodeRecycling = true;

    // process the special case with a single sub-node in both old and new chains just
    // to avoid creating temporary structures
    if (newLen === 1 && oldLen === 1)
    {
        let oldVN = oldChain[0]
        let newVN = newChain[0];
        let subDisp: VNDisp = { newVN };
        if (oldVN === newVN ||
            ((allowKeyedNodeRecycling || newVN.key === oldVN.key) && oldVN.constructor === newVN.constructor &&
                (!oldVN.isUpdatePossible || oldVN.isUpdatePossible( newVN))))
        {
            // old node can be updated with information from the new node
            subDisp.action = VNDispAction.Update;
            subDisp.oldVN = oldVN;
        }
        else
        {
            // old node cannot be updated, so the new node will be inserted and the old node will
            // be removed
            subDisp.action = VNDispAction.Insert;
            disp.subNodesToRemove = [oldVN];
        }

        disp.subNodeDisps = [subDisp];
        return;
    }

    // we are here if either old and new chains contain more than one node and we need to
    // reconcile the chains. First go over the old nodes and build a map of keyed ones and a
    // list of non-keyed ones. If there are more than one node with the same key, the first one
    // goes to the map and the rest to the unkeyed list.
    let oldKeyedMap = new Map<any,VN>();
    let oldUnkeyedList: VN[] = [];
    let key: any;
    oldChain.forEach( oldVN =>
    {
        key = oldVN.key;
        if (key != null && !oldKeyedMap.has( key))
            oldKeyedMap.set( key, oldVN);
        else
            oldUnkeyedList.push( oldVN);
    });

    // remember the length of the unkeyed list;
    let oldUnkeyedListLength = oldUnkeyedList.length;

    // prepare array for VNDisp objects for new nodes
    disp.subNodeDisps = new Array( newLen);

    // loop over new nodes
    let oldUnkeyedListIndex = 0;
    let subNodeIndex = 0;
    let subDisp: VNDisp;
    let hasUpdates = false;
    let oldVN: VN;
    newChain.forEach( newVN =>
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

        // if we have old nodes in the unkeyed list use the next one
        if (!oldVN && oldUnkeyedListIndex != oldUnkeyedListLength)
            oldVN = oldUnkeyedList[oldUnkeyedListIndex++];

        subDisp = { newVN };
        if (!oldVN)
            subDisp.action = VNDispAction.Insert;
        else if (oldVN === newVN ||
            ((allowKeyedNodeRecycling || newVN.key === oldVN.key) && oldVN.constructor === newVN.constructor &&
                (oldVN.isUpdatePossible === undefined || oldVN.isUpdatePossible( newVN))))
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
            if (!disp.subNodesToRemove)
                disp.subNodesToRemove = [];

            disp.subNodesToRemove.push( oldVN);
        }

        disp.subNodeDisps[subNodeIndex++] = subDisp;
    });

    // old nodes remaining in the keyed map and in the unkeyed list will be removed
    if (oldKeyedMap.size > 0 || oldUnkeyedListIndex < oldUnkeyedListLength)
    {
        if (!disp.subNodesToRemove)
            disp.subNodesToRemove = [];

        oldKeyedMap.forEach( oldVN => disp.subNodesToRemove.push( oldVN));
        for( let i = oldUnkeyedListIndex; i < oldUnkeyedListLength; i++)
            disp.subNodesToRemove.push( oldUnkeyedList[i]);
    }

    if (hasUpdates && newLen > NO_GROUP_THRESHOLD)
        buildSubNodeGroups( disp);
}



/**
 * From a flat list of new sub-nodes builds groups of consecutive nodes that should be either
 * updated or inserted.
 */
function buildSubNodeGroups( disp: VNDisp): void
{
    // we are here only if we have some number of sub-node dispositions
    let subNodeDisps = disp.subNodeDisps;
    let count = subNodeDisps.length;

    /// #if DEBUG
        // this method is not supposed to be called if the number of sub-nodes is less then
        // the pre-determined threshold
        if (count <= NO_GROUP_THRESHOLD || count === 0)
            return;
    /// #endif

    // create array of groups and create the first group starting from the first node
    let group = new VNDispGroup( disp, subNodeDisps[0].action, 0);
    let subNodeGroups = [group];

    // loop over sub-nodes and on each iteration decide whether we need to open a new group
    // or put the current node into the existing group or close the existing group and open
    // a new one.
    let action: VNDispAction;
    let subDisp: VNDisp;
    let prevOldVN: VN;
    for( let i = 1; i < count; i++)
    {
        subDisp = subNodeDisps[i];
        action = subDisp.action;
        if (action !== group.action)
        {
            // close the group with the previous index. Decrement the iterating index so that
            // the next iteration will open a new group. Note that we cannot be here for a node
            // that starts a new group because for such node disp.action === groupAction.
            group.last = i - 1;
            group = new VNDispGroup( disp, action, i);
            subNodeGroups.push( group);
        }
        else if (action === VNDispAction.Update)
        {
            // an "update" sub-node is out-of-order and should close the current group if the index
            // of its previous sibling + 1 isn't equal to the index of this sub-node.
            // The last node will close the last group after the loop.
            prevOldVN = subNodeDisps[i-1].oldVN;
            if (!prevOldVN || prevOldVN.index + 1 !== subDisp.oldVN.index)
            {
                // close the group with the current index.
                group.last = i - 1;
                group = new VNDispGroup( disp, action, i);
                subNodeGroups.push( group);
            }
        }

        // all consecutive "insert" nodes belong to the same group so we just wait for the
        // next node
    }

    // close the last group
    if (group !== undefined)
        group.last = count - 1;

    disp.subNodeGroups = subNodeGroups;
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
function getLastDN( vn: VN): DN
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
function getImmediateDNs( vn: VN): DN[]
{
	let arr: DN[] = [];
	collectImmediateDNs( vn, arr);
	return arr;
}



// Collects all DOM nodes that are the immediate children of this virtual node (that is,
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
function getNextDNUnderSameAnchorDN( vn: VN, anchorDN: DN): DN
{
	// check if we have sibling DOM nodes after our last sub-node - that might be elements
	// not controlled by our component.
	if (vn.subNodes && vn.subNodes.length > 0)
	{
		let dn = getLastDN( vn.subNodes[vn.subNodes.length - 1]);
		if (dn)
		{
			let nextSibling = dn.nextSibling;
			if (nextSibling)
				return nextSibling;
		}
	}

    // if we don't have the parent, this means that it is a root node and it doesn't have siblings
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
	let depth = vn.depth;
	let path = Array<string>( depth);
	for( let i = 0, nvn: VN = vn; i < depth; i++, nvn = nvn.parent)
	{
		path[i] = nvn.name + (nvn.creator && nvn.creator.vn ? ` (created by ${nvn.creator.vn.name})` : "");
	}

	return path;
}



// Creates an array of virtual nodes from the given content. Calls the createNodesFromContent and
// if it returns a single node, wraps it in an array.
function createVNChainFromContent( content: any): VN[] | null
{
    let retVal = createNodesFromContent( content);
    return !retVal ? null : Array.isArray(retVal) ? retVal : [retVal];
}



// Creates either a single virtual node or an array of virtual nodes from the given content.
// For all types of contents other than an array, the returned value is a single VN. If the input
// content is an array, then a VN is created for each of the array elements. Since array elements
// might also be arrays, the process is recursive.
function createNodesFromContent( content: any, nodes?: VN[]): VN | VN[] | null
{
	if (content == null || content === false)
	{
		// the comparison above covers both null and undefined
		return null;
    }

    let vn: VN;
    if (content instanceof VN)
    {
        vn = content;
    }
    else if (typeof content === "string")
	{
        if (!content)
            return null;

        vn = new TextVN( content);
    }
	else if (typeof content.render === "function")
	{
		// if the component (this can only be an Instance component) is already attached to VN,
		// return this existing VN; otherwise create a new one.
		vn = (content as IComponent).vn
						? (content as IComponent).vn as IVNode as VN
						: new IndependentCompVN( content as IComponent);
	}
	else if (content instanceof Promise)
	{
		vn = new PromiseProxyVN( { promise: content});
	}
	else if (typeof content === "function")
	{
        vn = new FuncProxyVN( content);
	}
    else if (Array.isArray( content))
    {
        return content.length === 0 ? null : createNodesFromArray( content, nodes);
    }
    else
    {
        let s = content.toString();
        if (!s)
            return null;

        vn = new TextVN( s);
    }

    if (nodes)
        nodes.push( vn);

    return vn;
}



// Creates array of virtual nodes from the given array of items.
function createNodesFromArray( arr: any[], nodes?: VN[]): VN[] | null
{
    /// #if DEBUG
    if (arr.length === 0)
    {
        console.error("createNodesFromArray was called with empty array");
        return null;
    }
    /// #endif

    if (!nodes)
        nodes = [];

    arr.forEach( item => { createNodesFromContent( item, nodes); });
    return nodes.length > 0 ? nodes : null;
}



// Creates a chain of virtual nodes from the data provided by the TypeScript's JSX parser.
export function createNodesFromJSX( tag: any, props: any, children: any[]): VN | VN[] | null
{
	if (typeof tag === "string")
		return new ElmVN( tag, props, children);
    else if (tag === Fragment)
    {
        if (children.length === 0)
            return null;
        else
            return createNodesFromArray( children);
    }
	else if (tag === FuncProxy)
	{
        /// #if DEBUG
            if (!props || !props.func)
            {
                console.error("FuncProxy component doesn't have 'func' property");
                return null;
            }
        /// #endif

        return new FuncProxyVN( props.func, props.funcThisArg, props.arg, props.key);
	}
	else if (tag === PromiseProxy)
	{
		if (!props || !props.promise)
			return null;

		return new PromiseProxyVN( props, children);
	}
	else if (typeof tag === "function")
	{
		// children parameter is always an array. A component can specify that its children are
		// an array of a certain type, e.g. class A extends Component<{},T[]>. In this case
		// there are two ways to specify children in JSX that would be accepted by the TypeScript
		// compiler:
		//	1) <A>{t1}{t2}</A>. In this case, children will be [t1, t2] (as expected by A).
		//	2) <A>{[t1, t2]}</A>. In this case, children will be [[t1,t2]] (as NOT expected by A).
		//		This looks like a TypeScript bug.
		// The realChildren variable accommodates both cases.
		let realChildren = children.length === 1 && Array.isArray( children[0]) ? children[0] : children;
		if (typeof tag.prototype.render === "function")
			return new ManagedCompVN( tag as IComponentClass, props, realChildren);
		else
			return new FuncVN( tag as FuncCompType, props, realChildren);
	}

	/// #if DEBUG
	else
		throw new Error( "Invalid tag in jsx processing function: " + tag);
	/// #endif
}



