import {IComponent, ITextVN, TickSchedulingType} from "../api/mim"
import {DN, ITrigger, VN, VNDisp} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



/**
 * Represents a text node.
 */
export class TextVN extends VN implements ITextVN
{
	// Text for a simple text node.
	public text: string | ITrigger<string>;

	// Text DOM node
	public get textNode(): Text { return this.ownDN; }



	constructor( text: string | ITrigger<string>)
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
    setText( text: string | ITrigger<string>, schedulingType?: TickSchedulingType): void
    {
        if (text === this.text)
            return;

        let val = this.updateText(text);
        if (schedulingType === TickSchedulingType.Sync)
            this.ownDN.nodeValue = val;
        else
        {
            this.textForPartialUpdate = val;
            super.requestPartialUpdate( schedulingType);
        }
    }



	/**
     * Recursively inserts the content of this virtual node to DOM under the given parent (anchor)
     * and before the given node.
     */
    public mount( creator: IComponent, parent: VN, index: number, anchorDN: DN, beforeDN?: DN | null): void
    {
        super.mount( creator, parent, index, anchorDN);

        // the text can actually be a trigger and we need to listen to its changes then
        let val: string;
        if (typeof this.text === "object")
        {
            val = this.text.get();
            this.onChange = onTriggerChanged.bind(this);
            this.text.attach( this.onChange);
        }
        else
            val = this.text;

        this.ownDN = document.createTextNode( val);
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

        if (typeof this.text === "object")
            this.text.detach( this.onChange);

        super.unmount( removeFromDOM);

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Text, StatsAction.Deleted);
        /// #endif
    }



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node.
	public update( newVN: TextVN, disp: VNDisp): void
	{
        if (this.text !== newVN.text)
        {
            this.ownDN.nodeValue = this.updateText( newVN.text);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Text, StatsAction.Updated);
            /// #endif
        }
    }

	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	private updateText( text: string | ITrigger<string>): string
	{
        if (typeof this.text === "object")
            this.text.detach( this.onChange);

        this.text = text;

        let val: string;
        if (typeof text === "object")
        {
            if (!this.onChange)
                this.onChange = onTriggerChanged.bind(this);
            text.attach( this.onChange);
            val = text.get();
        }
        else
            val = text;

        return val;
    }



    // This method is called if the node requested a "partial" update. Text virtual node keeps
    // string value to set as node value.
    public performPartialUpdate(): void
    {
        this.ownDN.nodeValue = this.textForPartialUpdate;
        this.textForPartialUpdate = undefined;

        /// #if USE_STATS
            DetailedStats.log( StatsCategory.Text, StatsAction.Updated);
        /// #endif
    }



    // Text DOM node
    public declare ownDN: Text;

    // Text waiting for the partial update operation
    public textForPartialUpdate: string;

    // Bound method reacting on the value change in the trigger. It is created only if the node
    // value is a trigger and not just text.
    private onChange: (s: string) => void;
}


// Define methods/properties that are invoked during mounting/unmounting/updating and which don't
// have or have trivial implementation so that lookup is faster.

TextVN.prototype.render = undefined;
TextVN.prototype.isUpdatePossible = undefined; // this means that update is always possible



/**
 * Function reacting on the value change in the trigger. This function gets bound to the instance
 * of the TextVN class; therefore, it can use "this".
 */
function onTriggerChanged( this: TextVN, s: string): void
{
    this.textForPartialUpdate = s;
    this.requestPartialUpdate();
}



