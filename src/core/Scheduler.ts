import * as mim from "../api/mim"
import {DN, VN, getFirstDN, getLastDN, getImmediateDNs, getNextDNUnderSameAnchorDN, getVNPath} from "./VN"
import {createVNChainFromContent} from "./ContentFuncs"
import {VNDispAction, VNDisp, VNDispGroup} from "./VNDisp"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// State of the scheduler indicating in what phase of the update cycle we currently reside.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
enum SchedulerState
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
 * The ScheduledFuncMap class represents a map of functions scheduled to be executed either before
 * or after component updates. The keys in this map are the original functions and the values are
 * the wrapper functions that will be executed in the context of a given virtual node. Both
 * the keys and the values have the same type: mim.ScheduledFuncType.
 */
class ScheduledFuncMap extends Map<mim.ScheduledFuncType,mim.ScheduledFuncType> {}



// Map of nodes that should be updated on the next UI cycle. We use Map in order to not include
// the same node more than once - which can happen if the node's requestUpdate method is called
// more than once during a single run (e.g. during event processing). The value mapped to the
// node determines the operation to be performed:
//	- undefined - the node will be updated
//	- null - the node will be deleted from its parent
//	- anything else - the node will be replaced with this new content
let s_vnsScheduledForUpdate = new Set<VN>();

// Map of functions that have been scheduled to be called upon a new animation frame before
// components scheduled for update are updated. The values in the map are objects that will
// be used s the "this" value in the callback.
let s_callsScheduledBeforeUpdate = new ScheduledFuncMap();

// Map of functions that have been scheduled to be called upon a new animation frame after
// components scheduled for update are updated. The values in the map are objects that will
// be used s the "this" value in the callback.
let s_callsScheduledAfterUpdate = new ScheduledFuncMap();

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
export let s_currentVN: VN = null;



// Callback that is called on a new UI cycle when there is a need to update UI components
export function updateNodeSync( vn: VN): void
{
	// increment tick number.
	s_currentTick++;

	/// #if USE_STATS
		DetailedStats.stats = new DetailedStats( `Mimbl update cycle ${s_currentTick}: `);
		DetailedStats.stats.start();
	/// #endif

	let vns: VN[][] = new Array(1);
	vns[0] = [vn];

	s_schedulerState = SchedulerState.Update;
	performCommitPhase( performRenderPhase( vns));

	/// #if USE_STATS
		DetailedStats.stats.stop( true);
		DetailedStats.stats = null;
	/// #endif

	s_schedulerState = SchedulerState.Idle;
};



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
	// wil be updated in the current cycle and there is already no time to execute the "before
	// update" method.
	if (vn.type === mim.VNType.IndependentComp || vn.type === mim.VNType.ManagedComp)
	{
		let comp = (vn as any as mim.IClassCompVN).comp;
		if (comp.beforeUpdate && s_schedulerState !== SchedulerState.BeforeUpdate)
			s_callsScheduledBeforeUpdate.set( comp.beforeUpdate, wrapCallbackWithVN( comp.beforeUpdate, comp, vn));

		if (comp.afterUpdate)
			s_callsScheduledAfterUpdate.set( comp.afterUpdate, wrapCallbackWithVN( comp.beforeUpdate, comp, vn));
	}

	// the update is scheduled in the next cycle unless the request is made during a
	// "before update" function execution.
	if (s_schedulerState !== SchedulerState.BeforeUpdate)
		requestFrameIfNeeded();
}



// Schedules to call the given function either before or after all the scheduled components
// have been updated.
export function scheduleFuncCall( func: mim.ScheduledFuncType, beforeUpdate: boolean, that: object, vn: mim.IVNode): void
{
	if (!func)
		return;

	let wrapper = wrapCallbackWithVN( func, that, vn);
	if (beforeUpdate)
	{
		s_callsScheduledBeforeUpdate.set( func, wrapper);

		// a "before update" function is always scheduled in the next frame even if the
		// call is made from another "before update" function.
		requestFrameIfNeeded();
	}
	else
	{
		s_callsScheduledAfterUpdate.set( func, wrapper);

		// an "after update" function is scheduled in the next cycle unless the request is made
		// either from a "before update" function execution or during a node update.
		if (s_schedulerState !== SchedulerState.BeforeUpdate && s_schedulerState !== SchedulerState.Update)
			requestFrameIfNeeded();
	}
}



