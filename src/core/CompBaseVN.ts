import * as mim from "./mim"
import {DN, VN} from "./VN"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "./Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class CompBaseVN is a base class for InstanceVN and ClassVN. It provides common functionality
// in terms of update requests and lifecycle management.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class CompBaseVN<TComp extends mim.IComponent> extends VN
{
	/// #if USE_STATS
		public getStatsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif



	// Generates list of sub-nodes according to the current state
	public render(): any
	{
		/// #if DEBUG
			if (this.comp === undefined)
			{
				console.error( "render() was called on unmounted component.");
				return null;
			}
		/// #endif

		/// #if VERBOSE_COMP
			console.debug( `VERBOSE: Calling render() on component ${this.name}`);
		/// #endif

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Comp, StatsAction.Rendered);
		/// #endif

		return this.comp.render();
	}



	// Determines whether the node supports handling of errors; that is, exception thrown during
	// rendering of the node itself and/or its sub-nodes.
	public supportsErrorHandling(): boolean
	{
		return this.comp.handleError !== undefined;
	}



	// This method is called after an exception was thrown during rendering of the node itself
	// and/or its sub-nodes.
	public handleError( err: any, path: string[]): void
	{
		this.comp.handleError( err, path);
	}



	/**
	 * Retrieves update strategy object that determines different aspects of node behavior
	 * during updates.
	 */
	public getUpdateStrategy?(): mim.UpdateStrategy
	{
		return this.comp.getUpdateStrategy ? this.comp.getUpdateStrategy() : undefined;
	}



	// Returns DOM node corresponding to the virtual node itself and not to any of its sub-nodes.
	public getOwnDN(): DN
	{
		// components don't have their own DOM node
		return null;
	}



	// Component instance.
	protected comp: TComp;
}



