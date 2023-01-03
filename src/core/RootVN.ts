import {DN, IRootVN} from "../api/CompTypes"

/// #if USE_STATS
	import {StatsCategory} from "../utils/Stats"
/// #endif

import { VN } from "./VN";
import { mountContent } from "./Reconciler";



/**
 * The RootVN class is used as a top-level virtual node for all rendered trees. RootVN serves as
 * an error boundary of last resort. When it catches an error that wasn't caught by any descendand
 * node, it displays a simple UI that shows the error.
 */
export class RootVN extends VN implements IRootVN
{
	/// #if USE_STATS
    public get statsCategory(): StatsCategory { return StatsCategory.Root; }
	/// #endif

	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string { return "Root"; }



	/**
     * Recursively inserts the content of this virtual node to DOM under the given parent (anchor)
     * and before the given node.
     */
	public mount(parent: VN | null, index: number, anchorDN: DN, beforeDN: DN = null): void
    {
        super.mount(parent, index, anchorDN, beforeDN);

        // publish ErrorBoundary service
        this.publishService( "ErrorBoundary", this);

        // try
        // {
        //     mountContent(this, this.content, anchorDN, beforeDN);
        // }
        // catch(err)
        // {
        //     this.reportError(err);
        // }
    }



    /**
     * Recursively removes the content of this virtual node from DOM.
     */
	public unmount(removeFromDOM: boolean): void
    {
        this.unmountSubNodes(removeFromDOM);
        this.clearPubSub();
        super.unmount(removeFromDOM);
    }



	// Generates a chain of sub-nodes according to the current state. If the node doesn't have
	// sub-nodes, null should be returned.
	public render(): any
	{
		return this.errMsg ?? this.waitMsg ?? this.content;
	}



    // This method is called after an exception was thrown during rendering of the node's
    // sub-nodes.
    public handleError( err: any): void
    {
		if (err instanceof Promise)
		{
            // add the promise to our set of promises we are waiting for
			(this.promises ??= new Set()).add( err);

            // use callback that will remove the promise after it is settled
			err.finally(() => this.onPromise( err));

            // put simple message that will be rendered until all promises are settled
            this.waitMsg = "Waiting...";
            this.errMsg = null;
		}
		else
			this.errMsg = err?.message ?? err?.toString() ?? "Error";
    }



	/** Sets the content to be rendered under this root node and triggers update. */
	public setContent(content: any): void
	{
		this.content = content;

        // since the new content is set, we need to forget about previous errors and promises
        this.errMsg = this.waitMsg = this.promises = null;

		this.requestUpdate();
	}



    /**
     * This method is called after an exception was thrown during rendering of the node's
     * sub-nodes. The method returns the new content to display.
     */
    public reportError(err: any): void
    {
        this.handleError(err);
        this.requestUpdate();
    }



	/**
     * Removes the fulfilled promise from our internal list and if the list is empty asks to
     * re-render
     */
	private onPromise( promise: Promise<any>): void
	{
		if (this.promises?.delete( promise) && !this.promises.size)
		{
			this.waitMsg = null;
			this.requestUpdate();
		}
	}



	/** Content rendered under this root node. */
	private content: any;

	/** Message from the error that was caught from descendand nodes. */
	private errMsg: string | null | undefined;

	/** Message about waiting for a promise thrown as exception that was caught from descendand nodes. */
	private waitMsg: string | null | undefined;

	/** Set of promises thrown by descendant nodes and not yet fulfilled. */
	private promises: Set<Promise<any>> | null | undefined;
}



let symRootMountPoint = Symbol("rootMountPoint");



// Renders the given content (usually a result of JSX expression or a component instance)
// under the given HTML element.
export function mountRoot( content: any, anchorDN: DN): IRootVN | null
{
	let realAnchorDN = anchorDN ?? document.body;
	if (!realAnchorDN)
    {
        /// #if DEBUG
        console.error( `Trying to mount under non-existing '<body>' element`);
        /// #endif

		return null;
    }

	// check whether we already have root node remembered in the anchor element's well-known
	// property
	let rootVN = realAnchorDN[symRootMountPoint] as RootVN;
	if (!rootVN)
	{
		// create root node and remember it in the anchor element's well-known property
		rootVN = new RootVN();
        realAnchorDN[symRootMountPoint] = rootVN;
        rootVN.mount( null, 0, realAnchorDN);
	}

    rootVN.setContent(content);
    return rootVN;
}



// Unmounts a root node that was created using mountRoot.
export function unmountRoot( anchorDN: DN): void
{
	let realAnchorDN: DN = anchorDN ?? document.body;
	if (!realAnchorDN)
    {
        /// #if DEBUG
        console.error( "Trying to unmount under non-existing '<body>' element");
        /// #endif

		return;
    }

	// get our root node from the anchor element's well-known property.
	let rootVN = realAnchorDN[symRootMountPoint] as RootVN;
	if (rootVN)
    {
        // remove our root node from the anchor element's well-known property
        delete realAnchorDN[symRootMountPoint];

        // remove content from DOM
        rootVN.unmount(true);
    }
}