/**
 * Wraps the given callback and returns a wrapper function which is executed in the context of the
 * given virtual node. The given "that" object will be the value of "this" when the callback is
 * executed. If the original callback throws an exception, it is processed by the Mimbl error
 * handling mechanism so that the exception bubles from this virtual node up the hierarchy until a
 * node/component that knows to handle errors is found.
 * @param vn Virtual node in whose context the callback will be executed.
 * @param callback Callback to be wrapped.
 * @param that Object that will be the value of "this" when the callback is executed.
 * @returns The wrapper function that should be used instead of the original callback.
 */
export function wrapCallbackWithVN<T extends Function>( callback: T, that?: object, vn?: mim.IVNode): T
{
	return CallbackWrapper.bind( vn, that, callback);
}



/**
 * The CallbackWrapper function is used to wrap a callback in order to catch exceptions from the
 * callback and pass it to the "StdErrorHandling" service. The function is bound to  the virtual
 * node as "this" and to two parameters: the object that will be the value of "this" when the
 * original callback is executed and the original callback itself. These two parameters are
 * accessed as the first and second elements of the `arguments` array). The rest of parameters in
 * the `arguments` array are passed to the original callback and the value returned by the callback
 * is returned from the wrapper.
 */
function CallbackWrapper(): any
{
	// remember the current VN and set the current VN to be the VN from the "this" value. Note
	// that this can be undefined
	let currentVN = s_currentVN;
	s_currentVN = this;
	try
	{
		let [that, orgCallback, ...rest] = arguments;
		return that ? orgCallback.apply( that, rest) : orgCallback( ...rest);
	}
	catch( err)
	{
		if (!this)
			throw err;
		else
		{
			let errorService = this.findService( "StdErrorHandling") as mim.IErrorHandlingService;
			if (errorService)
				errorService.reportError( err, getVNPath( this));
			else
				throw err;
		}
	}
	finally
	{
		// restore the current VN to the remembered value;
		s_currentVN = currentVN;
	}
}



// Determines whether the call to requestAnimationFrame should be made or the frame has already
// been scheduled.
function requestFrameIfNeeded(): void
{
	if (s_scheduledFrameHandle === 0)
		s_scheduledFrameHandle = requestAnimationFrame( onScheduledFrame);
}



// Callback that is called on a new UI cycle when there is a need to update UI components
let onScheduledFrame = (): void =>
{
	// clear the scheduled frame handle so that new update or replacement requests will
	// schedule a new frame.
	s_scheduledFrameHandle = 0;

	// increment tick number.
	s_currentTick++;

	// call functions scheduled to be invoked before updating components. If this function
	// calls the requestUpdate method or schedules a function to be invoked after updates,
	// they will be executed in this cycle. However, if it schedules a function to be invoked
	// after updates, it will be executed in the next cycle.
	if (s_callsScheduledBeforeUpdate.size > 0)
	{
		s_schedulerState = SchedulerState.BeforeUpdate;
		let callsScheduledBeforeUpdate = s_callsScheduledBeforeUpdate;
		s_callsScheduledBeforeUpdate = new ScheduledFuncMap();
		callScheduledFunctions( callsScheduledBeforeUpdate, true);
	}

	if (s_vnsScheduledForUpdate.size > 0)
	{
		/// #if USE_STATS
			DetailedStats.stats = new DetailedStats( `Mimbl update cycle ${s_currentTick}: `);
			DetailedStats.stats.start();
		/// #endif

		// remember the internal set of nodes and re-create it so that it is ready for new
		// update requests. Arrange scheduled nodes by their nesting depths and perform updates.
		s_schedulerState = SchedulerState.Update;
		let vnsScheduledForUpdate = s_vnsScheduledForUpdate;
		s_vnsScheduledForUpdate = new Set<VN>();
		performCommitPhase( performRenderPhase( arrangeNodesByDepth( vnsScheduledForUpdate)));

		/// #if USE_STATS
			DetailedStats.stats.stop( true);
			DetailedStats.stats = null;
		/// #endif
	}

	// call functions scheduled to be invoked after updating components
	if (s_callsScheduledAfterUpdate.size > 0)
	{
		s_schedulerState = SchedulerState.AfterUpdate;
		let callsScheduledAfterUpdate = s_callsScheduledAfterUpdate;
		s_callsScheduledAfterUpdate = new ScheduledFuncMap();
		callScheduledFunctions( callsScheduledAfterUpdate, false);
	}

	s_schedulerState = SchedulerState.Idle;
};



