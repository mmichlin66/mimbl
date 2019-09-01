import * as mim from "./mim"
import {DN, VN, IRootVN} from "./VN"
import {createVNChainFromContent} from "./VNChainFuncs"
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
		super( mim.VNType.Root)

		this.anchorDN = anchorDN;
		this.name = "Root";
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

			// let set = new Set<VN>();
			// set.add( this);
			// this.performUpdateCycle( set);
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
	public willMount(): void
	{
		this.publishService( "StdErrorHandling", this);
	}



	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the Commit phase.
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
	public notifyServicePublished( id: string, sourceVN: VN): void
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
	public notifyServiceUnpublished( id: string, sourceVN: VN): void
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
	public notifyServiceSubscribed( id: string, sourceVN: VN): void
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
	public notifyServiceUnsubscribed( id: string, sourceVN: VN): void
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



	// Determines whether the call to requestAnimationFrame should be made after an update or a
	// call has been scheduled.
	private requestFrameIfNeeded(): void
	{
		if (this.scheduledFrameHandle === 0)
			this.scheduledFrameHandle = requestAnimationFrame( this.onScheduledFrame);
	}



	// Determines whether the call to cancelAnimationFrame should be made after a scheduled update
	// or call has been canceled.
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
		vnsByDepth.forEach( (vns: VN[]) => { vns.forEach( (vn: VN) =>
		{
			try
			{
				// if the component was already updated in this cycle, don't update it again
				if (vn.lastUpdateTick === this.currentTick)
					return;

				updatedNodeDisps.push( this.updateStemVirtual( vn));
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
		updatedNodeDisps.forEach( (disp: VNDisp) =>
		{
			this.preUpdatePhysical( disp);
		});

		updatedNodeDisps.forEach( (disp: VNDisp) =>
		{
			this.updatePhysical( disp);
		});

		updatedNodeDisps.forEach( (disp: VNDisp) =>
		{
			this.postUpdate( disp);
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
		vn.willMount();

		// if the node doesn't handle errors we don't need to waste time to use try/catch
		if (!vn.supportsErrorHandling())
			this.createSubNodesVirtual( vn);
		else
		{
			try
			{
				this.createSubNodesVirtual( vn);
			}
			catch( err)
			{
				/// #if VERBOSE_NODE
					console.debug( `VERBOSE: Calling handleError() on node ${vn.name}`);
				/// #endif

				// let the node handle its own error and re-render
				vn.handleError( err, this.currentVN.path);
				this.createSubNodesVirtual( vn);
			}
		}

		// restore pointer to the currently being processed node after processing its subnodes
		this.currentVN = currentVN;
	}



	// Performs creation and initial rendering on the sub-nodes of our node.
	private createSubNodesVirtual( vn: VN): void
	{
		let subNodes = createVNChainFromContent( vn.render());
		for( let svn = subNodes.first; svn !== null; svn = svn.next)
			this.createVirtual( svn, vn);

		vn.subNodes = subNodes;
	}



	// Recursively creates DOM nodes for this VN and its sub-nodes.
	private createPhysical( vn: VN, anchorDN: DN, beforeDN: DN)
	{
		// remember the anchor node
		vn.anchorDN = anchorDN;

		/// #if VERBOSE_NODE
			console.debug( `VERBOSE: Calling mount() on node ${vn.name}`);
		/// #endif
		vn.mount();

		// If the virtual node has its own DOM node, add it to the DOM tree and use it as an
		// anchor for the sub-nodes.
		let ownDN: DN = vn.getOwnDN();

		// if we have our own DOM node, add it under the anchor node
		if (ownDN !== null)
			vn.anchorDN.insertBefore( ownDN, beforeDN);

		// if the node has sub-nodes, add DOM nodes for them
		if (vn.subNodes.count > 0)
		{
			// determine what nodes to use as anchor and "before" for the sub-nodes
			let newAnchorDN: DN = ownDN === null ? anchorDN : ownDN;
			let newBeforeDN: DN = ownDN === null ? beforeDN : null;

			// mount all sub-nodes
			for( let svn = vn.subNodes.first; svn !== null; svn = svn.next)
				this.createPhysical( svn, newAnchorDN, newBeforeDN);
		}
	}



	// Recursively calls didMount on this VN and its sub-nodes.
	private postCreate( vn: VN)
	{
		/// #if VERBOSE_NODE
			console.debug( `VERBOSE: Calling didMount() on node ${vn.name}`);
		/// #endif

		try
		{
			vn.didMount();
		}
		catch( err)
		{
			console.error( `Node ${vn.name} threw exception '${err.message}' in didMount`);
		}

		for( let svn = vn.subNodes.first; svn !== null; svn = svn.next)
			this.postCreate( svn);
	}



	// Recursively calls willUnmount on this VN and its sub-nodes.
	private preDestroy( vn: VN)
	{
		for( let svn = vn.subNodes.first; svn !== null; svn = svn.next)
			this.preDestroy( svn);

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
		let ownDN: DN = vn.getOwnDN();

		/// #if VERBOSE_NODE
			console.debug( `VERBOSE: Calling unmount() on node ${vn.name}`);
		/// #endif
		vn.unmount();

		// If the virtual node has its own DOM node, we remove it from the DOM tree. In this case,
		// we don't need to recurse into sub-nodes, because they are removed with the parent.
		if (ownDN)
		{
			// our DOM nodes can only be either Element or Text - both derive from ChildNode
			(ownDN as any as ChildNode).remove();
		}
		else
		{
			// loop over sub-nodes from last to first because this way the DOM element removal is
			// easier.
			for( let svn = vn.subNodes.last; svn !== null; svn = svn.prev)
				this.destroyPhysical( svn);
		}

		vn.terminate();
	}



	// Recursively renders the children if this node. This method is only invoked if a node is
	// being updated as a result of updateMe invocation.
	private updateStemVirtual( vn: VN): VNDisp
	{
		let disp = new VNDisp();
		disp.action = VNDispAction.Unknown;
		disp.oldVN = disp.newVN = vn;
		this.updateVirtual( disp);
		return disp;
	}



	// Recursively renders this node and updates its sub-nodes if necessary. This method is
	// invoked when a node is being updated either as a result of updateMe invocation or because
	// the parent node was updated. If an exception is thrown during the execution of this method
	// (which can be only from components' shouldUpdate or render methods), the component is asked
	// to handle the error. If the component handles the error, the content returned from the
	// error handling method is rendered; otherwise, the exception is re-thrown. Thus, the
	// exception is propagated up until it is handled by a node that handles it or up to the root
	// node.
	private updateVirtual( disp: VNDisp): void
	{
		// keep track of the node that is being currently processed.
		let currentVN = disp.oldVN;
		this.currentVN = currentVN;

		// if the node doesn't handle errors we don't need to waste time to use try/catch
		if (!disp.oldVN.supportsErrorHandling())
			this.updateSubNodesVirtual( disp);
		else
		{
			try
			{
				this.updateSubNodesVirtual( disp);
			}
			catch( err)
			{
				disp.oldVN.handleError( err, this.currentVN.path);
				this.updateSubNodesVirtual( disp);
			}
		}

		// indicate that the node was updated in this cycle - this will prevent it from 
		// rendering again in this cycle.
		disp.oldVN.lastUpdateTick = this.currentTick;

		// restore pointer to the currently being processed node after processing its subnodes
		this.currentVN = currentVN;
	}



	// Performs rendering phase of the update on the sub-nodes of the node, which is passed as
	// the oldVN member of the VNDisp structure.
	private updateSubNodesVirtual( disp: VNDisp): void
	{
		// render the new content and build array of dispositions objects for the sub-nodes.
		disp.buildSubNodeDispositions();

		// perform rendering for sub-nodes that should be inserted, replaced or updated
		for( let subNodeDisp of disp.subNodeDisps)
		{
			if (subNodeDisp.action === VNDispAction.Update)
			{
				/// #if VERBOSE_NODE
					console.debug( `VERBOSE: Calling prepareUpdate() on node ${subNodeDisp.oldVN.name}`);
				/// #endif

				subNodeDisp.updateDisp = subNodeDisp.oldVN.prepareUpdate( subNodeDisp.newVN);
				if (subNodeDisp.updateDisp.shouldRender)
					this.updateVirtual( subNodeDisp);
			}
			else
				this.createVirtual( subNodeDisp.newVN, disp.oldVN);
		}
	}



	// Recursively calls willUnmount on sub-nodes marked for deletion.
	private preUpdatePhysical( disp: VNDisp)
	{
		// first, sub-nodes marked for deletion
		for( let svn of disp.subNodesToRemove)
			this.preDestroy( svn);

		// second, sub-nodes marked for update or insert
		for( let subNodeDisp of disp.subNodeDisps)
			this.preUpdatePhysical( subNodeDisp);
	}



	// Recursively performs DOM updates corresponding to this VN and its sub-nodes.
	private updatePhysical( disp: VNDisp): void
	{
		// get the node whose children are being updated. This is always the oldVN member of
		// the disp structure.
		let vn = disp.oldVN;

		// it might happen that the node being updated was already deleted by its parent. Check
		// for this situation and exit if this is the case
		if (!vn.anchorDN)
			return;

		// remove from DOM the old nodes designated to be removed (that is, those for which there
		// is no counterpart new node that will either update or replace it) and then those
		// designated to be replaced. We need to remove old nodes first before we start inserting
		// new - one reason is to properly maintain references.
		for( let svn of disp.subNodesToRemove)
			this.destroyPhysical( svn);

		// clear our current list of sub-nodes - we will populate it while updating them
		vn.subNodes.clear();

		// determine the anchor node to use when inserting new or moving existing sub-nodes. If
		// our node has its own DN, it will be the anchor for the sub-nodes; otherwise, our node's
		// anchor will be the anchor for the sub-nodes too.
		let ownDN = vn.getOwnDN();
		let anchorDN = ownDN !== null ? ownDN : vn.anchorDN;

		// if this virtual node doesn't define its own DOM node (true for components), we will
		// need to find a DOM node before which to start inserting new nodes. Null means
		// append to the end of the anchor node's children.
		let beforeDN = ownDN !== null ? null : vn.getNextDNUnderSameAnchorDN( anchorDN);

		// perform updates and inserts by either groups or individual nodes.
		if (disp.subNodeGroups && disp.subNodeGroups.length > 0)
		{
			this.updatePhysicalByGroups( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
			this.arrangeGroups( vn, disp.subNodeDisps, disp.subNodeGroups, anchorDN, beforeDN);
		}
		else if (disp.subNodeDisps && disp.subNodeDisps.length > 0)
		{
			this.updatePhysicalByNodes( vn, disp.subNodeDisps, anchorDN, beforeDN);
		}
	}



	// Performs updates and inserts by groups. We go from the end of the list of update groups
	// and on each iteration we decide the value of the "beforeDN".
	private updatePhysicalByGroups( parentVN: VN, disps: VNDisp[], groups: VNDispGroup[], anchorDN: DN, beforeDN: DN): void
	{
		for( let i = groups.length - 1; i >= 0; i--)
		{
			let group = groups[i];

			// first update every sub-node in the group and its sub-sub-nodes
			for( let j = group.last; j >= group.first; j--)
			{
				let disp = disps[j];
				let newVN = disp.newVN;
				if (group.action === VNDispAction.Update)
				{
					let oldVN = disp.oldVN;
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

					let firstDN = oldVN.getFirstDN();
					if (firstDN !== null)
						beforeDN = firstDN;

					// the old node remains as a sub-node
					parentVN.subNodes.insertVN( oldVN);
				}
				else
				{
					// since we are going from the first node in the group to the last we always use
					// the same beforeDN for insertion
					this.createPhysical( newVN, anchorDN, beforeDN);

					// if the new node defines a DOM node, it becomes the DOM node before which
					// next components should be inserted/moved
					let firstDN = newVN.getFirstDN();
					if (firstDN !== null)
						beforeDN = firstDN;

					// the new node becomes a sub-node
					parentVN.subNodes.insertVN( newVN);
				}
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

			// let subNodeFirstDN = subNodeVN.getFirstDN();
			// if (subNodeFirstDN)
			// {
			// 	anchorDN.insertBefore( subNodeFirstDN, beforeDN);

			// 	/// #if USE_STATS
			// 		DetailedStats.stats.log( parentVN.getStatsCategory(), StatsAction.Moved);
			// 	/// #endif
			// }

			// determine whether all the nodes under this VN should be moved.
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
		for( let i = disps.length - 1; i >= 0; i--)
		{
			let disp = disps[i];
			let action = disp.action;
			let newVN = disp.newVN;
			if (action === VNDispAction.Update)
			{
				let oldVN = disp.oldVN;
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
				parentVN.subNodes.insertVN( oldVN);
			}
			else
			{
				// since we already destroyed old nodes designated to be replaced, the code is
				// identical for Replace and Insert actions
				this.createPhysical( newVN, anchorDN, beforeDN);

				// if the new node defines a DOM node, it becomes the DOM node before which
				// next components should be inserted/moved
				let firstDN: DN = newVN.getFirstDN();
				if (firstDN !== null)
					beforeDN = firstDN;

				// the new node becomes a sub-node
				parentVN.subNodes.insertVN( newVN);
			}
		}
	}



	// // Recursively performs DOM updates corresponding to this VN and its sub-nodes.
	// private updatePhysical( disp: VNDisp)
	// {
	// 	// get the node whose children are being updated. This is always the oldVN member of
	// 	// the disp structure.
	// 	let vn = disp.oldVN;

	// 	// it might happen that the node being updated was already deleted by its parent. Check
	// 	// for this situation and exit if this is the case
	// 	if (!vn.anchorDN)
	// 		return;

	// 	// remove from DOM the old nodes designated to be removed (that is, those for which there
	// 	// is no counterpart new node that will either update or replace it) and then those
	// 	// designated to be replaced. We need to remove old nodes first before we start inserting
	// 	// new - one reason is to properly maintain references.
	// 	for( let svn of disp.subNodesToRemove)
	// 		this.destroyPhysical( svn);

	// 	// clear our current list of sub-nodes we will populate it while updating them
	// 	vn.subNodes.clear();

	// 	// determine the anchor node to use when inserting or moving new nodes
	// 	let ownDN = vn.getOwnDN();
	// 	let anchorDN = ownDN !== null ? ownDN : vn.anchorDN;

	// 	// if this virtual node doesn't define its own DOM node (true for components), we will
	// 	// need to find a DOM node before which to start inserting or moving nodes. Null means
	// 	// append to the end of the anchor node's children.
	// 	let beforeDN: DN = ownDN !== null ? null : vn.getNextDNUnderSameAnchorDN( anchorDN);

	// 	// perform DOM operations according to sub-node disposition. We need to decide for each
	// 	// node what node to use to insert or move it before. We go from the end of the list of
	// 	// new nodes and on each iteration we decide the value of the "beforeDN".
	// 	for( let i = disp.subNodeDisps.length - 1; i >= 0; i--)
	// 	{
	// 		let subNodeDisp = disp.subNodeDisps[i];
	// 		let action = subNodeDisp.action;
	// 		if (action === VNDispAction.Update)
	// 		{
	// 			let oldVN = subNodeDisp.oldVN;
	// 			let newVN = subNodeDisp.newVN;
	// 			if (subNodeDisp.updateDisp.shouldCommit)
	// 			{
	// 				/// #if VERBOSE_NODE
	// 					console.debug( `VERBOSE: Calling commitUpdate() on node ${oldVN.name}`);
	// 				/// #endif

	// 				oldVN.commitUpdate( newVN);
	// 			}

	// 			// update the sub-nodes if necessary
	// 			if (subNodeDisp.updateDisp.shouldRender)
	// 				this.updatePhysical( subNodeDisp);

	// 			// if our sub-node defines its own DN, we need to determine whether it should be moved.
	// 			let subNodeFirstDN = oldVN.getFirstDN();
	// 			if (subNodeFirstDN !== null)
	// 			{
	// 				let nextSubNodeVNDisp = i === disp.subNodeDisps.length - 1 ? null : disp.subNodeDisps[i+1];
	// 				let newNextVN = nextSubNodeVNDisp === null
	// 									? null
	// 									: nextSubNodeVNDisp.action === VNDispAction.Update
	// 										? nextSubNodeVNDisp.oldVN
	// 										: nextSubNodeVNDisp.newVN;
	// 				if (oldVN.next !== newNextVN || subNodeFirstDN.nextSibling !== beforeDN)
	// 				{
	// 					anchorDN.insertBefore( subNodeFirstDN, beforeDN);

	// 					/// #if USE_STATS
	// 						DetailedStats.stats.log( vn.getStatsCategory(), StatsAction.Moved);
	// 					/// #endif
	// 				}

	// 				beforeDN = subNodeFirstDN;
	// 			}

	// 			// // if the updated old VN (or one of its sub-nodes) defines a DOM node and it
	// 			// // is not positioned before the current "beforeDN", move it there. It also
	// 			// // becomes the new DOM node before which next components should be inserted.
	// 			// let firstDN = oldVN.getFirstDN();
	// 			// if (firstDN !== null)
	// 			// {
	// 			// 	// determine whether we need to move our node
	// 			// 	let nextSubNodeVNDisp: VNDisp = i === disp.subNodeDisps.length - 1
	// 			// 					? undefined : disp.subNodeDisps[i+1];
	// 			// 	if (this.shouldMoveVN( subNodeDisp, nextSubNodeVNDisp) || firstDN.nextSibling !== beforeDN)
	// 			// 	{
	// 			// 		anchorDN.insertBefore( firstDN, beforeDN);

	// 			// 		/// #if USE_STATS
	// 			// 			DetailedStats.stats.log( vn.getStatsCategory(), StatsAction.Moved);
	// 			// 		/// #endif
	// 			// 	}

	// 			// 	beforeDN = firstDN;
	// 			// }

	// 			// the old node remains as a sub-node
	// 			vn.subNodes.insertVN( oldVN);
	// 		}
	// 		else
	// 		{
	// 			let newVN = subNodeDisp.newVN;

	// 			// since we already destroyed old nodes designated to be replaced, the code is
	// 			// identical for Replace and Insert actions
	// 			this.createPhysical( newVN, anchorDN, beforeDN);

	// 			// if the new node defines a DOM node, it becomes the DOM node before which
	// 			// next components should be inserted/moved
	// 			let firstDN: DN = newVN.getFirstDN();
	// 			if (firstDN !== null)
	// 				beforeDN = firstDN;

	// 			// the new node becomes a sub-node
	// 			vn.subNodes.insertVN( newVN);
	// 		}
	// 	}
	// }



	// private shouldMoveVN( vnDisp: VNDisp, nextVNDisp: VNDisp): boolean
	// {
	// 	if (nextVNDisp === undefined)
	// 		return vnDisp.oldVN.next !== null;
	// 	else if (nextVNDisp.action === VNDispAction.Update)
	// 		return vnDisp.oldVN.next !== nextVNDisp.oldVN;
	// 	else
	// 		return true;
	// }



	// Recursively calls appropriate life-cycle methods on this VN and its sub-nodes.
	private postUpdate( disp: VNDisp)
	{
		for( let subNodeDisp of disp.subNodeDisps)
		{
			if (subNodeDisp.action === VNDispAction.Update)
			{
				// if we updated sub-nodes, notify them too
				if (subNodeDisp.updateDisp.shouldRender)
					this.postUpdate( subNodeDisp);
			}
			else if (subNodeDisp.action === VNDispAction.Insert)
				this.postCreate( subNodeDisp.newVN);
		}

		/// #if VERBOSE_NODE
			console.debug( `VERBOSE: Calling didUpdate() on node ${disp.oldVN.name}`);
		/// #endif

		try
		{
			disp.oldVN.didUpdate();
		}
		catch( err)
		{
			console.error( `Node ${disp.oldVN.name} threw exception '${err.message}' in didUpdate`);
		}
	}



	// Determines whether the node should be moved based on its disposition.
	// // Compares two chains of nodes (old and new) and fills two arrays for sub-nodes:
	// //	- array of node disposition objects corresponding to new sub-nodes. Each disposition
	// //		indicates whether the new sub-node should be just inserted or whether it should update
	// //		the old sub-node.
	// //	- array of old sub-nodes which should be removed.
	// // This method is only invoked with the disp object whose oldVN field is non-null.
	// private buildSubNodeDispositions( disp: VNDisp): void
	// {
	// 	// render the new content;
	// 	let newChain = createVNChainFromContent( disp.oldVN.render());

	// 	// build map of old keyed nodes and an array of old non-keyed nodes
	// 	let keyedMap: Map<any,VN> = new Map<any,VN>();
	// 	let nonKeyedList: VN[] = [];
	// 	let oldChain = disp.oldVN.subNodes;
	// 	for( let oldVN = oldChain.first; oldVN !== null; oldVN = oldVN.next)
	// 	{
	// 		if (oldVN.key === undefined)
	// 			nonKeyedList.push( oldVN);
	// 		else
	// 			keyedMap.set( oldVN.key, oldVN);
	// 	}

	// 	// loop over new nodes
	// 	let nonKeyedListLength: number = nonKeyedList.length;
	// 	let nonKeyedIndex: number = 0;
	// 	for( let newVN = newChain.first; newVN !== null; newVN = newVN.next)
	// 	{
	// 		let oldVN: VN;
	// 		if (newVN.key !== undefined)
	// 		{
	// 			oldVN = keyedMap.get( newVN.key);

	// 			// if we found old node then remove the old node from the map - this way at
	// 			// the end of the loop all old nodes remaining in the map should be deleted
	// 			if (oldVN !== undefined)
	// 				keyedMap.delete( newVN.key);
	// 		}
	// 		else if (nonKeyedIndex < nonKeyedListLength)
	// 		{
	// 			oldVN = nonKeyedList[nonKeyedIndex];
	// 			nonKeyedIndex++;
	// 		}

	// 		let subNodeDisp = new VNDisp();
	// 		subNodeDisp.newVN = newVN;

	// 		// by now, if we didn't find an old node, then the new node should be inserted;
	// 		// otherwise, we decide on whether the new node should be used to update or
	// 		// replace the old node
	// 		if (oldVN === undefined)
	// 			subNodeDisp.action = VNAction.Insert;
	// 		else if (oldVN.type === newVN.type && oldVN.isUpdatePossible( newVN))
	// 		{
	// 			subNodeDisp.action = VNAction.Update;
	// 			subNodeDisp.oldVN = oldVN;
	// 		}
	// 		else
	// 		{
	// 			// we are here if the new node should replace the old one. We add the old node to
	// 			// the list of those to be removed and indicate
	// 			disp.subNodesToRemove.push( oldVN);
	// 			subNodeDisp.action = VNAction.Insert;
	// 		}

	// 		disp.subNodeDisps.push( subNodeDisp);
	// 	}

	// 	// old keyed nodes remaining in the map will be unmounted because these are the old nodes
	// 	// for which there were no new nodes with the same key.
	// 	for( let oldVN of keyedMap.values())
	// 		disp.subNodesToRemove.push( oldVN);

	// 	// old non-keyed nodes from the current index to the end of the list will be unmounted
	// 	for( let i = nonKeyedIndex; i < nonKeyedListLength; i++)
	// 		disp.subNodesToRemove.push( nonKeyedList[i]);
	// }



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



