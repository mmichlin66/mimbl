import {IComponent, ScheduledFuncType, RefPropType, setRef, IVNode, UpdateStrategy} from "../api/mim";
import {
    notifyServiceUnpublished, notifyServiceUnsubscribed, requestNodeUpdate,
    scheduleFuncCall, notifyServicePublished, notifyServiceSubscribed, wrapCallbackWithVN
} from "../internal";



// Use type DN to refer to DOM's Node class. The DOM nodes that we are dealing with are
// either of type Element or Text.
export type DN = Node;



/// #if USE_STATS
    import {StatsCategory} from "../utils/Stats"
/// #endif

/// #if DEBUG
    let g_nextVNDebugID = 1;
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VNBase class is a base class for all types of virtual nodes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class VN implements IVNode
{
	/// #if USE_STATS
        public abstract get statsCategory(): StatsCategory;
	/// #endif

	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public abstract get name(): string;

	// Parent node. This is null for the top-level (root) nodes.
	public parent: VN;

	/** Component that created this node in its render method (or undefined). */
	public creator: IComponent;

	/**
     * Zero-based index of this node in the parent's list of sub-nodes. This is zero for the
     * root nodes that don't have parents.
     */
	public index: number;

	// Level of nesting at which the node resides relative to the root node.
	public depth: number;

	// DOM node under which all content of this virtual node is rendered.
	public anchorDN: DN;

	/**
	 * Node's key. The derived classes set it based on their respective content. A key can be of
	 * any type.
	 */
	public key?: any;

	// List of sub-nodes - both keyed and unkeyed - defined only if there are some sub-nodes.
	public subNodes: VN[];

	/**
	 * Update strategy object that determines different aspects of node behavior
	 * during updates.
	 */
	public updateStrategy: UpdateStrategy;

	// Returns DOM node corresponding to the virtual node itself (if any) and not to any of its
	// sub-nodes.
	public ownDN: DN;

	// Flag indicating that update has been requested but not yet performed. This flag is needed
	// to prevent trying to add the node to the global map every time the requestUpdate method
	// is called.
	public updateRequested: boolean;

	// "Tick number" during which the node was last updated. If this node's tick number equals
	// the current tick number maintained by the root node, this indicates that this node was
	// already updated in this update cycle. This helps prevent double-rendering of a
	// component if both the component and its parent are updated in the same cycle.
	public lastUpdateTick: number;

    // Flag indicating thata partial update has been requested but not yet performed. This flag is
    // different from the updateRequested since it controls node-type-specific "partial" updates,
    // which are treated by the rconciler by calling the performPartialUpdate method. Different
    // virtual node types can support different kinds of partial updates; for example, the ElmVN
    // allows updating the element properties without re-rendering its children.
	public partialUpdateRequested: boolean;



	///////////////////////////////////////////////////////////////////////////////////////////////
	//
	// Life cycle methods
	//
	///////////////////////////////////////////////////////////////////////////////////////////////

    // Initializes internal stuctures of the virtual node before it is mounted. This method is used
    // to let the node know that it is going to be mounted; however, the node doesn't need to
    // create any DOM elements yet. This will be done during the mount() method.
	public init?(): void;

	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount?(): void;

	// Returns content that comprises the children of the node. If the node doesn't have
	// sub-nodes, null should be returned. If this method is not implemented that means the node
	// never has children - for example text nodes.
	public render?(): any;

    // Notifies the virtual node that it was successfully mounted. This method is called after the
    // content of node and all its sub-nodes is added to the DOM tree.
	public didMount?(): void;

    // Clears internal structures of the virtual node. For nodes that have their own DOM nodes,
    // should only release the internally held reference to the DOM node - the actual removal of
    // the node from DOM is done by the infrastructure.
	public unmount?(): void;

	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node. If this method is
	// not implemented the update is considered possible - e.g. for text nodes.
	public isUpdatePossible?( newVN: VN): boolean;

	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update?( newVN: VN): boolean;

	// Determines whether the node supports handling of errors; that is, exception thrown during
	// rendering of the node itself and/or its sub-nodes. If this method is not implemented the node
	// doesn't support error handling.
	public supportsErrorHandling?: boolean;

	// This method is called after an exception was thrown during rendering of the node itself
	// and/or its sub-nodes. The render method will be called after this method returns.
	public handleError?( err: any, path: string[]): void;

    // This method is called if the node requested a "partial" update. Different types of virtual
    // nodes can keep different data for the partial updates; for example, ElmVN can keep new
    // element properties that can be updated without re-rendering its children.
	public performPartialUpdate?(): void;



    /** Determines whether the node is currently mounted */
	public get isMounted(): boolean { return !!this.anchorDN; }



	// Schedules an update for this node.
	public requestUpdate(): void
	{
		if (!this.updateRequested)
		{
			requestNodeUpdate( this);
			this.updateRequested = true;
		}
	}



	// Schedules an update for this node.
	public requestPartialUpdate(): void
	{
		if (!this.partialUpdateRequested)
		{
			requestNodeUpdate( this);
			this.partialUpdateRequested = true;
		}
	}



	/**
	 * Schedules to call the given function before all the scheduled components have been updated.
	 * @param func Function to be called.
	 * @param funcThisArg Object to be used as the "this" value when the function is called. This parameter
	 *   is not needed if the function is already bound or it is an arrow function.
	 */
	public scheduleCallBeforeUpdate( func: ScheduledFuncType, funcThisArg?: any): void
	{
		scheduleFuncCall( func, true, funcThisArg, this);
	}



	/**
	 * Schedules to call the given function before all the scheduled components have been updated.
	 * @param func Function to be called.
	 * @param funcThisArg Object to be used as the "this" value when the function is called. This parameter
	 *   is not needed if the function is already bound or it is an arrow function.
	 */
	public scheduleCallAfterUpdate( func: ScheduledFuncType, funcThisArg?: any): void
	{
		scheduleFuncCall( func, false, funcThisArg, this);
	}



	// Registers an object of any type as a service with the given ID that will be available for
	// consumption by descendant nodes.
	public publishService( id: string, service: any): void
	{
		if (this.publishedServices === undefined)
			this.publishedServices = new Map<string,any>();

		let existinService: any = this.publishedServices.get( id);
		if (existinService !== service)
		{
			this.publishedServices.set( id, service);
			notifyServicePublished( id, this);
		}
	}



	// Unregisters a service with the given ID.
	public unpublishService( id: string): void
	{
		if (this.publishedServices === undefined)
			return;

		this.publishedServices.delete( id);
		notifyServiceUnpublished( id, this);

		if (this.publishedServices.size === 0)
			this.publishedServices = undefined;
	}



	// Subscribes for a service with the given ID. If the service with the given ID is registered
	// by one of the ancestor nodes, the passed Ref object will reference it; otherwise,
	// the Ref object will be set to the defaultValue (if specified) or will remain undefined.
	// Whenever the value of the service that is registered by a closest ancestor node is
	// changed, the Ref object will receive the new value.
	public subscribeService( id: string, ref: RefPropType, defaultService?: any, useSelf?: boolean): void
	{
		if (this.subscribedServices === undefined)
			this.subscribedServices = new Map<string,VNSubscribedServiceInfo>();

		let info = new VNSubscribedServiceInfo();
		info.ref = ref;
		info.defaultService = defaultService;
		info.useSelf = useSelf ? true : false;

		this.subscribedServices.set( id, info);
		notifyServiceSubscribed( id, this);
		setRef( ref, this.getService( id, defaultService));
}



	// Unsubscribes from a service with the given ID. The Ref object that was used to subscribe,
	// will be set to undefined.
	public unsubscribeService( id: string): void
	{
		if (this.subscribedServices === undefined)
			return;

		let info = this.subscribedServices.get( id);
		if (info === undefined)
			return;

        setRef( info.ref, undefined);
		this.subscribedServices.delete( id);
		notifyServiceUnsubscribed( id, this);

		if (this.subscribedServices.size === 0)
			this.subscribedServices = undefined;
	}



	// Retrieves the value for a service with the given ID registered by a closest ancestor
	// node or the default value if none of the ancestor nodes registered a service with
	// this ID. This method doesn't establish a subscription and only reflects the current state.
	public getService( id: string, defaultService?: any, useSelf?: boolean): any
	{
		let service = this.findService( id, useSelf);
		return service !== undefined ? service : defaultService;
	}



	// Goes up the chain of nodes looking for a published service with the given ID. Returns
	// undefined if the service is not found. Note that null might be a valid value.
	private findService( id: string, useSelf?: boolean): any
	{
		if (useSelf)
		{
			if (this.publishedServices !== undefined)
			{
				let service = this.publishedServices.get( id);
				if (service !== undefined)
					return service;
			}
		}

		// go up the chain; note that we don't pass the useSelf parameter on.
		return this.parent ? this.parent.findService( id, true) : undefined;
	}



	// Notifies the node that publication information about the given service (to which the node
	// has previously subscribed) has changed.
	public notifyServiceChanged( id: string): void
	{
		if (this.subscribedServices === undefined)
			return;

		let info = this.subscribedServices.get( id);
		if (info === undefined)
			return;

		setRef( info.ref, this.getService( id, info.defaultService));
	}



	/**
	 * Creates a wrapper function with the same signature as the given callback so that if the original
	 * callback throws an exception, it is processed by the Mimbl error handling mechanism so that the
	 * exception bubles from this virtual node up the hierarchy until a node/component that knows
	 * to handle errors is found.
	 *
	 * This function should be called by the code that is not part of any component but still has access
	 * to the IVNode object; for example, custom attribute handlers. Components that derive from the
	 * Component class should use the wrapCallback method of the Component class.
	 *
	 * @param callback
	 */
	public wrapCallback<T extends Function>( callback: T, thisCallback?: object, dontDoMimblTick?: boolean): T
	{
		return wrapCallbackWithVN( callback, thisCallback, this, dontDoMimblTick);
	}



	// Map of service IDs to service objects published by this node.
	private publishedServices: Map<string,any>;

	// Map of service IDs to objects constituting subscriptions made by this node.
	private subscribedServices: Map<string,VNSubscribedServiceInfo>;

    /// #if DEBUG
    private debugID = g_nextVNDebugID++;
	/// #endif

}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VNSubscribedServiceInfo class keeps information about a subscription of a node to a service.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class VNSubscribedServiceInfo
{
	// Reference that will be filled in with the service value
	ref: RefPropType<any>;

	// Default value of the service that is used if none of the ancestor nodes publishes the
	// service
	defaultService: any;

	// Flag indicating whether a node can subscribe to a service that it implements itself. This
	// is useful in case where a service that is implemented by a component can chain to a service
	// implemented by an ancestor component.
	useSelf: boolean;
}



