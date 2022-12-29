import { DN, IClassCompVN, IComponent, IComponentClass, ComponentShadowOptions } from "../api/CompTypes"
import { VNDisp } from "./VNTypes";
import { IWatcher } from "../api/TriggerTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { createWatcher } from "../api/TriggerAPI";
import { setCurrentClassComp, mountContent, reconcile } from "./Reconciler";
import { symRenderNoWatcher, VN } from "./VN";



/**
 * Symbol used on component class to specify shadow parameters (ComponentShadowParams)
 */
const symShadowOptions = Symbol("shadowOptions");

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



/**
 * Base class for IndependentCompVN and ManagedCompVN classes. It provides common functionality
 * in terms of update requests and lifecycle management.
 */
export abstract class ClassCompVN extends VN implements IClassCompVN
{
	/** Type of the class-based component. */
	public compClass: IComponentClass;

	/** Component instance. */
	public comp?: IComponent;

	/**
     * Properties that were passed to the component. This might be undefined for independent
     * components.
     */
	public props: Record<string,any> | undefined;

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
    public get shadowRoot(): ShadowRoot | undefined { return this.ownDN; };



	/// #if USE_STATS
		public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount( parent: VN | null, index: number, anchorDN: DN, beforeDN: DN): void
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

        let comp = this.comp!;
        let prevCreator = setCurrentClassComp( comp);

        this.prepareMount( comp);

        let newAnchorDN = this.ownDN ?? anchorDN;
        let newBeforeDN = this.ownDN ? null : beforeDN;

        if (!comp.handleError)
            mountContent( this, this.render(), newAnchorDN, newBeforeDN);
        else
        {
            try
            {
                mountContent( this, this.render(), newAnchorDN, newBeforeDN);
            }
            catch( err)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling handleError() on node ${this.name}. Error:`, err);
                /// #endif

                // let the component handle the error and re-render; then we render the new
                // content but we do it without try/catch this time; otherwise, we may end
                // up in an infinite loop. We also set our component as current again.
                setCurrentClassComp(comp);
                comp.handleError(err);
                mountContent( this, this.render(), newAnchorDN, newBeforeDN);
            }
        }

        setCurrentClassComp( prevCreator);

        if (this.rootHost)
            anchorDN!.insertBefore( this.rootHost, beforeDN);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Comp, StatsAction.Added);
        /// #endif
    }



    // Releases reference to the DOM node corresponding to this virtual node.
    public unmount( removeFromDOM: boolean): void
    {
        this.prepareUnmount( this.comp!);

        if (this.rootHost)
        {
            this.rootHost.remove();
            removeFromDOM = false;
            this.rootHost = undefined;
            this.ownDN = undefined;
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
		// update is possible if the component class is the same
		return this.compClass === newVN.compClass;
	}



	/**
     * Performs part of the update functionality, which is common for managed and independent
     * coponents.
     */
	public update( newVN: ClassCompVN, disp: VNDisp): void
	{
        let comp = this.comp!;
        this.updateStrategy = comp.updateStrategy;

        let prevCreator = setCurrentClassComp( comp);

        if (!comp.handleError)
            reconcile( this, disp, this.render());
        else
        {
            try
            {
                reconcile( this, disp, this.render());
            }
            catch( err)
            {
                /// #if VERBOSE_NODE
                    console.debug( `Calling handleError() on node ${this.name}. Error`, err);
                /// #endif

                // let the component handle the error; then we render the new content but we do it
                // without try/catch this time; otherwise, we may end up in an infinite loop.
                setCurrentClassComp(comp);
                comp.handleError(err);
                reconcile( this, {oldVN: disp.oldVN}, this.render());
            }
        }

        setCurrentClassComp( prevCreator);
	}



    /**
     * Generates list of sub-nodes according to the current state. This method is invoked in two
     * situations:
     * 1. Directly if the component is being updated on its own (that is, not as a result of
     * parent update). In this case, this component is set as the currently active cmoponent by
     * the code in Reconciler.
     * 2. From this class'es mount or update. In this case, this component is set as the currently
     * active cmoponent by the code in mount and update.
     */
	public render(): any
	{
		/// #if DEBUG
			if (!this.comp)
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

        // return this.actRender();
        return this.watcher ? this.watcher() : this.comp.render();
	}



    /** This method is called by the component when it needs to be updated. */
	public updateMe(): void
    {
        this.requestUpdate();
    }



	/**
     * Prepares component for mounting but doesn't render and mount sub-nodes
     */
	protected prepareMount( comp: IComponent): void
    {
        // connect the component to this virtual node
        comp.vn = this;

        // don't need try/catch because it will be caught up the chain
        comp.willMount?.call( comp);

        // establish watcher if not disabled using the @noWatcher decorator
        this.watcher = comp.render[symRenderNoWatcher]
            ? undefined
            : createWatcher( comp.render, this.requestUpdate, comp, this);

        this.updateStrategy = comp.updateStrategy;
    }



    // Releases reference to the DOM node corresponding to this virtual node.
    protected prepareUnmount( comp: IComponent): void
    {
        // release the watcher; we don't need to set it to undefined because it will be done
        // in the next mount (which is only possible in independent components)
        this.watcher?.dispose();

        let willUnmount = comp.willUnmount;
        if (willUnmount)
        {
            // need try/catch but only to log
            let prevCreator = setCurrentClassComp( comp);
            try
            {
                willUnmount.call( comp);
            }
            catch( err)
            {
                /// #if DEBUG
                console.error( `Exception in willUnmount of component '${this.name}'`, err);
                /// #endif
            }
            setCurrentClassComp( prevCreator);
        }

        // unpublish and unsubscribe
        this.clearPubSub();

        comp.vn = undefined;
    }



    /**
     * Watcher function wrapping the component's render function. The watcher will notice any
     * trigger objects being read during the original function execution and will request update
     * thus triggerring re-rendering. */
	private watcher?: IWatcher;
}



