import {PromiseProxyProps} from "../api/mim"
import {VN} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



/**
 * Encapsultes a rendering function, which is usually a method of a class-based component. This
 * object remembers the function, the "this" pointer to use when calling the function and the
 * arguments to pass to it. This allows re-rendering only the part of the parent component as
 * though the method were a full blown independent component. Updating the nodes is accomplished
 * using the FuncProxy static update method accepting the function to be updated.
 *
 * The same function can be used multiple times within the parent component's render() method -
 * especially (but not necessarily) if it is called with different parameters. To distinguish
 * between multiple nodes when updating (using FuncProxy.update), a unique key must be assigned.
 * The node then creates a link between the function and the node. This link is removed when the
 * node is unmounted. The key is optional if the function is used only once in the parent's
 * render method. If the function is used more than once and keys are not provided or are the same
 * Mimble will issue an error.
 *
 * The link between the function and the nodes that use this function is kept in a map from the
 * keys to the nodes. The map is stored in a custom property on the function object itself.
 */
export class PromiseProxyVN extends VN
{
	constructor( props: PromiseProxyProps, children?: any[])
	{
		super();

		this.promise = props.promise;
		this.errorContentFunc = props.errorContentFunc;
		this.content = children;

		this.key = props.key;
	}



	// Flag indicating whether the promise is settled (successfully or not).
	public get isSettled(): boolean { return this.promise == null; }



	/// #if USE_STATS
	public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif
	; // ugly trick to not let the TypeScript compiler to strip the #endif comment

	// Node's key. The derived classes set it based on their respective content. A key
	// can be of any type.
	public key: any;



	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string
	{
		let name = "Promise";
		if (this.key != null)
			name += "@" + this.key;

		return name;
	}



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount(): void
	{
        this.watchPromise();

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif
	}



    /// #if USE_STATS
        // Cleans up the node object before it is released.
        public unmount(): void
        {
            DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Deleted);
        }
    /// #endif



	// Generates list of sub-nodes according to the current state
	public render(): any
	{
		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Rendered);
		/// #endif

		return this.content;
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: PromiseProxyVN): boolean
	{
		// update is possible if it is the same promise object
		return this.promise === newVN.promise;
	}



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: PromiseProxyVN): boolean
	{
		// remember the new value of the key property (even if it is the same)
		this.key = newVN.key;
		this.content = newVN.content;
		this.errorContentFunc = newVN.errorContentFunc;

		// indicate that it is necessary to update the sub-nodes. The commitUpdate
		// method should NOT be called.
		return true;
	}



	/**
	 * Waits for the promise to settle
	 */
	private async watchPromise(): Promise<void>
	{
		try
		{
			this.content = await this.promise;
			this.promise = null;

			// if the node is still mounted, request update
			if (this.isMounted)
				this.requestUpdate();
		}
		catch( err)
		{
			this.promise = null;
			this.content = null;

			// if the node is already unmounted, do nothing
			if (!this.isMounted)
				return;

			if (this.errorContentFunc)
			{
				try
				{
					this.content = this.errorContentFunc( err);
				}
				catch( err1)
				{
					console.warn( "Unhandled rejected promise:", err1);
				}
			}
			else
				console.warn( "Unhandled rejected promise:", err);

			this.requestUpdate();
		}
	}

	// Promise that this node watches.
	private promise: Promise<any>;

	// Content that this node displays. Initially this content is set to props.children. When
	// the promise is resolved, the content is set to the resolved value. If the promise is
	// rejected and the errorContentFunc is defined, this function is called and its return
	// value is used as content.
	private content?: any;

	// Optional arguments to be passed to the function.
	private errorContentFunc?: ( err: any) => any;
}



