import {ITextVN} from "../api/mim"
import {VN} from "../internal"

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
	public get textNode(): Text { return this.ownDN as Text }



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



	/**
     * Requests update of the text.
     */
    requestTextUpdate( text: string): void
    {
        this.textToUpdate = text;
        this.requestPartialUpdate();
    }



    // Creates and returns DOM node corresponding to this virtual node.
	public mount(): void
	{
		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Text, StatsAction.Added);
		/// #endif

		this.ownDN = document.createTextNode( this.text);
	}



    /// #if USE_STATS
        // Cleans up the node object before it is released.
        public unmount(): void
        {
            DetailedStats.stats.log( StatsCategory.Text, StatsAction.Deleted);
        }
    /// #endif



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: TextVN): boolean
	{
        if (this.text !== newVN.text)
        {
            this.ownDN.nodeValue = this.text = newVN.text;

            /// #if USE_STATS
                DetailedStats.stats.log( StatsCategory.Text, StatsAction.Updated);
            /// #endif
        }

		// text nodes don't have sub-nodes
		return false;
    }



    // This method is called if the node requested a "partial" update. Different types of virtual
    // nodes can keep different data for the partial updates; for example, ElmVN can keep new
    // element properties that can be updated without re-rendering its children.
    public performPartialUpdate(): void
    {
        if (this.text !== this.textToUpdate)
        {
            this.ownDN.nodeValue = this.text = this.textToUpdate;
            this.textToUpdate = undefined;

            /// #if USE_STATS
                DetailedStats.stats.log( StatsCategory.Text, StatsAction.Updated);
            /// #endif
        }
    }



    // Text to update the node using the partial update mechanism
    private textToUpdate: string;
}


