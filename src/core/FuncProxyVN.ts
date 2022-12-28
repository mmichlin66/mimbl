import {ComponentProps, DN, FuncProxyProps, IFuncProxyVN, RefType, RenderMethodType} from "../api/CompTypes"
import { VNDisp } from "./VNTypes";
import { IWatcher } from "../api/TriggerTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { createWatcher } from "../api/TriggerAPI";
import { mountContent, reconcile } from "./Reconciler";
import { setRef, symRenderNoWatcher, updateRef, VN } from "./VN";



/**
 * Encapsulates a rendering function, which is usually a method of a class-based component. This
 * object remembers the function, the "this" pointer to use when calling the function and the
 * argument to pass to it. This allows re-rendering only a part of the parent component as
 * though the method were a full blown independent component.
 *
 * The same function can be used multiple times within the parent component's render() method -
 * usually if it is called with different arguments.
 *
 * Rendering functions are normally wrapped in a watcher and thus re-render automatically if any
 * of the triggers used in the function changes its value. The function can opt-out of being
 * wrapped in a watcher by applying the `@noWatcher` decorator to it. If there is a need to
 * request rerendering of the function without relying on triggers, the `ref` property must be
 * supplied. When the virtual node mounts, the reference is set to the [[IFuncProxyVN]] interface,
 * which is implemented by this node. Through this interface, callers caller can request
 * re-rendering by invoking the `updateMe` method.
 */
export class FuncProxyVN extends VN implements IFuncProxyVN
{
	constructor(props: ComponentProps<FuncProxyProps>)
	{
		super();

        // remember data from the props.
		this.func = props.func;
		this.thisArg = props.thisArg ?? this.creator;
		this.arg = props.arg;
        this.ref = props.ref;
        this.key = props.key;
	}


	/// #if USE_STATS
	public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif



    /** String representation of the virtual node. */
	public get name(): string { return this.func.name; }



    /**
     * Causes rerendering
     */
    public updateMe(): void
    {
        this.requestUpdate();
    }



	/**
     * Initializes internal stuctures of the virtual node. This method is called right after the
     * node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
     * corresponding to this virtual node.
     */
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN: DN): void
	{
        super.mount( parent, index, anchorDN);
        this.prepareMount();
        mountContent( this, this.render(), anchorDN, beforeDN);

        /// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif
	}



    /** Cleans up the node object before it is released. */
    public unmount( removeFromDOM: boolean): void
    {
        this.prepareUnmount();
        super.unmount( removeFromDOM);

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Deleted);
		/// #endif
    }



	/**
     * Updated this node from the given node. This method is invoked only if update happens as a
     * result of rendering the parent nodes. The newVN parameter is guaranteed to point to a VN
     * of the same type as this node.
     */
	public update( newVN: FuncProxyVN, disp: VNDisp): void
	{
		// remember the new value of the key property (even if it is the same)
		this.key = newVN.key;

        // we allow any FuncProxyVN update; however, if the method or the object to
        // which this method belongs are different, we unmount the old
        if (this.func === newVN.func && this.thisArg === newVN.thisArg)
        {
            // update reference if needed
            if (this.ref !== newVN.ref)
                this.ref = updateRef(this.ref, newVN.ref, this);

            // we need to re-render only if the arguments are not the same.
            if (this.arg === newVN.arg)
                return;

            this.arg = newVN.arg;
        }
        else
        {
            this.prepareUnmount();
            this.func = newVN.func;
            this.thisArg = newVN.thisArg;
            this.arg = newVN.arg;
            this.ref = newVN.ref;
            this.prepareMount();
        }

        reconcile( this, disp, this.render());
	}



	/** Invokes the rendering function */
	public render(): any
	{
		/// #if VERBOSE_COMP
			console.debug( `VERBOSE: Calling function proxy component ${this.name}`);
		/// #endif

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Rendered);
		/// #endif

        return this.watcher ? this.watcher(this.arg) : this.func(this.arg);
	}



	/**
     * Initializes the node either before mounting or before updating with a different function.
     */
	private prepareMount(): void
	{
        // establish watcher if not disabled using the @noWatcher decorator
        this.watcher = this.func[symRenderNoWatcher]
            ? undefined
            : createWatcher( this.func, this.requestUpdate, this.thisArg, this);

        if (this.ref)
            setRef( this.ref, this);
	}



    /**
     * Cleans up the node object before it is either released or updated with different function.
     */
    private prepareUnmount(): void
    {
        if (this.ref)
            setRef( this.ref, undefined, this);

        // release the watcher; we don't need to set it to undefined because it will be done
        // in the next mount (if it comes)
        this.watcher?.dispose();
    }



	/** Original rendering function */
	private func: RenderMethodType;

	/** Object to be used as "this" when invoking the function. */
	private thisArg?: any;

	/** Optional arguments to be passed to the function. */
	private arg?: any;

	/** Optional arguments to be passed to the function. */
	private ref?: RefType<IFuncProxyVN>;

    /**
     * Watcher function wrapping the original function. The watcher will notice any trigger objects
     * being read during the original function execution and will request update thus triggerring
     * re-rendering.
     */
	private watcher?: IWatcher;
}



