import * as mim from "./mim"
import {DN, VN, VNUpdateDisp} from "./VN"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "./Stats"
/// #endif



/**
 * Represents a text node.
 */
export class TextVN extends VN implements mim.ITextVN
{
	constructor( text: string)
	{
		super( mim.VNType.Text)

		this.text = text;

		// node name is #text
		this.name = "#text";
	};



	public get Text(): string { return this.text; }
	public get TextNode(): Text { return this.dn; }



/// #if USE_STATS
	public getStatsCategory(): StatsCategory { return StatsCategory.Text; }
/// #endif



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// If the node never has any children (like text nodes), it should return false.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount(): boolean
	{
		// text nodes don't have children
		return false;
	}

	// Inserts the virtual node's content into DOM.
	// This method is part of the Commit phase.
	public mount(): void
	{
		this.dn = document.createTextNode( this.text);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Text, StatsAction.Added);
		/// #endif
	}



	// Removes content from the DOM tree.
	// This method is part of the Commit phase.
	public unmount(): void
	{
		this.dn = undefined;

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Text, StatsAction.Deleted);
		/// #endif
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: VN): boolean
	{
		// one text node can always update another text node
		return true;
	}



	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	public prepareUpdate( newVN: VN): VNUpdateDisp
	{
		// text nodes don't have sub-nodes
		return { shouldCommit: this.text !== (newVN as TextVN).text, shouldRender: false };
	}



	// Commits updates made to this node to DOM.
	public commitUpdate( newVN: VN): void
	{
		this.dn.nodeValue = this.text = (newVN as TextVN).text;

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Text, StatsAction.Updated);
		/// #endif
	}



	public getOwnDN(): DN
	{
		return this.dn;
	}



	// Text for a simple text node.
	text: string;

	// Text DOM node
	dn: Text;
}



