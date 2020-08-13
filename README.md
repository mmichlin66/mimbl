# Mimbl - Component Authoring Library
Mimbl is a TypeScript/JavaScript UI authoring library that combines declarative and imperative programming in one package. Mimbl is proposed as an alternative to React. The accompanying document [React Discussion](http://mmichlin66.github.io/2019/08/10/React-Discussion.html) provides more information about aspects of React that this library strives to improve upon.

## Installation

```
npm install mimbl
```

## Features
Mimbl provides all the standard React-style functionality that developers expect from component authoring libraries: declarative laying out of HTML structure, function- and class-based components, references, error boundaries, lazy-loading, etc. In addition to this functionality Mimbl provides the following unique features:

- Components whose lifecycle is controlled by developers and which can be accessed via standard property and method invocation.
- Build in mechanism for initiating component updates by triggering state changes.
- Partitioning components into multiple independently updatable areas just by using rendering methods.
- Custom HTML and SVG attributes defined by developers and supported via handler objects.
- Service publish/subscribe mechanism.
- Mimcss library for style definitions.

## Usage
The Mimbl library provides a custom JSX factory function called `jsx`. In order for this function to be invoked by the TypeScript compiler, the tsconfig.json file must have the following option:

```json
"compilerOptions":
{
    "jsx": "react",
    "jsxFactory": "mim.jsx"
}
 ```

The .tsx files must import the Mimbl module as mim. Mimbl uses the Mimcss library for managing CSS styles; therefore, it is also imported here.

```tsx
import * as mim from "mimbl"
import * as css from "mimcss"

// Define a component
class HelloWorld extends mim.Component
{
    color: css.CssColor;

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

mim.mount( new HelloWorld("red"));
```

For more details please see the following resources:
- [Documentation](https://mmichlin66.github.io/mimbl/introduction.html)
- [API Reference](https://mmichlin66.github.io/mimbl/reference.html)
- [Playground](https://mmichlin66.github.io/mimbl/playground.html) (work in progress)

