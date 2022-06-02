---
layout: mimbl-guide
unit: 2
title: "Mimbl Guide: Rendering HTML Content"
---

# Mimbl Guide: Rendering HTML Content
The ultimate goal of any Web UI library is to produce HTML content and make it easy for developers. Mimbl mostly relies on JSX for laying out the HTML structure; however, it can also work with regular JavaScript types such as strings, numbers, arrays and objects.

There are several places in Mimbl that accept content to be converted to HTML:

- first parameter of the `mim.mount` function
- return value of functional components
- return value of the `render` method of class-based components

In all these places, developers can use either JSX expressions or any other JavaScript type; in fact these parameters and return values have the TypeScript type of `any`. In this unit we will use the `mim.mount` function for demonstration, but all the concepts are applicable to all other cases where HTML content is produced.

Here are a few examples of producing HTML content:

```tsx
mim.mount( "Hello World!");
// produces a single Text node with the "Hello World!" string

mim.mount( 25);
// produces a single Text node with the "25" string

mim.mount( true);
mim.mount( false);
mim.mount( null);
mim.mount( undefined);
// each of the above calls doesn't produce any HTML content

mim.mount( new Date());
// produces a single Text node with the string representation of the current date-time

mim.mount( [1,2]);
// produces two text nodes with strings "1" and "2"

mim.mount( { a: 1, b: 2});
// produces a single Text node with the "[object Object]" string (default toString() for objects)

mim.mount( <h1>Hello World!</h1>);
// produces <h1> element with the "Hello World!" string (text node)

function foo() { return <div>Hello</div>; }
mim.mount( foo);
// Produces a <div> element with the "Hello" string (text node)

function Foo() { return <div>Hello</div> }
mim.mount( <Foo/>);
// Produces a <div> element with the "Hello" string (text node) - Foo is a functional component in a JSX expression
```

The above examples demonstrate the rules that Mimbl uses when producing HTML from the content provided to it. The following sections will discuss these rules in more detail and will provide more involved examples.

## JavaScript Types
Mimbl produces HTML content according to the following rules:

- `true`, `false`, `null` and `undefined` are ignored - no HTML content is created for them.
- Strings are used as is and produce HTML text nodes. Empty strings don't produce HTML content.
- Numbers are converted to strings using the standard JavaScript rules.
- Arrays are iterated over and HTML content is created separately for each item. If an item is itself an array, the process continues recursively. For example, an array `[1, [2,3], 4]` will be treated the same way as array `[1,2,3,4]`.
- Objects that are instances of a class derived from `Component` are treated as component instances: their `render` method is invoked by the Mimbl rendering mechanism and its return value is used to produce HTML content.
- Other objects are converted to strings using the `toString` method. Objects that don't override the default implementation of the `toString` method are converted to the `[object Object]` string.
- Promises are watched by the Mimbl rendering mechanism and their resolved values are used to produce HTML content. While a promise is pending, no HTML content is produced. If the promise is rejected, an exception is thrown, which bubbles up the component chain until there is a component that knows to handle it.
- Functions are called by the Mimbl rendering mechanism without parameters and their return values are used to produce HTML content. Using functions has some benefits and is described in more details in the unit [Partitioned Components](partitioned-components.html).

## JSX Expressions
This section provides a brief description of JSX as it pertains to Mimbl. The detailed description of JSX can be found in the [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/jsx.html).

A JSX expression is an HTML-like construct that is type-checked and parsed by the TypeScript compiler into a call to a JSX factory function. A JSX expression consists of a single "root" JSX element with arbitrary number of children. Children can be either JSX expressions or strings or any other JavaScript type. A JSX element has an opening tag in the form `<tag>` and a closing tag in the form `</tag>`. If a JSX element doesn't have children it can use only an opening tag in the form `<tag/>`.

