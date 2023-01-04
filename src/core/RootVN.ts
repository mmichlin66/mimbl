import {DN, IRootVN} from "../api/CompTypes"

/// #if USE_STATS
	import {StatsCategory} from "../utils/Stats"
/// #endif

import { VN } from "./VN";



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

	/**
     * String representation of the virtual node. This is used mostly for tracing and error
     * reporting. The name can change during the lifetime of the virtual node; for example, it
     * can reflect an "id" property of an element (if any).
     */
	public get name(): string { return "Root"; }



	/**
     * Recursively inserts the content of this virtual node to DOM under the given parent (anchor)
     * and before the given node.
     */
	public mount(parent: VN | null, index: number, anchorDN: DN, beforeDN: DN = null): void
    {
        super.mount(parent, index, anchorDN, beforeDN);
    }



    /**
     * Recursively removes the content of this virtual node from DOM.
     */
	public unmount(removeFromDOM: boolean): void
    {
        this.unmountSubNodes(removeFromDOM);
        super.unmount(removeFromDOM);
    }



	// Generates a chain of sub-nodes according to the current state. If the node doesn't have
	// sub-nodes, null should be returned.
	public render(): any
	{
		return this.content;
	}



	/** Sets the content to be rendered under this root node and triggers update. */
	public setContent(content: any): void
	{
		this.content = content;
		this.requestUpdate();
	}



	/** Content rendered under this root node. */
	private content: any;
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



