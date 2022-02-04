import {IClassCompVN, symRenderNoWatcher, IComponent, RenderMethodType, ScheduledFuncType, TickSchedulingType} from "../api/mim"
import {createWatcher, IWatcher} from "../utils/TriggerWatcher"
import {VN, setCurrentClassComp, FuncProxyVN, scheduleFuncCall, s_wrapCallback, mimcss} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
import { DN } from "./VN";
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

    /** Optional shadow root if the component specifies the `shadow` property */
    public shadowRoot?: ShadowRoot;

    /** Specifal virtual node created if the component specifies the `shadow` property */
    private shadowVN?: ShadowRootVN;



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

        let shadowOptions = comp.shadow;
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

            this.ownDN = document.createElement( tag);
            this.shadowRoot = (this.ownDN as Element).attachShadow( init);
            this.shadowVN = new ShadowRootVN( this.shadowRoot);
        }

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

        if (comp.getUpdateStrategy)
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

        if (this.shadowRoot)
        {
            this.shadowRoot = null;
            this.shadowVN = null;
            (this.ownDN as Element).remove();
            this.ownDN = null;
        }

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
        let content = this.actRender();
        setCurrentClassComp( prevCreator);

        if (this.shadowVN)
        {
            this.shadowVN.content = content;
            content = this.shadowVN;
        }

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

        if (this.shadowVN)
        {
            this.shadowVN.content = content;
            content = this.shadowVN;
        }

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



/**
 * Represents a node responsible for representing a shadow root for an element that is created for
 * a component that wants to work with shadow DOM.
 */
class ShadowRootVN extends VN
{
    content: any;

	constructor( root: ShadowRoot)
	{
		super();
        this.ownDN = root;
	};



/// #if USE_STATS
	public get statsCategory(): StatsCategory { return StatsCategory.Text; }
/// #endif



	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string { return "#shadow"; }



    // Returns the first DOM node defined by either this virtual node or one of its sub-nodes.
    // This method is only called on the mounted nodes.
    public getFirstDN(): DN
    {
        return this.ownDN;
    }

    // Returns the last DOM node defined by either this virtual node or one of its sub-nodes.
    // This method is only called on the mounted nodes.
    public getLastDN(): DN
    {
        return this.ownDN;
    }

    // Returns the list of DOM nodes that are immediate children of this virtual node; that is, are
    // NOT children of sub-nodes that have their own DOM node. May return null but never returns
    // empty array.
    public getImmediateDNs(): DN | DN[] | null
    {
        return this.ownDN;
    }

    // Collects all DOM nodes that are the immediate children of this virtual node (that is,
    // are NOT children of sub-nodes that have their own DOM node) into the given array.
    protected collectImmediateDNs( arr: DN[]): void
    {
        arr.push( this.ownDN);
    }



    // // Creates and returns DOM node corresponding to this virtual node.
	// public mount(): void
	// {
	// 	this.ownDN = this.elm.attachShadow({mode: "open"});
	// }


    // Generates list of sub-nodes according to the current state
	public render(): any
	{
        return this.content;
    }

	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: ShadowRootVN): boolean
	{
		return true;
    }
}


// Define methods/properties that are invoked during mounting/unmounting/updating and which don't
// have or have trivial implementation so that lookup is faster.

/// #if !USE_STATS
    ShadowRootVN.prototype.unmount = undefined;
/// #endif

ShadowRootVN.prototype.isUpdatePossible = undefined; // this mens that update is always possible
ShadowRootVN.prototype.didUpdate = undefined;
ShadowRootVN.prototype.ignoreUnmount = false;


