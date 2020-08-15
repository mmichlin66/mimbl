import {VNBase} from "../internal"



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Information kept by Root virtual node about service export publications and subscriptions. The
// same service can be published and subscribed to by multiple nodes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class ServiceInfo
{
	publishingVNs: Set<VNBase> = new Set<VNBase>();
	subscribedVNs: Set<VNBase> = new Set<VNBase>();
}

// Map of service IDs to sets of virtual nodes that subscribed to this service.
let s_serviceInfos = new Map<string,ServiceInfo>();



// Informs that a service with the given ID was published by the given node.
export function notifyServicePublished( id: string, sourceVN: VNBase): void
{
	let info: ServiceInfo = s_serviceInfos.get( id);
	if (info === undefined)
	{
		info = new ServiceInfo();
		s_serviceInfos.set( id, info);
	}

	info.publishingVNs.add( sourceVN);

	// notify all subscribed nodes that information about the service has changed
	for( let vn of info.subscribedVNs)
		vn.notifyServiceChanged( id);
}



// Informs that a service with the given ID was unpublished by the given node.
export function notifyServiceUnpublished( id: string, sourceVN: VNBase): void
{
	let info: ServiceInfo = s_serviceInfos.get( id);
	if (info === undefined)
		return;

	info.publishingVNs.delete( sourceVN);

	if (info.publishingVNs.size === 0 && info.subscribedVNs.size === 0)
		s_serviceInfos.delete( id);
	else
	{
		// notify all subscribed nodes that information about the service has changed
		for( let vn of info.subscribedVNs)
			vn.notifyServiceChanged( id);
	}
}



// Informs that the given node has subscribed to a service with the given ID.
export function notifyServiceSubscribed( id: string, sourceVN: VNBase): void
{
	let info: ServiceInfo = s_serviceInfos.get( id);
	if (info === undefined)
	{
		info = new ServiceInfo();
		s_serviceInfos.set( id, info);
	}

	info.subscribedVNs.add( sourceVN);
}



// Informs that the given node has unsubscribed from a service with the given ID.
export function notifyServiceUnsubscribed( id: string, sourceVN: VNBase): void
{
	let info: ServiceInfo = s_serviceInfos.get( id);
	if (info === undefined)
		return;

	info.subscribedVNs.delete( sourceVN);

	if (info.publishingVNs.size === 0 && info.subscribedVNs.size === 0)
		s_serviceInfos.delete( id);
}



