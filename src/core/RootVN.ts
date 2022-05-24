import {IErrorBoundary} from "../api/CompTypes"
import { DN } from "./VNTypes";

/// #if USE_STATS
	import {StatsCategory} from "../utils/Stats"
/// #endif

import { VN } from "./VN";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The RootVN class is used as a top-level virtual node for all rendered trees. RootVN serves
// as an error boundary of last resort. When it catches an error that wasn't caught by any
// descendand node, it displays a simple UI that shows the error.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class RootVN extends VN implements IErrorBoundary
{
	public constructor( anchorDN: DN)
	{
		super();

		this.anchorDN = anchorDN;
	}



	/// #if USE_STATS
    public get statsCategory(): StatsCategory { return StatsCategory.Root; }
	/// #endif

	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string { return "Root"; }



	// Sets the content to be rendered under this root node and triggers update.
	public setContent( content: any): void
	{
		this.content = content;
		this.requestUpdate();
	}



	// Generates a chain of sub-nodes according to the current state. If the node doesn't have
	// sub-nodes, null should be returned.
	public render(): any
	{
		return this.errMsg ?? this.waitMsg ?? this.content;
	}



    // This method is called after an exception was thrown during rendering of the node's
    // sub-nodes. The method returns the new content to display.
    public reportError( err: unknown): void
    {
        this.handleError(err);
        this.requestUpdate();
    }

    // This method is called after an exception was thrown during rendering of the node's
    // sub-nodes.
    public handleError( err: unknown): void
    {
		if (err instanceof Promise)
		{
			let promise = err as Promise<any>;
			this.thrownPromises.add( promise);
			promise.then( () => { this.onPromiseFulfilled( promise); });
			promise.catch( () => { this.onPromiseFulfilled( promise); });
            this.waitMsg = "Please wait...";
		}
		else
		{
            console.error( `Unhandled error\n`, err);
			this.errMsg = (err as any).toString();
        }
	}



	// Removes the fulfilled promise from our internal list and if the list is empty asks to
	// re-render
	private onPromiseFulfilled( promise: Promise<any>): void
	{
		this.thrownPromises.delete( promise);
		if (this.thrownPromises.size === 0)
		{
			this.waitMsg = null;
			this.requestUpdate();
		}
	}



	/** Content rendered under this root node. */
	private content: any;

	/** Message from the error that was caught from descendand nodes. */
	private errMsg: string | null = null;

	/** Message about waiting for a promise thrown as exception that was caught from descendand nodes. */
	private waitMsg: string | null = null;

	/** Set of promises thrown by descendant nodes and not yet fulfilled. */
	private thrownPromises = new Set<Promise<any>>();
}



let symRootMountPoint = Symbol("rootMountPoint");



// Renders the given content (usually a result of JSX expression or a component instance)
// under the given HTML element.
export function mountRoot( content: any, anchorDN: DN): void
{
	let realAnchorDN = anchorDN ?? document.body;
	if (!realAnchorDN)
    {
        /// #if DEBUG
        console.error( `Trying to mount under non-existing '<body>' element`);
        /// #endif

		return;
    }

	// check whether we already have root node remembered in the anchor element's well-known
	// property
	let rootVN = realAnchorDN[symRootMountPoint] as RootVN;
	if (!rootVN)
	{
		// create root node and remember it in the anchor element's well-known property
		rootVN = new RootVN( realAnchorDN);
        realAnchorDN[symRootMountPoint] = rootVN;
	}

    // publish ErrorBoundary service
    rootVN.publishService( "ErrorBoundary", rootVN);

	// set content to the root node, which will trigger update
	rootVN.setContent(content);
}



// Unmounts a root node that was created using mountRoot.
export function unmountRoot( anchorDN: DN): void
{
	let realAnchorDN: DN = anchorDN ?? document.body;
	if (!realAnchorDN)
    {
        /// #if DEBUG
        console.error( `Trying to unmount under non-existing '<body>' element`);
        /// #endif

		return;
    }

	// get our root node from the anchor element's well-known property.
	let rootVN = realAnchorDN[symRootMountPoint] as RootVN;
	if (!rootVN)
		return;

    // unpublish ErrorBoundary service
    rootVN.clearPubSub();

	// remove our root node from the anchor element's well-known property
	delete realAnchorDN[symRootMountPoint];

	// destruct the root node (asynchronously)
	rootVN.setContent(null);
}



