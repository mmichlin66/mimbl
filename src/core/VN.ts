import * as mim from "./mim"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "./Stats"
/// #endif



// Use type DN to refer to DOM's Node class. The DOM nodes that we are dealing with are
// either of type Element or Text.
export type DN = Node;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VN class is a base class for all types of virtual nodes. Virtual nodes are kept in a
// doublly-linked list and each node points to a parent node as well as first and last sub-nodes.
//
// Mounting sequence:
//	- constructor
//	- willMount
//	- render
//	- mount
//	- didMount
//
// Unmounting sequence:
//	- willUnmount
//	- unmount
//	- //didUnmount
//
// Updating sequence when update was caused by the node itself:
//	- render
//	- didUpdate
//
// Updating sequence when update was caused by parent:
//	- updateFrom
//	- render (only if updateFrom indicated that children should be updated)
//	- commitUpdate (only if updateFrom indicated that commit is necessary)
//	- move (only if necessary)
//	- didUpdate
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class VN implements mim.IVNode
{
	// IVNode implementation
	public get Type(): mim.VNType { return this.type; }
	public get Parent(): mim.IVNode { return this.parent; }
	public get SubNodes(): mim.IVNode[] { return this.subNodes; }
	public get Name(): string { return this.name; }



	// Node's type.
	public abstract get type(): mim.VNType;

	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public abstract get name(): string;



	// Initializes the node by passing the parent node to it. After this, the node knows its
	// place in the hierarchy and gets access to the root of it - the RootVN object.
	public initialize( parent: VN): void
	{
		this.parent = parent;
		this.root = this.parent ? this.parent.root : this as any as IRootVN;
		this.depth = this.parent ? this.parent.depth + 1 : 0;
	}



	// Cleans up the node object before it is released.
	public terminate(): void
	{
		// remove information about any published and subscribed services
		if (this.publishedServices !== undefined)
		{
			this.publishedServices.forEach( (service, id) => this.root.notifyServiceUnpublished( id, this));
			this.publishedServices.clear();
		}

		if (this.subscribedServices !== undefined)
		{
			this.subscribedServices.forEach( (info, id) => { this.root.notifyServiceUnsubscribed( id, this); });
			this.subscribedServices.clear();
		}

		this.anchorDN = null;
		this.subNodes = undefined;
		this.parent = undefined;
		this.root = undefined;
		this.depth = undefined;
	}



	/// #if USE_STATS
		public abstract getStatsCategory(): StatsCategory;
	/// #endif

	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// If the node never has any children (like text nodes), it should return false.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount?(): boolean { return true; }

	// Returns content that comprises the children of the node. If the node doesn't have
	// sub-nodes, null should be returned. If this method is not implemented it is as though
	// null is returned.
	// This method is part of the Render phase.
	public render?(): any {}

	// Creates and returns DOM node corresponding to this virtual node.
	// This method is part of the Commit phase.
	public mount?(): DN { return null; }

	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the Render phase.
	public willUnmount?(): void {}

	// Destroys DOM node corresponding to this virtual node. This method is called only on nodes
	// that have their own DOM nodes.
	// This method is part of the Commit phase.
	public unmount?(): void {}

	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node. This method is
	// NOT marked as optional and thus must be implemented by all types of virtual nodes.
	// This method is part of the Render phase.
	public isUpdatePossible( newVN: VN): boolean { return false; }

	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	public prepareUpdate?( newVN: VN): VNUpdateDisp { return { shouldCommit: false, shouldRender: false }; }

	// Commits updates made to this node to DOM.
	// This method is part of the Commit phase.
	public commitUpdate?( newVN: VN): void {}

	// Determines whether the node supports handling of errors; that is, exception thrown during
	// rendering of the node itself and/or its sub-nodes.
	// This method is part of the Render phase.
	public supportsErrorHandling?(): boolean { return false; }

	// This method is called after an exception was thrown during rendering of the node itself
	// and/or its sub-nodes. It returns content comprising the children of the node.
	// This method is part of the Render phase.
	public handleError?( vnErr: any, path: string[]): void {}

	/**
	 * Retrieves update strategy object that determines different aspects of node behavior
	 * during updates.
	 */
	public getUpdateStrategy?(): mim.UpdateStrategy { return undefined; }

	// Returns DOM node corresponding to the virtual node itself (if any) and not to any of its
	// sub-nodes.
	public getOwnDN(): DN { return null; }



	// Schedules an update for this node.
	public requestUpdate(): void
	{
		if (this.root)
			this.root.requestNodeUpdate( this);
	}



	// Cancels a previously requested update for this node.
	public cancelUpdate(): void
	{
		if (this.root)
			this.root.cancelNodeUpdate( this);
	}



	// Schedules to call the given function either before or after all the scheduled components
	// have been updated.
	public scheduleCall( func: () => void, beforeUpdate: boolean = false): void
	{
		if (this.root)
			this.root.scheduleFuncCall( func, beforeUpdate);
	}



	// Cancels a call that has been scheduled to be made either before or after all the scheduled
	// components have been updated.
	public cancelScheduledCall( func: () => void, beforeUpdate: boolean = false): void
	{
		if (this.root)
			this.root.cancelScheduledFuncCall( func, beforeUpdate);
	}



	// Registers an object of any type as a service with the given ID that will be available for
	// consumption by descendant nodes.
	public publishService<K extends keyof mim.IServiceDefinitions>( id: K, service: mim.IServiceDefinitions[K]): void
	{
		if (this.publishedServices === undefined)
			this.publishedServices = new Map<string,any>();

		let existinService: any = this.publishedServices.get( id);
		if (existinService !== service)
		{
			this.publishedServices.set( id, service);
			this.root.notifyServicePublished( id, this);
		}
	}



	// Unregisters a service with the given ID.
	public unpublishService<K extends keyof mim.IServiceDefinitions>( id: K): void
	{
		if (this.publishedServices === undefined)
			return;

		this.publishedServices.delete( id);
		this.root.notifyServiceUnpublished( id, this);

		if (this.publishedServices.size === 0)
			this.publishedServices = undefined;
	}



	// Subscribes for a service with the given ID. If the service with the given ID is registered
	// by one of the ancestor nodes, the passed Ref object will reference it; otherwise,
	// the Ref object will be set to the defaultValue (if specified) or will remain undefined.
	// Whenever the value of the service that is registered by a closest ancestor node is
	// changed, the Ref object will receive the new value.
	public subscribeService<K extends keyof mim.IServiceDefinitions>( id: K,
					ref: mim.RefPropType<mim.IServiceDefinitions[K]>,
					defaultService?: mim.IServiceDefinitions[K], useSelf?: boolean): void
	{
		if (this.subscribedServices === undefined)
			this.subscribedServices = new Map<string,VNSubscribedServiceInfo>();

		let info = new VNSubscribedServiceInfo();
		info.ref = ref;
		info.defaultService = defaultService;
		info.useSelf = useSelf ? true : false;

		this.subscribedServices.set( id, info);
		this.root.notifyServiceSubscribed( id, this);
		mim.setRef( ref, this.getService( id, defaultService));
}



	// Unsubscribes from a service with the given ID. The Ref object that was used to subscribe,
	// will be set to undefined.
	public unsubscribeService<K extends keyof mim.IServiceDefinitions>( id: K): void
	{
		if (this.subscribedServices === undefined)
			return;

		let info = this.subscribedServices.get( id);
		if (info === undefined)
			return;

		mim.setRef( info.ref, undefined);
		this.subscribedServices.delete( id);
		this.root.notifyServiceUnsubscribed( id, this);

		if (this.subscribedServices.size === 0)
			this.subscribedServices = undefined;
	}



	// Retrieves the value for a service with the given ID registered by a closest ancestor
	// node or the default value if none of the ancestor nodes registered a service with
	// this ID. This method doesn't establish a subscription and only reflects the current state.
	public getService<K extends keyof mim.IServiceDefinitions>( id: K,
					defaultService?: mim.IServiceDefinitions[K], useSelf?: boolean): any
	{
		let service = this.findService( id, useSelf);
		return service !== undefined ? service : defaultService;
	}



	// Notifies the node that publication information about the given service (to which the node
	// has previously subscribed) has changed.
	public notifyServiceChanged<K extends keyof mim.IServiceDefinitions>( id: K): void
	{
		if (this.subscribedServices === undefined)
			return;

		let info = this.subscribedServices.get( id);
		if (info === undefined)
			return;

		mim.setRef( info.ref, this.getService( id, info.defaultService));
	}



	// Goes up the chain of nodes looking for a published service with the given ID. Returns
	// undefined if the service is not found. Note that null might be a valid value.
	public findService<K extends keyof mim.IServiceDefinitions>( id: K, useSelf?: boolean): any
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
	public wrapCallback<T>( callback: T): T
	{
		return CallbackWrapper.bind( this, callback);
	}



	// Returns the first DOM node defined by either this virtual node or one of its sub-nodes.
	// This method is only called on the mounted nodes.
	public getFirstDN(): DN
	{
		let dn = this.getOwnDN();
		if (dn !== null)
			return dn;
		else if (!this.subNodes)
			return null;

		// recursively call this method on the sub-nodes from first to last until a valid node
		// is returned
		for( let svn of this.subNodes)
		{
			dn = svn.getFirstDN();
			if (dn !== null)
				return dn;
		}

		return null;
	}



	// Returns the last DOM node defined by either this virtual node or one of its sub-nodes.
	// This method is only called on the mounted nodes.
	public getLastDN(): DN
	{
		let dn = this.getOwnDN();
		if (dn !== null)
			return dn;
		else if (!this.subNodes)
			return null;

		// recursively call this method on the sub-nodes from last to first until a valid node
		// is returned
		for( let i = this.subNodes.length - 1; i >= 0; i--)
		{
			dn = this.subNodes[i].getLastDN();
			if (dn !== null)
				return dn;
		}

		return null;
	}



	// Returns the list of DOM nodes that are immediate children of this virtual node; that is,
	// are NOT children of sub-nodes that have their own DOM node. Never returns null.
	public getImmediateDNs(): DN[]
	{
		let arr: DN[] = [];
		this.collectImmediateDNs( arr);
		return arr;
	}



	// Collects all DOM nodes that are immediate children of this virtual node (that is,
	// are NOT children of sub-nodes that have their own DOM node) into the given array.
	public collectImmediateDNs( arr: DN[]): void
	{
		let dn = this.getOwnDN();
		if (dn !== null)
			arr.push( dn);
		else if (this.subNodes)
		{
			// recursively call this method on the sub-nodes from first to last
			for( let svn of this.subNodes)
				svn.collectImmediateDNs( arr);
		}
	}



	// Finds the first DOM node in the tree of virtual nodes that comes after our node that is a
	// child of our own anchor element. We use it as a node before which to insert/move nodes of
	// our sub-nodes during the reconciliation process. The algorithm first goes to the next
	// siblings of our node and then to the next siblings of our parent node recursively. It stops
	// when we either find a DOM node (then it is returned) or find a different anchor element
	// (then null is returned). This method is called before the reconciliation process for our
	// sub-nodes starts and, therefore, it only traverses mounted nodes.
	public getNextDNUnderSameAnchorDN( anchorDN: DN): DN
	{
		// check if we have sibling DOM nodes after our last sub-node - that might be elements
		// not controlled by our component.
		if (this.subNodes && this.subNodes.length > 0)
		{
			const dn = this.subNodes[this.subNodes.length - 1].getLastDN();
			if (dn !== null)
			{
				const nextSibling = dn.nextSibling;
				if (nextSibling !== null)
					return nextSibling;
			}
		}

		// find our index in the parent's list of sub-nodes
		if (!this.parent || !this.parent.subNodes)
			return null;

		let ownIndex = this.parent.subNodes.indexOf( this);
		if (ownIndex < 0)
			return null;

		// loop over our next siblings
		for( let i = ownIndex + 1; i < this.parent.subNodes.length; i++)
		{
			let vn = this.parent.subNodes[i];
			if (vn.anchorDN !== anchorDN)
				return null;

			// note that getLastDN call traverses the hierarchy of nodes. Note also that it
			// it cannot find a node under a different anchor element because the first different
			// anchor element will be returned as a wanted node.
			const dn = vn.getLastDN();
			if (dn !== null)
				return dn;
		}

		// recurse to our parent if exists
		return this.parent.anchorDN === anchorDN ? this.parent.getNextDNUnderSameAnchorDN( anchorDN) : null;
	}



	// Returns array of node names starting with this node and up until the top-level node.
	public get path(): string[]
	{
		let depth = this.depth;
		let path = Array<string>( depth);
		for( let i = 0, vn: VN = this; i < depth; i++, vn = vn.parent)
		{
			path[i] = vn.name;
		}

		return path;
	}



	// Determines whether the node is mounted.
	public get IsMounted(): boolean { return this.anchorDN !== null; }



	// Returns string representation of the node.
	public toString(): string { return this.name; }



	// Parent node. This is null for the top-level (root) nodes.
	public parent: VN;

	// Root node.
	public root: IRootVN;

	// Level of nesting at which the node resides relative to the root node.
	public depth: number;

	// DOM node under which all content of this virtual node is rendered.
	public anchorDN: DN = null;

	// Node's key. The derived classes set it based on their respective content. A key
	// can be of any type.
	public key: any;

	// Chain of sub-nodes.
	public subNodes: VN[];

	// Map of service IDs to service objects published by this node.
	private publishedServices: Map<string,any>;

	// Map of service IDs to objects constituting subscriptions made by this node.
	private subscribedServices: Map<string,VNSubscribedServiceInfo>;

	// "Tick number" during which the node was last updated. If this node's tick number equals
	// the current tick number maintained by the root node, this indicates that this node was
	// already updated in this update cycle. This helps prevent the double-rendering of a
	// component if both the component and its parent are updated in the same cycle.
	public lastUpdateTick: number;
}



