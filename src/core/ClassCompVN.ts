﻿import {IClassCompVN, symRenderNoWatcher, IComponent, RenderMethodType, ScheduledFuncType, TickSchedulingType} from "../api/mim"
import {createWatcher, IWatcher} from "../utils/TriggerWatcher"
import {VN, setCurrentClassComp, FuncProxyVN, scheduleFuncCall, s_wrapCallback} from "../internal"

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
        let comp = this.comp;
        comp.vn = this;

        // don't need try/catch because it will be caught up the chain
        let fn: Function = comp.willMount;
        if (fn)
        {
            let prevCreator = setCurrentClassComp( comp);
            fn.call( comp);
            setCurrentClassComp( prevCreator);
        }

        // establish watcher if not disabled using the @noWatcher decorator
        let render = comp.render;
        if (render[symRenderNoWatcher])
            this.actRender = render.bind( comp);
        else
            this.actRender = this.renderWatcher = createWatcher( render, this.requestUpdate, comp, this);

        if (comp.handleError)
            this.supportsErrorHandling = true;

        if (this.comp.getUpdateStrategy)
            this.updateStrategy = comp.getUpdateStrategy();

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Comp, StatsAction.Added);
        /// #endif
    }



    // Releases reference to the DOM node corresponding to this virtual node.
    public unmount(): void
    {
        let comp = this.comp;
        let fn = comp.willUnmount;
		if (fn)
        {
            // need try/catch but only to log
            try
            {
                let prevCreator = setCurrentClassComp( comp);
                fn.call( comp);
                setCurrentClassComp( prevCreator);
            }
            catch( err)
            {
                console.error( `Exception in willUnmount of component '${this.name}'`, err);
            }
        }

        if (this.renderWatcher)
        {
            this.renderWatcher.dispose();
            this.renderWatcher = null;
        }

		comp.vn = undefined;

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Comp, StatsAction.Deleted);
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
			DetailedStats.log( StatsCategory.Comp, StatsAction.Rendered);
		/// #endif

        let prevCreator = setCurrentClassComp( this.comp);
        let ret = this.actRender();
        setCurrentClassComp( prevCreator);
        return ret;
	}



    // This method is called after an exception was thrown during rendering of the node's
    // sub-nodes. The method returns the new content to display.
	public handleError( err: any): any
	{
        // we can safely call the component's handleError method because our method is only
        // invoked if the component implements it.
        let prevCreator = setCurrentClassComp( this.comp);
		let retVal = this.comp.handleError( err);
        setCurrentClassComp( prevCreator);
        return retVal;
	}



    /** This method is called by the component when it needs to be updated. */
	public updateMe( func?: RenderMethodType, funcThisArg?: any, key?: any): void
    {
        // if no arguments are provided we request to update the entire component.
		if (!func)
			this.requestUpdate();
		else
            FuncProxyVN.update( func, funcThisArg || this.comp, key);
    }



	/**
	 * Schedules the given function to be called before any components scheduled to be updated in
	 * the Mimbl tick are updated.
	 * @param func Function to be called
	 * @param funcThisArg Object that will be used as "this" value when the function is called. If this
	 *   parameter is undefined, the component instance will be used (which allows scheduling
	 *   regular unbound components' methods). This parameter will be ignored if the function
	 *   is already bound or is an arrow function.
	 */
	public callMe( func: ScheduledFuncType, beforeUpdate: boolean, funcThisArg?: any): void
	{
		scheduleFuncCall( func, beforeUpdate, funcThisArg || this.comp, this.comp);
	}



	/**
	 * Creates a wrapper function with the same signature as the given callback so that if the original
	 * callback throws an exception, it is processed by the Mimbl error handling mechanism so that the
	 * exception bubbles from the component up the hierarchy until a component that knows to
	 * handle errors is found.
	 */
    public wrapCallback<T extends Function>( func: T, funcThisArg?: any, schedulingType?: TickSchedulingType): T
	{
		return s_wrapCallback( {func, funcThisArg: funcThisArg || this.comp, creator: this.comp, schedulingType});
	}



    // Watcher function wrapping the component's render function. The watcher will notice any
    // trigger objects being read during the original function execution and will request update
    // thus triggerring re-rendering.
	private renderWatcher?: IWatcher;

    // Actual function to be invoked during the rendering - it can be either the original func or
    // the watcher.
	private actRender: (...args: any) => any;
}



