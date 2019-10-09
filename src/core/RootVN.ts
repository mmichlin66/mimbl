import * as mim from "../api/mim"
import {updateNodeSync, requestNodeUpdate} from "./Scheduler"
import {DN} from "./VN"
import {VNBase} from "./VNBase"
import {RootErrorUI, RootWaitingUI} from "./RootUI"

/// #if USE_STATS
	import {StatsCategory} from "../utils/Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The RootVN class is used as a top-level virtual node for all rendered trees. RootVN serves
// as an error boundary of last resort. When it catches an error that wasn't caught by any
// descendand node, it displays a simple UI that shows the error and allows the user to restart.
// RootVN also manages service publishers and subscribers.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class RootVN extends VNBase implements mim.IErrorHandlingService
{
	public constructor( anchorDN: DN)
	{
		super();
		
		this.type = mim.VNType.Root;
		this.anchorDN = anchorDN;
		this.depth = 0;
		// this.willMount();
	};



	/// #if USE_STATS
		public get statsCategory(): StatsCategory { return StatsCategory.Root; }
	/// #endif

	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string { return "Root"; }



	// Sets the content to be rendered under this root node and triggers update.
	public setContent( content: any, sync: boolean): void
	{
		this.content = content;

		if (sync)
			updateNodeSync( this);
		else
			requestNodeUpdate( this);
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
	// This method is part of the render phase.
	public willUnmount(): void
	{
		this.unpublishService( "StdErrorHandling");
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



	// Displays the content originally passed in the constructor.
	public restart(): void
	{
		// clear the error and request to be updated
		this.errorUI = undefined;
		requestNodeUpdate( this);
	}



	// Informs that the given node has unsubscribed from a service with the given ID.
	public reportError( err: any, path: string[]): void
	{
		this.handleError( err, path);
		requestNodeUpdate( this);
	}



	// Removes the fulfilled promise from our internal list and if the list is empty asks to
	// re-render
	private onPromiseFulfilled( promise: Promise<any>): void
	{
		this.thrownPromises.delete( promise);
		if (this.thrownPromises.size === 0)
		{
			this.waitingUI = null;
			requestNodeUpdate( this);
		}
	}



	// Content rendered under this root node.
	private content: any;

	// Component instance that is rendered when an exception was caught from descendand nodes.
	private errorUI: RootErrorUI;

	// Component instance that is rendered when an exception was caught from descendand nodes.
	private waitingUI: RootWaitingUI;

	// Set of promises thrown by descendant nodes and not yet fulfilled.
	private thrownPromises = new Set<Promise<any>>();
}



let s_mimblAnchorPropName = "__mimblAnchorPropName__";



// Renders the given content (usually a result of JSX expression or a component instance)
// under the given HTML element in a synchronous way.
export function mountRootSync( content: any, anchorDN: DN): void
{
	let realAnchorDN: DN = anchorDN ? anchorDN : document.body;

	// check whether we already have root node remembered in the anchor element's well-known
	// property
	let rootVN: RootVN = realAnchorDN[s_mimblAnchorPropName];
	if (!rootVN)
	{
		// create root node and remember it in the anchor element's well-known property
		rootVN = new RootVN( realAnchorDN);
		(realAnchorDN as any)[s_mimblAnchorPropName] = rootVN;
	}


	// set content to the root node and trigger synchronous update
	rootVN.setContent( content, true);
}



// Unmounts a root node that was created using mountRootSync.
export function unmountRootSync( anchorDN: DN): void
{
	let realAnchorDN: DN = anchorDN ? anchorDN : document.body;
	if (!realAnchorDN)
		return;

	// get our root node from the anchor element's well-known property.
	let rootVN: RootVN = realAnchorDN[s_mimblAnchorPropName];
	if (!rootVN)
		return;

	// remove our root node from the anchor element's well-known property
	delete realAnchorDN[s_mimblAnchorPropName];

	rootVN.setContent( null, true);
	rootVN.term();
}



// Renders the given content (usually a result of JSX expression or a component instance)
// under the given HTML element.
export function mountRoot( content: any, anchorDN: DN): void
{
	let realAnchorDN: DN = anchorDN ? anchorDN : document.body;

	// check whether we already have root node remembered in the anchor element's well-known
	// property
	let rootVN: RootVN = realAnchorDN[s_mimblAnchorPropName];
	if (!rootVN)
	{
		// create root node and remember it in the anchor element's well-known property
		rootVN = new RootVN( realAnchorDN);
		(realAnchorDN as any)[s_mimblAnchorPropName] = rootVN;
	}

	// set content to the root node, which will trigger update
	rootVN.setContent( content, false);
}



// Unmounts a root node that was created using mountRoot.
export function unmountRoot( anchorDN: DN): void
{
	let realAnchorDN: DN = anchorDN ? anchorDN : document.body;
	if (!realAnchorDN)
		return;

	// get our root node from the anchor element's well-known property.
	let rootVN: RootVN = realAnchorDN[s_mimblAnchorPropName];
	if (!rootVN)
		return;

	// remove our root node from the anchor element's well-known property
	delete realAnchorDN[s_mimblAnchorPropName];

	// destruct the root node (asynchronously)
	rootVN.setContent( null, false);
	rootVN.scheduleCallAfterUpdate( () => rootVN.willUnmount() );
}



