import {ITextVN} from "../api/mim"
import {VN, DN, VNUpdateDisp} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



/**
 * Represents a text node.
 */
export class TextVN extends VN implements ITextVN
{
	// Text for a simple text node.
	public text: string;

	// Text DOM node
	public textNode: Text;



	constructor( text: string)
	{
		super();
		this.text = text;
	};



/// #if USE_STATS
	public get statsCategory(): StatsCategory { return StatsCategory.Text; }
/// #endif



	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string { return "#text"; }

	// Returns DOM node corresponding to the virtual node itself (if any) and not to any of its
	// sub-nodes.
	public get ownDN(): DN { return this.textNode; };



	// Creates and returns DOM node corresponding to this virtual node.
	// This method is part of the Commit phase.
	public mount(): DN
	{
		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Text, StatsAction.Added);
		/// #endif

		return this.textNode = document.createTextNode( this.text);
	}



	// Destroys DOM node corresponding to this virtual node.
	// This method is part of the Commit phase.
	public unmount(): void
	{
		this.textNode = undefined;

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Text, StatsAction.Deleted);
		/// #endif
	}



	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	public prepareUpdate( newVN: VN): VNUpdateDisp
	{
		// text nodes don't have sub-nodes
		return VNUpdateDisp.getStockValue( this.text !== (newVN as TextVN).text, false);
	}



	// Commits updates made to this node to DOM.
	public commitUpdate( newVN: VN): void
	{
		this.textNode.nodeValue = this.text = (newVN as TextVN).text;

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Text, StatsAction.Updated);
		/// #endif
	}
}



