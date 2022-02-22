import {IComponent, PromiseProxyProps} from "../api/mim"
import {DN, reconcile, VN, VNDisp} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



/**
 * Encapsultes a Promise object.
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
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN?: DN | null): void
	{
        super.mount( parent, index, anchorDN);

        this.watchPromise();

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif
	}



    // Cleans up the node object before it is released.
    public unmount( removeFromDOM: boolean): void
    {
        super.unmount( removeFromDOM);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Comp, StatsAction.Deleted);
        /// #endif
    }



	// Generates list of sub-nodes according to the current state
	public render(): any
	{
		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Rendered);
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
	public update( newVN: PromiseProxyVN, disp: VNDisp): void
	{
		// remember the new value of the key property (even if it is the same)
		this.key = newVN.key;
		this.content = newVN.content;
		this.errorContentFunc = newVN.errorContentFunc;

        reconcile( this, disp, this.render());
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



