import * as mim from "./mim"
import {DN, VN, VNUpdateDisp} from "./VN"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "./Stats"
/// #endif



/**
 * Represents a rendering function a.k.a. stateless component.
 */
export class FuncVN extends VN
{
	/** Determines whether this node corresponds to a fragment placeholder. */
	public static isVNaFragment( vn: VN): boolean
	{
		return (vn as FuncVN).func === mim.Fragment;
	}



	constructor( func: mim.FuncCompType, props: any, children: any[])
	{
		super( mim.VNType.FuncComp)

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

			// if key property was not specified, use id; if id was not specified key wil remain
			// undefined.
			if (this.key === undefined)
				this.key = props.id;
		}

		// remember children as part of props
		this.props.children = children;

		// node name is the function's name plus key if specified
		this.name = this.func.name;
		if (this.key !== undefined && this.key !== null)
			this.name += " @" + this.key;
	};



/// #if USE_STATS
	public getStatsCategory(): StatsCategory { return StatsCategory.Comp; }
/// #endif



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
		public willMount(): boolean
		{
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
			return true;
		}

		// This method is called before the content of node and all its sub-nodes is removed from the
		// DOM tree.
		// This method is part of the Commit phase.
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
		this.props = newFuncVN.props;

		// since the rendering produced by a function may depend on factors beyond properties,
		// we always indicate that it is necessary to update the sub-nodes. The commitUpdate
		// method should NOT be called.
		return { shouldCommit: false, shouldRender: true };
	}



	// Returns DOM node corresponding to the virtual node itself and not to any of its sub-nodes.
	public getOwnDN(): DN
	{
		// components don't have their own DOM node
		return null;
	}



	// Function for a stateless component. The function is invoked during the rendering process.
	func: mim.FuncCompType;

	// Properties that were passed to the component, function or element.
	props: any;
}



