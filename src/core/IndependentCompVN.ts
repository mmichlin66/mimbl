import {IIndependentCompVN, IComponent} from "../api/mim"
import {VN, VNUpdateDisp, ClassCompVN} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class InstanceVN is a node that holds an instance of an IComponent-implementing object.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class IndependentCompVN extends ClassCompVN implements IIndependentCompVN
{
	constructor( comp: IComponent)
	{
		super();

		this.comp = comp;
	};



	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string
	{
		// components can define the displayName property; if they don't then the default name
		// is the component's constructor name
		return this.comp.displayName ? this.comp.displayName : this.comp.constructor.name;
	}



	// Node's key. The derived classes set it based on their respective content. A key
	// can be of any type. The instance of our component is the key.
	public get key(): any { return this.comp; }



	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	public prepareUpdate( newVN: VN): VNUpdateDisp
	{
		// if it is the same component instance, we don't need to do anything
		let newComp = (newVN as IndependentCompVN).comp;
		let needsUpdating = this.comp !== newComp;

		// if the component instances are different, then we need to prepare the new instance for
		// mounting and the old one for unmounting.
		if (needsUpdating)
		{
			this.willUnmount();
            this.comp = newComp;
			this.willMount();
		}

		return VNUpdateDisp.getStockValue( false, needsUpdating);
	}
}