A JSX element can have an arbitrary number of *attributes* in the form `<tag name=value>`. Attribute values can be of any type: strings, numbers, Booleans, objects or even JSX expressions. Strings can be specified directly (using single or double quotes), while other types should be enclosed within curly braces. If only a name is specified for an attribute (as in `<tag attr/>`) the attribute's value is set to `true`. As opposed to regular HTML content, `false` and `null` are treated as normal attribute value. Attributes with the `undefined` value, however, are ignored - it is the same as not specifying the attribute at all.

JSX is perfectly suited to laying out HTML structure - here is an example:

```tsx
mim.mount( <div>
    <h1>Title</h1>
    <form>
        <label for="txt1">Label</label>
        <input type="text" id="txt1" value={15} autocomplete />
    </form>
</div>);
```

When we use curly braces within a JSX expression, we can put any JavaScript expression within it. The value of this expression will become part of the JSX expression. This can be used to put values of variables or results of function calls into JSX and it can also be used to compose JSX in chunks. For example, we could rewrite the previous example in a more modular form:

```tsx
function getRandomValue(): number { return Math.round(Math.random()) * 1000};

let title = "Title";
let id = "txt1";
let label = <label for={id}>Label</label>;
let input = <input type="text" id={id} value={getRandomValue()} autocomplete />;

mim.mount( <div>
    <h1>{title}</h1>
    <form>
        {label}
        {input}
    </form>
</div>);
```

So far we used HTML element names for JSX tag names. Note that we only used lowercase names. If a JSX tag starts with the uppercase letter, Mimbl will treat it as a component. All the JSX rules apply to components just as they apply to HTML elements. For example, we can have a functional component `Sum` and use it in JSX:

```tsx
type SumProps = { first: number; second: number; }

function Sum( props: SumProps): any { return props.first + props.second; };

let a = 5;
let b = 7;

mim.mount( <div>
    {`Sum of ${a} and ${b} is: `}
    <Sum first={a} second={b} />
</div>);
```

## Fragments
A JSX expression must have a single root; that is, the following code is invalid:

```tsx
// !!! This code doesn't compile !!!
mim.mount( <div>First Element</div> <div>Second Element</div>);
```

This can be an impediment when we assemble HTML from different fragments in our code. Note that surrounding multiple JSX expressions with an extra `<div>` or another element is not always possible. For example, some CSS styles are applied on child elements (e.g. flex box styles) and having an extra element produces wrong results.

One solution is to use an array as in the following example:

```tsx
mim.mount( [ <div>First Element</div>, <div>Second Element</div> ]);
```

This works but it visually breaks the JSX visual flow - the code doesn't resemble HTML anymore.

Starting from version 4.0.0, TypeScript supports a very convenient syntax in the form of a *fragment*, which is an empty JSX element. A fragment starts with `<>` and ends with `</>`. This syntax is very intuitive and is widely used with React. For example, the following code works:

```tsx
mim.mount( <>
    <div>First Element</div>
    <div>Second Element</div>
</>);
```

The earlier versions of TypeScript don't currently support this syntax when a custom JSX factory is used. In this case, Mimbl provides a component that serves the sole purpose of combining multiple JSX expressions into a group without inserting any extra element into the resultant HTML. Unsurprisingly, the component is called `mim.Fragment` and is used as in the following example:

```tsx
mim.mount( <mim.Fragment>
    <div>First Element</div>
    <div>Second Element</div>
</mim.Fragment>);
```


## References
References are objects of types `mim.Ref<T>` holding direct references to either a DOM element or a component instance. The generic type `T` corresponds to the type of the element or the component. References are created using the `new` operator and are initially empty. Reference instances are passed as values of the `ref` attribute in JSX and, after the content is rendered, the reference is filled in. From that moment on, the `r` property of the reference object points to the DOM element or the component instance. Here is an example:

```tsx
class Focus extends mim.Component
{
    private inputRef = new mim.Ref<HTMLInputElement>();

    public render(): any
    {
        return <div>
            <button click={this.onSetFocus}>Set Focus</button>
            <br/>
            <input type="text" ref={this.inputRef} />
        </div>
    }

    private onSetFocus(): void
    {
        this.inputRef.r.focus();
    }
}
```

