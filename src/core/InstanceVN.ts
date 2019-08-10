import * as mim from "./mim"
import {VN} from "./VN"
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
		// since the component instance is used as a key, the other node is always for the
		// same component instance and update is always possible.
		return true;
	}
}



