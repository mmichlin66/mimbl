---
layout: mimbl-guide
unit: 5
title: "Mimbl Guide: Custom Attributes"
---

# Custom Attributes
A unique Mimbl feature is the ability to implement custom element attributes. As their name implies, custom element attributes are attributes that can be directly applied to the JSX representation of HTML and SVG elements and that have associated JavaScript code executing the custom functionality at run-time. The code is provided in the form of Custom Attribute Handlers - classes that are registered to implement functionality for named attributes. The consumers of custom attributes specify the named attributes in JSX representation of HTML or SVG elements in the same way they specify standard attributes.

## Use Case
Let's assume that we want to periodically change the border color of any focused input field if the user didn't enter anything into the field for the last 5 seconds. In React, this would be accomplished by creating a component that would accept an element as a child. The component will have to specify that it can only accept a single child and that the type of the child must be the HTMLInputElement class. Then the component will have to render the element and obtain a reference to it. In addition, the component will have to expose as properties all the standard attributes of input elements and pass them on to the element during rendering. The consumer of a component will have to use it whenever an input element is needed. That's a lot of boilerplate code in addition to the code that actually implements the desired functionality. Imagine now that the same functionality should be implemented for the `textarea` and `select` elements. Since `textarea` and `select` elements are not `input` elements and have some unique attributes, the boilerplate code will have to be repeated over and over again.

Custom attributes provide an alternative way of implementing the desired functionality with a lot less boilerplate code. With this approach, we can define a new attribute name - let's call it `borderBlink` - and indicate that it can be applied on all input elements. We define a type of data that this attribute can take: it can be any TypeScript's type like string or Boolean or object or union, or any other type. We then write a *custom attribute handler* that implements the functionality for this attributes. Then, we can use this attribute just like any other attribute on the appropriate elements.

First we need to define the type that this attribute will take. We on purpose make the type very flexible (and complex) to showcase the power of custom attributes. This will make our implementation more involved; however, it will make the life of the developers using this attribute easier.

```tsx
/**
 * Type to use for the `borderBlink custom attribute:
 * - true means do blinking with default parameters: "red" color and 5 seconds delay
 * - string is for color
 * - number is for delay in seconds
 * - object notation should be self-explanatory
 */
type BorderBlinkType = true | string | number | BorderBlinkObjType |
				[string, number] | [number, string];
type BorderBlinkObjType = { color?: string; delay?: number };
```

Next, we need to satisfy the TypeScript JSX type-checking mechanism so that it will allow us to specify this attribute on the HTML `<input>` elements. This is accomplished using the TypeScript's module augmentation technique. Mimbl includes interfaces that define properties for all HTML and SVG elements. The module that defines HTML element interfaces is `HtmlTypes.d.ts` that lives under `lib/core/` directory of the `mimbl` directory under `node_modules`. Therefore, the module path we need to use for augmentation is `mimbl/lib/core/HtmlTypes`. The following code adds the new `borderBlink` attribute to the `IHtmlInputElementProps` interface:

```tsx
declare module "mimbl/lib/core/HtmlTypes"
{
    // define the custom attribute as applicable to any input element
    interface IHtmlInputElementProps
    {
        borderBlink?: BorderBlinkType;
    }
}
```
With the above code, TypeScript will allow us to write JSX that specifies `borderLink` attribute for `<input>` elements:

```tsx
<input type="text" borderBlink={ {color: "blue", delay: 5} }></input>
```

If we want to have the same functionality applied to the `textarea` and `select` elements, we just add the definition of the custom attribute under the corresponding interfaces:

```tsx
declare module "mimbl/lib/core/HtmlTypes"
{
    interface IHtmlTextareaElementProps
    {
        borderBlink?: BorderBlinkType;
    }

    interface IHtmlSelectElementProps
    {
        borderBlink?: BorderBlinkType;
    }
}
```

Note that the new `borderBlink` attribute is declared as optional; overwise, we would have to specify it for every input element! The module augmentation technique allows using the TypeScript's JSX type-checking mechanism to enforce the correct application of this attribute to the input elements. This will also prohibit applying this attribute to non-input elements:

```tsx
<span borderBlink={ {color: "blue"} } />                // ERROR!!! not an input element
<input type="text" borderBlink={ {colour: "blue"} } />  // ERROR!!! incorrect property name in object notation
<input type="text" borderBlink={ ["red", 5, true] } />  // ERROR!!! incorrect number of items in array
```

Now we need to write the code that will handle our custom attribute in the form of a handler class that implements the `ICustomAttributeHandler` interface.

```tsx
class BorderBlinkHandler implements mim.ICustomAttributeHandler<BorderBlinkType>
{
    constructor( elmVN: mim.IElmVN, propVal: BorderBlinkType)
    {
        // parse property value and determine color and delay parameters
        // attach to element events
        // establish user idleness timer
    }

    public terminate( isRemoval: boolean): void
    {
        // terminate user idleness timer
        // detach from element events
    }

    public update( newPropVal: BorderBlinkType): boolean
    {
        // parse new property value and determine color and delay parameters
        // change border color and delay values if necessary
    }
}
```

Module augmentation only makes the new attribute available to the TypeScript type-checking mechanism but to make this attribute available at run-time and to map our handler class to the attribute, we need to register it with the attribute's name:

```tsx
mim.registerCustomAttribute( "borderBlink", BorderBlickHandler);
```

## Custom Attribute Handler Life Cycle
The life cycle of custom attribute handlers is somewhat similar to that of components: they are created, go through possible updates and eventually destroyed. The difference is that custom attribute handlers only deal with a single value - although that can be of a complex type as we saw above.

When the element with the applied custom attribute is rendered for the first time, the handler is created. The constructor accepts the Virtual Node corresponding to the element as well as the initial value of the attribute. From the virtual node, the DOM element can be retrieved. The optional third parameter specifies the name of the custom attribute. This allows having the same handler class serving different attributes - probably with similar but slightly different functionality. If the handler only serves a single custom attribute, this parameter can be omitted.

When the parent of the element is re-rendered it can pass the same or a different value to the custom attribute. In this case the `update` method will be called and provide the new value. The handler is responsible to act on any changes to the attribute value. If needed, the handler can remember the previous value from constructor and from previous updates or it can rely on the information it extracts from the value. For example, in our `borderBlink` example, we extracted the color and the delay interval from the attribute value.

When the element's parent renders it without applying the custom attribute or before the element is removed from DOM, the `terminate` method is invoked. The handler is responsible to clean up its resources to avoid leaks. The `terminate` method has the `isRemoval` parameter, which is set to `true` if the element is being removed and to `false` if the element is still there but the custom attribute is no longer applied. This parameter can be used to determine what clean up actions are needed: for example, there is no need to remove event listeners from the element if the element is being removed.

The handler is free to manipulate the element in any way as well as create, remove and manipulate other DOM elements. For example, in our case, the handler would have to attach to the element's `input`, `focus` and `blur` events and establish a timer to wait for user idleness.

## Conclusion
Custom attributes are well suited for tasks that on one hand don't fit well to the declarative nature of HTML layout and on the other hand can be applicable to a wide class of HTML or SVG elements. Just like CSS animations, custom attributes allow declarative specification of rather complex run-time behavior.

