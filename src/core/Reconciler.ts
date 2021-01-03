import {
    ScheduledFuncType, IComponent, IVNode, Fragment, FuncProxy,
    PromiseProxy, IComponentClass, FuncCompType, IClassCompVN, Component, TickSchedulingType
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



// Current object that is set as "creator" during rendering when instantiating certain virtual nodes.
let s_currentClassComp: IComponent = null;

// Sets the given object as the current "creator" object.
export function setCurrentClassComp( comp: IComponent): void
{
    s_currentClassComp = comp;
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
 *   - Enters mutation scope for the duration of the callback execution
 * @param func Callback to be wrapped.
 * @param funcThisArg Object that will be the value of "this" when the callback is executed.
 * @param creator Object that is set as the current creator to be used when JSX is parsed..
 * @param schedulingType Type of scheduling a Mimbl tick.
 * @returns The wrapper function that should be used instead of the original callback.
 */
export function wrapCallback<T extends Function>( func: T, funcThisArg: any,
    creator: any, schedulingType: TickSchedulingType): T
{
    // return CallbackWrapper.bind( { func, funcThisArg, creator, schedulingType });
    return CallbackWrapper.bind( creator, func, funcThisArg, schedulingType);
}



/**
 * The CallbackWrapper function is used to wrap callbacks in order to have it executed in a Mimbl
 * context.
 *
 */
// function CallbackWrapper( this: {func: Function, funcThisArg?: any, creator?: any, schedulingType: TickSchedulingType}): any
// {
//     let prevCreator = s_currentClassComp;
//     s_currentClassComp = this.creator;
//     enterMutationScope();

//     try
// 	{
// 		let retVal = this.func.apply( this.funcThisArg, arguments);
//         scheduleMimblTick( this.schedulingType);
//         return retVal;
// 	}
// 	finally
// 	{
//         exitMutationScope();
//         s_currentClassComp = prevCreator;
//     }
// }
function CallbackWrapper(): any
{
    let prevCreator = s_currentClassComp;
    s_currentClassComp = this;
    enterMutationScope();

    try
	{
        let [func, funcThisArg, schedulingType, ...rest] = arguments;
		let retVal = func.apply( funcThisArg, rest);
        scheduleMimblTick( schedulingType);
        return retVal;
	}
	finally
	{
        exitMutationScope();
        s_currentClassComp = prevCreator;
    }
}



// Schedules an update for the given node.
export function requestNodeUpdate( vn: VN): void
{
	if (!vn.anchorDN)
		console.warn( `Update requested for virtual node '${getVNPath(vn).join("->")}' that doesn't have anchor DOM node`)

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
			s_callsScheduledBeforeUpdate.set( comp.beforeUpdate, wrapCallback( comp.beforeUpdate, comp, comp, "no"));

		if (comp.afterUpdate)
			s_callsScheduledAfterUpdate.set( comp.afterUpdate, wrapCallback( comp.beforeUpdate, comp, comp, "no"));
	}

    // schedule Mimbl tick using animation frame. If this call comes from a wrapped callback,
    // the callback might schedule a tick using microtask. In this case, the animation frame
    // will be canceled.
    scheduleMimblTick( "af");
}



// Schedules to call the given function either before or after all the scheduled components
// have been updated.
export function scheduleFuncCall( func: ScheduledFuncType, beforeUpdate: boolean,
    funcThisArg?: any, creator?: any): void
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
			s_callsScheduledBeforeUpdate.set( func, wrapCallback( func, funcThisArg, creator, "no"));

			// a "before update" function is always scheduled in the next frame even if the
			// call is made from another "before update" function.
			requestAnimationFrameIfNeeded();
		}
	}
	else
	{
		if (!s_callsScheduledAfterUpdate.has( func))
		{
			s_callsScheduledAfterUpdate.set( func, wrapCallback( func, funcThisArg, creator, "no"));

			// an "after update" function is scheduled in the next cycle unless the request is made
			// either from a "before update" function execution or during a node update.
			if (s_schedulerState !== SchedulerState.BeforeUpdate && s_schedulerState !== SchedulerState.Update)
				requestAnimationFrameIfNeeded();
		}
	}
}



