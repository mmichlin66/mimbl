import * as mim from "./mim"
import {VNChain} from "./VNChain"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "./Stats"
/// #endif



// Use type DN to refer to DOM's Node class. The DOM nodes that we are dealing with are
// either of type Element or Text.
export type DN = Node;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The IVNLifeCycle interface defines life-cycle and notifications methofs that are called during
// mounting, unmounting and updates. The IVNLifeCycle interface is implemented by all types of
// virtual nodes. All methods in this interface are optional because they might not be neeeded
// for all types of nodes.
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
//	- didUnmount
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
	constructor( type: mim.VNType)
	{
		this.type = type;
	}



	// IVNode implementation
	public get Type(): mim.VNType { return this.type; }
	public get Parent(): mim.IVNode { return this.parent; }
	public get Next(): mim.IVNode { return this.next; }
	public get Prev(): mim.IVNode { return this.prev; }
	public get SubNodes(): mim.IVNChain { return this.subNodes; }
	public get DisplayName(): string { return this.name; }




	// Initializes the node by passing the parent node to it. After this, the node knows its
	// place in the hierarchy and gets access to the root of it - the RootVN object.
	public initialize( parent: VN): void
	{
		this.parent = parent;
		if (parent === null)
		{
			this.root = this as any as IRootVN;
			this.depth = 0;
		}
		else
		{
			this.root = parent.root;
			this.depth = parent.depth + 1;
		}
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
		this.subNodes.clear();
		this.root = null;
		this.parent = null;
		this.depth = 0;
	}



/// #if USE_STATS
	public abstract getStatsCategory(): StatsCategory;
/// #endif

	// Returns content that comprizes the children of the node. If the node doesn't have
	// sub-nodes, null should be returned. If this method is not implemented it is as though
	// null is returned.
	// This method is part of the Render phase.
	public render?(): any {}

	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount?(): void {}

	// Inserts the virtual node's content into DOM.
	// This method is part of the Commit phase.
	public mount?(): void {}

	// This method is called after the content of node and all its sub-nodes has been inserted
	// into the DOM tree.
	// This method is part of the Commit phase.
	public didMount?(): void {}

	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the Commit phase.
	public willUnmount?(): void {}

	// Removes content from the DOM tree.
	// This method is part of the Commit phase.
	public unmount?(): void {}

	//// Clears internal structures after the DOM content has been removed from the DOM tree.
	//// This method is part of the Commit phase.
	//didUnmount?(): void {}

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

	// This method is called after the content of node and all its sub-nodes has been updated
	// in the DOM tree.
	// This method is part of the Commit phase.
	public didUpdate?(): void {}

	// Determines whether the node supports handling of errors; that is, exception thrown during
	// rendering of the node itself and/or its sub-nodes.
	// This method is part of the Render phase.
	public supportsErrorHandling?(): boolean { return false; }

	// This method is called after an exception was thrown during rendering of the node itself
	// and/or its sub-nodes. It returns content comprising the children of the node.
	// This method is part of the Render phase.
	public handleError?( vnErr: any, path: string[]): void {}

	// Returns DOM node corresponding to the virtual node itself (if any) and not to any of its
	// sub-nodes.
	public getOwnDN(): DN { return null; }



	// Returns the first DOM node defined by either this virtual node or one of its sub-nodes.
	// This method is only called on the mounted nodes.
	public getFirstDN(): DN
	{
		let dn: DN = this.getOwnDN();
		if (dn !== null)
			return dn;

		// recursively call this method on the sub-nodes until a valid node is returned
		if (this.subNodes.first !== null)
		{
			for( let svn: VN = this.subNodes.first; svn !== null; svn = svn.next)
			{
				dn = svn.getFirstDN();
				if (dn !== null)
					return dn;
			}
		}

		return null;
	}



	// This method is called to set a distinguishing display name identifying the object
	// represented by the node (e.g. component instance).
	public setDisplayName( name: string): void
	{
		this.name = name;
	}



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
	public publishService( id: string, service: any): void
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
	public unpublishService( id: string): void
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
	public subscribeService( id: string, ref: mim.RefPropType<any>, defaultService?: any, useSelf?: boolean): void
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
	public unsubscribeService( id: string): void
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
	public findService( id: string, useSelf?: boolean): any
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
		return this.parent !== null ? this.parent.findService( id, true) : undefined;
	}


	// Finds the first DOM node in the tree of virtual nodes that comes after our node that is a
	// child of our own anchor element. We use it as a node before which to insert/move nodes of
	// our sub-nodes during the reconciliation process. The algorithm first goes to the next
	// siblings of our node and then to the next siblings of our parent node recursively. It stops
	// when we either find a DOM node (then it is returned) or find a differen anchor element
	// (then null is returned). This method is called before the reconciliation process for our
	// sub-nodes starts and, therefore, it only traverses mounted nodes.
	public getNextDNUnderSameAnchorDN( anchorDN: DN): DN
	{
		// check if we have sibling DOM nodes after our last sub-node - that might be elements
		// not controlled by our component.
		if (this.subNodes.last !== null)
		{
			const dn: DN = this.subNodes.last.getFirstDN();
			if (dn !== null)
			{
				const nextSibling: DN = dn.nextSibling;
				if (nextSibling !== null)
					return nextSibling;
			}
		}

		// loop over our next siblings
		for( let vn: VN = this.next; vn !== null; vn = vn.next)
		{
			if (vn.anchorDN !== anchorDN)
				return null;

			// note that getFirstDN call traverses the hierarchy of nodes. Note also that
			// it cannot find a node under a different anchor element because the first different
			// anchor element will be returned as a wanted node.
			const dn: DN = vn.getFirstDN();
			if (dn !== null)
				return dn;
		}

		// recurse to our parent if exists
		return this.parent !== null && this.parent.anchorDN === anchorDN
						? this.parent.getNextDNUnderSameAnchorDN( anchorDN) : null;
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



	// Node's type.
	public type: mim.VNType;

	// Parent node. This is null for the top-level (root) nodes.
	public parent: VN;

	// Root node.
	public root: IRootVN;

	// Level of nesting at which the node resides relative to the root node.
	public depth: number;

	// Node's key. The derived classes set it based on their respective content. A key
	// can be of any type.
	public key: any;

	// String representation of the virtual node. This is used mostly for tracing and
	// error reporting. The name must be available right after the node is constructed - which
	// means before the create method is called. The name can change during the lifetime of the
	// virtual node; for example, it can reflect an "id" property of an element (if any).
	public name: string;

	// Next node in the chain of sibling nodes or null if this is the last one.
	public next: VN = null;

	// Previous node in the chain of sibling nodes or null if this is the first one.
	public prev: VN = null;

	// Chain of sub-nodes.
	public subNodes = new VNChain();

	// DOM node under which all content of this virtual node is rendered.
	public anchorDN: DN = null;

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



