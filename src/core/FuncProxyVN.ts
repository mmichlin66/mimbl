import {RenderMethodType} from "../api/CompTypes"
import { DN, VNDisp } from "./VNTypes";
import { IWatcher } from "../api/TriggerTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { createWatcher } from "../api/TriggerAPI";
import { mountContent, unmountSubNodes, reconcile } from "./Reconciler";
import { symRenderNoWatcher, VN } from "./VN";



/**
 * A Symbol used to connect between the original function and the VNs created for it.
 */
let symFuncsToNodes = Symbol( "symFuncsToNodes");



/**
 * Encapsultes a rendering function, which is usually a method of a class-based component. This
 * object remembers the function, the "this" pointer to use when calling the function and the
 * arguments to pass to it. This allows re-rendering only the part of the parent component as
 * though the method were a full blown independent component. Updating the nodes is accomplished
 * using the FuncProxy static update method accepting the function to be updated.
 *
 * The same function can be used multiple times within the parent component's render() method -
 * especially (but not necessarily) if it is called with different parameters. To distinguish
 * between multiple nodes when updating (using FuncProxy.update), a unique key must be assigned.
 * The node then creates a link between the function and the node. This link is removed when the
 * node is unmounted. The key is optional if the function is used only once in the parent's
 * render method. If the function is used more than once and keys are not provided or are the same
 * Mimble will issue an error.
 *
 * The link between the function and the nodes that use this function is kept in a map from the
 * keys to the nodes. The map is stored in a symbol on the function object itself.
 */
export class FuncProxyVN extends VN
{
	constructor( func: RenderMethodType, thisArg?: any, arg?: any, key?: any)
	{
		super();

        // remember data from the props. Note that if funcThisArg is undefined it will be changed
        // to the node's creator component upon mounting. If there is no key specified, the arg
        // will be used (which may also be unspecified)
		this.func = func;
		this.thisArg = thisArg;
		this.arg = arg;
		this.key = key || arg;
	}


	/// #if USE_STATS
	public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif
	; // ugly trick to not let the TypeScript compiler to strip the #endif comment



    // String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string
	{
		// node name is the function's name plus key (or id) if specified.
		let name = this.func.name;
		if (this.key != null)
			name += "@" + this.key;

		return name;
	}



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
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN?: DN | null): void
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
            this.watcher = null;
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
            this.subNodes = null;
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

        return this.actFunc( this.arg);
	}



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: FuncProxyVN, disp: VNDisp): void
	{
        if (!newVN.thisArg)
            newVN.thisArg = this.creator;

		// remember the new value of the key property (even if it is the same)
		this.key = newVN.key;

        // we allow any FuncProxyVN update; however, if the method of the object to
        // which this method belongs are different, we unmount the old
        if (this.func === newVN.func && this.thisArg === newVN.thisArg)
        {
            // we need to re-render only if the arguments are the same.
            if (this.arg !== newVN.arg)
                this.arg = newVN.arg;
            else
                return;
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
        if (!this.thisArg)
            return;

		let mapFuncsToNodes = this.thisArg[symFuncsToNodes] as Map<Function,FuncProxyVN>;
		if (!mapFuncsToNodes)
		{
			mapFuncsToNodes = new Map<Function,FuncProxyVN>();
			this.thisArg[symFuncsToNodes] = mapFuncsToNodes;
		}

		mapFuncsToNodes.set( this.func, this);
	}



    // Unlink this node from the function - opposite of what linkNodeToFunc does.
    private unlinkNodeFromFunc(): void
	{
        if (!this.thisArg)
            return;

		let mapFuncsToNodes = this.thisArg[symFuncsToNodes] as Map<Function,FuncProxyVN>;
		if (mapFuncsToNodes)
			mapFuncsToNodes.delete( this.func);
	}



    // Tries to find the node linked to the given function using the linkNodeToFunction method.
    private static findVN( func: RenderMethodType, thisArg: any, key?: any): FuncProxyVN
	{
        /// #if DEBUG
            if (!thisArg)
            {
                console.error("FuncProxVN.findVN was called with undefined thisArg");
                return undefined;
            }
        /// #endif

        if (!thisArg)
            return null;

		let mapFuncsToNodes: Map<Function,FuncProxyVN> = thisArg[symFuncsToNodes];
		return mapFuncsToNodes && mapFuncsToNodes.get( func);
	}



	public static update( func: RenderMethodType, thisArg?: any, key?: any): void
	{
		// find the node
		let vn = FuncProxyVN.findVN( func, thisArg, key);
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
	private actFunc: RenderMethodType;
}



// Define methods/properties that are invoked during mounting/unmounting/updating and which don't
// have or have trivial implementation so that lookup is faster.
FuncProxyVN.prototype.isUpdatePossible = undefined; // this means that update is always possible



