---
layout: mimbl-guide
unit: 3
title: "Mimbl Guide: Handling Events"
---

# Handling Events
Mimbl allows developers to attach functions to DOM Element events so that when an event occurs the function is invoked. Although the concept is very simple, there are a lot of caveats and nuances involved:

- How do we identify events?
- Do we want to attach to a bubbling or a capturing phase of event processing?
- How do we make event handlers, which are defined as class-based component methods, to use the correct value of `this`?
- What if event handlers throw exceptions?

This unit describes the Mimbl's event handling mechanism and answers the above questions.

Note that this unit only discusses handling events of DOM elements created using JSX - usually in the context of a component's `render` method. Mimbl of course allows handling events of other objects (e.g. `window` or `document`) using the standard `addEventListener` function; however, this is discussed separately as part of the unit [Callbacks and this](callbacks-and-this.html).

## Basic Use Case
Below is a simple code of a component that has a button and a method that should be invoked when the button is clicked:

```tsx
class Hello extends mim.Component
{
    name: string;

    constructor(name: string)
    {
        super();
        this.name = name;
    }

    public render(): void
    {
        return <button click={this.onButtonClick}>Click Me</button>;
    }

    public onButtonClick(e: MouseEvent): void
    {
        console.log( "Hello to " + this.name);
    }
}

mim.mount(new Hello("Michael"));
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

## The Value of **this**
In the example above, the event handler uses the `this` keyword to refer to the instance member `name`. But wait a minute! How can it work? We all know that in JavaScript, in order for callbacks to have a correct value of `this`, they must be either defined as arrow functions or be explicitly bound to `this`. The code above does neither and still works - how come?!

The answer is simple: Mimbl performs a small trick behind the scenes - it uses the component instance that created the element to call the event handler method. This is almost the same as binding: Mimbl just uses the `Function.apply` method instead of `Function.bind`.

But what if the event handler belongs not to the component class but to another related class? Mimbl of course cannot know that on its own but it allows developers to explicitly specify the object, to which the event handler belongs. In order to do that, developers must specify an object where the `func` property is set to the event handler function and the `thisArg` property is set to the object to which the handler function belongs:

```tsx
// Define interface that knows to react on the click event
interface IClickable
{
    onClick(e: MouseEvent): void;
}

// The Hello component will work with any implementation of the IClickable interface
class Hello extends mim.Component
{
    clcikable: IClickable;

    constructor(clcikable: IClickable)
    {
        super();
        this.clcikable = clcikable;
    }

    public render(): void
    {
        // the onClick event handler belongs to the object implementing the IClickable interface
        return <button click={ {func: this.clcikable.onClick, thisArg: this.clcikable} }>Click Me</button>;
    }
}

// The Person class implements the IClickable interface
class Person implements IClickable
{
    name: string;

    constructor(name: string)
    {
        super();
        this.name = name;
    }

    public onClick(e: MouseEvent): void
    {
        console.log( "Hello to " + this.name);
    }
}

mim.mount(new Hello(new Person("Michael")));
```

If you want your event handler, which belongs to a separate object, to react on the capturing phase of the event processing, you must specify an object with three properties: the event handler function, the object reference and the Boolean `true` value:

```tsx
public render(): void
{
    return <button click={ {func: this.clcikable.onClick, thisArg: this.clcikable, useCapture: true} }>Click Me</button>;
}
```

Mimbl also supports event handlers implemented as arrow function properties or as bound methods. In this case, developers should only specify the function itself.

## Event Handlers with Arguments
It is often the case when we want to pass some extra information to our event handlers beyond the `Event` itself. Take for example the case of a group of radio buttons, which when clicked set a certain property to different values. In such cases, it is common to have the code resembling the following:

```tsx
class Radios extends mim.Component
{
    @mim.trigger private color: css.CssColor = "red";

    render <div>
        <div>
            <input type="radio" name="colors" click={() => this.onColorChanged("red")} />
            <input type="radio" name="colors" click={() => this.onColorChanged("green")} />
            <input type="radio" name="colors" click={() => this.onColorChanged("blue")} />
        </div>
        <p style={ {color: this.color} }>
            This text appears in the selected color.
        </p>
    </div>

