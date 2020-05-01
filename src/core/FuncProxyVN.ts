import * as mim from "../api/mim"
import {DN, VN, VNUpdateDisp} from "./VN"
import {VNBase} from "./VNBase"
import {s_currentClassComp} from "./Scheduler"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



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
 * keys to the nodes. The map is stored in a custom property on the function object itself.
 */
export class FuncProxyVN extends VNBase
{
	constructor( props: mim.FuncProxyProps)
	{
		super();

		this.type = mim.VNType.FuncProxy;
		this.func = props.func;
		this.thisArg = props.thisArg || s_currentClassComp;
		this.args = props.args;
		this.argsReplaced = false;

		this.key = props.key;

		// if a key was not provided we use the value of thisArg (which might be the current
		// component) as a key. If that is undefined too we use the function itself as a key.
		this.linkKey = props.key || this.thisArg || this.func;
	}


	public replaceArgs( args: any[]): void
	{
		this.args = args;
		this.argsReplaced = true;
	}



	/// #if USE_STATS
	public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif
	; // ugly trick to not let the TypeScript compiler to strip the #endif comment



	// Node's key. The derived classes set it based on their respective content. A key
	// can be of any type.
	public key: any;



	/**
	 * Flag indicating whether this node should re-render during update even it is the same
	 * physical node instance. This is needed for nodes that serve as a proxy to a rendering
	 * function and that function must be invoked even none of the node parameters have changed.
	 */
	public get renderOnUpdate(): boolean { return this.argsReplaced; };



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



	// Generates list of sub-nodes according to the current state
	public render(): any
	{
		/// #if VERBOSE_COMP
			console.debug( `VERBOSE: Calling function proxy component ${this.name}`);
		/// #endif

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Rendered);
		/// #endif

		this.argsReplaced = false;
		return this.func.apply( this.thisArg, this.args);
	}



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount(): void
	{
		this.linkNodeToFunc();

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif
	}



	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the render phase.
	public willUnmount(): void
	{
		this.unlinkNodeFromFunc();

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Deleted);
		/// #endif
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: VN): boolean
	{
		let newFuncProxyVN = newVN as FuncProxyVN;

		// update is possible if it is the same function object and the same thisArg property
		return this.func === newFuncProxyVN.func && this.thisArg === newFuncProxyVN.thisArg;
	}



	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	public prepareUpdate( newVN: VN): VNUpdateDisp
	{
		let newFuncProxyVN = newVN as FuncProxyVN;

		// remeber the new value of the key property (even if it is the same)
		this.key = newFuncProxyVN.key;
		this.linkKey = newFuncProxyVN.linkKey;

		// take arguments from the new node; the function itself and "thisArg" remain the same.
		this.args = newFuncProxyVN.args;

		// indicate that it is necessary to update the sub-nodes. The commitUpdate
		// method should NOT be called.
		return VNUpdateDisp.NoCommitDoRender;
	}



	public static findVN( func: Function, key?: any, thisArg?: any): FuncProxyVN
	{
		// if the key is undefined, we use the function object itself
		let linkKey: any = key || thisArg || s_currentClassComp || func;

		// try to find the key in the map on the function object; if not found, do nothing
		let mapKeysToNodes: Map<any,FuncProxyVN> = func["__keys-to-nodes"];
		return mapKeysToNodes && mapKeysToNodes.get( linkKey);
	}



	public static update( func: Function, key?: any, thisArg?: any, args?: any[]): void
	{
		// find the node
		let vn = FuncProxyVN.findVN( func, key, thisArg);
		if (!vn)
			return;

		vn.args = args;
		vn.argsReplaced = true;
		vn.requestUpdate();
	}



	private linkNodeToFunc(): void
	{
		let func: any = this.func;
		let mapKeysToNodes: Map<any,FuncProxyVN> = func["__keys-to-nodes"];
		if (!mapKeysToNodes)
		{
			mapKeysToNodes = new Map<any,FuncProxyVN>();
			func["__keys-to-nodes"] = mapKeysToNodes;
		}

		mapKeysToNodes.set( this.linkKey, this);
	}


	private unlinkNodeFromFunc(): void
	{
		let func: any = this.func;
		let mapKeysToNodes: Map<any,FuncProxyVN> = func["__keys-to-nodes"];
		if (mapKeysToNodes)
			mapKeysToNodes.delete( this.linkKey);
	}


	// Function to be invoked during the rendering
	private func: Function;

	// Object to be used as "this" when invoking the function.
	private thisArg: any;

	// Optional arguments to be passed to the function.
	private args: any[];

	// Flag indicating whether arguments have been replaced. This is needed to determine whether
	// the node should be re-rendered; that is, the function should be called.
	private argsReplaced: boolean;

	// Key that links the function and this node. This key is either equals to the key provided
	// in the properties passed to the constructor or to the current component or to the function
	// itself.
	private linkKey: any;
}



