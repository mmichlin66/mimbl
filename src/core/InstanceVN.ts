﻿import * as mim from "./mim"
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
	constructor( comp: mim.Component)
	{
		super( mim.VNType.InstanceComp)
		this.comp = comp;

		// the component object is a key for the node
		this.key = comp;

		// default node name is the component's constructor name
		this.name = this.comp.constructor.name;
	};



	// IInstanceVN implementation
	public get Comp(): mim.IComponent { return this.comp; }



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount(): void
	{
		this.comp.setSite( this);
		if (this.comp.componentWillMount)
			this.comp.componentWillMount();

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
		/// #endif
	}



	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the Commit phase.
	public willUnmount(): void
	{
		if (this.comp.componentWillUnmount)
			this.comp.componentWillUnmount();

		this.comp.setSite( null);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Deleted);
		/// #endif
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
		{
			newComp.setSite( this);
			if (newComp.componentWillMount)
				newComp.componentWillMount();
	
			/// #if USE_STATS
				DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Added);
			/// #endif
		}

		return { shouldCommit: needsUpdating, shouldRender: needsUpdating };
	}



	// Commits updates made to this node to DOM.
	// This method is part of the Commit phase.
	public commitUpdate?( newVN: VN): void
	{
		// we are here only if the component instances are different. In this case we should
		// replace the old component with the new one and also replace its characteristics.
		// First indicate that our old component will be unmounted
		this.willUnmount();

		let newInstanceVN = newVN as InstanceVN;
		this.comp = this.key = newInstanceVN.comp;
		this.name = newInstanceVN.name;
	}

}