    private onColorChanged(color: css.CssColor): void
    {
        this.color = color;
    }
}
```

The problem with this approach is that each time the `render` function is called, new event handlers are created and this may cause some inefficiencies because the old handlers should be removed and the new ones added to each radio button element. In addition, the `onColorChanged` method above is not really an event handler anymore; in particular, it doesn't accept the event object (the `MouseEvent` in our case). If needed, this can be obviously solved by explicitly passing the event object from the event handler (the fat arrow function) to `onColorChanged` method - this just becomes even more verbose.

Mimbl solves these problems by allowing specifying the arguments along with event handlers right in the event property. This can be done in two ways. First, as in the previous examples, the object notation can be used with the `arg` property:

```tsx
<input type="radio" name="colors" click={ {func: this.onColorChanged, arg: "red"} } />
```

Since passing arguments to event handlers is a rather common need, Mimbl also provides a second syntax, which requires even less typing. The handler function and the argument value can be specified as a tuple:

```tsx
<input type="radio" name="colors" click={[this.onColorChanged, "red"]} />
```

Using either approaches requires the event handler function to accept the parameter after the event object. So our example can be re-written as the following:

```tsx
class Radios extends mim.Component
{
    @mim.trigger private color: css.CssColor = "red";

    render <div>
        <div>
            <input type="radio" name="colors" click={[this.onColorChanged, "red"]} />
            <input type="radio" name="colors" click={[this.onColorChanged, "green"]} />
            <input type="radio" name="colors" click={[this.onColorChanged, "blue"]} />
        </div>
        <p style={ {color: this.color} }>
            This text appears in the selected color.
        </p>
    </div>

    private onColorChanged(e: MouseEvent, color: css.CssColor): void
    {
        this.color = color;
    }
}
```

Event handlers can only specify a single parameter (in addition to the event object); if more are needed, they should be put into an array or an object.

## Virtual Event Handlers
Event handlers can be overridden in derived classes:

```tsx
// Base class
class Hello extends mim.Component
{
    name: string;

    constructor(name: string)
    {
        super();
        this.name = name;
    }

    public render(): void
    {
        return <button click={this.onButtonClick}>Click Me</button>;
    }

    public onButtonClick(e: MouseEvent): void
    {
        console.log("Hello to " + this.name);
    }
}

// Derived class
class Shalom extends Hello
{
    constructor( name: string)
    {
        super( name);
    }

    public onButtonClick(e: MouseEvent): void
    {
        console.log("Shalom to " + this.name);
    }
}

mim.mount([new Hello( "Michael"), new Shalom("Michael")]);
```

Here, the base class defines the event handler `onButtonClick` and the derived class overrides it with a slightly different functionality.

## Component Events
In Mimbl, class based components can also fire events. First, the class `Component`, which is the base class for all components, derives from JavaScript's `EventTarget`. This allows the components to fire events using the standard `this.dispatchEvent` function, while callers can attach to these events using the standard `comp.addEventListener` function. In addition, Managed components allow attaching to their events using component event properties - just like we attach to events of DOM elements.

A class based component can define an *Events* interface and provide it as a template parameter when extending the `Component` class. The *Events* interface maps event names to event types. If the event type derives from the standard `Event` type, then this is the type that will be passed to the event handler. If the event type doesn't derive from the `Event` type, then it defines the type of the `detail` property of the `CustomEvent` type. The `Component` class defines the convenient `fireEvent` method, which accepts the value corresponding to the property from the *Events* interface and dispatches the proper event type.

Callers of independent components can attach to the events using the component instance and the standard `addEventListener` method. For managed components, the *props* object type defines (in addition to the regular properties) defines a property for each key in the *Events* interface. The property name is defined in the form "$on_*key*"; that is, If the *Events* interface defines property `opened`, the *props* object type will define property `$on_opened`.

Here is an example of a managed component that defines several events and another component that attaches to them:

```tsx
// Interface for component properties
interface CounterProps
{
    initialValue?: number;
}

// Interface for component events
interface CounterEvents
{
    // will fire MouseEvent
    clicked: MouseEvent;

    // will fire CustomEvent with number value in the detail property
    incremented: number;
}

// Define component with properties and events interfaces as template parameters
class Counter extends mim.Component<CounterProps, CounterEvents>
{
    private value: number;

    constructor(props: CounterProps)
    {
        super(props);
        this.value = props.initialValue ?? 0;
    }

    render(): any
    {
        return <button click={this.onIncrement}>Increment</button>
    }

    private onIncrement(e: MouseEvent): void
    {
        this.value++;

        // re-fire the click event with the "clicked" name
        this.fireEvent("clicked", new MouseEvent("clicked", e));

        // fire custom event. Note that we only provide the value - Mimble will create the
        // CustomEvent with this value and will dispatch it to the listeners.
        this.fireEvent("incremented", this.value);
    }
}

// Define component that attaches to the Counter component's events
class Counter extends mim.Component
{
    render(): any
    {
        return <div>
            <Counter $on_clicked={this.onCounterClicked} $on_incremented={this.onCounterIncremented} />
        </div>
    }

    private onCounterClicked(e: MouseEvent): void
    {
        console.log("Counter clicked", e);
    }

    private onCounterIncremented(e: CustomEvent<number>): void
    {
        console.log("Counter incremented", e.detail);
    }
}
```



