# Mimbl - Component Authoring Library
Mimbl is a TypeScript/JavaScript UI authoring library that combines declarative and imperative programming in one package. Mimbl is React-like library, which leverages Virtual DOM and employs constructs very similar to those of React. Mimbl also provides some unique features allowing more flexibility for developers.

## Features
Mimbl provides all the standard functionality that developers expect from component authoring libraries: declarative laying out of HTML structure, function- and class-based components, references, error boundaries, lazy-loading, etc. In addition to this functionality Mimbl provides the following unique features:

- Functional and class–based components as well as custom Web elements.
- Built-in trigger-watcher mechanism that re-renders components upon changes in the observable properties.
- Partitioned components that allow independent re-rendering of portions of a component.
- Component events - just like HTML element events.
- Custom HTML and SVG attributes defined by developers and supported via handler objects.
- Service publish/subscribe mechanism.
- Defining styles using [Mimcss](https://www.mimcss.com/guide/introduction.html) CSS-in-JS library.
- Full support for MathML elements.

## Installation and Usage
Mimbl is provided as an NPM package. Install it with the following command:

```
npm install mimbl
```

The Mimbl library provides a custom JSX factory function called `jsx`. In order for this function to be invoked by the TypeScript compiler, the tsconfig.json file must have the following option:

```json
"compilerOptions":
{
    "jsx": "react",
    "jsxFactory": "mim.jsx",
    "jsxFragmentFactory": "mim.Fragment",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
}
 ```

The .tsx files must import the Mimbl module as mim. Mimbl uses the Mimcss library for managing CSS styles; therefore, it is also imported here.

```tsx
import * as mim from "mimbl"
import * as css from "mimcss"

// Define a component
class HelloWorld extends mim.Component
{
    @mim.trigger color: css.CssColor;

    constructor( color: css.CssColor = "black")
    {
        super();
        this.color = color;
    }

    render(): any
    {
        return <div>
            <button click={[this.onChangeColor, "red"]}>Red</button>
            <button click={[this.onChangeColor, "green"]}>Green</button>
            <button click={[this.onChangeColor, "blue"]}>Blue</button>
            <span style={ {color: this.color} }>Hello World!</span>;
        </div>
    }

    onChangeColor(e: MouseEvent, color: css.CssColor)
    {
        this.color = color;
    }
}

mim.mount( new HelloWorld());
```

For more details please see the following resources:
- [Documentation](https://www.mimjs.com/guide/introduction.html)
- [API Reference](https://www.mimjs.com/typedoc.html)
- [Playground](https://www.mimjs.com/demo/playground.html)

