import * as mim from "./mim"
import {DN, VN, IRootVN} from "./VN"
import {createVNChainFromContent} from "./ContentFuncs"
import {VNDispAction, VNDisp, VNDispGroup} from "./VNDisp"
import {RootErrorUI, RootWaitingUI} from "./RootUI"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "./Stats"
/// #endif



// let g_requestIdleCallback: (func: ()=>void) => number = (window as any).requestIdleCallback
// 				? (window as any).requestIdleCallback
// 				: (func: ()=>void) => setTimeout( func);

// let g_cancelIdleCallback: (handle) => void = (window as any).cancelIdleCallback
// 				? (window as any).cancelCallback
// 				: (handle) => clearTimeout( handle);



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The RootVN class is used as a top-level virtual node for all rendered trees. RootVN serves
// as an error boundary of last resort. When it catches an error that wasn't caught by any
// descendand node, it displays a simple UI that shows the error and allows the user to restart.
// RootVN also manages service publishers and subscribers.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class RootVN extends VN implements IRootVN, mim.IErrorHandlingService
{
	private constructor( anchorDN: DN)
	{
		super()

		this.anchorDN = anchorDN;
		this.initialize( null);
		this.content = null;
		this.willMount();
	};



	/// #if USE_STATS
		public getStatsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif



	// Sets the content to be rendered under this root node and triggers update.
	private setContent( content: any, sync: boolean): void
	{
		this.content = content;

		if (sync)
		{
			this.vnsScheduledForUpdate.add( this);
			this.onScheduledFrame();
		}
		else
			this.requestNodeUpdate( this);
	}



	// Renders the given content (usually a result of JSX expression or a component instance)
	// under the given HTML element in a synchronous way.
	public static mountRootSync( content: any, anchorDN: DN): void
	{
		let realAnchorDN: DN = anchorDN ? anchorDN : document.body;

		// check whether we already have root node remembered in the anchor element's well-known
		// property
		let rootVN: RootVN = realAnchorDN[RootVN.mimblAnchorPropName];
		if (!rootVN)
		{
			// create root node and remember it in the anchor element's well-known property
			rootVN = new RootVN( realAnchorDN);
			(realAnchorDN as any)[RootVN.mimblAnchorPropName] = rootVN;
		}


		// set content to the root node and trigger synchronous update
		rootVN.setContent( content, true);
	}



	// Unmounts a root node that was created using mountRootSync.
	public static unmountRootSync( anchorDN: DN): void
	{
		let realAnchorDN: DN = anchorDN ? anchorDN : document.body;
		if (!realAnchorDN)
			return;

		// get our root node from the anchor element's well-known property.
		let rootVN: RootVN = realAnchorDN[RootVN.mimblAnchorPropName];
		if (!rootVN)
			return;

		// remove our root node from the anchor element's well-known property
		delete realAnchorDN[RootVN.mimblAnchorPropName];

		rootVN.setContent( null, true);
		rootVN.willUnmount();
	}



	// Renders the given content (usually a result of JSX expression or a component instance)
	// under the given HTML element.
	public static mountRoot( content: any, anchorDN: DN): void
	{
		let realAnchorDN: DN = anchorDN ? anchorDN : document.body;

		// check whether we already have root node remembered in the anchor element's well-known
		// property
		let rootVN: RootVN = realAnchorDN[RootVN.mimblAnchorPropName];
		if (!rootVN)
		{
			// create root node and remember it in the anchor element's well-known property
			rootVN = new RootVN( realAnchorDN);
			(realAnchorDN as any)[RootVN.mimblAnchorPropName] = rootVN;
		}

		// set content to the root node, which will trigger update
		rootVN.setContent( content, false);
	}



	// Unmounts a root node that was created using s_MountRoot.
	public static unmountRoot( anchorDN: DN): void
	{
		let realAnchorDN: DN = anchorDN ? anchorDN : document.body;
		if (!realAnchorDN)
			return;

		// get our root node from the anchor element's well-known property.
		let rootVN: RootVN = realAnchorDN[RootVN.mimblAnchorPropName];
		if (!rootVN)
			return;

		// remove our root node from the anchor element's well-known property
		delete realAnchorDN[RootVN.mimblAnchorPropName];

		// destruct the root node (asynchronously)
		rootVN.setContent( null, false);
		rootVN.scheduleCall( () => rootVN.willUnmount() );
	}



	// Node's type.
	public type = mim.VNType.Root;



	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string { return "Root"; }



	// Generates a chain of sub-nodes according to the current state. If the node doesn't have
	// sub-nodes, null should be returned.
	public render(): any
	{
		if (this.errorUI)
			return this.errorUI;
		else if (this.waitingUI)
			return this.waitingUI;
		else
			return this.content;
	}



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount(): boolean
	{
		this.publishService( "StdErrorHandling", this);
		return true;
	}



	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the render phase.
	public willUnmount(): void
	{
		this.unpublishService( "StdErrorHandling");
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: VN): boolean
	{
		return true;
	}



	// Determines whether the node supports handling of errors; that is, exception thrown during
	// rendering of the node itself and/or its sub-nodes.
	public supportsErrorHandling(): boolean
	{
		return true;
	}



	// This method is called after an exception was thrown during rendering of the node itself
	// or its sub-nodes.
	public handleError( err: any, path: string[]): void
	{
		if (err instanceof Promise)
		{
			let promise = err as Promise<any>;
			this.thrownPromises.add( promise);
			promise.then( () => { this.onPromiseFulfilled( promise); });
			promise.catch( () => { this.onPromiseFulfilled( promise); });
			if (!this.waitingUI)
				this.waitingUI = new RootWaitingUI();
		}
		else
		{
			this.errorUI = new RootErrorUI( this, err, path);
		}
	}



	// Returns DOM node corresponding to the virtual node itself and not to any of its sub-nodes.
	public getOwnDN(): DN { return null; }




	private static mimblAnchorPropName = "__mimblAnchorPropName__";



	// Displays the content originally passed in the constructor.
	public restart(): void
	{
		// clear the error and request to be updated
		this.errorUI = null;
		this.requestUpdate();
	}



	// Informs that a service with the given ID was published by the given node.
	public notifyServicePublished<K extends keyof mim.IServiceDefinitions>( id: K, sourceVN: VN): void
	{
		let info: ServiceInfo = this.serviceInfos.get( id);
		if (info === undefined)
		{
			info = new ServiceInfo();
			this.serviceInfos.set( id, info);
		}

		info.publishingVNs.add( sourceVN);

		// notify all subscribed nodes that information about the service has changed
		for( let vn of info.subscribedVNs)
			vn.notifyServiceChanged( id);
	}



	// Informs that a service with the given ID was unpublished by the given node.
	public notifyServiceUnpublished<K extends keyof mim.IServiceDefinitions>( id: K, sourceVN: VN): void
	{
		let info: ServiceInfo = this.serviceInfos.get( id);
		if (info === undefined)
			return;

		info.publishingVNs.delete( sourceVN);

		if (info.publishingVNs.size === 0 && info.subscribedVNs.size === 0)
			this.serviceInfos.delete( id);
		else
		{
			// notify all subscribed nodes that information about the service has changed
			for( let vn of info.subscribedVNs)
				vn.notifyServiceChanged( id);
		}
	}



	// Informs that the given node has subscribed to a service with the given ID.
	public notifyServiceSubscribed<K extends keyof mim.IServiceDefinitions>( id: K, sourceVN: VN): void
	{
		let info: ServiceInfo = this.serviceInfos.get( id);
		if (info === undefined)
		{
			info = new ServiceInfo();
			this.serviceInfos.set( id, info);
		}

		info.subscribedVNs.add( sourceVN);
	}



	// Informs that the given node has unsubscribed from a service with the given ID.
	public notifyServiceUnsubscribed<K extends keyof mim.IServiceDefinitions>( id: K, sourceVN: VN): void
	{
		let info: ServiceInfo = this.serviceInfos.get( id);
		if (info === undefined)
			return;

		info.subscribedVNs.delete( sourceVN);

		if (info.publishingVNs.size === 0 && info.subscribedVNs.size === 0)
			this.serviceInfos.delete( id);
	}



	// Schedules an update for the given node.
	public requestNodeUpdate( vn: VN): void
	{
		if (!vn.anchorDN)
		{
			console.error( `Update requested for virtual node '${vn.path.join("/")}' that doesn't have anchor DOM node`)
			return;
		}

		// add this node to the map of nodes for which either update or replacement or
		// deletion is scheduled. Note that a node will only be present once in the map no
		// matter how many times it calls requestUpdate().
		this.vnsScheduledForUpdate.add( vn);

		// the update is scheduled in the next cycle unless the request is made during a
		// "before update" function execution.
		if (this.schedulerState !== SchedulerState.BeforeUpdate)
			this.requestFrameIfNeeded();
	}



	// Cancels a previously requested update for the given node.
	public cancelNodeUpdate( vn: VN): void
	{
		// try to remove this node from the set of nodes for which update or replacement or
		// deletion is scheduled.
		if (!this.vnsScheduledForUpdate.delete( vn))
			return;

		// if this was the last node in the set, cancel the request to schedule update processing.
		if (this.schedulerState !== SchedulerState.BeforeUpdate)
			this.cancelFrameRequestIfNeeded();
	}



	// Schedules to call the given function either before or after all the scheduled components
	// have been updated.
	public scheduleFuncCall( func: mim.ScheduledFuncType, beforeUpdate: boolean = false): void
	{
		if (!func)
			return;

		if (beforeUpdate)
		{
			this.callsScheduledBeforeUpdate.add( func);

			// a "before update" function is always scheduled in the next frame even if the
			// call is made from another "before update" function.
			this.requestFrameIfNeeded();
		}
		else
		{
			this.callsScheduledAfterUpdate.add( func);

			// an "after update" function is scheduled in the next cycle unless the request is made
			// either from a "before update" function execution or during a node update.
			if (this.schedulerState !== SchedulerState.BeforeUpdate && this.schedulerState !== SchedulerState.Update)
				this.requestFrameIfNeeded();
		}
	}



	// Cancels a call that has been scheduled to be made either before or after all the scheduled
	// components have been updated.
	public cancelScheduledFuncCall( func: mim.ScheduledFuncType, beforeUpdate: boolean = false): void
	{
		if (!func)
			return;

		if (beforeUpdate)
		{
			this.callsScheduledBeforeUpdate.delete( func);
			this.cancelFrameRequestIfNeeded();
		}
		else
		{
			this.callsScheduledAfterUpdate.delete( func);
			if (this.schedulerState !== SchedulerState.BeforeUpdate && this.schedulerState !== SchedulerState.Update)
				this.requestFrameIfNeeded();
		}
	}



	// Informs that the given node has unsubscribed from a service with the given ID.
	public reportError( err: any, path: string[]): void
	{
		this.handleError( err, path);
		this.requestUpdate();
	}



	// Removes the fulfilled promise from our internal list and if the list is empty asks to
	// re-render
	private onPromiseFulfilled( promise: Promise<any>): void
	{
		this.thrownPromises.delete( promise);
		if (this.thrownPromises.size === 0)
		{
			this.waitingUI = null;
			this.requestUpdate();
		}
	}



	// Determines whether the call to requestAnimationFrame should be made or the frame has already
	// been scheduled.
	private requestFrameIfNeeded(): void
	{
		if (this.scheduledFrameHandle === 0)
			this.scheduledFrameHandle = requestAnimationFrame( this.onScheduledFrame);
	}



	// Determines whether the call to cancelAnimationFrame should be made.
	private cancelFrameRequestIfNeeded(): void
	{
		if (this.vnsScheduledForUpdate.size === 0 &&
			this.callsScheduledBeforeUpdate.size === 0 &&
			this.callsScheduledAfterUpdate.size === 0)
		{
			cancelAnimationFrame( this.scheduledFrameHandle);
			this.scheduledFrameHandle = 0;
		}
	}



	// Callback that is called on a new UI cycle when there is a need to update UI components
	private onScheduledFrame = (): void =>
	{
		// clear the scheduled frame handle so that new update or replacement requests will
		// schedule a new frame.
		this.scheduledFrameHandle = 0;

		// increment tick number.
		this.currentTick++;

		// call functions scheduled to be invoked before updating components. If this function
		// calls the requestUpdate method or schedules a function to be invoked after updates,
		// they will be executed in this cycle. However, if it schedules a function to be invoked
		// after updates, it will be executed in the next cycle.
		if (this.callsScheduledBeforeUpdate.size > 0)
		{
			this.schedulerState = SchedulerState.BeforeUpdate;
			const callsScheduledBeforeUpdate = this.callsScheduledBeforeUpdate;
			this.callsScheduledBeforeUpdate = new Set<mim.ScheduledFuncType>();
			this.callScheduledFunctions( callsScheduledBeforeUpdate, "before");
		}

		if (this.vnsScheduledForUpdate.size > 0)
		{
			/// #if USE_STATS
				DetailedStats.stats = new DetailedStats( `Mimbl update cycle ${this.currentTick}: `);
				DetailedStats.stats.start();
			/// #endif

			// remember the internal set of nodes and re-create it so that it is ready for new
			// update requests. Arrange scheduled nodes by their nesting depths and perform updates.
			this.schedulerState = SchedulerState.Update;
			let vnsScheduledForUpdate = this.vnsScheduledForUpdate;
			this.vnsScheduledForUpdate = new Set<VN>();
			this.performCommitPhase( this.performRenderPhase( this.arrangeNodesByDepth( vnsScheduledForUpdate)));

			/// #if USE_STATS
				DetailedStats.stats.stop( true);
				DetailedStats.stats = null;
			/// #endif
		}

		// call functions scheduled to be invoked after updating components
		if (this.callsScheduledAfterUpdate.size > 0)
		{
			this.schedulerState = SchedulerState.AfterUpdate;
			const callsScheduledAfterUpdate = this.callsScheduledAfterUpdate;
			this.callsScheduledAfterUpdate = new Set<mim.ScheduledFuncType>();
			this.callScheduledFunctions( callsScheduledAfterUpdate, "after");
		}

		this.schedulerState = SchedulerState.Idle;
	};



	// Arranges the scheduled nodes by their nesting depths so that we update "upper" nodes before
	// the lower ones. This can help avoid two conditions:
	//	- rendering a child component twice: first because it called updateMe, and second
	//		because its parent was also updated.
	//	- unnecessary rendering a child component before it is removed by the parent
	// We allocate contiguous array where indices correspond to depth. Each element in this
	// array will either be undefined or contain an array of nodes at this depth.
	private arrangeNodesByDepth( vnsScheduledForUpdate: Set<VN>): VN[][]
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
	private performRenderPhase( vnsByDepth: VN[][]): VNDisp[]
	{
		let updatedNodeDisps: VNDisp[] = [];

		// iteration over the sparse array skips the holes.
		let disp: VNDisp;
		vnsByDepth.forEach( (vns: VN[]) => { vns.forEach( (vn: VN) =>
		{
			try
			{
				// if the component was already updated in this cycle, don't update it again
				if (vn.lastUpdateTick === this.currentTick)
					return;

				disp = new VNDisp( vn, VNDispAction.Unknown, vn);
				this.updateVirtual( disp);
				updatedNodeDisps.push( disp);
			}
			catch( err)
			{
				// find the nearest error handling service. If nobody else, it is implemented
				// by the RootVN object.
				let errorService: mim.IErrorHandlingService = vn.findService( "StdErrorHandling", false);
				errorService.reportError( err, this.currentVN ? this.currentVN.path : null);
			}

			this.currentVN = null;
		})});

		return updatedNodeDisps;
	}



	// Performs the commit phase for all components scheduled for update and recursively for their
	// sub-nodes where necessary. The Commit phase consists of updating DOM and calling life-cycle
	// methods didMount, didUpdate and willUnmount.
	private performCommitPhase( updatedNodeDisps: VNDisp[]): void
	{
		// we don't unticipate any exceptions here because we don't invoke 3rd-party code here.
		updatedNodeDisps.forEach( (disp: VNDisp) =>
		{
			this.updatePhysical( disp);
		});
	}



	// Call functions scheduled before or after update cycle.
	private callScheduledFunctions( funcs: Set<()=>void>, beforeOrAfter: string)
	{
		funcs.forEach( (func) =>
		{
			try
			{
				func();
			}
			catch( err)
			{
				console.error( `Exception while invoking function ${beforeOrAfter} updating components\n`, err);
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
	private createVirtual( vn: VN, parent: VN): void
	{
		// set essential node parameters.
		vn.initialize( parent);

		// keep track of the node that is being currently processed.
		let currentVN = vn;
		this.currentVN = currentVN;

		/// #if VERBOSE_NODE
			console.debug( `VERBOSE: Calling willMount() on node ${vn.name}`);
		/// #endif

		// if willMount returns false, the node never has any sub-nodes (e.g. text nodes)
		if (vn.willMount())
		{
			try
			{
				this.createSubNodesVirtual( vn);
			}
			catch( err)
			{
				if (vn.supportsErrorHandling())
				{
					/// #if VERBOSE_NODE
						console.debug( `VERBOSE: Calling handleError() on node ${vn.name}`);
					/// #endif

					// let the node handle its own error and re-render
					vn.handleError( err, this.currentVN.path);
					this.createSubNodesVirtual( vn);
				}
				else
					throw err;
			}
		}

		// restore pointer to the currently being processed node after processing its sub-nodes.
		// If this node doesn't support error handling and an exception is thrown either by this
		// node or by one of its sub-nodes, this line is not executed and thus, this.currentVN
		// will point to our node when the exception is caught.
		this.currentVN = currentVN;
	}



	// Performs creation and initial rendering on the sub-nodes of our node.
	private createSubNodesVirtual( vn: VN): void
	{
		vn.subNodes = createVNChainFromContent( vn.render());
		if (vn.subNodes)
		{
			if (vn.subNodes.length > 1)
				vn.keyedSubNodes = new Map<any,VN>();

			let prevVN: VN;
			for( let svn of vn.subNodes)
			{
				this.createVirtual( svn, vn);

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
	private createPhysical( vn: VN, anchorDN: DN, beforeDN: DN)
	{
		// remember the anchor node
		vn.anchorDN = anchorDN;

		/// #if VERBOSE_NODE
			console.debug( `VERBOSE: Calling mount() on node ${vn.name}`);
		/// #endif
		let ownDN = vn.mount();

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
				this.createPhysical( svn, newAnchorDN, newBeforeDN);
		}
	}



	// Recursively calls willUnmount on this VN and its sub-nodes.
	private preDestroy( vn: VN)
	{
		if (vn.subNodes)
		{
			for( let svn of vn.subNodes)
				this.preDestroy( svn);
		}

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



	// Recursively removes DOM nodes corresponding to this VN and its sub-nodes.
	private destroyPhysical( vn: VN)
	{
		// get the DOM node before we call unmount, because unmount will clear it.
		let ownDN = vn.getOwnDN();

		// If the virtual node has its own DOM node, we remove it from the DOM tree. In this case,
		// we don't need to recurse into sub-nodes, because they are removed with the parent.
		if (ownDN)
		{
			/// #if VERBOSE_NODE
				console.debug( `VERBOSE: Calling unmount() on node ${vn.name}`);
			/// #endif
			vn.unmount();

			vn.anchorDN.removeChild( ownDN);
		}
		else if (vn.subNodes)
		{
			// loop over sub-nodes from last to first because this way the DOM element removal is
			// easier.
			for( let i = vn.subNodes.length - 1; i >=0; i--)
				this.destroyPhysical( vn.subNodes[i]);
		}

		// disconnect the node from its siblings (if any)
		if (vn.next !== undefined)
			vn.next.prev = undefined;

		if (vn.prev !== undefined)
			vn.prev.next = undefined;

		vn.terminate();
	}



	// Recursively renders this node and updates its sub-nodes if necessary. This method is
	// invoked when a node is being updated either as a result of updateMe invocation or because
	// the parent node was updated. If an exception is thrown during the execution of this method
	// (which can be only from components' shouldUpdate or render methods), the component is asked
	// to handle the error. If the component handles the error, the component is asked to render
	// again; otherwise, the exception is re-thrown. Thus, the exception is propagated up until it
	// is handled by a node that handles it or up to the root node.
	private updateVirtual( disp: VNDisp): void
	{
		// let vn = disp.action === VNDispAction.Insert ? disp.newVN : disp.oldVN;
		let vn = disp.oldVN;

		// keep track of the node that is being currently processed.
		let currentVN = vn;
		this.currentVN = currentVN;

		try
		{
			this.updateSubNodesVirtual( disp);
		}
		catch( err)
		{
			if (vn.supportsErrorHandling())
			{
				/// #if VERBOSE_NODE
					console.debug( `VERBOSE: Calling handleError() on node ${vn.name}`);
				/// #endif

				// let the node handle its own error and re-render
				vn.handleError( err, this.currentVN.path);
				this.updateSubNodesVirtual( disp);
			}
			else
				throw err;
		}

		// indicate that the node was updated in this cycle - this will prevent it from 
		// rendering again in this cycle.
		vn.lastUpdateTick = this.currentTick;

		// restore pointer to the currently being processed node after processing its sub-nodes
		this.currentVN = currentVN;
	}



	// Performs rendering phase of the update on the sub-nodes of the node, which is passed as
	// the oldVN member of the VNDisp structure.
	private updateSubNodesVirtual( disp: VNDisp): void
	{
		// render the new content and build array of dispositions objects for the sub-nodes.
		disp.buildSubNodeDispositions();

		// for nodes to be removed, call willUnmount
		if (disp.subNodesToRemove)
		{
			for( let svn of disp.subNodesToRemove)
				this.preDestroy( svn);
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
				if (subNodeDisp.action === VNDispAction.Update && oldVN !== newVN)
				{
					/// #if VERBOSE_NODE
						console.debug( `VERBOSE: Calling prepareUpdate() on node ${oldVN.name}`);
					/// #endif

					subNodeDisp.updateDisp = oldVN.prepareUpdate( newVN);
					if (subNodeDisp.updateDisp.shouldRender)
						this.updateVirtual( subNodeDisp);
				}
				else if (subNodeDisp.action === VNDispAction.Insert)
					this.createVirtual( newVN, parentVN);
			}
		}
	}



	// Recursively performs DOM updates corresponding to this VN and its sub-nodes.
	private updatePhysical( disp: VNDisp): void
	{
		// remove from DOM the old nodes designated to be removed (that is, those for which there
		// was no counterpart new node that would either update or replace it). We need to remove
		// old nodes first before we start inserting new - one reason is to properly maintain
		// references.
		if (disp.subNodesToRemove)
		{
			for( let svn of disp.subNodesToRemove)
				this.destroyPhysical( svn);
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
		let ownDN = vn.getOwnDN();
		let anchorDN = ownDN !== null ? ownDN : vn.anchorDN;

		// if this virtual node doesn't define its own DOM node (true for components), we will
		// need to find a DOM node before which to start inserting new nodes. Null means
		// append to the end of the anchor node's children.
		let beforeDN = ownDN !== null ? null : vn.getNextDNUnderSameAnchorDN( anchorDN);

		// re-create our current list of sub-nodes - we will populate it while updating them
		vn.subNodes = disp.subNodeDisps ? new Array<VN>(disp.subNodeDisps.length) : undefined;
		vn.keyedSubNodes = vn.subNodes !== undefined && vn.subNodes.length > 1 ? new Map<any,VN>() : undefined;

		// perform updates and inserts by either groups or individual nodes.
		if (disp.subNodeGroups)
		{
			this.updatePhysicalByGroups( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
			this.arrangeGroups( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
		}
		else if (disp.subNodeDisps)
		{
			this.updatePhysicalByNodes( vn, disp.subNodeDisps, anchorDN, beforeDN);
		}
	}



	// Performs updates and inserts by groups. We go from the end of the list of update groups
	// and on each iteration we decide the value of the "beforeDN".
	private updatePhysicalByGroups( parentVN: VN, disps: VNDisp[], groups: VNDispGroup[], anchorDN: DN, beforeDN: DN): void
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
				if (group.action === VNDispAction.Update && oldVN !== newVN)
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
						this.updatePhysical( disp);

					firstDN = oldVN.getFirstDN();
					if (firstDN !== null)
						beforeDN = firstDN;

					// the old node remains as a sub-node
					svn = oldVN;
				}
				else if (group.action === VNDispAction.Insert)
				{
					this.createPhysical( newVN, anchorDN, beforeDN);

					// if the new node defines a DOM node, it becomes the DOM node before which
					// next components should be inserted/moved
					firstDN = newVN.getFirstDN();
					if (firstDN !== null)
						beforeDN = firstDN;

					// the new node becomes a sub-node
					svn = newVN;
				}
				else
					svn = newVN;

				parentVN.subNodes[currSubNodeIndex--] = svn;
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
	private arrangeGroups( parentVN: VN, disps: VNDisp[], groups: VNDispGroup[], anchorDN: DN, beforeDN: DN): void
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
			if (group.lastDN !== null)
			{
				if (group.lastDN.nextSibling !== beforeDN)
				{
					// if the current group now resides before the previous group, then that means
					// that we are swapping two groups. In this case we want to move the shorter one.
					if (group.lastDN.nextSibling === prevGroup.firstDN && group.count > prevGroup.count)
						this.moveGroup( parentVN, disps, prevGroup, anchorDN, group.firstDN);
					else
						this.moveGroup( parentVN, disps, group, anchorDN, beforeDN);
				}

				// the group's first DN becomes the new beforeDN. Note that firstDN cannot be null
				// because lastDN is not null
				beforeDN = group.firstDN;
			}
		}
	}



	// Moves all the nodes in the given group before the given DOM node.
	private moveGroup( parentVN: VN, disps: VNDisp[], group: VNDispGroup, anchorDN: DN, beforeDN: DN): void
	{
		for( let j = group.first; j <= group.last; j++)
		{
			let subNodeVN = group.action === VNDispAction.Update ? disps[j].oldVN : disps[j].newVN;
			let subNodeDNs = subNodeVN.getImmediateDNs();
			for( let subNodeDN of subNodeDNs)
				anchorDN.insertBefore( subNodeDN, beforeDN);

			/// #if USE_STATS
				DetailedStats.stats.log( parentVN.getStatsCategory(), StatsAction.Moved);
			/// #endif

		}
	}



	// Performs updates and inserts by individual nodes.
	private updatePhysicalByNodes( parentVN: VN, disps: VNDisp[], anchorDN: DN, beforeDN: DN): void
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
			if (disp.action === VNDispAction.Update && oldVN !== newVN)
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
					this.updatePhysical( disp);

				// determine whether all the nodes under this VN should be moved.
				let subNodeDNs = oldVN.getImmediateDNs();
				if (subNodeDNs.length > 0)
				{
					// check whether the last of the DOM nodes already resides right before the needed node
					if (subNodeDNs[subNodeDNs.length - 1].nextSibling !== beforeDN)
					{
						for( let subNodeDN of subNodeDNs)
							anchorDN.insertBefore( subNodeDN, beforeDN);

						/// #if USE_STATS
							DetailedStats.stats.log( parentVN.getStatsCategory(), StatsAction.Moved);
						/// #endif
					}

					// the first of DOM nodes become the next beforeDN
					beforeDN = subNodeDNs[0];
				}

				// the old node remains as a sub-node
				svn = oldVN;
			}
			else if (disp.action === VNDispAction.Insert)
			{
				// since we already destroyed old nodes designated to be replaced, the code is
				// identical for Replace and Insert actions
				this.createPhysical( newVN, anchorDN, beforeDN);

				// if the new node defines a DOM node, it becomes the DOM node before which
				// next components should be inserted/moved
				firstDN = newVN.getFirstDN();
				if (firstDN !== null)
					beforeDN = firstDN;

				// the new node becomes a sub-node
				svn = newVN;
			}
			else
				svn = newVN;

			parentVN.subNodes[i] = svn;
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



	// Content rendered under this root node.
	private content: any;

	// Component instance that is rendered when an exception was caught from descendand nodes.
	private errorUI: RootErrorUI = null;

	// Component instance that is rendered when an exception was caught from descendand nodes.
	private waitingUI: RootWaitingUI = null;

	// Set of promises thrown by descendant nodes and not yet fulfilled.
	private thrownPromises = new Set<Promise<any>>();

	// Map of service IDs to sets of virtual nodes that subscribed to this service.
	private serviceInfos = new Map<string,ServiceInfo>();

	// Map of nodes that should be updated on the next UI cycle. We use Map in order to not include
	// the same node more than once - which can happen if the node's requestUpdate method is called
	// more than once during a single run (e.g. during event processing). The value mapped to the
	// node determines the operation to be performed:
	//	- undefined - the node will be updated
	//	- null - the node will be deleted from its parent
	//	- anything else - the node will be replaced with this new content
	private vnsScheduledForUpdate = new Set<VN>();

	// Set of functions that have been scheduled to be called upon a new animation frame before
	// components scheduled for update are updated.
	private callsScheduledBeforeUpdate = new Set<mim.ScheduledFuncType>();

	// Set of functions that have been scheduled to be called upon a new animation frame after
	// components scheduled for update are updated.
	private callsScheduledAfterUpdate = new Set<mim.ScheduledFuncType>();

	// Handle of the animation frame request (in case it should be canceled).
	private scheduledFrameHandle: number = 0;

	// State of the scheduler.
	private schedulerState: SchedulerState = SchedulerState.Idle;

	// Number that serves as a unique ID of an update cycle. Each update cycle the root node
	// increments this number. Each node being updated in this cycle is assigned this number.
	// This helps prevent double-rendering of when both a component and its parent are
	// updated in the same cycle.
	private currentTick: number = 0;

	// Node currently being processed. During creation and updating process, this value is set
	// every time we recurse into sub-nodes and restored when we return back to the node. If
	// during creation or updating process an exception is thrown and is caught by some upper
	// level node, this value will still point at the node that caused the exception.
	private currentVN: VN = null;
}



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



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Information kept by Root virtual node about service publications and subscriptions. The same
// service can be published and subscribed to by multiple nodes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ServiceInfo
{
	publishingVNs: Set<VN> = new Set<VN>();
	subscribedVNs: Set<VN> = new Set<VN>();
}



