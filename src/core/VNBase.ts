import * as mim from "./mim"
import {VN, DN, VNUpdateDisp} from "./VN"
import {requestNodeUpdate, scheduleFuncCall} from "./Scheduler"
import {notifyServicePublished, notifyServiceUnpublished, notifyServiceSubscribed, notifyServiceUnsubscribed} from "./PubSub"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "./Stats"
/// #endif



// Use type DN to refer to DOM's Node class. The DOM nodes that we are dealing with are
// either of type Element or Text.
export type DN = Node;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VNBase class is a base class for all types of virtual nodes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class VNBase implements VN
{
	/// #if USE_STATS
		public abstract get statsCategory(): StatsCategory;
	/// #endif

	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public abstract get name(): string;

	// Node's type.
	public type: mim.VNType;

	// Parent node. This is null for the top-level (root) nodes.
	public parent: VNBase;

	// Level of nesting at which the node resides relative to the root node.
	public depth: number;

	// DOM node under which all content of this virtual node is rendered.
	public anchorDN: DN;

	// Reference to the next sibling node or undefined for the last sibling.
	public next: VNBase;

	// Reference to the previous sibling node or undefined for the first sibling.
	public prev: VNBase;

	// List of sub-nodes - both keyed and unkeyed - defined only if there are some sub-nodes.
	public subNodes: VNBase[];

	// Map of keyed sub-nodes - defined only if the number of sub-nodes is greater than 1.
	public keyedSubNodes: Map<any,VNBase>;

	// Flag indicating that update has been requested but not yet performed. This flag is needed
	// to prevent trying to add the node to the global map every time the requestUpdate method
	// is called. 
	public updateRequested: boolean;

	// "Tick number" during which the node was last updated. If this node's tick number equals
	// the current tick number maintained by the root node, this indicates that this node was
	// already updated in this update cycle. This helps prevent double-rendering of a
	// component if both the component and its parent are updated in the same cycle.
	public lastUpdateTick: number;

	// // Component that created this node or null if created not by a component (e.g. directly in
	// // mim.mount).
	// private _creator: mim.IClassCompVN;
	// public get creator(): mim.IClassCompVN
	// {
	// 	if (this._creator === undefined)
	// 	{
	// 		// go up the parent chain
	// 		let ancestor = this.parent;
	// 		while( ancestor)
	// 		{
	// 			if (ancestor.type === mim.VNType.ClassComp || ancestor.type == mim.VNType.InstanceComp)
	// 		}
	// 	}

	// 	return this._creator;
	// }



	// Initializes the node by passing the parent node to it. After this, the node knows its
	// place in the hierarchy and gets access to the root of it - the RootVN object.
	public init( parent: VNBase): void
	{
		this.parent = parent;
		this.depth = this.parent ? this.parent.depth + 1 : 0;
	}



	// Cleans up the node object before it is released.
	public term(): void
	{
		// remove information about any published and subscribed services
		if (this.publishedServices !== undefined)
		{
			this.publishedServices.forEach( (service, id) => notifyServiceUnpublished( id, this));
			this.publishedServices.clear();
		}

		if (this.subscribedServices !== undefined)
		{
			this.subscribedServices.forEach( (info, id) => { notifyServiceUnsubscribed( id, this); });
			this.subscribedServices.clear();
		}

		// disconnect the node from its siblings (if any)
		if (this.next !== undefined)
			this.next.prev = undefined;

		if (this.prev !== undefined)
			this.prev.next = undefined;

		this.subNodes = undefined;
		this.keyedSubNodes = undefined;
		this.parent = undefined;
		this.depth = undefined;
	}



	// Schedules an update for this node.
	public requestUpdate(): void
	{
		if (!this.updateRequested)
		{
			requestNodeUpdate( this);
			this.updateRequested = true;
		}
	}



	// Schedules to call the given function either before or after all the scheduled components
	// have been updated.
	public scheduleCall( func: () => void, beforeUpdate: boolean = false): void
	{
		scheduleFuncCall( func, beforeUpdate);
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
	public subscribeService( id: string, ref: mim.RefPropType, defaultService?: any, useSelf?: boolean): void
	{
		if (this.subscribedServices === undefined)
			this.subscribedServices = new Map<string,VNSubscribedServiceInfo>();

		let info = new VNSubscribedServiceInfo();
		info.ref = ref;
		info.defaultService = defaultService;
		info.useSelf = useSelf ? true : false;

		this.subscribedServices.set( id, info);
		notifyServiceSubscribed( id, this);
		mim.setRef( ref, this.getService( id, defaultService));
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

		mim.setRef( info.ref, undefined);
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

		mim.setRef( info.ref, this.getService( id, info.defaultService));
	}



	/**
	 * Creates a wrapper function with the same signature as the given callback so that if the original
	 * callback throws an exception, it is processed by the Mimble error handling mechanism so that the
	 * exception bubles from this virtual node up the hierarchy until a node/component that knows
	 * to handle errors is found.
	 * 
	 * This function should be called by the code that is not part of any component but still has access
	 * to the IVNode object; for example, custom attribute handlers. Components that derive from the
	 * mim.Component class should use the wrapCallback method of the mim.Component class.
	 * 
	 * @param callback 
	 */
	public wrapCallback<T>( callback: T, that?: any): T
	{
		// if (!that && (callback as any).boundable === true)
		// 	that = undefined;

		return CallbackWrapper.bind( this, that, callback);
	}



	// Map of service IDs to service objects published by this node.
	private publishedServices: Map<string,any>;

	// Map of service IDs to objects constituting subscriptions made by this node.
	private subscribedServices: Map<string,VNSubscribedServiceInfo>;
}



/**
 * The CallbackWrapper function is used to wrap a callback in order to catch exceptions from the
 * callback and pass it to the "StdErrorHandling" service. The function is bound to two parameters:
 * a virtual node (accessed as `this`) and the original callback (accessed as the first element
 * from the `arguments` array). The rest of parameters in the `arguments` array are passed to the
 * original callback and the value returned by the callback is returned from the wrapper.
 */
function CallbackWrapper(): any
{
	try
	{
		let [that, orgCallback, ...rest] = arguments;
		return that ? orgCallback.apply( that, rest) : orgCallback( ...rest);
	}
	catch( err)
	{
		let errorService = this.findService( "StdErrorHandling") as mim.IErrorHandlingService;
		if (errorService)
			errorService.reportError( err, this.path);
		else
			throw err;
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VNSubscribedServiceInfo class keeps information about a subscription of a node to a service.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class VNSubscribedServiceInfo
{
	// Reference that will be filled in with the service value
	ref: mim.RefPropType<any>;

	// Default value of the service that is used if none of the ancestor nodes publishes the
	// service
	defaultService: any;

	// Flag indicating whether a node can subscribe to a service that it implements itself. This
	// is useful in case where a service that is implemented by a component can chain to a service
	// implemented by an ancestor component.
	useSelf: boolean;
}



