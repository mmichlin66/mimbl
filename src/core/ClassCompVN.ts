﻿import {IClassCompVN, IComponent, symRenderWatcher} from "../api/mim"
import {createWatcher, IWatcher} from "../utils/TriggerWatcher"
import {VN, setCurrentClassComp} from "../internal"

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



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount(): void
    {
        // connect the component to this virtual node
        this.comp.vn = this;

        this.willMount();

        // establish watcher if requested using the @watcher decorator
        let render = this.comp.render;
        if (render[symRenderWatcher])
            this.actRender = this.renderWatcher = createWatcher( render, this.requestUpdate, this.comp, this);
        else
            this.actRender = render.bind( this.comp);

        if (this.comp.handleError)
            this.supportsErrorHandling = true;

        if (this.comp.getUpdateStrategy)
            this.updateStrategy = this.comp.getUpdateStrategy();
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

        setCurrentClassComp( this.comp);
        return this.actRender();
	}



	// This method is called after an exception was thrown during rendering of the node itself
	// and/or its sub-nodes.
	public handleError( err: any): void
	{
        setCurrentClassComp( this.comp);
		this.comp.handleError( err);
	}



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	protected willMount(): void
	{
        // don't need try/catch because it will be caught up the chain
        let fn: Function = this.comp.willMount;
        if (fn)
        {
            setCurrentClassComp( this.comp);
            fn.call( this.comp);
        }

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



