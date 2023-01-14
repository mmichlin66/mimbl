import * as mim from "mimbl";


/**
 * Type to use for the `resizeObserver` custom attribute:
 * - ResizeObserverCallback - a new ResizeObserver will be created for this element
 * - ResizeObserver - a preexisting ResizeObserver object would be used to observe the element
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



	constructor(elmVN: mim.IElmVN, attrVal: ResizeObserverAttrType, attrName: string)
	{
		this.elm = elmVN.elm as HTMLElement;

        if (attrVal instanceof ResizeObserver)
            this.observer = attrVal;
        else
            this.observer = new ResizeObserver(attrVal);

        this.observer.observe(this.elm)
	}

	public terminate( isRemoval: boolean): void
	{
        this.observer.unobserve(this.elm)
	}

	public update( newAttrVal: ResizeObserverAttrType): boolean
	{
		return true;
	}
}



// Register our handler class
mim.registerCustomAttribute( "resizeObserver", ResizeObserverHandler);



function resizer(entries: ResizeObserverEntry[]): void
{
    let size = entries[0]?.contentBoxSize?.[0];
    if (!size)
        return;

    let elm = entries[0]?.target as unknown as ElementCSSInlineStyle;
    elm.style.backgroundColor = `hsl(${size.blockSize + size.inlineSize}deg 50% 50%)`;
}

export class MyComponent extends mim.Component
{
    render(): any
    {
        return <div style={{display: "flex", flexDirection: "column", gap: 8}}>
            <span>The box wll change color when resized</span>
            <div resizeObserver={resizer}
                style={{height: 200, width: 200, resize: "both", overflow: "auto", border: [1, "solid"]}} />
        </div>;
    }
}



// Mount our component under the body element.
mim.mount( new MyComponent());


