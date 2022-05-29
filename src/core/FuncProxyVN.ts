import {DN, RenderMethodType} from "../api/CompTypes"
import { VNDisp } from "./VNTypes";
import { IWatcher } from "../api/TriggerTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { createWatcher } from "../api/TriggerAPI";
import { mountContent, unmountSubNodes, reconcile } from "./Reconciler";
import { symRenderNoWatcher, VN } from "./VN";



/**
 * A Symbol used to connect between the original function and the FuncProxyVN created for it.
 */
const symFuncsToNodes = Symbol( "symFuncsToNodes");



/**
 * Encapsultes a rendering function, which is usually a method of a class-based component. This
 * object remembers the function, the "this" pointer to use when calling the function and the
 * argument to pass to it. This allows re-rendering only the part of the parent component as
 * though the method were a full blown independent component. Updating the nodes is accomplished
 * using the FuncProxy static update method accepting the function to be updated.
 *
 * The same function can be used multiple times within the parent component's render() method if
 * it is called with different arguments. The node creates a link between the function and the
 * node. This link is removed when the node is unmounted.
 *
 * The links between the functions and the nodes that use theses functions are kept in a map from
 * the function objects to the nodes. The map is stored in a symbol on the function itself.
 * Normally, the render functions are component methods without arguments - in this case, the node
 * will be mapped to the `undefined` value. If the function was used multiple times with different
 * arguments, then the nodes will be mapped to these argument objects.
 */
export class FuncProxyVN extends VN
{
	constructor( func: RenderMethodType, thisArg: any, arg?: any)
	{
		super();

        // remember data from the props.
		this.func = func;
		this.thisArg = thisArg;
		this.arg = arg;

        // the node's key is the object that most distinguishes the node from other similar nodes.
        // So it is set either to the argument (if defined) or the `thisArg` (if defined) or to the
        // function object itself
        this.key = arg ?? thisArg ?? func;
	}


	/// #if USE_STATS
	public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif
	; // ugly trick to not let the TypeScript compiler to strip the #endif comment



    // String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string { return this.func.name; }



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public prepareMount(): void
	{
        if (!this.thisArg)
            this.thisArg = this.creator;

		this.linkNodeToFunc();

        // establish watcher if not disabled using the @noWatcher decorator
        let func = this.func as RenderMethodType;
        if (func[symRenderNoWatcher])
            this.actFunc = func.bind( this.thisArg);
        else
            this.actFunc = this.watcher = createWatcher( func, this.requestUpdate, this.thisArg, this);
	}



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN: DN): void
	{
        super.mount( parent, index, anchorDN);

        this.prepareMount();

        mountContent( this, this.render(), anchorDN, beforeDN);

        /// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif
	}



    // Cleans up the node object before it is released.
    public prepareUnmount(): void
    {
        if (this.watcher)
        {
            this.watcher.dispose();
            this.watcher = undefined;
        }

        this.unlinkNodeFromFunc();
        this.actFunc = undefined;
    }



    // Cleans up the node object before it is released.
    public unmount( removeFromDOM: boolean): void
    {
        this.prepareUnmount();

        if (this.subNodes)
        {
            unmountSubNodes( this.subNodes, removeFromDOM);
            this.subNodes = undefined;
        }

        super.unmount( removeFromDOM);

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Deleted);
		/// #endif
    }



	// Generates list of sub-nodes according to the current state
	public render(): any
	{
		/// #if VERBOSE_COMP
			console.debug( `VERBOSE: Calling function proxy component ${this.name}`);
		/// #endif

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Comp, StatsAction.Rendered);
		/// #endif

        return this.actFunc!( this.arg);
	}



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node.
	public update( newVN: FuncProxyVN, disp: VNDisp): void
	{
        if (!newVN.thisArg)
            newVN.thisArg = this.creator;

		// remember the new value of the key property (even if it is the same)
		this.key = newVN.key;

        // we allow any FuncProxyVN update; however, if the method or the object to
        // which this method belongs are different, we unmount the old
        if (this.func === newVN.func && this.thisArg === newVN.thisArg)
        {
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
            this.prepareMount();
        }

        reconcile( this, disp, this.render());
	}



    // We need to link our node to the function so that the static method findVN can work (this is
    // used when the IComponent.updateMe(func) method is called). We keep a map of function
    // objects to VNs using the symFuncsToNodes symbol.
    private linkNodeToFunc(): void
	{
		let mapArgsToNodes = this.func[symFuncsToNodes] as Map<any,FuncProxyVN>;
		if (!mapArgsToNodes)
		{
			mapArgsToNodes = new Map();
			this.func[symFuncsToNodes] = mapArgsToNodes;
		}

		mapArgsToNodes.set( this.arg, this);
	}



    // Unlink this node from the function - opposite of what linkNodeToFunc does.
    private unlinkNodeFromFunc(): void
	{
		let mapFuncsToNodes = this.func[symFuncsToNodes] as Map<any,FuncProxyVN>;
		if (mapFuncsToNodes)
			mapFuncsToNodes.delete( this.arg);
	}



    // Tries to find the node linked to the given function using the linkNodeToFunction method.
    private static findVN( func: RenderMethodType, arg: any): FuncProxyVN | undefined
	{
		let mapFuncsToNodes = func[symFuncsToNodes] as Map<any,FuncProxyVN>;
		return mapFuncsToNodes?.get( arg);
	}



	public static update( func: RenderMethodType, arg?: any): void
	{
		// find the node
		let vn = FuncProxyVN.findVN( func, arg);
		if (!vn)
			return;

		vn.requestUpdate();
	}



	// Original rendering function
	private func: RenderMethodType;

	// Object to be used as "this" when invoking the function.
	private thisArg: any;

	// Optional arguments to be passed to the function.
	private arg: any;

    // Watcher function wrapping the original function. The watcher will notice any trigger objects
    // being read during the original function execution and will request update thus triggerring
    // re-rendering.
	private watcher?: IWatcher;

    // Actual function to be invoked during the rendering - it can be either the original func or
    // the watcher.
	private actFunc?: RenderMethodType;
}