// Shedules a Mimbl tick according to the given type.
function scheduleMimblTick( schedulingType: TickSchedulingType): void
{
    if (schedulingType === "mt")
        queueMicrotask( performMimbleTick);
    else if (schedulingType === "af")
    {
        // the update is scheduled in the next tick unless the request is made during a
        // "before update" function execution.
        if (s_schedulerState !== SchedulerState.BeforeUpdate)
            requestAnimationFrameIfNeeded();
    }
}



// Determines whether the call to requestAnimationFrame should be made or the frame has already
// been scheduled.
function requestAnimationFrameIfNeeded(): void
{
	if (s_scheduledFrameHandle === 0)
		s_scheduledFrameHandle = requestAnimationFrame( onAnimationFrame);
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
                        updateNodeChildren( {oldVN: vn, newVN: vn});
                        s_currentClassComp = null;
                    }
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

    // if the node doesn't implement render(), the node never has any sub-nodes (e.g. text nodes)
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
                vn.handleError( err);

                if (fn)
                    vn.subNodes = createVNChainFromContent( fn.call(vn));

                if (vn.subNodes)
                    vn.subNodes.forEach( (svn, i) => { svn.index = i; mountNode( svn, vn, newAnchorDN, newBeforeDN); });
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
function updateNodeChildren( disp: VNDisp): void
{
	let oldVN = disp.oldVN;
	let newVN = disp.newVN;
    let ownDN = oldVN.ownDN;

    // we call the render method without try/catch. If it throws, the control goes to either the
    // ancestor node that supports error handling or the Mimbl tick loop (which has try/catch).
    // The render method is invoked on the old node assuming that the old node already has the
    // updated information from the new node. If, however, the old node doesn't have the render
    // method, we get the sub-nodes from the new node. For eample, ElmVN doesn't have the render
    // method but it has the sub-nodes filled in during the JSX operations.
    let fn: Function = oldVN.render;
    let newSubNodes = fn ? createVNChainFromContent( fn.call( oldVN)) : newVN.subNodes;
    buildSubNodeDispositions( disp, newSubNodes);

    // remove from DOM the old nodes designated to be removed (that is, those for which there
    // was no counterpart new node that would either update or replace it). We need to remove
    // old nodes first before we start inserting new - one reason is to properly maintain
    // references.
    if (disp.replaceAllSubNodes)
    {
        if (oldVN.subNodes)
        {
            // if we are removing all sub-nodes under an element, we can optimize by setting
            // innerHTML to null;
            if (ownDN)
                (ownDN as Element).innerHTML = null;

            oldVN.subNodes.forEach( svn => { unmountNode( svn, !ownDN) });
        }
    }
	else if (disp.subNodesToRemove)
	{
		disp.subNodesToRemove.forEach( svn => { unmountNode( svn, true) });
	}

    if (!newSubNodes)
        oldVN.subNodes = null;
    else
    {
        // determine the anchor node to use when inserting new or moving existing sub-nodes. If
        // our node has its own DN, it will be the anchor for the sub-nodes; otherwise, our node's
        // anchor will be the anchor for the sub-nodes too.
        let anchorDN = ownDN || oldVN.anchorDN;

        // if this virtual node doesn't define its own DOM node (true for components), we will
        // need to find a DOM node before which to start inserting new nodes. Null means
        // append to the end of the anchor node's children.
        let beforeDN = ownDN ? null : getNextDNUnderSameAnchorDN( oldVN, anchorDN);

        // since we have sub-nodes, we need to create nodes for them and render. If our node
        // knows to handle errors, we do it under try/catch; otherwise, the exceptions go to
        // either the uncestor node that knows to handle errors or to the Mimbl tick loop.
        if (!oldVN.supportsErrorHandling)
            updateSubNodes( oldVN, disp, newSubNodes, anchorDN, beforeDN);
        else
        {
            try
            {
                updateSubNodes( oldVN, disp, newSubNodes, anchorDN, beforeDN);
            }
            catch( err)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling handleError() on node ${oldVN.name}. Error`, err);
                /// #endif

                // let the node handle its own error and re-render; then we render the new
                // content but we do it without try/catch this time; otherwise, we may end
                // up in an infinite loop
                oldVN.handleError( err);
                newSubNodes = fn ? createVNChainFromContent( fn.call( oldVN)) : newVN.subNodes;
                buildSubNodeDispositions( disp, newSubNodes);
                if (!newSubNodes)
                    oldVN.subNodes = null;
                else
                    updateSubNodes( oldVN, disp, newSubNodes, anchorDN, beforeDN);
            }
        }
    }

    if (oldVN !== newVN)
    {
        // notify the new component that it will replace the old component.
        fn = newVN.didUpdate;
        fn && fn.call( oldVN);
    }

    // indicate that the node was updated in this cycle - this will prevent it from
    // rendering again in this cycle.
    oldVN.lastUpdateTick = s_currentTick;
}



// Performs rendering phase of the update on the sub-nodes of the node, which is passed as
// the oldVN member of the VNDisp structure.
function updateSubNodes( vn: VN, disp: VNDisp, newSubNodes: VN[], anchorDN: DN, beforeDN: DN): void
{
    if (disp.replaceAllSubNodes)
    {
        vn.subNodes = newSubNodes;
        newSubNodes.forEach( (svn, i) => { svn.index = i; mountNode( svn, vn, anchorDN, beforeDN); });
    }
    else
    {
        // re-create our current list of sub-nodes - we will populate it while updating them
        vn.subNodes = new Array<VN>(newSubNodes.length);

        // perform updates and inserts by either groups or individual nodes.
        if (disp.subNodeGroups)
            updateSubNodesByGroups( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
        else
            updateSubNodesByNodes( vn, disp.subNodeDisps, anchorDN, beforeDN);
    }
}



// Performs updates and inserts by individual nodes.
function updateSubNodesByNodes( parentVN: VN, disps: VNDisp[], anchorDN: DN, beforeDN: DN): void
{
	// perform DOM operations according to sub-node disposition. We need to decide for each
	// node what node to use to insert or move it before. We go from the end of the list of
	// new nodes and on each iteration we decide the value of the "beforeDN".
    for( let i = disps.length - 1; i >= 0; i--)
    {
        let disp = disps[i];
        let newVN = disp.newVN;
        let oldVN = disp.oldVN;

        // for the Update operation, the old node becomes a sub-node; for the Insert operation
        // the new node become a sub-node.
        let svn: VN;
        if (disp.action === VNDispAction.Insert)
        {
            // we must assign the index and put the node in the list of sub-nodes before calling
            // mountNode because it may use this info if the node is cloned
            newVN.index = i;
            parentVN.subNodes[i] = newVN;

            // if mountNode clones the node, it puts the new node into the list of sub-nodes
            // and returns it; otherwise, it returns the original node.
            svn = mountNode( newVN, parentVN, anchorDN, beforeDN);
        }
        else // if (disp.action === VNDispAction.Update)
        {
            svn = parentVN.subNodes[i] = oldVN;
            if (oldVN !== newVN)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling update() on node ${oldVN.name}`);
                /// #endif

                // update method must exists for nodes with action Update
                if (oldVN.update( newVN))
                    updateNodeChildren( disp);
            }

            // determine whether all the nodes under this VN should be moved.
            if (i !== oldVN.index)
                moveNode( oldVN, anchorDN, beforeDN);

            // we must assign the new index after the comparison above because otherwise the
            // comparison will not work
            svn.index = i;
        }


        // if the virtual node defines a DOM node, it becomes the DOM node before which
        // next components should be inserted/moved
        beforeDN = getFirstDN( svn) || beforeDN;
    }
}