// 
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
		let [orgCallback, ...rest] = arguments;
		return orgCallback( ...rest);
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
// The VNUpdateDisp type describes whether certain actions should be performed on the node
// during update. This object is returned from the node's updateFrom method.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export type VNUpdateDisp =
{
	// Falg indicatng whether the node has changes that should be applied to the DOM tree. If this
	// flag is true, then the commitUpdate method will be clled on the node during the Commit
	// phase.
	shouldCommit: boolean;

	// Falg indicatng whether the sub-nodes should be updated. If this flag is true, then the
	// node's render method will be immediately called.
	shouldRender: boolean;
};



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



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The IRootVN interface represent the functionality of the Root virtual node.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface IRootVN
{
	// Informs that a service with the given ID was published by the given node.
	notifyServicePublished( id: string, sourceVN: VN): void;

	// Informs that a service with the given ID was unpublished by the given node.
	notifyServiceUnpublished( id: string, sourceVN: VN): void;

	// Informs that the given node has subscribed to a service with the given ID.
	notifyServiceSubscribed( id: string, sourceVN: VN): void;

	// Informs that the given node has unsubscribed from a service with the given ID.
	notifyServiceUnsubscribed( id: string, sourceVN: VN): void;

	// Schedules an update for the given node.
	requestNodeUpdate( vn: VN): void;

	// Cancels a previously requested update for the given node.
	cancelNodeUpdate( vn: VN): void;

	// Schedules to call the given function either before or after all the scheduled components
	// have been updated.
	scheduleFuncCall( func: () => void, beforeUpdate: boolean): void;

	// Cancels a call that has been scheduled to be made either before or after all the scheduled
	// components have been updated.
	cancelScheduledFuncCall( func: () => void, beforeUpdate: boolean): void;
}



