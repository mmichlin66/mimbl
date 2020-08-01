import * as mim from "../api/mim"
import {VNBase} from "./VNBase"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class CompBaseVN is a base class for InstanceVN and ClassVN. It provides common functionality
// in terms of update requests and lifecycle management.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class ClassCompVN extends VNBase implements mim.IClassCompVN
{
	// Component instance.
	public comp: mim.IComponent;



	/// #if USE_STATS
		public get statsCategory(): StatsCategory { return StatsCategory.Comp; }
	/// #endif



	/**
	 * Retrieves update strategy object that determines different aspects of node behavior
	 * during updates.
	 */
	public get updateStrategy(): mim.UpdateStrategy
	{
		return this.comp.getUpdateStrategy ? this.comp.getUpdateStrategy() : undefined;
	}



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



    // Notifies the virtual node that it was successfully mounted. This method is called after the
    // content of node and all its sub-nodes is added to the DOM tree.
	// This method is part of the Commit phase.
    public didMount(): void
    {
		if (this.comp.didMount)
			this.comp.didMount();
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
}