// Performs updates and inserts by groups. We go from the end of the list of update groups
// and on each iteration we decide the value of the "beforeDN".
function updateSubNodesByGroups( parentVN: VN, disps: VNDisp[], groups: VNDispGroup[], anchorDN: DN, beforeDN: DN): void
{
    // let currSubNodeIndex = disps.length - 1;
    let currBeforeDN = beforeDN;
    let disp: VNDisp;
    let newVN: VN;
    let oldVN: VN;
	for( let i = groups.length - 1; i >= 0; i--)
	{
		let group = groups[i];

        if (group.action === VNDispAction.Insert)
        {
            // mount every sub-node in the group and its sub-sub-nodes
            for( let j = group.first; j <= group.last; j++)
            {
                disp = disps[j];
                newVN = disp.newVN;

                // we must assign the index and put the node in the list of sub-nodes before calling
                // mountNode because it may use this info if the node is cloned
                newVN.index = j;
                parentVN.subNodes[j] = newVN;
                mountNode( newVN, parentVN, anchorDN, currBeforeDN);
            }
        }
        else
        {
            // update every sub-node in the group and its sub-sub-nodes
            for( let j = group.last; j >= group.first; j--)
            {
                disp = disps[j];
                newVN = disp.newVN;
                oldVN = disp.oldVN;

                oldVN.index = j;
                parentVN.subNodes[j] = oldVN;
                if (oldVN !== newVN)
                {
                    /// #if VERBOSE_NODE
                        console.debug( `Calling update() on node ${oldVN.name}`);
                    /// #endif

                    // update method must exists for nodes with action Update
                    if (oldVN.update( newVN))
                        updateNodeChildren( disp);
                }
            }
        }

		// now that all nodes in the group have been updated or inserted, we can determine
		// first and last DNs for the group
		determineGroupDNs( group);
		// group.determineDNs();

		// if the group has at least one DN, its first DN becomes the node before which the next
        // group of new nodes (if any) should be inserted.
		currBeforeDN = group.firstDN || currBeforeDN;
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
interface VNDispGroup
{
	/** parent VNDisp to which this group belongs */
	parentDisp: VNDisp;

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
 * nodes were phisically updated/inserted and we can obtain their DOM nodes.
 */
function determineGroupDNs( group: VNDispGroup)
{
    if (group.count === 1)
    {
        let vn = group.action === VNDispAction.Update
            ? group.parentDisp.subNodeDisps[group.first].oldVN
            : group.parentDisp.subNodeDisps[group.first].newVN;

        group.firstDN = getFirstDN(vn);
        group.lastDN = getLastDN( vn);
    }
    else
    {
        let disp: VNDisp;
        for( let i = group.first; i <= group.last; i++)
        {
            disp = group.parentDisp.subNodeDisps[i];
            group.firstDN = getFirstDN( group.action === VNDispAction.Update ? disp.oldVN : disp.newVN);
            if (group.firstDN)
                break;
        }

        for( let i = group.last; i >= group.first; i--)
        {
            disp = group.parentDisp.subNodeDisps[i];
            group.lastDN = getLastDN( group.action === VNDispAction.Update ? disp.oldVN : disp.newVN);
            if (group.lastDN)
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
    else if (newLen === 0 || oldLen === 0)
    {
        // either old or new chain is empty - either delete all old nodes or insert all new nodes
        disp.replaceAllSubNodes = true;
        return;
    }

    // determine whether recycling of non-matching old keyed sub-nodes by non-matching new
    // keyed sub-nodes is allowed. If update strategy is not defined for the node, the
    // recycling is allowed.
    let allowKeyedNodeRecycling = !disp.oldVN.updateStrategy?.disableKeyedNodeRecycling;

    // process the special case with a single sub-node in both old and new chains just
    // to avoid creating temporary structures
    if (newLen === 1 && oldLen === 1)
    {
        let oldVN = oldChain[0]
        let newVN = newChain[0];
        if (oldVN === newVN ||
            ((allowKeyedNodeRecycling || newVN.key === oldVN.key) && oldVN.constructor === newVN.constructor &&
                (!oldVN.isUpdatePossible || oldVN.isUpdatePossible( newVN))))
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

    // prepare array for VNDisp objects for new nodes
    disp.subNodeDisps = new Array( newLen);
    let subNodesToRemove: VN[] = [];
    let hasUpdates = allowKeyedNodeRecycling
        ? reconcileWithRecycling( newChain, oldKeyedMap, oldUnkeyedList, disp.subNodeDisps, subNodesToRemove)
        : reconcileWithoutRecycling( newChain, oldKeyedMap, oldUnkeyedList, disp.subNodeDisps, subNodesToRemove);

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
            buildSubNodeGroups( disp);
    }
}



/**
 * Reconciles new and old nodes without recycling non-matching keyed nodes.
 */
function reconcileWithoutRecycling( newChain: VN[], oldKeyedMap: Map<any,VN>, oldUnkeyedList: VN[],
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

        // if we have old nodes in the unkeyed list and either the new node doesn't have key or
        // recyclining keyed nodes is allowed, use the next old unkeyed node
        if (!oldVN && !key && oldUnkeyedListIndex != oldUnkeyedListLength)
            oldVN = oldUnkeyedList[oldUnkeyedListIndex++];

        subDisp = { newVN };
        if (!oldVN)
            subDisp.action = VNDispAction.Insert;
        else if (oldVN === newVN ||
            (key === oldVN.key && oldVN.constructor === newVN.constructor &&
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
function reconcileWithRecycling( newChain: VN[], oldKeyedMap: Map<any,VN>, oldUnkeyedList: VN[],
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

        // if we have old nodes in the unkeyed list and either the new node doesn't have key or
        // recyclining keyed nodes is allowed, use the next old unkeyed node
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
        else if (oldVN === newVN ||
            (oldVN.constructor === newVN.constructor &&
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
                if (oldVN === newVN ||
                    (oldVN.constructor === newVN.constructor &&
                        (oldVN.isUpdatePossible === undefined || oldVN.isUpdatePossible( newVN))))
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
    let group: VNDispGroup = { parentDisp: disp, action: subNodeDisps[0].action, first: 0 };
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
            group.count = i - group.first;

            // open new group
            group = { parentDisp: disp, action, first: i };
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
                group.count = i - group.first;

                // open new group
                group = { parentDisp: disp, action, first: i };
                subNodeGroups.push( group);
            }
        }

        // all consecutive "insert" nodes belong to the same group so we just wait for the
        // next node
    }

    // close the last group
    if (group)
    {
        group.last = count - 1;
        group.count = count - group.first;
    }

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
	let dn: DN;
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
	let dn: DN;
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
		vn.subNodes.forEach( svn => collectImmediateDNs( svn, arr));
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
    if (content == null)
        return null;
    else
    {
        let retVal = content[symToVNs]();
        return !retVal ? null : Array.isArray(retVal) ? retVal : [retVal];
    }
}



/**
 * Symbol used to set a "toVNs" function to certain classes. This function converts the instances
 * of these classes to a VN or an array of VNs.
 */
let symToVNs = Symbol();



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

    arr.forEach( item => { item == null ? null : item[symToVNs]( nodes); });
    return nodes.length > 0 ? nodes : null;
}



// Add toVNs method to the String class. This method is invoked to convert rendered content to
// virtual node or nodes.
(Boolean.prototype as any)[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    return null;
    // if (this === false)
    //     return null;

    // let vn = new TextVN( "true");
    // if (nodes)
    //     nodes.push( vn);

    // return vn;
};



// Add toVNs method to the String class. This method is invoked to convert rendered content to
// virtual node or nodes.
(String.prototype as any)[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
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
(Component.prototype as any)[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
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
(Function.prototype as any)[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    let vn = new FuncProxyVN( s_currentClassComp, this);
    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add toVNs method to the Array class. This method is invoked to convert rendered content to
// virtual node or nodes.
(Array.prototype as any)[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    return this.length > 0 ? createNodesFromArray( this, nodes) : null;
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
(Promise.prototype as any)[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    let vn = new PromiseProxyVN( { promise: this});
    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add toVNs method to the Object class. This method is invoked to convert rendered content to
// virtual node or nodes.
(Object.prototype as any)[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
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
(String.prototype as any)[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    if (children.length === 0)
        return new ElmVN( s_currentClassComp, this, props, null);
    else
    {
        let subNodes: VN[] = [];
        children.forEach( item =>
        {
            if (item instanceof VN)
                subNodes.push( item)
            else
                item != null && item[symToVNs]( subNodes);
        });

        return new ElmVN( s_currentClassComp, this, props, subNodes);
    }
};



// Add jsxToVNs method to the Fragment class object. This method is invoked by the JSX mechanism.
(Fragment as any)[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    return children.length > 0 ? createNodesFromArray( children) : null;
};



// Add jsxToVNs method to the FuncProxy class object. This method is invoked by the JSX mechanism.
(FuncProxy as any)[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
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
(PromiseProxy as any)[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    return props && props.promise ? new PromiseProxyVN( props, children) : null;
};



// Add jsxToVNs method to the Function class. This method is invoked by the JSX mechanism.
(Function.prototype as any)[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
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
    if (typeof this.prototype.render === "function")
        return new ManagedCompVN( this as IComponentClass, props, realChildren);
    else
        return new FuncVN( this as FuncCompType, props, realChildren);
};



// Add jsxToVNs method to the Object class object. This method is invoked by the JSX mechanism.
(Object.prototype as any)[symJsxToVNs] = function( props: any, children: any[]): VN | VN[] | null
{
    throw new Error( "Invalid tag in jsx processing function: " + this);
};



