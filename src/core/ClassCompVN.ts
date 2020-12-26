import {IClassCompVN, IComponent, UpdateStrategy, symRenderWatcher} from "../api/mim"
import {createWatcher, IWatcher} from "../utils/TriggerWatcher"
import {VN} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class CompBaseVN is a base class for InstanceVN and ClassVN. It provides common functionality
// in terms of update requests and lifecycle management.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class ClassCompVN extends VN implements IClassCompVN
{
	// Component instance.
	public comp: IComponent;



	/// #if USE_STATS
		public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif



	// /**
	//  * Retrieves update strategy object that determines different aspects of node behavior
	//  * during updates.
	//  */
	// public get updateStrategy(): UpdateStrategy
	// {
    //     let fn = this.comp.getUpdateStrategy;
	// 	return fn ? fn.call(this) : undefined;
	// }



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount(): void
    {
        // connect the component to this virtual node
        this.comp.vn = this;

        this.willMount();

        // establish watcher if requested using the @watcher decorator
        let render = this.comp.render as (...args: any) => any;
        if (render[symRenderWatcher])
            this.actRender = this.renderWatcher = createWatcher( render, this.requestUpdate, this.comp, this);
        else
            this.actRender = render.bind( this.comp);

        if (this.comp.handleError)
            this.supportsErrorHandling = true;

        let fn = this.comp.getUpdateStrategy;
        if (fn)
            this.updateStrategy = fn.call(this);
    }



    // Releases reference to the DOM node corresponding to this virtual node.
    public unmount(): void
    {
        this.willUnmount();

        if (this.renderWatcher)
        {
            this.renderWatcher.dispose();
            this.renderWatcher = null;
        }

		this.comp.vn = undefined;

        /// #if USE_STATS
            DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Deleted);
        /// #endif
    }



    // Generates list of sub-nodes according to the current state
	public render(): any
	{
		/// #if DEBUG
			if (this.comp === undefined)
			{
				console.error( "render() was called on unmounted component.");
				return null;
			}
		/// #endif

		/// #if VERBOSE_COMP
			console.debug( `VERBOSE: Calling render() on component ${this.name}`);
		/// #endif

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Rendered);
		/// #endif

        return this.actRender();
	}



	// This method is called after an exception was thrown during rendering of the node itself
	// and/or its sub-nodes.
	public handleError( err: any, path: string[]): void
	{
		this.comp.handleError( err, path);
	}



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	protected willMount(): void
	{
        // don't need try/catch because it will be caught up the chain
        let fn: Function = this.comp.willMount;
		if (fn)
			fn.call( this.comp);

        /// #if USE_STATS
            DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
        /// #endif
	}



	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the render phase.
	protected willUnmount(): void
	{
        let fn = this.comp.willUnmount;
		if (fn)
        {
            // need try/catch but only to log
            try
            {
                fn.call( this.comp);
            }
            catch( err)
            {
                console.error( `Exception in willUnmount of component '${this.name}'`, err);
            }
        }
	}



    // Watcher function wrapping the component's render function. The watcher will notice any
    // trigger objects being read during the original function execution and will request update
    // thus triggerring re-rendering.
	private renderWatcher?: IWatcher;

    // Actual function to be invoked during the rendering - it can be either the original func or
    // the watcher.
	private actRender: (...args: any) => any;
}



