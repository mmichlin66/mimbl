import * as mim from "../api/mim"
import {DN, VN, VNUpdateDisp} from "./VN"
import {VNBase} from "./VNBase"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



/**
 * Represents a rendering function a.k.a. stateless component.
 */
export class FuncVN extends VNBase
{
	/** Determines whether this node corresponds to a fragment placeholder. */
	public static isVNaFragment( vn: VN): boolean
	{
		return (vn as FuncVN).func === mim.Fragment;
	}



	constructor( func: mim.FuncCompType, props: any, children: any[])
	{
		super();

		this.type = mim.VNType.FuncComp;
		this.func = func;

		// copy properties to our own object excluding framework-handled key
		this.props = {};
		if (props)
		{
			for( let propName in props)
			{
				let propVal: any = props[propName];
				if (propVal === undefined || propVal === null)
				{
					// ignore properties with values undefined and null
					continue;
				}
				else if (propName === "key")
				{
					// remember key property but don't copy it to this.props object
					this.key = propVal;
				}
				else
					this.props[propName] = propVal;
			}

			// if key property was not specified, use id; if id was not specified key will remain
			// undefined.
			if (this.key === undefined)
				this.key = props.id;
		}

		// remember children as part of props
		this.props.children = children;
	};



/// #if USE_STATS
	public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
/// #endif



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
			console.debug( `VERBOSE: Calling functional component ${this.name}`);
		/// #endif

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Rendered);
		/// #endif

		return this.func( this.props);
	}



	/// #if USE_STATS
		// Creates internal stuctures of the virtual node so that it is ready to produce children.
		// This method is called right after the node has been constructed.
		// This method is part of the Render phase.
		public willMount(): void
		{
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
		}

		// This method is called before the content of node and all its sub-nodes is removed from the
		// DOM tree.
		// This method is part of the render phase.
		public willUnmount(): void
		{
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Deleted);
		}
	/// #endif



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: VN): boolean
	{
		// update is possible if it is the same function object
		return this.func === (newVN as FuncVN).func;
	}



	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	public prepareUpdate( newVN: VN): VNUpdateDisp
	{
		let newFuncVN = newVN as FuncVN;

		// remeber the new value of the key property (even if it is the same)
		this.key = newFuncVN.key;

		// take properties from the new node
		this.func = newFuncVN.func;
		this.props = newFuncVN.props;

		// since the rendering produced by a function may depend on factors beyond properties,
		// we always indicate that it is necessary to update the sub-nodes. The commitUpdate
		// method should NOT be called.
		return VNUpdateDisp.NoCommitDoRender;
	}



	// Function for a stateless component. The function is invoked during the rendering process.
	private func: mim.FuncCompType;

	// Properties that were passed to the component, function or element.
	private props: any;

	// Node's key. The derived classes set it based on their respective content. A key
	// can be of any type.
	public key: any;
}