// Arranges the scheduled nodes by their nesting depths so that we update "upper" nodes before
// the lower ones. This can help avoid two conditions:
//	- rendering a child component twice: first because it called updateMe, and second
//		because its parent was also updated.
//	- unnecessary rendering a child component before it is removed by the parent
// We allocate contiguous array where indices correspond to depth. Each element in this
// array will either be undefined or contain an array of nodes at this depth.
function arrangeNodesByDepth( vnsScheduledForUpdate: Set<VN>): VN[][]
{
	/// #if VERBOSE_NODE
		let label = `arranging ${vnsScheduledForUpdate.size} nodes by depth`;
		console.time( label);
	/// #endif

	// create a sparse array of certain reasonable size. If we have depths greater than this,
	// the array will grow automatically (although it is less performant it is still acceptable).
	let vnsByDepth: VN[][] = new Array<VN[]>(100);
	vnsScheduledForUpdate.forEach( (vn: VN) =>
	{
		let arr = vnsByDepth[vn.depth];
		if (!arr)
		{
			arr = [];
			vnsByDepth[vn.depth] = arr;
		}

		arr.push(vn);
	});

	/// #if VERBOSE_NODE
		console.timeEnd( label);
	/// #endif

	return vnsByDepth;
}



// Performs rendering phase for all components scheduled for update and recursively for their
// sub-nodes where necessary. Returns array of VNDisp structures for each updated node.
function performRenderPhase( vnsByDepth: VN[][]): VNDisp[]
{
	let updatedNodeDisps: VNDisp[] = [];

	// iteration over the sparse array skips the holes.
	let disp: VNDisp;
	vnsByDepth.forEach( (vns: VN[]) => { vns.forEach( (vn: VN) =>
	{
		try
		{
			// clear the flag that update has been requested for the node
			vn.updateRequested = false;
			
			// if the component was already updated in this cycle, don't update it again
			if (vn.lastUpdateTick === s_currentTick)
				return;

			disp = new VNDisp( vn, VNDispAction.Unknown, vn);
			updateVirtual( disp);
			updatedNodeDisps.push( disp);
		}
		catch( err)
		{
			// find the nearest error handling service. If nobody else, it is implemented
			// by the RootVN object.
			let errorService: mim.IErrorHandlingService = vn.getService( "StdErrorHandling", undefined, false);
			if (errorService)
				errorService.reportError( err, s_currentVN ? getVNPath( s_currentVN) : null);
			else
				throw err;
		}

		s_currentVN = null;
	})});

	return updatedNodeDisps;
}



// Performs the commit phase for all components scheduled for update and recursively for their
// sub-nodes where necessary. The Commit phase consists of updating DOM and calling life-cycle
// methods didMount, didUpdate and willUnmount.
function performCommitPhase( updatedNodeDisps: VNDisp[]): void
{
	// we don't unticipate any exceptions here because we don't invoke 3rd-party code here.
	updatedNodeDisps.forEach( (disp: VNDisp) =>
	{
		updatePhysical( disp);
	});
}



