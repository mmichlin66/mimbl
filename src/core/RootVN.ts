import {IErrorHandlingService} from "../api/mim"
import {VN, DN, requestNodeUpdate} from "../internal"

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
export class RootVN extends VN implements IErrorHandlingService
{
	public constructor( anchorDN: DN)
	{
		super();

		this.anchorDN = anchorDN;
        this.depth = 0;
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
		requestNodeUpdate( this);
	}



	// Generates a chain of sub-nodes according to the current state. If the node doesn't have
	// sub-nodes, null should be returned.
	public render(): any
	{
		return this.error || this.waiting ? null : this.content;
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
	public get supportsErrorHandling(): boolean { return true; }



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
			this.waiting = true;
		}
		else
		{
            console.error( `Unhandled error in component\n${path.join("\n")}\n`, err);
			this.error = true;
		}
	}



	// Displays the content originally passed in the constructor.
	public restart(): void
	{
		// clear the error and request to be updated
		this.error = false;
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
			this.waiting = false;
			requestNodeUpdate( this);
		}
	}



	// Content rendered under this root node.
	private content: any;

	// Flag indicating that an exception was caught from descendand nodes.
	private error: boolean = false;

	// Flag indicating that a promise thrown as exception was caught from descendand nodes.
	private waiting: boolean = false;

	// Set of promises thrown by descendant nodes and not yet fulfilled.
	private thrownPromises = new Set<Promise<any>>();
}



let symRootMountPoint = Symbol("symRootMountPoint");



// Renders the given content (usually a result of JSX expression or a component instance)
// under the given HTML element.
export function mountRoot( content: any, anchorDN: DN): void
{
	let realAnchorDN: DN = anchorDN ? anchorDN : document.body;

	// check whether we already have root node remembered in the anchor element's well-known
	// property
	let rootVN: RootVN = realAnchorDN[symRootMountPoint];
	if (!rootVN)
	{
		// create root node and remember it in the anchor element's well-known property
		rootVN = new RootVN( realAnchorDN);
        (realAnchorDN as any)[symRootMountPoint] = rootVN;
        rootVN.willMount();
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
	let rootVN: RootVN = realAnchorDN[symRootMountPoint];
	if (!rootVN)
		return;

	// remove our root node from the anchor element's well-known property
	delete realAnchorDN[symRootMountPoint];

	// destruct the root node (asynchronously)
	rootVN.setContent( null, false);
	rootVN.scheduleCallAfterUpdate( () => rootVN.willUnmount() );
}



