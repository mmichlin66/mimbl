---
layout: mimbl-guide
unit: 4
title: "Mimbl Guide: Partitioned Components"
---

# Mimbl Guide: Partitioned Components
### Rendering Complex Components
We often deal with creating complex components that contain multiple sections, which in turn can be divided into sub-sections. Having a single `render` method is usually too cumbersome - there is too much JSX. On the other hand, the sections of our complex components are probably only used on this page and are not leveraged in any other part of the application; therefore, creating a separate component for them is not really worth the time and effort. The standard solution is to use private rendering methods - methods that return JSX content that is ultimately used in the `render` method.

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
        <button click={() => this.setRightSidebarColor( "red")}>Red</button>
        <button click={() => this.setRightSidebarColor( "green")}>Green</button>
        <button click={() => this.setRightSidebarColor( "blue")}>Blue</button>
  </div>;
}

private renderRightSidebar(): any
{
    return <div style={ {color: this.rightSidebarColor} }>
        This text appears in the corresponding color when you click Red, Green or Blue buttons in the header.
    </div>;
}

private setRightSidebarColor( color: css.CssColor): void
{
    this.rightSidebarColor = color;
}

@mim.trigger
private rightSidebarColor: css.CssColor = "red";

// some method definitions are omitted for brevity.
```

The above code presents a page divided into five sections. The header has three buttons labeled Red, Green and Blue clicking which changes the color of the text in the right sidebar section. Note that when a color button is clicked, the entire component is re-rendered although only one section has actually changed. If a main section contained a heavy component like a grid with many sub-components, the rendering time might be quite significant.

It is possible to create components for each of the sections, which would be rendered independently, but this requires an extra effort and, most importantly, we will have to pass the proper pieces of the internal state to each of the components. With such components being used in exactly one place, the extra effort seems unjustified. What we really want is a way to say "re-render only the part for which the *renderSomething* method is responsible" and Mimbl provides exactly this functionality.

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

The only differences from the previous code is that while in the first example, the *renderSomething* methods are called, in the second excerpt, the methods themselves are provided as content (note the lack of `()`). The outcome is exactly what we wanted: when a color button is clicked in the header, only the right sidebar area is re-rendered.

There is no magic of course. Behind the scene, whenever Mimbl encounters a function passed as content, it creates a small component (called `FuncProxy`) and keeps it linked to the function. As with the main `render` method the other rendering methods react on the changes in the triggers that they use. Mimbl also makes sure to pass the reference to our entire component as *this* when it calls the rendering method.

In short, the mechanism converts methods into components - that is, it does automatically what developers would otherwise have to do by hand.

### FuncProxy Component
The code above is the simplest scenario where the *renderSomething* functions don't accept any parameters, are instance methods of our component and are called only once each in our component's main `render` method. In real life, this might not be the case and Mimbl provides a solution that covers all these cases.

Mimbl has a special component called `FuncProxy` that is used in JSX:

```tsx
<FuncProxy func={this.renderSomething} />;
```

The `FuncProxy` component, however, accepts several additional properties that allow us to solve the problems listed above. These are discussed in the sections below.

### Rendering Methods with Arguments
While rendering methods that don't accept any parameters are pretty common, rendering methods that do accept parameters are not less common. Imagine a scenario when there is code that calculates a certain value and then passes it on to a rendering function. Why wouldn't the rendering function itself calculate the value? Perhaps the value is used in more than one place or maybe the same rendering function is called more than once with different parameters.

Let's have a component where the left and right sidebars use different colors depending on some "urgency" parameter. The idea is that the "urgency" is not part of the state, but is calculated based on other state parameters. Here is an example of the rendering code - first using an old approach:

```tsx
public render()
{
    let urgency: number = this.calculateUrgency();
    return <div class="hbox">
        { () => this.renderLeftSidebar( urgency) }
        { ... }
        { () => this.renderRightSidebar( urgency) }
    </div>;
}

private renderLeftSidebar( urgency: number): void
{
    return <div style={ {color: price > 100 : "red" : "green"} }>...</div>;
}

