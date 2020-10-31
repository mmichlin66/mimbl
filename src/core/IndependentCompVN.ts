import {IIndependentCompVN, IComponent} from "../api/mim"
import {VN, VNUpdateDisp, ClassCompVN} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class IndependentCompVN is a node that holds an instance of an IComponent-implementing
// object. The component instance also serves as the node's key.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class IndependentCompVN extends ClassCompVN implements IIndependentCompVN
{
	constructor( comp: IComponent)
	{
		super();

        this.comp = comp;
        this.key = comp;
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

		// if the component instances are different, then we need to prepare the old instance for
		// unmounting and the new one for mounting.
		if (needsUpdating)
		{
			this.willUnmount();
			this.unmount();

            this.comp = newComp;
            this.key = newComp;

            this.willMount();

            /// the mount method is only defined for gathering stats
            /// #if USE_STATS
                this.mount();
            /// #endif

            this.didMount();
		}

		return VNUpdateDisp.getStockValue( false, needsUpdating);
	}
}



