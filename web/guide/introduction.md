---
layout: mimbl-guide
unit: 0
title: "Mimbl Guide: Introduction"
description: Brief introduction to using the Mimbl library for authoring Web UI.
---

# Mimbl Guide: Introduction

Mimbl is a Web UI authoring library and this guide will help you get started with building Web UI using Mimbl. If you are familiar with React, you will find many concepts of Mimbl to be very close to those of React. Mimbl builds on the same principles React was built on and then goes further in an attempt to improve in certain areas where React is lacking.

This guide consists of a number of units each explaining a single concept.

## Installing Mimbl
Mimbl is available as an NPM package and you can install it using the following command:

```shell
npm i mimbl
```

Although Mimbl can be used for pure JavaScript development, it has many features that make it shine when used with TypeScript. Mimbl is heavily based on JSX and the samples in this guide were all built using TypeScript and JSX; therefore, go ahead and install TypeScript (`npm i type-script -g -D`).

## Using Mimbl
In order to use the Mimbl library in your TypeScript project, you need to do the following:

1. Add Mimbl's JSX factory method to the `tsconfig.json` file.
1. Import the Mimbl module into you TypeScript files.
1. Reference the Mimbl library in a `<script>` tag in your HTML file

Mimbl provides its own JSX factory function, which should be registered in your `tsconfig.json` file. (As with any JSX factory function it is possible to use it on a file-by-file basis; however, we recommend to have it configured once in the `tsconfig.json` file.) Here is a snippet of such file that you can copy-and-paste:

```json
    "compilerOptions": {
        "jsx": "react",
        "jsxFactory": "mim.jsx",
        "jsxFragmentFactory": "mim.Fragment",
        "experimentalDecorators": true,
    }
```

TypeScript converts every JSX expression to a call to the JSX factory function and, therefore, the Mimbl's JSX factory should be imported into every .tsx file under a name that matches the name specified in the `tsconfig.json` file. The name `mim.jsx` assumes that you import the Mimbl library using the following statement:

```tsx
import * as mim from "mimbl"
```

That's how the code in this guide imports the library; however, if you decide to import it under a different name you are free to do so. Just remember to change the `jsxFactory` field in your `tsconfig.json` file to the appropriate value.

The `jsxFragmentFactory` option is needed for the JSX "fragment" notation - `<>...</>` - to use multiple elements or components where a single entry is expected. This feature is available starting with TypeScript 4.0.0. If you are using an earlier version of TypeScript, you will have to use the construct `<mim.Fragment>...</mim.Fragment>`.

In your HTML file use the following URL to reference the Mimbl library (well, when Mimbl becomes popular enough we will host it on CDN):

```html
<script src="mmichlin66.github.io/lib/mimbl.js"></script>
```

## Hello World!
The first Web page we will author will be, of course, a Hello World! program. The program consists of a simple HTML file and a simple Mimbl component. Here is the HTML file, which references the Mimbl library and also references the application bundle created by processing the code with your favorite bundler (e.g. Webpack).

```html
<html>
    <body>
        <script src="mmichlin66.github.io/lib/mimbl.js"></script>
        <script src="bundle.js"></script>
    </body>
</html>
```

The simplest program you can write with Mimbl is this:

```tsx
import * as mim from "mimbl"

mim.mount( "Hello World!");
```

This program will display the "Hello World!" string right in the HTML's body element. But of course, the power of Mimbl is in the ability to write components and so we will write a simple component that will demonstrate the  basic Mimbl functionality: laying out HTML structure, reacting to events and updating when the internal state changes.

We will create a `HelloTo` component that will contain just three HTML elements: a button, an input text field and a `<span>` element. When the user enters a *name* into the text field and clicks the button, the `<span>` element will read: "Hello to *name*!".

```tsx
import * as mim from "mimbl"

class HelloTo extends mim.Component
{
    @mim.trigger private name: string;
    @mim.ref private refName: HTMLInputElement;

    public render(): any
    {
        return <div>
            <button click={this.onSayHelloTo}>Say Hello To</button>
            <input type="text" ref={this.refName} style={ {marginLeft: 20} } />
            <span style={ {marginLeft: 20} }>{`Hello to ${this.name}!`}</span>
        </div>
    }

    private onSayHelloTo(): void
    {
        this.name = this.refName.value;
    }
}

mim.mount( new HelloTo());
```

As we can see the component structure is pretty similar to that of React. The HelloWorld class is a class-based component because it derives from the Mimbl's Component class. It's `render` method uses JSX to lay out the HTML structure.

The component declares a reference `refName` and passes it on to the `<input>` element. It also defines a `name` field that is used to remember the value from the `<input>` element when the user clicks the button. The button element is passed the event handler method `onSayHelloTo` for the `click` event. The `<span>` element displays the "Hello to" string concatenated with the value of the `name` field whenever the component is updated.

When the user clicks the button, the reference object is used to retrieve the `<input>` element's current value and to store it in the component's `name` field. Since the `name` property is decorated with `@trigger` the component will be re-rendered as soon as the value of the `name` property changes.

To put the component on the page, the Mimbl's `mount` method is called, which is passed the component instance. In our example the component will be rendered right in the `<body>` element; however, we could specify an HTML element, under which the component should be rendered, in the optional second parameter.

There are several differences - some significant, some subtle - in the component definition compared to React. Among the subtle ones are:

- The reference is declared with the intended type and with the `@ref` decorator. This way the reference can be used to directly access the referenced object's methods and properties without the extra `current` property.
- Events are identified by their DOM names without prefixing them with "on"; that is, "click" instead of "onClick". In general, Mimbl strives to use the original HTML attribute and event names whenever possible. For example, Mimbl uses "class", "for" and "tabindex", while React uses customized "className", "forHtml" and "tabIndex".
- There is no "controlled component" pattern, which is common in and recommended by React: the value of the internal variable `name` isn't kept in sync with the value of the `<input>` element; instead, it is retrieved only when there is a need to use it. Mimbl is fully capable of implementing the control component pattern; however, we don't see it as a good practice. You can read more on this author's view of the controlled components [here](https://mmichlin66.github.io/2019/08/10/React-Discussion.html).

Among the significant differences are the following:

- Mimbl components don't have a `state` object - the component's state is kept in the instance variables. The existence of the `state` object and the React insistence on using it has always been a mystery for this author: you can read more on this topic in the same article mentioned [above](https://mmichlin66.github.io/2019/08/10/React-Discussion.html).
- Mimbl components don't have the `setState` method (which, in React, combines the state changing and update requesting). Whenever the component needs to be updated it must either call the `updateMe` method (which acts as the React's `forceUpdate`) or rely on the trigger-watcher mechanism as in the example.
- The component in our example is instantiated by us (the developers), while in React, the component's class is used in JSX and is instantiated by the React library. Mimbl, in fact supports several component types, which are discussed later in this guide.

In addition, Mimbl provides the following unique features:

- Instance-based components whose lifecycle is controlled by developers and which can be accessed via standard property and method invocation.
- Built-in trigger-watcher mechanism that re-renders components upon changes in the observable properties.
- Partitioned components - independent re-rendering of portions of a component encapsulated in a method.
- Custom HTML and SVG attributes defined by developers and supported via handler objects.
- Using [Mimcss](../mimcss/guide/introduction.html) library for defining element styles and classes.
- Service publish/subscribe mechanism.

The following units discuss these features in more details.


