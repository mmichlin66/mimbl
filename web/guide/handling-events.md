---
layout: mimbl-guide
unit: 3
title: "Mimbl Guide: Handling Events"
---

# Mimbl Guide: Handling Events
Mimbl allows developers to attach functions to DOM Element events so that when an event occurs the function is invoked. Although the concept is very simple, there are a lot of caveats and nuances involved:

- How do we identify events?
- Do we want to attach to a bubbling or a capturing phase of event processing?
- How do we make event handlers, which are defined as class-based component methods, to use the correct value of `this`?
- What if event handlers throw exceptions?

This unit describes the Mimbl's event handling mechanism and answers the above questions.

Note that this unit only discusses handling events of DOM elements created using JSX - usually in the context of a component's `render` method. Mimbl of course allows handling events of other objects (e.g. `window` or `document`) using the standard `addEventListener` function; however, this is discussed separately as part of the unit [Callbacks and this](callbacks-and-this.html).

### Basic Use Case
Below is a simple code of a component that has a button and a method that should be invoked when the button is clicked:

```tsx
class Hello extends mim.Component
{
    name: string;

    constructor( name: string)
    {
        super();
        this.name = name;
    }

    public render(): void
    {
        return <button click={this.onButtonClick}>Click Me</button>;
    }

    public onButtonClick( e: MouseEvent): void
    {
        console.log( "Hello to " + this.name);
    }
}

mim.mount( new Hello( "Michael"));
```

From the above code, we can immediately answer the question about how events are identified in Mimbl: events are identified by their standard names - without prefixing them with *"on"*. Behind the scenes Mimbl calls the `Element.addEventListener` function and event names are passed to it without any string manipulations.

The handler function receives as a parameter an event object with the type corresponding to the event. Mimbl wraps event handler invocations so that it can intercept exceptions, but it doesn't change event parameters in any way.

Specifying an event handler for an event as shown in the example above, attaches to the bubbling phase of the event processing. In most cases this is what developers need. If, however, the developer wants to attach to the capturing phase of the event processing, he must specify an object where the `func` property is set to the event handler function and the `useCapture` property is set to `true`:

```tsx
public render(): void
{
    return <button click={ {func: this.onButtonClick, useCapture: true} }>Click Me</button>;
}
```

### The Value of **this**
In the example above, the event handler uses the `this` keyword to refer to the instance member `name`. But wait a minute! How can it work? We all know that in JavaScript, in order for callbacks to have a correct value of `this`, they must be either defined as arrow functions or be explicitly bound to `this`. The code above does neither and still it works - how come?!

The answer is simple: Mimbl performs a small trick behind the scenes - it uses the component instance that created the element to call the event handler method. This is almost the same as binding: Mimbl just uses the `Function.apply` method instead of `Function.bind`.

But what if the event handler belongs not to the component class but to another related class? Mimbl of course cannot know that on its own but it allows developers to explicitly specify the object, to which the event handler belongs. In order to do that, developers must specify an object where the `func` property is set to the event handler function and the `funcThisArg` property is set to the object to which the handler function belongs:

```tsx
// Define interface that knows to react on the click event
interface IClickable
{
    onClick( e: MouseEvent): void;
}

// The Hello component will work with any implementation of the IClickable interface
class Hello extends mim.Component
{
    clcikable: IClickable;

    constructor( clcikable: IClickable)
    {
        super();
        this.clcikable = clcikable;
    }

    public render(): void
    {
        // the onClick event handler belongs to the object implementing the IClickable interface
        return <button click={ {func: this.clcikable.onClick, funcThisArg: this.clcikable} }>Click Me</button>;
    }
}

// The Person class implements the IClickable interface
class Person implements IClickable
{
    name: string;

    constructor( name: string)
    {
        super();
        this.name = name;
    }

    public onClick( e: MouseEvent): void
    {
        console.log( "Hello to " + this.name);
    }
}

mim.mount( new Hello( new Person( "Michael")));
```

If you want your event handler, which belongs to a separate object, to react on the capturing phase of the event processing, you must specify an object with three properties: the event handler function, the object reference and the Boolean `true` value:

```tsx
public render(): void
{
    return <button click={ {func: this.clcikable.onClick, funcThisArg: this.clcikable, useCapture: true} }>Click Me</button>;
}
```

Mimbl also supports event handlers implemented as arrow function properties or as bound methods. In this case, developers should only specify the function itself.


### Virtual Event Handlers
Event handlers can be overridden in derived classes:

```tsx
// Base class
class Hello extends mim.Component
{
    name: string;

    constructor( name: string)
    {
        super();
        this.name = name;
    }

    public render(): void
    {
        return <button click={this.onButtonClick}>Click Me</button>;
    }

    public onButtonClick( e: MouseEvent): void
    {
        console.log( "Hello to " + this.name);
    }
}

// Derived class
class Shalom extends Hello
{
    constructor( name: string)
    {
        super( name);
    }

    public onButtonClick( e: MouseEvent): void
    {
        console.log( "Shalom to " + this.name);
    }
}

mim.mount( [new Hello( "Michael"), new Shalom("Michael")]);
```

Here, the base class defines the event handler `onButtonClick` and the derived class overrides it with a slightly different functionality.