private renderRightSidebar( urgency: number): void
{
    return <div style={ {color: price > 100 : "orange" : "cyan"} }>...</div>;
}

private onSomeStateChanges(): void
{
    this.updateMe();
}
```

Using the `FuncProxy` component the code will look as follows:

```tsx
public render()
{
    let urgency: number = this.calculateUrgency();
    return <div class="hbox">
        <FuncProxy func={this.renderLeftSidebar} args={[urgency]} replaceArgs />
        { ... }
        <FuncProxy func={this.renderRightSidebar} args={[urgency]} replaceArgs />
    </div>;
}

private onSomeStateChanges(): void
{
    let urgency: number = this.calculateUrgency();
    this.updateMe( {func: this.renderLeftSidebar, args: [urgency]}, {func: this.renderRightSidebar, args: [urgency]});
}
```

We are using the `FuncProxy` component and specifying not only the function to be called but also an array of arguments to be passed to it. Note that it should always be an array. When the component's state changes, we calculate the urgency value again and pass it to the `this.updateMe` calls. The `this.updateMe` method accepts variable argument list; therefore, there is no need to wrap the `urgency` variable in an array. Whenever the `this.updateMe` method is called, the arguments passed to it are remembered in the instance of the FuncProxy component and are passed to the rendering function when it is called.

We are also using the `replaceArgs` Boolean property of the `FuncProxy` component. This informs the component instance that the arguments passed to it should replace the parameters that are remembered in that instance from the prior renderings or from the `this.updateMe` calls. The default value of the `replaceArgs` parameter is `false` (and this is also what's used when it is omitted), which indicates that the arguments passed to it will not replace the arguments already remembered in the component instance. This essentially means that the arguments passed to the `FuncProxy` component will be treated as "initialization" parameters: they will be used in the first rendering (when the component instance is created) and ignored in all subsequent renderings (when the component instance is updated).

Omitting the `replaceArgs` property allows for the following code:

```tsx
public render()
{
    let urgency: number = this.calculateInitialUrgency();
    return <div class="hbox">
        <FuncProxy func={this.renderLeftSidebar} args={[urgency]} />
        { ... }
        <FuncProxy func={this.renderRightSidebar} args={[urgency]} />
    </div>;
}

private onSomeStateChanges(): void
{
    let urgency: number = this.calculateUrgency();
    this.updateMe( {func: this.renderLeftSidebar, args: [urgency]}, {func: this.renderRightSidebar, args: [urgency]});
}
```

In the code above, the `FunProxy` instances will be initialize with the initial value of the urgency parameter. During repeated renderings of our component, the `FuncProxy` instance will not be re-rendered. It will be re-rendered only when the `this.updateMe` method is called in the `onSomeStateChanges` event handler.

### Multiple Uses of Rendering Methods
We already noticed that when a rendering method is returned as content or when the `FuncProxy` component is used, Mimbl creates an internal structure (a special kind of virtual node) and links it to the function. This linking is what allows the `this.updateMe` method to find the right node to re-render. When the rendering function is used only once by the parent component, the linking is one-to-one. A question arises, however, how the linking works if the rendering method is used more than once. For example, it is common that a similar code is used to render a table's header and footer.

A solution might be to have two different very thin methods - say, *renderTableHeader* and *renderTableFooter* - which would call the same method - maybe with different parameters. This will obviously work, although developers would have to create these extra methods - and we don't want developers to do any extra work. But what if the number of times a rendering method is used is not known at development time? For example, what if we need to render a sequence of small objects? We might develop a separate component for rendering such an object, but it might be an overkill.

The problem we are trying to solve is how to uniquely identify each instance of calling the same rendering function so that when we call the `this.updateMe` method the right node is re-rendered. The solution Mimbl provides is that the `FuncProxy` component accepts a `key` property, which must be unique every time the same rendering function is used. The key becomes part of the link between the function and the internal node. The same key is then passed to the `this.updateMe` call.



