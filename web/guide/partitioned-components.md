---
layout: mimbl-guide
unit: 5
title: "Mimbl Guide: Partitioned Components"
---

# Partitioned Components
We often deal with complex components that contain multiple sections, which in turn can be divided into sub-sections. Having a single `render` method is usually too cumbersome - there is too much JSX and some parts of it are created only based on certain conditions. On the other hand, the sections of our complex components are probably only used on this page and are not leveraged in any other part of the application; therefore, creating a separate component for them is not really worth the time and effort. The standard solution is to use private rendering methods - methods that return JSX content that is ultimately used in the `render` method.

## Rendering Complex Components
The rendering code of a complex component often looks like the following:

```tsx
public render(): any
{
    return <div class="vbox">
        { this.renderHeader() }
        <div class="hbox">
            { this.renderLeftSidebar() }
            { this.renderMainContent() }
            { this.renderRightSidebar() }
        </div>
        { this.renderFooter() }
    </div>;
}

private renderHeader(): any
{
    return <div>
        <button click={[this.onRightSidebarColorChange, "red"]}>Red</button>
        <button click={[this.onRightSidebarColorChange, "green"]}>Green</button>
        <button click={[this.onRightSidebarColorChange, "blue"]}>Blue</button>
  </div>;
}

private renderRightSidebar(): any
{
    return <div style={ {color: this.rightSidebarColor} }>
        This text appears in the corresponding color when you click Red, Green or Blue buttons in the header.
    </div>;
}

private onRightSidebarColorChange(e: MouseEvent, color: css.CssColor): void
{
    this.rightSidebarColor = color;
}

@mim.trigger
private rightSidebarColor: css.CssColor = "red";

// some method definitions are omitted for brevity.
```

The above code presents a page divided into five sections. The header has three buttons labeled Red, Green and Blue clicking which changes the color of the text in the right sidebar section. Note that when a color button is clicked, the entire component is re-rendered although only one section has actually changed. If a main section contained a heavy component like a grid with many sub-components, the rendering time might be quite significant.

It is possible to create components for each of the sections, which would be rendered independently, but this requires an extra effort and, most importantly, we will have to pass the proper pieces of the internal state to each of the components. With such components being used in exactly one place, the extra effort seems unjustified. What we really want is a way to say "re-render only the part for which the *renderSomething* method is responsible" and Mimbl provides exactly this functionality.

## Functions as Content
Here is the syntax that Mimbl allows (only the `render` method has changes):

```tsx
public render(): any
{
    return <div class="vbox">
        { this.renderHeader }
        <div class="hbox">
            { this.renderLeftSidebar }
            { this.renderMainContent }
            { this.renderRightSidebar }
        </div>
        { this.renderFooter }
    </div>;
}
```

The only difference from the previous code is that while in the first example, the *renderSomething* methods are called, in the second excerpt, the methods themselves are provided as content (note the lack of `()`). The outcome is exactly what we wanted: when a color button is clicked in the header, only the right sidebar area is re-rendered.

There is no magic of course. Behind the scenes, whenever Mimbl encounters a function passed as content, it creates a small component (called `Functor`) and keeps it linked to the function. As with the main `render` method the other rendering methods react on the changes in the triggers that they use. Mimbl also makes sure to pass the reference to our component as *this* when it calls the rendering method, so that they have access to all data members and other methods.

In short, the mechanism converts methods into components - that is, it does automatically what developers would otherwise have to do by hand.

## Functor Component
The code above is the simplest scenario where the *renderSomething* functions don't accept any parameters, are instance methods of our component and are called only once each in our component's main `render` method. Although this already covers a lot of scenarios, in real life, this might not be the case and Mimbl provides a solution that covers all these cases.

The already mentioned special component called `Functor` is actually a regular component available to developers who can use it in JSX. In fact, passing the function as content is equivalent to using the `Functor` component with a single property `func` - as in the following code:

```tsx
<Functor func={this.renderSomething} />;
```

The `Functor` component accepts several additional properties that allow us to solve the problems listed above. For example, it is pretty common to have a component that should render a list of objects - think of a "to-do" component rendering a list of "to-do" items. In some cases, the objects in the list deserve to be represented by their own components, but in other cases they are such an intrinsic part of the "outer" component that it doesn't make sense to create a separate component for them. Still, we do want them to be updated independently of each other and of the outer component. To accomplish this, the `Functor` component allows specifying an argument using the `arg` property. Here is the "to-do" component using the same rendering function for every "to-do" item passing the item object as an argument:

```tsx
type TodoItem =
{
    title: string;
    text: string;
    time: Date;
}

class TodoList extends mim.Component
{
    @mim.trigger private items: TodoItem[] = [];

    render(): any
    {
        return <div>
            <button click={this.onAddItem}>Add New Item</button>
            {this.items.map(item => <mim.Functor func={this.renderItem} arg={item} key={item} />)}
        </div>
    }

    renderItem(item: TodoItem): any
    {
        return <div>
            <h3>{item.title}</h3>
            <p>{item.text</p>
            <span>{item.time.toDateString()</span>
            <button click={[this.onRemoveItem, item]}>Remove</button>
        <div>
    }

    onAddItem(): void
    {
        this.items.push({title: "New item", text: "Do something useful", time: new Date()});
    }

    onRemoveItem(e: MouseEvent, item: TodoItem): void
    {
        let index = this.items.indexOf(item);
        if (index >= 0)
            this.items.splice(index, 1);
    }
}
```

In the example above, the `Functor` component is used in a loop for every "to-do" item with the same `renderItem` function, which will be passed the item object when invoked. Since the `renderItem` is a regular method of the `TodoList` component, it has access to all its fields and methods; in particular, it can assign the `onRemoveItem` method to the `click` event of its `<button>` element with the item object as a parameter.

Note also the use of the `key` property: since we are rendering a list, it is essential to provide unique keys so that the list can be properly maintained when items are added to or removed from it. The item objects themselves are the perfect candidates for key values.

The `Functor` component allows specifying only one argument, but it can be of any type including an array or an object.

Normally, the rendering functions are just methods of the component class, and Mimbl uses the component's instance to setup `this` when calling them. In rare cases, there might be a need to use a rendering function, which is a method on another class. In such cases, the `Functor` component allows passing the required object instance in the `thisArg` property.

## Rendering Functions without Triggers
As it was previously mentioned, a rendering function will be called to re-render its content if any of the triggers it encountered during its last execution has its value changed. That is, Mimbl establishes a watcher for each rendering function. Usually, this is all what's needed for the rendering functions to serve their purpose. Sometimes, however, there might be a need to force a function to re-render even if no trigger values have changed. The simplest example is when the content depends on time.

Since the `Functor` component is a regular managed component, it supports the `ref` property, which will point to the instance of the `Functor` component when mounted. Then, the owner of the reference can call the `updateMe` method (that every component supports), which will cause the function to re-render.


