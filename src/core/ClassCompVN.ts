import {
    IClassCompVN, symRenderNoWatcher, IComponent, RenderMethodType, ScheduledFuncType,
    IComponentClass, ComponentShadowOptions
} from "../api/mim"
import {
    DN, VN, setCurrentClassComp, FuncProxyVN, scheduleFuncCall, mountContent,
    unmountSubNodes, VNDisp, reconcile, createWatcher, IWatcher
} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



/**
 * Symbol used on component class to specify shadow parameters (ComponentShadowParams)
 */
const symShadowOptions = Symbol("shadowParam");

/**
 * Decorator function for component classes, which sets the symbol on the given class with the
 * given shadaow options.
 * @param cls Component class to decorate
 * @param options Shadow options to set
 */
export const shadowDecorator = (options: ComponentShadowOptions, cls: Function): void =>
{
    cls[symShadowOptions] = options;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class CompBaseVN is a base class for InstanceVN and ClassVN. It provides common functionality
// in terms of update requests and lifecycle management.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class ClassCompVN extends VN implements IClassCompVN
{
	/** Type of the class-based component. */
	public compClass: IComponentClass;

	/** Component instance. */
	public comp: IComponent;

    /**
     * Optional element serving as a host for shadow root if the component specifies the `shadow`
     * property.
     */
    public rootHost?: Element;

    /** Optional shadow root if the component specifies the `shadow` property */
    public declare ownDN?: ShadowRoot;

	/**
     * If the component specifies the [[shadow]] property, the `shadowRoot` property will be set
     * to the shadow root element under which the component's content returned from the `render()`
     * method will be placed. If the component doesn't specify the [[shadow]] property, the
     * `shadowRoot` property will be undefined. Components can access the shadow root via their
     * `vn.shadowRoot` property.
     */
    public get shadowRoot(): ShadowRoot { return this.ownDN; };



	/// #if USE_STATS
		public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif



	/**
     * Prepares component for mounting but doesn't render and mount sub-nodes
     */
	public prepareMount( comp: IComponent): void
    {
        // check whether the component is already connected to another node
        let oldVN = comp.vn as ClassCompVN;

        // connect the component to this virtual node
        comp.vn = this;

        // don't need try/catch because it will be caught up the chain
        let fn: Function = comp.willMount;
        fn && fn.call( comp);

        // establish watcher if not disabled using the @noWatcher decorator
        let render = comp.render;
        if (render[symRenderNoWatcher])
            this.actRender = render.bind( comp);
        else
            this.actRender = this.renderWatcher = createWatcher( render, this.requestUpdate, comp, this);

        if (comp.getUpdateStrategy)
            this.updateStrategy = comp.getUpdateStrategy();
    }



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN?: DN | null): void
    {
        super.mount( parent, index, anchorDN);

        let shadowOptions = this.compClass[symShadowOptions] as ComponentShadowOptions;
        if (shadowOptions)
        {
            let tag: string = "div";
            let init: ShadowRootInit = {mode: "open"};
            if (typeof shadowOptions === "string")
                tag = shadowOptions;
            else if (Array.isArray(shadowOptions))
            {
                tag = shadowOptions[0];
                init = shadowOptions[1];
            }
            else if (typeof shadowOptions === "object")
                init = shadowOptions;

            this.rootHost = document.createElement( tag);
            this.ownDN = this.rootHost.attachShadow( init);
        }

        let comp = this.comp;
        let prevCreator = setCurrentClassComp( comp);

        this.prepareMount( comp);

        if (!this.comp.handleError)
            mountContent( this, this.actRender(), this.ownDN ?? anchorDN, this.ownDN ? null : beforeDN);
        else
        {
            try
            {
                mountContent( this, this.actRender(), this.ownDN ?? anchorDN, this.ownDN ? null : beforeDN);
            }
            catch( err)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling handleError() on node ${this.name}. Error:`, err);
                /// #endif

                // let the node handle the error and re-render; then we render the new
                // content but we do it without try/catch this time; otherwise, we may end
                // up in an infinite loop. We also set our component as current again.
                setCurrentClassComp( comp);
                mountContent( this, this.comp.handleError( err), this.ownDN ?? anchorDN, this.ownDN ? null : beforeDN);
            }
        }

        setCurrentClassComp( prevCreator);

        if (this.rootHost)
            anchorDN.insertBefore( this.rootHost, beforeDN);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Comp, StatsAction.Added);
        /// #endif
    }



    // Releases reference to the DOM node corresponding to this virtual node.
    public prepareUnmount( comp: IComponent): void
    {
        if (this.renderWatcher)
        {
            this.renderWatcher.dispose();
            this.renderWatcher = null;
        }

        let fn = comp.willUnmount;
        if (fn)
        {
            // need try/catch but only to log
            let prevCreator = setCurrentClassComp( comp);
            try
            {
                fn.call( comp);
            }
            catch( err)
            {
                console.error( `Exception in willUnmount of component '${this.name}'`, err);
            }
            setCurrentClassComp( prevCreator);
        }

        comp.vn = undefined;
    }



    // Releases reference to the DOM node corresponding to this virtual node.
    public unmount( removeFromDOM: boolean): void
    {
        let comp = this.comp;
        this.prepareUnmount( comp);

        if (this.rootHost)
        {
            this.rootHost.remove();
            this.rootHost = null;
            this.ownDN = null;
        }

        if (this.subNodes)
        {
            unmountSubNodes( this.subNodes, removeFromDOM);
            this.subNodes = null;
        }

        super.unmount( removeFromDOM);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Comp, StatsAction.Deleted);
        /// #endif
    }



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: ClassCompVN): boolean
	{
		// update is possible if the component class name is the same
		return this.compClass === newVN.compClass;
	}



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node.
	public update( newVN: ClassCompVN, disp: VNDisp): void
	{
        let comp = this.comp;
        let prevCreator = setCurrentClassComp( comp);

        if (!comp.handleError)
            reconcile( this, disp, this.actRender());
        else
        {
            try
            {
                reconcile( this, disp, this.actRender());
            }
            catch( err)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling handleError() on node ${this.name}. Error`, err);
                /// #endif

                // let the node handle its own error and re-render; then we render the new
                // content but we do it without try/catch this time; otherwise, we may end
                // up in an infinite loop
                reconcile( this, {oldVN: disp.oldVN}, this.handleError( err));
            }
        }

        setCurrentClassComp( prevCreator);
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
        let content = this.actRender();
        setCurrentClassComp( prevCreator);
        return content;
	}



    // This method is called after an exception was thrown during rendering of the node's
    // sub-nodes. The method returns the new content to display.
	public handleError( err: any): any
	{
        // we can safely call the component's handleError method because our method is only
        // invoked if the component implements it.
        let prevCreator = setCurrentClassComp( this.comp);
		let content = this.comp.handleError( err);
        setCurrentClassComp( prevCreator);

        return content;
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
		scheduleFuncCall( func, beforeUpdate, funcThisArg || this.comp);
	}



    // Watcher function wrapping the component's render function. The watcher will notice any
    // trigger objects being read during the original function execution and will request update
    // thus triggerring re-rendering.
	private renderWatcher?: IWatcher;

    // Actual function to be invoked during the rendering - it can be either the original func or
    // the watcher.
	private actRender: (...args: any) => any;
}



