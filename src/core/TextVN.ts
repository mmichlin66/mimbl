import {IComponent, ITextVN, TickSchedulingType} from "../api/mim"
import {DN, VN, VNDisp} from "../internal"

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
	public get textNode(): Text { return this.ownDN; }



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



	/**
     * Recursively inserts the content of this virtual node to DOM under the given parent (anchor)
     * and before the given node.
     */
    public mount( creator: IComponent, parent: VN, index: number, anchorDN: DN, beforeDN?: DN | null): void
    {
        super.mount( creator, parent, index, anchorDN);

        this.ownDN = document.createTextNode( this.text);
        anchorDN.insertBefore( this.ownDN, beforeDN);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Text, StatsAction.Added);
        /// #endif
    }



    // Cleans up the node object before it is released.
    public unmount( removeFromDOM: boolean): void
    {
        if (removeFromDOM)
            this.ownDN.remove();

		this.ownDN = null;

        super.unmount( removeFromDOM);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Text, StatsAction.Deleted);
        /// #endif
    }



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: TextVN, disp: VNDisp): void
	{
        if (this.text !== newVN.text)
        {
            this.ownDN.nodeValue = this.text = newVN.text;

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Text, StatsAction.Updated);
            /// #endif
        }
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



    // Text DOM node
    public declare ownDN: Text;

    // Text waiting for the partial update operation
    private textForPartialUpdate: string;
}


// Define methods/properties that are invoked during mounting/unmounting/updating and which don't
// have or have trivial implementation so that lookup is faster.

TextVN.prototype.render = undefined;
TextVN.prototype.isUpdatePossible = undefined; // this means that update is always possible


