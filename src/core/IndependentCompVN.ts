import * as mim from "../api/mim"
import {VN, VNUpdateDisp} from "./VN"
import {ClassCompVN} from "./ClassCompVN"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class InstanceVN is a node that holds an instance of an IComponent-implementing object.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class IndependentCompVN extends ClassCompVN implements mim.IIndependentCompVN
{
	constructor( comp: mim.IComponent)
	{
		super();

		this.type = mim.VNType.IndependentComp;
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



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount(): void
	{
		this.willMountInstance( this.comp);
        super.willMount();
	}



	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the render phase.
	public willUnmount(): void
	{
        super.willUnmount();
		this.willUnmountInstance( this.comp);
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

		// if the component instances are different, then we need to prepare the new instance for
		// mounting and the old one for unmounting.
		if (needsUpdating)
		{
			this.willMountInstance( newComp);
			this.willUnmountInstance( this.comp);
            this.comp = newComp;
            
            // now that we have the new component in our comp property we should reestablish
            // watching its render method
            super.reestablishWatcher();
		}

		return VNUpdateDisp.getStockValue( false, needsUpdating);
	}



	// Notifies the given component that it will be mounted.
	private willMountInstance( comp: mim.IComponent): void
	{
		comp.vn = this;

		if (comp.willMount)
			comp.willMount();

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif
	}



	// Notifies the given component that it will be unmounted.
	private willUnmountInstance( comp: mim.IComponent): void
	{
		if (comp.willUnmount)
			comp.willUnmount();

		comp.vn = undefined;

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Deleted);
		/// #endif
	}
}



