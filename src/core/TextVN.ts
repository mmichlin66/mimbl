import {ITextVN, TickSchedulingType} from "../api/mim"
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
    setText( text: string, schedulingType?: TickSchedulingType): void
    {
        if (text === this.text)
            return;

        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            this.ownDN.nodeValue = this.text = text;
        else
        {
            this.textForPartialUpdate = text;
            super.requestPartialUpdate();
        }
    }



    // Creates and returns DOM node corresponding to this virtual node.
	public mount(): void
	{
		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Text, StatsAction.Added);
		/// #endif

		this.ownDN = document.createTextNode( this.text);
	}



/// #if USE_STATS
    // Cleans up the node object before it is released.
    unmount(): void
    {
        DetailedStats.log( StatsCategory.Text, StatsAction.Deleted);
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
                DetailedStats.log( StatsCategory.Text, StatsAction.Updated);
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
        this.ownDN.nodeValue = this.text = this.textForPartialUpdate;
        this.textForPartialUpdate = undefined;

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Text, StatsAction.Updated);
        /// #endif
    }



    // Text waiting for the partial update operation
    private textForPartialUpdate: string;
}


// Define methods/properties that are invoked during mounting/unmounting/updating and which don't
// have or have trivial implementation so that lookup is faster.

/// #if !USE_STATS
    TextVN.prototype.unmount = undefined;
/// #endif

TextVN.prototype.render = undefined;
TextVN.prototype.isUpdatePossible = undefined; // this mens that update is always possible
TextVN.prototype.didUpdate = undefined;
TextVN.prototype.ignoreUnmount = false;


