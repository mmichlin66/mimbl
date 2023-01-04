import {ComponentProps, DN, PromiseProxyProps} from "../api/CompTypes"
import { IVN, VNDisp } from "./VNTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { mountContent, reconcile } from "./Reconciler";
import { VN } from "./VN";



/**
 * Encapsulates a Promise object.
 */
export class PromiseProxyVN extends VN
{
	constructor(props: ComponentProps<PromiseProxyProps>, children?: IVN[] | null)
	{
		super();

		this.props = props;
		this.promise = props.promise;
		this.key = props.key;
		this.content = children;
	}



	/** Flag indicating whether the promise is settled (either successfully or not). */
	public get isSettled(): boolean { return this.promise == null; }



	/// #if USE_STATS
	public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif



	/** String representation of the virtual node. */
	public get name(): string
	{
		let name = "Promise";
		if (this.key != null)
			name += "@" + this.key;

		return name;
	}



	/** Initializes internal stuctures of the virtual node. */
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN: DN): void
	{
        if (this.promise)
        {
            this.watch();
            if (this.props.bounce)
                throw this.promise;
        }

        super.mount( parent, index, anchorDN);

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif

        // mount the current content if it was provided
        if (this.content != null)
        {
            mountContent( this, this.content, anchorDN, beforeDN);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Comp, StatsAction.Rendered);
            /// #endif
        }
	}



    /** Cleans up the node object before it is released. */
    public unmount(removeFromDOM: boolean): void
    {
        this.unmountSubNodes(removeFromDOM);
        super.unmount( removeFromDOM);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Comp, StatsAction.Deleted);
        /// #endif
    }



	/** Generates list of sub-nodes according to the current state */
	public render(): any
	{
		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Rendered);
		/// #endif

		return this.content;
	}



	/**
     * Updated this node from the given node. This method is invoked only if update happens as a
     * result of rendering the parent nodes. The newVN parameter is guaranteed to point to a VN
     * of the same type as this node.
     */
	public update( newVN: PromiseProxyVN, disp: VNDisp): void
	{
        let newPromise = newVN.promise;
        if (newPromise && newVN.props.bounce)
            throw newPromise;

		// remember the new value of the key property (even if it is the same)
		this.props = newVN.props;
		this.key = newVN.key;

        // if the new promise is different from the current one an is unsettled, we need to start
        // watching it.
        if (this.promise !== newPromise)
        {
            this.promise = newPromise;
            if (newPromise)
                this.watch();
        }

        // we need to update content if it is different from ours
        if (this.content !== newVN.content)
        {
            this.content = newVN.content;
            reconcile( this, disp, this.content);
        }
	}



	/**
	 * Waits for the current promise to settle
	 */
	private async watch(): Promise<void>
	{
        // remember the original promise because this.promise can be changed during an update
        // while we are still awaiting.
        let orgPromise = this.promise!
        let content: any;
		try
		{
			content = await orgPromise;
		}
		catch( err)
		{
            // if we still have our promise and we have an error content function, call it
            if (this.promise === orgPromise && this.props.errorContentFunc)
            {
                try
                {
                    content = this.props.errorContentFunc( err);
                }
                catch(err1)
                {
                    /// #if DEBUG
                    console.error("Promise rejection content function failed:", err1);
                    /// #endif
                }
            }
		}

        // if we still have our promise, we are still mounted, so request re-rendering with the
        // new content; otherwise, we are either already unmounted or have a different promise
        // after update, which is already being watched.
        if (this.promise === orgPromise)
        {
            this.promise = undefined;
            this.content = content;
            this.requestUpdate();
        }
	}



	/** Properties passed to this node. */
	private props: PromiseProxyProps;

	/**
     * Promise that this node watches. It gets its non-null value in the constructor and becomes
     * undefined either after it settles or after the code is updated with an already settled
     * promise.
     */
	private promise?: Promise<any>;

	/**
     * Content that this node displays. Initially this content is set to props.children. When the
     * promise is resolved, the content is set to the resolved value. If the promise is rejected
     * and the errorContentFunc is defined, this function is called and its return value is used
     * as content.
     */
	private content?: any;

	// /** Optional function that provides content in case the promise is rejected. */
	// private errorContentFunc?: (err: any) => any;
}