// Call functions scheduled before or after update cycle.
function callScheduledFunctions( funcs: ScheduledFuncMap, beforeUpdate: boolean)
{
	funcs.forEach( (wrapper, func) =>
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
// method (which can be only from components' setSite or render methods),
// the component is asked to handle the error. If the component handles the error, the
// content returned from the error handling method is rendered; otherwise, the exception
// is re-thrown. Thus, the exception is propagated up until it is handled by a node that
// handles it or up to the root node.
function createVirtual( vn: VN, parent: VN): void
{
	vn.init( parent);

	// set essential node parameters.
	vn.parent = parent;
	vn.depth = vn.parent ? vn.parent.depth + 1 : 0;

	// keep track of the node that is being currently processed.
	let currentVN = vn;
	s_currentVN = currentVN;

	if (vn.willMount)
	{
		/// #if VERBOSE_NODE
			console.debug( `VERBOSE: Calling willMount() on node ${vn.name}`);
		/// #endif

		try
		{
			vn.willMount();
		}
		catch( err)
		{
			if (vn.supportsErrorHandling && vn.supportsErrorHandling())
			{
				/// #if VERBOSE_NODE
					console.debug( `VERBOSE: Calling handleError() on node ${vn.name}`);
				/// #endif

				// let the node handle its own error and re-render
				vn.handleError( err, getVNPath( s_currentVN));
				vn.willMount();
			}
			else
				throw err;
		}
	}

	// if the node doesn't implement `render`, the node never has any sub-nodes (e.g. text nodes)
	if (vn.render)
	{
		try
		{
			createSubNodesVirtual( vn);
		}
		catch( err)
		{
			if (vn.supportsErrorHandling && vn.supportsErrorHandling())
			{
				/// #if VERBOSE_NODE
					console.debug( `VERBOSE: Calling handleError() on node ${vn.name}`);
				/// #endif

				// let the node handle its own error and re-render
				vn.handleError( err, getVNPath( s_currentVN));
				createSubNodesVirtual( vn);
			}
			else
				throw err;
		}
	}

	// restore pointer to the currently being processed node after processing its sub-nodes.
	// If this node doesn't support error handling and an exception is thrown either by this
	// node or by one of its sub-nodes, this line is not executed and thus, s_currentVN
	// will point to our node when the exception is caught.
	s_currentVN = currentVN;
}



// Performs creation and initial rendering on the sub-nodes of our node.
function createSubNodesVirtual( vn: VN): void
{
	// this method is only invoked if the node has the render function
	vn.subNodes = createVNChainFromContent( vn.render());
	if (vn.subNodes)
	{
		if (vn.subNodes.length > 1)
			vn.keyedSubNodes = new Map<any,VN>();

		let prevVN: VN;
		for( let svn of vn.subNodes)
		{
			createVirtual( svn, vn);

			if (vn.keyedSubNodes !== undefined && svn.key !== undefined)
				vn.keyedSubNodes.set( svn.key, svn);

			if (prevVN)
			{
				prevVN.next = svn;
				svn.prev = prevVN;
			}

			prevVN = svn;
		}
	}
}



// Recursively creates DOM nodes for this VN and its sub-nodes.
function createPhysical( vn: VN, anchorDN: DN, beforeDN: DN)
{
	// remember the anchor node
	vn.anchorDN = anchorDN;

	/// #if VERBOSE_NODE
		console.debug( `VERBOSE: Calling mount() on node ${vn.name}`);
	/// #endif
	let ownDN = vn.mount ? vn.mount() : undefined;

	// if we have our own DOM node, add it under the anchor node
	if (ownDN)
		vn.anchorDN.insertBefore( ownDN, beforeDN);

	// if the node has sub-nodes, add DOM nodes for them. If the virtual node has its own
	// DOM node use it as an anchor for the sub-nodes.
	if (vn.subNodes)
	{
		// determine what nodes to use as anchor and "before" for the sub-nodes
		let newAnchorDN = ownDN ? ownDN : anchorDN;
		let newBeforeDN = ownDN ? null : beforeDN;

		// mount all sub-nodes
		for( let svn of vn.subNodes)
			createPhysical( svn, newAnchorDN, newBeforeDN);
	}
}



// Recursively calls willUnmount on this VN and its sub-nodes.
function preDestroy( vn: VN)
{
	if (vn.subNodes)
	{
		for( let svn of vn.subNodes)
			preDestroy( svn);
	}

	if (vn.willUnmount)
	{
		/// #if VERBOSE_NODE
			console.debug( `VERBOSE: Calling willUnmount() on node ${vn.name}`);
		/// #endif

		try
		{
			vn.willUnmount();
		}
		catch( err)
		{
			console.error( `Node ${vn.name} threw exception '${err.message}' in willUnmount`);
		}
	}
}



// Recursively removes DOM nodes corresponding to this VN and its sub-nodes.
function destroyPhysical( vn: VN)
{
	// get the DOM node before we call unmount, because unmount will clear it.
	let ownDN = vn.ownDN;

	if (vn.unmount)
	{
		/// #if VERBOSE_NODE
			console.debug( `VERBOSE: Calling unmount() on node ${vn.name}`);
		/// #endif
		vn.unmount();
	}

	// If the virtual node has its own DOM node, we remove it from the DOM tree. In this case,
	// we don't need to recurse into sub-nodes, because they are removed with the parent.
	if (ownDN)
		(ownDN as any as ChildNode).remove();
	else if (vn.subNodes)
	{
		// loop over sub-nodes from last to first because this way the DOM element removal is
		// easier.
		for( let i = vn.subNodes.length - 1; i >=0; i--)
			destroyPhysical( vn.subNodes[i]);
	}

	vn.term();

	vn.anchorDN = undefined;
}



// Recursively renders this node and updates its sub-nodes if necessary. This method is
// invoked when a node is being updated either as a result of updateMe invocation or because
// the parent node was updated. If an exception is thrown during the execution of this method
// (which can be only from components' shouldUpdate or render methods), the component is asked
// to handle the error. If the component handles the error, the component is asked to render
// again; otherwise, the exception is re-thrown. Thus, the exception is propagated up until it
// is handled by a node that handles it or up to the root node.
function updateVirtual( disp: VNDisp): void
{
	// let vn = disp.action === VNDispAction.Insert ? disp.newVN : disp.oldVN;
	let vn = disp.oldVN;

	// keep track of the node that is being currently processed.
	let currentVN = vn;
	s_currentVN = currentVN;

	try
	{
		updateSubNodesVirtual( disp);
	}
	catch( err)
	{
		if (vn.supportsErrorHandling && vn.supportsErrorHandling())
		{
			/// #if VERBOSE_NODE
				console.debug( `VERBOSE: Calling handleError() on node ${vn.name}`);
			/// #endif

			// let the node handle its own error and re-render
			vn.handleError( err, getVNPath( s_currentVN));
			updateSubNodesVirtual( disp);
		}
		else
			throw err;
	}

	// indicate that the node was updated in this cycle - this will prevent it from 
	// rendering again in this cycle.
	vn.lastUpdateTick = s_currentTick;

	// restore pointer to the currently being processed node after processing its sub-nodes
	s_currentVN = currentVN;
}



// Performs rendering phase of the update on the sub-nodes of the node, which is passed as
// the oldVN member of the VNDisp structure.
function updateSubNodesVirtual( disp: VNDisp): void
{
	// render the new content and build array of dispositions objects for the sub-nodes.
	disp.buildSubNodeDispositions();

	// for nodes to be removed, call willUnmount
	if (disp.subNodesToRemove)
	{
		for( let svn of disp.subNodesToRemove)
			preDestroy( svn);
	}

	// perform rendering for sub-nodes that should be inserted, replaced or updated
	if (disp.subNodeDisps)
	{
		let oldVN: VN, newVN: VN;
		let parentVN = disp.oldVN;
		for( let subNodeDisp of disp.subNodeDisps)
		{
			oldVN = subNodeDisp.oldVN;
			newVN = subNodeDisp.newVN;
			if (subNodeDisp.action === VNDispAction.Update)
			{
				if (oldVN !== newVN && oldVN.prepareUpdate)
				{
					/// #if VERBOSE_NODE
						console.debug( `VERBOSE: Calling prepareUpdate() on node ${oldVN.name}`);
					/// #endif
					subNodeDisp.updateDisp = oldVN.prepareUpdate( newVN);
					if (subNodeDisp.updateDisp.shouldRender)
						updateVirtual( subNodeDisp);
				}
			}
			else if (subNodeDisp.action === VNDispAction.Insert)
				createVirtual( newVN, parentVN);
		}
	}
}



// Recursively performs DOM updates corresponding to this VN and its sub-nodes.
function updatePhysical( disp: VNDisp): void
{
	// remove from DOM the old nodes designated to be removed (that is, those for which there
	// was no counterpart new node that would either update or replace it). We need to remove
	// old nodes first before we start inserting new - one reason is to properly maintain
	// references.
	if (disp.subNodesToRemove)
	{
		for( let svn of disp.subNodesToRemove)
			destroyPhysical( svn);
	}

	// get the node whose children are being updated. This is always the oldVN member of
	// the disp structure.
	let vn = disp.oldVN;

	// it might happen that the node being updated was already deleted by its parent. Check
	// for this situation and exit if this is the case
	if (!vn.anchorDN)
		return;

	// determine the anchor node to use when inserting new or moving existing sub-nodes. If
	// our node has its own DN, it will be the anchor for the sub-nodes; otherwise, our node's
	// anchor will be the anchor for the sub-nodes too.
	let ownDN = vn.ownDN;
	let anchorDN = ownDN != null ? ownDN : vn.anchorDN;

	// if this virtual node doesn't define its own DOM node (true for components), we will
	// need to find a DOM node before which to start inserting new nodes. Null means
	// append to the end of the anchor node's children.
	let beforeDN = ownDN != null ? null : getNextDNUnderSameAnchorDN( vn, anchorDN);

	// re-create our current list of sub-nodes - we will populate it while updating them
	vn.subNodes = disp.subNodeDisps ? new Array<VN>(disp.subNodeDisps.length) : undefined;
	vn.keyedSubNodes = vn.subNodes !== undefined && vn.subNodes.length > 1 ? new Map<any,VN>() : undefined;

	// perform updates and inserts by either groups or individual nodes.
	if (disp.subNodeGroups)
	{
		updatePhysicalByGroups( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
		arrangeGroups( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
	}
	else if (disp.subNodeDisps)
	{
		updatePhysicalByNodes( vn, disp.subNodeDisps, anchorDN, beforeDN);
	}
}



// Performs updates and inserts by individual nodes.
function updatePhysicalByNodes( parentVN: VN, disps: VNDisp[], anchorDN: DN, beforeDN: DN): void
{
	// perform DOM operations according to sub-node disposition. We need to decide for each
	// node what node to use to insert or move it before. We go from the end of the list of
	// new nodes and on each iteration we decide the value of the "beforeDN".
	let nextVN: VN, svn: VN, disp: VNDisp, newVN: VN, oldVN: VN, firstDN: DN;
	for( let i = disps.length - 1; i >= 0; i--)
	{
		disp = disps[i];
		newVN = disp.newVN;
		oldVN = disp.oldVN;

		// for the Update operation, the new node becomes a sub-node; for the Insert operation
		// the new node become a sub-node.
		svn = disp.action === VNDispAction.Update ? oldVN : newVN;
		parentVN.subNodes[i] = svn;

		if (disp.action === VNDispAction.Update)
		{
			if (oldVN !== newVN)
			{
				if (disp.updateDisp.shouldCommit)
				{
					/// #if VERBOSE_NODE
						console.debug( `VERBOSE: Calling commitUpdate() on node ${oldVN.name}`);
					/// #endif

					oldVN.commitUpdate( newVN);
				}

				// update the sub-nodes if necessary
				if (disp.updateDisp.shouldRender)
					updatePhysical( disp);
			}

			// determine whether all the nodes under this VN should be moved.
			let subNodeDNs = getImmediateDNs( oldVN);
			if (subNodeDNs.length > 0)
			{
				// check whether the last of the DOM nodes already resides right before the needed node
				if (subNodeDNs[subNodeDNs.length - 1].nextSibling !== beforeDN)
				{
					for( let subNodeDN of subNodeDNs)
					{
						anchorDN.insertBefore( subNodeDN, beforeDN);

						/// #if USE_STATS
							DetailedStats.stats.log( StatsCategory.Elm, StatsAction.Moved);
						/// #endif
					}

					/// #if USE_STATS
						DetailedStats.stats.log( oldVN.statsCategory, StatsAction.Moved);
					/// #endif
				}

				// the first of DOM nodes become the next beforeDN
				beforeDN = subNodeDNs[0];
			}
		}
		else if (disp.action === VNDispAction.Insert)
		{
			// since we already destroyed old nodes designated to be replaced, the code is
			// identical for Replace and Insert actions
			createPhysical( newVN, anchorDN, beforeDN);

			// if the new node defines a DOM node, it becomes the DOM node before which
			// next components should be inserted/moved
			firstDN = getFirstDN( newVN);
			if (firstDN != null)
				beforeDN = firstDN;
		}

		if (parentVN.keyedSubNodes !== undefined && svn.key !== undefined)
			parentVN.keyedSubNodes.set( svn.key, svn);

		svn.next = svn.prev = undefined;
		if (nextVN)
		{
			nextVN.prev = svn;
			svn.next = nextVN;
		}

		nextVN = svn;
	}
}



// Performs updates and inserts by groups. We go from the end of the list of update groups
// and on each iteration we decide the value of the "beforeDN".
function updatePhysicalByGroups( parentVN: VN, disps: VNDisp[], groups: VNDispGroup[], anchorDN: DN, beforeDN: DN): void
{
	let currSubNodeIndex = disps.length - 1;
	let nextVN: VN, svn: VN, disp: VNDisp, newVN: VN, oldVN: VN, firstDN: DN;
	for( let i = groups.length - 1; i >= 0; i--)
	{
		let group = groups[i];

		// first update every sub-node in the group and its sub-sub-nodes
		for( let j = group.last; j >= group.first; j--)
		{
			disp = disps[j];
			newVN = disp.newVN;
			oldVN = disp.oldVN;

			// for the Update operation, the new node becomes a sub-node; for the Insert operation
			// the new node become a sub-node.
			svn = group.action === VNDispAction.Update ? oldVN : newVN;
			parentVN.subNodes[currSubNodeIndex--] = svn;

			if (group.action === VNDispAction.Update)
			{
				if (oldVN !== newVN)
				{
					if (disp.updateDisp.shouldCommit)
					{
						/// #if VERBOSE_NODE
							console.debug( `VERBOSE: Calling commitUpdate() on node ${oldVN.name}`);
						/// #endif

						oldVN.commitUpdate( newVN);
					}

					// update the sub-nodes if necessary
					if (disp.updateDisp.shouldRender)
						updatePhysical( disp);
				}

				firstDN = getFirstDN( oldVN);
				if (firstDN != null)
					beforeDN = firstDN;
			}
			else if (group.action === VNDispAction.Insert)
			{
				createPhysical( newVN, anchorDN, beforeDN);

				// if the new node defines a DOM node, it becomes the DOM node before which
				// next components should be inserted/moved
				firstDN = getFirstDN( newVN);
				if (firstDN != null)
					beforeDN = firstDN;
			}

			if (parentVN.keyedSubNodes !== undefined && svn.key !== undefined)
				parentVN.keyedSubNodes.set( svn.key, svn);

			svn.next = svn.prev = undefined;
			if (nextVN)
			{
				nextVN.prev = svn;
				svn.next = nextVN;
			}

			nextVN = svn;
		}

		// now that all nodes in the group have been updated or inserted, we can determine
		// first and last DNs for the group
		group.determineDNs();

		// if the group has at least one DN, its first DN becomes the node before which the next
		// group of new nodes (if any) should be inserted.
		if (group.firstDN)
			beforeDN = group.firstDN;
	}
}



// Arrange the groups in order as in the new sub-node list, moving them if necessary.
function arrangeGroups( parentVN: VN, disps: VNDisp[], groups: VNDispGroup[], anchorDN: DN, beforeDN: DN): void
{
	// We go from the last group to the second group in the list because as soon as we moved all
	// groups except the first one into their right places, the first group will be automatically
	// in the right place. We always have two groups (i and i-1), which allows us to understand
	// whether we need to swap them. If we do we move the shorter group.
	for( let i = groups.length - 1; i > 0; i--)
	{
		let group = groups[i];
		let prevGroup = groups[i-1];

		// determine whether the group should move. We take the last node from the group
		// and compare its DN's next sibling to the current "beforeDN".
		if (group.lastDN != null)
		{
			if (group.lastDN.nextSibling !== beforeDN)
			{
				// if the current group now resides before the previous group, then that means
				// that we are swapping two groups. In this case we want to move the shorter one.
				if (group.lastDN.nextSibling === prevGroup.firstDN && group.count > prevGroup.count)
					moveGroup( parentVN, disps, prevGroup, anchorDN, group.firstDN);
				else
					moveGroup( parentVN, disps, group, anchorDN, beforeDN);
			}

			// the group's first DN becomes the new beforeDN. Note that firstDN cannot be null
			// because lastDN is not null
			beforeDN = group.firstDN;
		}
	}
}



// Moves all the nodes in the given group before the given DOM node.
function moveGroup( parentVN: VN, disps: VNDisp[], group: VNDispGroup, anchorDN: DN, beforeDN: DN): void
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