Mimbl supports the `@ref` decorator that also creates a reference but allows for a more straightforward syntax. Here is the same code using the `@ref` decorator:

```tsx
class Focus extends mim.Component
{
    @ref private inputRef: HTMLInputElement;

    public render(): any
    {
        return <div>
            <button click={this.onSetFocus}>Set Focus</button>
            <br/>
            <input type="text" ref={this.inputRef} />
        </div>
    }

    private onSetFocus(): void
    {
        this.inputRef.focus();
    }
}
```

Note that we declare our `inputRef` property directly as of type `HTMLInputElement` and use it as such in the `onSetFocus` method - there is no `r` property. Also note that we don't assign any value to this property. Behind the scenes, Mimbl creates a `Proxy` object, which points to the actual HTML element and delegates all calls to it.

References are usually needed when there is no good way to perform a desired task in a declarative manner, for example, setting focus to an element or measuring the size of an element. The `ref` attribute is applicable to any type of DOM elements as well as any managed component. References are not used for independent components because the instance of the independent component is available directly.

There are times when a component that created a `mim.Ref` object wants to be notified when the reference is filled in, cleared or its value changes. The `mim.Ref` object allows providing a callback that will be invoked every time the value of the reference changes in any way. The callback can either be provided as a first parameter in the `mim.Ref` constructor or passed in the call to the `addListener` method. When no longer needed, the callback can be removed by calling the `removeListener` method. Note that when the reference is defined using the `@ref` decorator, the `addListener` and `removeListener` methods are not available.

## Element and Component Lists
It is a common task for Web developers to represent collections of same-type structures. This is modeled by an element having multiple sub-elements or a parent component rendering a list of child components. Such lists change when items are added to or removed from the list or when the order of items in the list changes. In order to properly update DOM when an item list changes, the first task Mimbl has to do is to match items from a newly rendered list to those in the existing list. Based on this matching, Mimbl understands what items should be destroyed or inserted or simply updated. The matching algorithm should figure out an item identity for the matching to be accurate and that identity should be unique among the items under the same parent.

Mimbl allows developers to specify *keys* when elements and components are rendered. A key is a built-in property (of `any` type) that can be specified for any element as well as managed and functional components. For proper matching, keys for all items under the same parent (another component or DOM element) must be unique. In many cases, choosing a unique key for an item is not difficult because it may reflect some unique property of a data element that the item represents. There are cases, however, when there is no such property and the keys should be actively managed by the parent component to be created and remain unique.

## CSS and Styles
Mimbl uses the [Mimcss](https://mmichlin66.github.io/mimcss/guide/introduction.html) library for defining and using styles.

CSS classes can be specified using properties from Mimcss Style Definition classes; for example:

```tsx
// Define styles for our component
class MyStyles extends css.StyleDefinition
{
    blue = this.$class({ color: css.Colors.blue })
}

let styles = css.activate( MyStyles);

render()
{
    // specify class by using the property of our style definition class
    return <div class={styles.blue}>
        Hello World!
    </div>
}
```

Of course class names can be specified as regular strings too. Moreover, in situations when there is a need to combine several classes for a single element, strings and style definition properties can be mixed; for example:

```tsx
render()
{
    return <div class={[styles.blue, "bold"]}>
        Hello World!
    </div>
}
```

The `id` property of an element can also be specified as either a regular string or a property from a style definition class (instead of `this.$class` the `this.$id` function must be used).

The `style` property is specified as an object whose type is defined by Mimcss. This object contains all the CSS properties in their lowerCamel case. Every property has a defined type, so some can be specified as strings others as numbers, yet others as arrays, tuples, functions, objects or a combination of all the above. For dimensional properties such as length and angle, values can be specified as a number, in which case the default prefix corresponding to the type will be appended. The default prefix also depends on whether the number is integer or floating point.

```tsx
render()
{
    return <div style={ {padding: 4, margin: [4, 0.5, "auto"], filter: css.greyscale( 0.8) } }>
        Hello World!
    </div>
}
```





