import {IClassCompVN, IComponent, UpdateStrategy} from "../api/mim"
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



	/**
	 * Retrieves update strategy object that determines different aspects of node behavior
	 * during updates.
	 */
	public get updateStrategy(): UpdateStrategy
	{
		return this.comp.getUpdateStrategy ? this.comp.getUpdateStrategy() : undefined;
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

        return this.renderWatcher ? this.renderWatcher() : this.comp.render();
	}



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount(): void
	{
		this.comp.vn = this;

        // don't need try/catch because it will be caught up the chain
		if (this.comp.willMount)
			this.comp.willMount();

        // // start watching the function if not disabled
        if (!this.comp.disableRenderWatcher || !this.comp.disableRenderWatcher())
            this.renderWatcher = createWatcher( this.comp.render, this.requestUpdate, this.comp, this);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif
	}



	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the render phase.
	public willUnmount(): void
	{
        if (this.renderWatcher)
        {
            this.renderWatcher.dispose();
            this.renderWatcher = null;
        }

        if (this.comp.willUnmount)
        {
            // need try/catch but only to log
            try
            {
                this.comp.willUnmount();
            }
            catch( err)
            {
                console.error( `Exception in willUnmount of component '${this.name}'`, err);
            }
        }

		this.comp.vn = undefined;
		this.comp = undefined;

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Deleted);
		/// #endif
	}



    // Notifies the virtual node that it was successfully mounted. This method is called after the
    // content of node and all its sub-nodes is added to the DOM tree.
	// This method is part of the Commit phase.
    public didMount(): void
    {
        if (this.comp.didMount)
        {
            // need try/catch but only to log
            try
            {
                this.comp.didMount();
            }
            catch( err)
            {
                console.error( `Exception in didMount of component '${this.name}'`, err);
            }
        }
    }



	// Determines whether the node supports handling of errors; that is, exception thrown during
	// rendering of the node itself and/or its sub-nodes.
	public get supportsErrorHandling(): boolean
	{
		return this.comp.handleError !== undefined;
	}



	// This method is called after an exception was thrown during rendering of the node itself
	// and/or its sub-nodes.
	public handleError( err: any, path: string[]): void
	{
		this.comp.handleError( err, path);
	}



    // Watcher function wrapping the component's render function. The watcher will notice any
    // trigger objects being read during the original function execution and will request update
    // thus triggerring re-rendering.
	private renderWatcher?: IWatcher;
}



