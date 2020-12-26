import {Fragment, FuncCompType} from "../api/mim"
import { VN } from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



/**
 * Represents a rendering function a.k.a. stateless component.
 */
export class FuncVN extends VN
{
	/** Determines whether this node corresponds to a fragment placeholder. */
	public static isVNaFragment( vn: VN): boolean
	{
		return (vn as FuncVN).func === Fragment;
	}



	constructor( func: FuncCompType, props: any, children: any[])
	{
		super();

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



    /// #if USE_STATS
        // Initializes internal stuctures of the virtual node. This method is called right after the
        // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
        // corresponding to this virtual node.
        public mount(): void
        {
            DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
        }



        // Cleans up the node object before it is released.
        public unmount(): void
        {
            DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Deleted);
        }
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



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: FuncVN): boolean
	{
		// update is possible if it is the same function object
		return this.func === newVN.func;
	}



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: FuncVN): boolean
	{
		// remember the new value of the key property (even if it is the same)
		this.key = newVN.key;

		// take properties from the new node
		this.func = newVN.func;
		this.props = newVN.props;

		// since the rendering produced by a function may depend on factors beyond properties,
		// we always indicate that it is necessary to update the sub-nodes. The commitUpdate
		// method should NOT be called.
		return true;
	}



	// Function for a stateless component. The function is invoked during the rendering process.
	private func: FuncCompType;

	// Properties that were passed to the component, function or element.
	private props: any;
}



