import * as mim from "mimbl";
import * as css from "mimcss";


/**
 * Type to use for the `resizeObserver` custom attribute:
 * - ResizeObserverCallback - a new ResizeObserver with the given callback will be created to
 *   observe this element
 * - ResizeObserver - a preexisting ResizeObserver object with its own callback will be used
 *   to observe the element
 */
export type ResizeObserverAttrType = ResizeObserver | ResizeObserverCallback;



// Augment the IHtmlElementAttrs interface so that the resizeObserver attribute can
// be specified for any HTML element
declare module "mimbl"
{
	interface IHtmlElementAttrs
	{
        resizeObserver?: ResizeObserverAttrType
	}
}



// Define handler for our custom attribute
class ResizeObserverHandler implements mim.ICustomAttributeHandler<ResizeObserverAttrType>
{
	/** Element under our control */
	private elm: HTMLElement;

	/** ResizeObserver object used to observe our element */
	private observer: ResizeObserver;

    // Constructor is called when the element is mounted
	constructor(elmVN: mim.IElmVN, attrVal: ResizeObserverAttrType, attrName: string)
	{
		this.elm = elmVN.elm as HTMLElement;

        if (attrVal instanceof ResizeObserver)
            this.observer = attrVal;
        else
            this.observer = new ResizeObserver(attrVal);

        this.observer.observe(this.elm)
	}

    // This method is called when either the element is unmounted or when the element
    // doesn't have the resizeObserver attribute anymore
	public terminate(isRemoval: boolean): void
	{
        this.observer.unobserve(this.elm)
	}

    // This method is called if the element is updated (which may bring a new value or have the same
    // value for the custom attribute)
	public update(newAttrVal: ResizeObserverAttrType): void
	{
        // if the attribute value didn't change we don't need to change anything
        if (this.observer === newAttrVal)
            return;

        // if the attribute value did change, we need to discard the old observer and create
        // a new one
        this.observer.unobserve(this.elm);

        if (newAttrVal instanceof ResizeObserver)
            this.observer = newAttrVal;
        else
            this.observer = new ResizeObserver(newAttrVal);

        this.observer.observe(this.elm)
	}
}



// Register our handler class
mim.registerCustomAttribute( "resizeObserver", ResizeObserverHandler);



// Define callback passed to the resizeObserver property. This implementation will use
// the sum of width and height element as a number of degrees in the HSL color space.
// The resulting color is set as the element's background color.
function colorResizer(entries: ResizeObserverEntry[]): void
{
    let size = entries[0]?.contentBoxSize?.[0];
    if (!size)
        return;

    let elm = entries[0]?.target as unknown as ElementCSSInlineStyle;
    elm.style.$.backgroundColor = css.hsl(css.deg(size.blockSize + size.inlineSize), 50, 50);
}



// Define callback passed to the resizeObserver property. This implementation will use
// the height of the element to set the element's font size.
function fontResizer(entries: ResizeObserverEntry[]): void
{
    let size = entries[0]?.contentBoxSize?.[0];
    if (!size)
        return;

    let elm = entries[0]?.target as unknown as ElementCSSInlineStyle;
    elm.style.fontSize = `${size.blockSize / 1.5}px`;
}



// Define our component that renders `<div>` and `<textarea>` elements with resizeObserver custom
// attributes
export class MyComponent extends mim.Component
{
    render(): any
    {
        return <div style={{display: "flex", flexDirection: "column", gap: 8}}>
            <span>The box will change color when resized</span>
            <div resizeObserver={colorResizer}
                style={{height: 200, width: 200, resize: "both", overflow: "auto", border: [1, "solid"]}} />
            <div/>
            <br/>
            <span>The textarea box will have its font size changed when resized</span>
            <textarea resizeObserver={fontResizer} style={{height: 20, width: 500, resize: "both", overflow: "auto"}}>
                The font size should change when you resize this box
            </textarea>
            <br/>
            <span>The box will change color when the viewport width changes</span>
            <div resizeObserver={colorResizer}
                style={{height: 200, width: "100%", border: [1, "solid"]}} />
            <div/>
        </div>
    }
}



// Mount our component under the body element.
mim.mount( new MyComponent());


