import {DN, ITextVN, TickSchedulingType} from "../api/CompTypes"
import { ITrigger } from "../api/TriggerTypes";
import { VNDisp } from "./VNTypes";

/// #if USE_STATS
import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { VN } from "./VN";



/**
 * Represents a text node.
 */
export class TextVN extends VN implements ITextVN
{
	// Text for a simple text node.
	public text: string | ITrigger<string>;

	// Text DOM node
	public get textNode(): Text | null { return this.ownDN; }



	constructor(text: string | ITrigger<string>)
	{
		super();
		this.text = text;
	}



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
    setText(text: string | ITrigger<string>, schedulingType?: TickSchedulingType): void
    {
        if (text !== this.text)
        {
            this.newText = this.updateText(text);
            super.requestUpdate(schedulingType);
        }
    }



	/**
     * Recursively inserts the content of this virtual node to DOM under the given parent (anchor)
     * and before the given node.
     */
    public mount(parent: VN, index: number, anchorDN: DN, beforeDN: DN): void
    {
        super.mount( parent, index, anchorDN);

        // the text can actually be a trigger and we need to listen to its changes then
        let text = this.text;
        if (typeof text === "object")
        {
            this.onChange = this.onTriggerChanged.bind(this);
            text.attach(this.onChange!);
            text = text.get();
        }

        this.ownDN = document.createTextNode(text);
        anchorDN!.insertBefore(this.ownDN, beforeDN);

        /// #if USE_STATS
        DetailedStats.log(StatsCategory.Text, StatsAction.Added);
        /// #endif
    }



    /**
     * Cleans up the node object before it is released.
     */
    public unmount(removeFromDOM: boolean): void
    {
        if (removeFromDOM)
        {
            this.ownDN?.remove();

            /// #if USE_STATS
            DetailedStats.log(StatsCategory.Text, StatsAction.Deleted);
            /// #endif
        }

        // the onChange is non-null only if this.text is a trigger
        if (this.onChange)
            (this.text as ITrigger).detach(this.onChange);

		this.ownDN = null;
        super.unmount(removeFromDOM);
    }



    /**
     * This method is called if the node requested an update. Text node updates the DOM node value
     * to the remembered text value.
     */
    public update(): void
    {
        this.ownDN!.nodeValue = this.newText!;
        this.newText = undefined;

        /// #if USE_STATS
        DetailedStats.log(StatsCategory.Text, StatsAction.Updated);
        /// #endif
    }



	/**
     * Determines whether the update of this node from the given node is possible. The newVN
     * parameter is guaranteed to point to a VN of the same type as this node. Text nodes don't
     * implement this method - it is set to undefined in the class prototype below.
     */
	canReconcile?(newVN: VN): boolean;



	/**
     * Recursively updates this node from the given node. This method is invoked only if update
     * happens as a result of rendering the parent nodes. Text node updates the DOM node value
     * from the text value from the new virtual node.
     */
	public reconcile(newVN: TextVN, disp: VNDisp): void
	{
        if (this.text !== newVN.text)
        {
            this.ownDN!.nodeValue = this.updateText(newVN.text);

            /// #if USE_STATS
            DetailedStats.log(StatsCategory.Text, StatsAction.Updated);
            /// #endif
        }
    }



	// Update the text field and returns the new text value to be set as the node's value.
	private updateText(text: string | ITrigger<string>): string
	{
        // the onChange is non-null only if this.text is a trigger
        let onChange = this.onChange;
        if (onChange)
            (this.text as ITrigger).detach(onChange);

        this.text = text;

        if (typeof text === "object")
        {
            if (!onChange)
                this.onChange = onChange = this.onTriggerChanged.bind(this);

            text.attach(onChange!);
            return text.get();
        }
        else
        {
            if (onChange)
                this.onChange = undefined;
            return text;
        }
    }



    /**
     * Function reacting on the value change in the trigger.
     */
    private onTriggerChanged(s: string): void
    {
        this.ownDN!.nodeValue = s;
    }



    // Text DOM node
    public declare ownDN: Text | null;

    // Text waiting for the partial update operation
    private newText?: string = undefined;

    // Bound method reacting on the value change in the trigger. It is created only if the node
    // value is a trigger and not just text.
    private onChange?: (s: string) => void = undefined;
}


// Define methods/properties that are invoked during mounting/unmounting/updating and which don't
// have or have trivial implementation so that lookup is faster.

TextVN.prototype.canReconcile = undefined; // this means that update is always possible



