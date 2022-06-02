---
layout: mimbl-guide
title: About Mimbl
---

# Mimbl - Web UI Authoring Library
Mimbl is a TypeScript/JavaScript UI authoring library that combines declarative and imperative programming in one package. Mimbl is React-like library, which leverages Virtual DOM and employs constructs very similar to those of React. Mimbl also provides some unique features allowing more flexibility for developers.

## Features
Mimbl provides all the standard functionality that developers expect from component authoring libraries: declarative laying out of HTML structure, function- and class-based components, references, error boundaries, lazy-loading, etc. In addition to this functionality Mimbl provides the following unique features:

- Instance-based components whose lifecycle is controlled by developers and which can be accessed via standard property and method invocation.
- Built-in trigger-watcher mechanism that re-renders components upon changes in the observable properties.
- Partitioned components that allow independent re-rendering of portions of a component.
- Custom HTML and SVG attributes defined by developers and supported via handler objects.
- Using [Mimcss](https://mimcss.com/guide/introduction.html) library for defining element styles and classes.
- Service publish/subscribe mechanism.

### Components
Mimbl components can be developed as functions or as classes. Function-based components are regular TypeScript/JavaScript functions that accept a "props" object and return an object that represents DOM content. Function components are stateless and are updated only when a parent component passes to it a different set of properties during its update.

Class-based components are classes that derive from the `mimbl.Component` class. They must implement the `render` method and may optionally implement other methods for lifecycle management. Class-based components are stateful and maintain their state using their instance properties. There is no special "state" object that the Mimbl infrastructure knows about and treats in a special way - component state is encapsulated by and known only to the component itself.

Functional components are first-class citizens in Mimbl but since they don't have state they are only useful for simple stateless functionality. Nevertheless, functional components have very significant role because it is a perfect tool to develop convenience wrappers around HTML elements. The majority of the further discussion is dedicated to the class-based components. Also, if not otherwise indicated, the term "component" will refer to class-based components.

Mimbl components can be leveraged in two different ways:
* as React-style components - that is, by specifying the component class name in JSX and letting the infrastructure to decide when to instantiate and when to destroy its instances. These components are also referred to later as *managed* components.
* as instance-based components - that is, by allowing developers to decide when the component should be instantiated and destroyed. In this case the components are created using a standard new operator and developers are in full control as to when to create the components. These components are referred to later as *independent* components.

In both cases, the components participate in the JSX layout. For the independent components, the variable holding the reference to the component is used directly within the curly braces. The component's properties and methods can be accessed and invoked directly. Developers are free to create component constructors with whatever parameters they see fit. Developers are encouraged to create component class hierarchies for code reuse.

Read more about components types in the [Component Types](component-types.html) unit of the Mimbl Guide.

### Trigger-Watcher Mechanism
For a class-based component (both managed and independent), its internal properties can be specified as *triggers* by using the `@trigger` decorator. From the moment such component is mounted, every run of the `render` method remembers what triggers were accessed. Later, when a trigger's value is changed, the component will be re-rendered automatically.

### Partitioned Components
It is ubiquitous that complex components don't have their entire JSX-related code reside in one big `render` method, but instead, use private methods (usually called `renderSomething`) responsible for rendering portions of the component. These methods are then invoked from the `render` method. In Mimbl, such methods are automatically converted to internally managed components that can be updated independently of the *parent* component and of each other. Just like the `render` method, these methods use the trigger-watcher mechanism to re-render portions of the component when the values of the triggers change.

Read more about partitioned components in the [Partitioned Components](partitioned-components.html) unit of the Mimbl Guide.

### Custom Attributes
A unique Mimbl feature is the ability to implement custom element attributes. As their name implies, custom element attributes are attributes that can be directly applied to the JSX representation of HTML and SVG elements and that have associated code executing custom functionality at run-time. The code is provided in the form of Custom Attribute Handlers - classes that are registered to implement functionality for named attributes. The consumers of custom attributes specify the named attributes in JSX representation of HTML or SVG elements in the same way they specify standard attributes.

Read more about custom attributes in the [Custom Attributes](custom-attributes.html) unit of the Mimbl Guide.

### Publishing and Subscribing to Services
In Mimbl parlance, *service* is an arbitrary object that is *published* by a component and that can be accessed and *subscribed to* by components below the publishing one in the HTML tree.

Service publish/subscribe mechanism provides the way to make information maintained by an upstream component available to the downstream components without passing this information through layers of intermediary components between the publisher and the subscriber. For these intermediary components, there is no need to know anything about the service.

Multiple components can publish the same service. The service subscription always finds a service publisher that is the closest to the subscriber up the ancestor chain. If during re-rendering a new component that resides between the subscriber and the publisher publishes the same service, the subscriber's reference will be updated to point to the newly published service. Similarly, if a component that previously published a service is removed from the hierarchy, the subscriber's reference will be updated to point to the service instance from another publisher. If another publisher is not found, the subscriber's reference will be set to `undefined`.

Read more about services in the [Publishing and Subscribing to Services](service-pub-sub.html) unit of the Mimbl Guide.

## Hello World in Mimbl
Just to have a small taste of Mimbl, let's see a simple example with two components - parent and child. The child component displays the "Hello World!" string with the text color defined by its public property that can be changed directly by whatever code that has access to its instance - in this example by the parent component.

```tsx
import * as mim from "mimbl"
import * as css from "mimcss"

/** Define Child component */
class Child extends mim.Component
{
    @mim.trigger color: css.CssColor;

    constructor( color: css.CssColor = "black")
    {
        super();
        this.color = color;
    }

    render(): any
    {
        return <span style={ {color: this.color} }>Hello World!</span>;
    }
}

/** Define Parent component and its properties */
interface ParentProps
{
    initColor?: css.CssColor;
}

class Parent extends mim.Component<ParentProps>
{
    child: Child;

    constructor( props: ParentProps)
    {
        super( props);
        this.child = new Child( props.initColor ? props.initColor : 'green');
    }

    render(): any
    {
        return <div>
            <button click={() => this.child.color = "black"}>Black</button>
            <button click={() => this.child.color = "red"}>Red</button>
            <button click={() => this.child.color = "blue"}>Blue</button>
            {this.child}
        </div>;
    }
}

mim.mount( <Parent initColor="brown"/>, document.getElementById("root"));
```

The `Child` component defines a property `txtColor` that keeps the current color of the "Hello World!" text that the component displays in its `render` method. The `color` property is defined using the `@trigger` decorator, which schedules re-rendering of the component whenever the property value changes.

The `Parent` component creates an instance of the `Child` component and keeps it in its `child` property. The `render` method lays out three `button` elements for changing text color and then specifies the `child` property in the curly braces. When the user clicks one of the color buttons, the `Parent` component sets the corresponding color string to the `Child` component's `txtColor` property. This causes re-rendering of the `child` component with the new text color. Note that the `Parent` component is not re-rendered.

The `mim.mount` method is used to render the instance of the `Parent` component under the "root" HTML element.

This simple example illustrates similarities as well as several key differences between Mimbl and React components. Mimbl components use JSX to lay out the HTML structure in their `render` method just like in React. The `Parent` component looks just like you would expect a simple React component to look like. The properties are defined as an interface, which is passed as a type parameter to the base `mim.Component` class. The property value is specified when the component class is used in JSX.

As for the differences, we need to look at how the `Child` component is implemented and how it is used by the `Parent` component. The `Parent` and `Child` components represent two kinds of components available in Mimbl - we will call them *managed* and *independent* components respectively. Managed components are the traditional React-style components, which are specified in JSX using their class names and are given property values via JSX attributes. Managed components are not created explicitly - rather they are created and controlled by the rendering infrastructure. Independent components, however, are created using the `new` operator and their lifetime is controlled by the developer.

The control over the component lifetime is the main difference between these two kinds of components because they share many other features. Both types of components can be manipulated via property and method invocations just like regular JavaScript classes. The only caveat is that for managed components, developers must rely on a reference (the `ref` property) in order to obtain the component instance, while the instance of the independent component is available directly.

Mimbl components (of either type) do not have built-in `state` object. The component's state is kept in the instance variables and is updated via direct property access or method invocations. Components schedule re-rendering via the call to the `updateMe` method of the `Component` base class. The `@trigger` decorator can be used on the component's instance properties to indicate that whenever the property value changes, the component should be re-rendered. This decorator, however, is simply a "syntax sugar" - meaning it can save developers some typing but the functionality is also available by different means. Components can expose whatever properties and methods they want and they can schedule re-rendering by calling the `updateMe` method whenever they want. As in React, components can schedule re-rendering multiple times within the JavaScript event cycle and re-rendering will only happen once.

One of the React shortcomings in this author's view is the necessity to re-render a parent component in order to provide new property values to a child component. In Mimbl's philosophy, only those components whose UI needs to change should be re-rendered. Thus in the example above, even though it is the `Parent` component that decides what color the `Child` component's text should be displayed with, it is only the `Child` component that is re-rendered. The React's implementation of this example would require the Parent component to update itself and pass the new property values to the Child component, which will also be updated. The Mimbl's functionality relies on the well established object-oriented paradigms of encapsulation and polymorphism, which (not-surprisingly) also helps optimize the run-time behavior.

