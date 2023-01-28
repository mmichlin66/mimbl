---
layout: mimbl-guide
unit: 10
title: "Mimbl Guide: Component Lazy-Loading"
---

# Component Lazy-Loading

## Code-Splitting
If a Web application consists of several relatively independent functionality areas, then it makes sense to not create a single JavaScript bundle, but, instead, create multiple chunks. The chunks would load only when necessary, which minimizes the initial amount of code required to be downloaded for the application to start.

Bundlers (such as Webpack) can perform the chunking (also called code-splitting) either according to an explicit configuration or automatically where they make decisions on what chunks to create based on the calls to the dynamic `import()` statements. The Mimbl's component lazy-loading is based on the dynamic `import()` statements and on the use of the built-in `Boundary` component.

The dynamic `import()` statement takes a module path as a parameter and, therefore, we often talk about "lazy-loading" of a module. In practice, of course, what is really loaded is a chunk that contains the given module. Since chunks usually contain more than one module, all this modules will become available as soon as the chunk is imported.

## Lazy-Loading in Mimbl
To lazy-load a module you wrap the call to the dynamic `import()` statement in a call to the Mimbl's `lazy()` function, like the following:

```tsx
let myModule = mim.lazy(import("path/to/MyModule"));

OR

let myModule = mim.lazy(() => import("path/to/MyModule"));
```

The parameter to the `lazy()` function can be either a *Promise* object returned from the dynamic `import()` statement or a function that returns such *Promise*. When the parameter is a function, this function is not called immediately; it will be called only when a property is accessed on the returned object. The chunk downloading will only start when the function is called; thus passing a function as a parameter allows deferring the actual chunk downloading until it is used.

The return type from the `lazy()` function is of the `typeof import(...)` type; that is, the object containing all module exports. For example, if `MyModule` exports a component named `MyComp`, then it is accessed as `myModule.MyComp` or directly via `mim.lazy(import("path/to/MyModule")).MyComp`. If the module defines a default export, it is accessed as `myModule.default`.

The dynamic `import()` statement returns a promise, and the object returned from the `lazy()` function is a *Proxy* object wrapping a promise inside it. Similarly, the object returned for `myModule.MyComp` component is also a *Proxy* object wrapping a promise. This object, however, can be directly used in all the places where a normal component can be used; that is, in JSX for functional and managed components or in the `new` statement for independent components.

## Using Lazy-Loaded Components
When components are lazy-loaded, they can be used in JSX as regular components; for example:

```tsx
let lib = mim.lazy(import("path/to/lib"));

class MyComp extends mim.Component
{
    render()
    {
        return <Boundary>
            ...
            <lib.LibComp prop="value" />
            ...
        </Boundary>
    }
}
```

Lazy-loaded components are intended to be used inside the `Boundary` component because until the chunk is downloaded and parsed, using the component in JSX will throw the underlying promise as an exception. The `Boundary` component catches this promise and will re-render when the promise resolves. There can be several lazy-loaded components under a single `Boundary` component on different levels of DOM hierarchy and the `Boundary` component will re-render only when all the promises are resolved.

If there is an error downloading the chunk, the error will be caught by the `Boundary` component and the appropriate message will be displayed.

## Promises
Lazy-loaded components wrap internal promises and they behave like promises themselves. That means that you can `await` for the component to become available (that is, its chunk to be downloaded and parsed) as well as call the regular promise methods `then()`, `catch()` and `finally()`.




