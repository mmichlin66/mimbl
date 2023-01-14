---
layout: mimbl-guide
unit: 4
title: "Mimbl Guide: Trigger/Watcher Mechanism"
---

# Trigger/Watcher Mechanism

## Triggers and Watchers
The Mimbl's trigger/watcher mechanism implements what is commonly referred to as *reactivity*; that is, ability for functions to re-run in response to changes of observable properties. In the component world, this also means that components are re-rendered automatically in response to observable property changes.

In Mimbl's parlance, observable properties are called *triggers*, while functions that react on value changes are called *watchers*. Although it is possible (and sometimes beneficial) to create triggers and watchers explicitly, usually all the developers should do is to mark some component properties with the `@trigger` decorator. Having done that they ensured that the component will re-render if values of such properties change. Here is a basic example:

```tsx
class Counter extends mim.Component
{
    @mim.trigger count = 0;

    render(): any
    {
        return <div>
            <button click={this.onIncrement}>Increment</button>
            <span>{this.count}</span>
        </div>
    }

    onIncrement(): void
    {
        this.count++;
    }
}
```

Mimbl makes every component's `render` method a *watcher*, which means that whenever it encounters a trigger it starts "watching" it and when the trigger's value changes, the component will be scheduled for re-rendering. There can be multiple triggers used in the `render` method but no matter how many of them have their values changed, the component will be re-rendered only once. Trigger values can be changed not only during event callbacks but by asynchronous methods executions, for example, after fetching data from the server.

## Trigger Levels
The `@trigger` decorator can be applied to primitive types as well as arrays, plain objects, maps and sets. For primitive types, the only possible change is when the property value is set to a different value; however, for complex types, this is a bit more complicated. Lets take array as an example. Of course when a new array is assigned to the property, this constitutes a change and the component should re-render. But what if the array itself remains the same but one of its elements changes? And what if the element is itself a complex type - say an object - and only one of the object's properties changes?

What we have with complex types is a number of *levels* on which the change can occur. The value of the property itself is considered level 0, the value of array elements or object properties or Map and Set items is considered level 1 and so on. When we apply the `@trigger` decorator, we can specify the maximum level for which it should trigger re-rendering.

```tsx
// the component will be re-rendered only when a new array is assigned to the property
@mim.trigger(0) arr: any[];

// the component will be re-rendered when a new object is assigned to the property or when
// one of the object's properties is changed,
@mim.trigger(1) obj: {name: string, age: number};

// define a recursive structure
type Node = { name: string; subnodes: Node[] }

// the component will be re-rendered if a change is made on the up to a 3rd level but no deeper.
// the following changes will trigger re-rendering (assuming x is a Node instance):
//   - this.rootNode = x;
//   - this.rootNode.subnodes = [x];
//   - this.rootNode.subnodes[1] = x;
// the following changes will NOT trigger re-rendering:
//   - this.rootNode.subnodes[2].name = "John";
//   - this.rootNode.subnodes[3].subnodes = [];
@mim.trigger(3) rootNode: Node;
```

Specifying the `@trigger` decorator without parameters is equivalent to specifying level 1. This works well for primitive types (that have only level 0 anyway) as well as for complex types, for which triggering re-rendering when elements/properties one level deep change, is a reasonable default.

## Trigger Object
A trigger object can be created independently of the `@trigger` decorator using the `createTrigger` function. A trigger created this way can be used as an attribute value or in place of a text node. Although in most cases it is not needed, under certain circumstances this can optimize rendering behavior. To understand how this occurs let's compare two implementations of a simple component displaying an element in different color when it is clicked.

```tsx
class CompWithDecorator extends mim.Component
{
    @mim.trigger className: string | undefined;

    render(): any
    {
        return <div click={this.onClick} class={this.className}>Click to change my color</div>
    }

    onClick(): void
    {
        this.className = this.className ? undefined : "red";
    }
}

class CompWithTrigger extends mim.Component
{
    className = createTrigger<string | undefined>();

    render(): any
    {
        return <div click={this.onClick} class={this.className}>Click to change my color</div>
    }

    onClick(): void
    {
        if (this.className.get())
            this.className.set(undefined);
        else
            this.className.set("red");
    }
}
```

The two components' visual behavior is identical: when the `<div>` element is clicked it changes color to red (assuming that's what the `red` class does) and when it is clicked again, goes back to the default color. However, the amount of work done to accomplish this is different. When the `CompWithDecorator` is clicked, the component is re-rendered - that's what the `@trigger` decorator is designed to do. When the `CompWithTrigger` component is clicked, however, the component is not actually re-rendered at all. Instead, the change in the trigger value is noticed by the Mimbl's infrastructure and the `class` attribute's value is changed directly.

Note that the DOM changes the two components make are identical - they both only change the `class` attribute's value; however, the `CompWithDecorator` component goes through the Virtual DOM reconciliation process before understanding what changes to make in the DOM, while the `CompWithTrigger` component doesn't need to do that. This is too subtle a difference for simple or even medium-size components and in the majority of cases the `@trigger` decorator is the way to go; however, there are cases when the performance difference can be significant. Consider for example, a table where clicking on a cell selects it. If the table has a big number of cells, then re-rendering the entire component may take significant time even if the eventual DOM change is just of a single attribute. Although virtual DOM reconciliation is a relatively fast process, given a big number of elements, it can take a long time.



