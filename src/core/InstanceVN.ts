import * as mim from "./mim"
import {VN, VNUpdateDisp} from "./VN"
import {CompBaseVN} from "./CompBaseVN"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "./Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class InstanceVN is a node that holds an instance of an IComponent-implementing object.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class InstanceVN extends CompBaseVN<mim.IComponent> implements mim.IInstanceVN
{
	constructor( comp: mim.IComponent)
	{
		super();
		this.comp = comp;

		// the component object is a key for the node
		this.key = comp;
	};



	// IInstanceVN implementation
	public get Comp(): mim.IComponent { return this.comp; }



	// Node's type.
	public get type(): mim.VNType { return mim.VNType.InstanceComp; }



	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string
	{
		// components can define the getDisplayName method; if they don't then the default name
		// is the component's constructor name
		if (this.comp.getDisplayName)
			return this.comp.getDisplayName();
		else
			return this.comp.constructor.name;
	}



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount(): boolean
	{
		this.willMountInstance( this.comp);
		return true;
	}



	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the Commit phase.
	public willUnmount(): void
	{
		this.willUnmountInstance( this.comp);
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: VN): boolean
	{
		// update is possible if the components are from the same class
		return this.comp === (newVN as InstanceVN).comp ||
				this.comp.constructor === (newVN as InstanceVN).comp.constructor;
	}



	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	public prepareUpdate?( newVN: VN): VNUpdateDisp
	{
		// if it is the same component instance, we don't need to do anything
		let newComp = (newVN as InstanceVN).comp;
		let needsUpdating = this.comp !== newComp;

		// if the coponent instance are different, then we need to prepare the new instance for
		// mounting.
		if (needsUpdating)
			this.willMountInstance( newComp);

		return { shouldCommit: needsUpdating, shouldRender: needsUpdating };
	}



	// Commits updates made to this node to DOM.
	// This method is part of the Commit phase.
	public commitUpdate?( newVN: VN): void
	{
		// we are here only if the component instances are different. In this case we should
		// replace the old component with the new one and also replace its characteristics.
		// First indicate that our old component will be unmounted
		this.willUnmountInstance( this.comp);

		let newInstanceVN = newVN as InstanceVN;
		this.comp = this.key = newInstanceVN.comp;
	}




	// Notifies the given component that ir will be mounted.
	private willMountInstance( comp: mim.IComponent): void
	{
		// it is OK for the component to not implement setSite method; however, it will not be
		// able to use any of the Mimbl services including requests for updates.
		if (this.comp.setSite)
			comp.setSite( this);

		if (comp.componentWillMount)
			comp.componentWillMount();

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif
	}



	// Notifies the given component that it will be unmounted.
	public willUnmountInstance( comp: mim.IComponent): void
	{
		if (comp.componentWillUnmount)
			comp.componentWillUnmount();

		if (this.comp.setSite)
			comp.setSite( null);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Deleted);
		/// #endif
	}
}



