# Mimbl - Component Authoring Library
Mimbl is a TypeScript/JavaScript UI authoring library that combines declarative and imperative programming in one package. Mimbl is proposed as an alternative to React. The accompanying document [React Discussion](http://mmichlin66.github.io/2019/08/10/React-Discussion.html) provides more information about aspects of React that this library strives to improve on.

## Installation

```
npm install mimbl -D
```

## Features
Mimbl provides all the standard React-style functionality that developers expect from component authoring libraries: declarative laying out of HTML structure, function- and class-based components, references, error boundaries, lazy-loading, etc. In addition to this functionality Mimbl provides the following unique features:

- Instance-based components whose lifecycle is controlled by developers and which can be accessed via standard property and method invocation.
- Custom HTML and SVG attributes defined by developers and supported via handler objects.
- Context functionality based on publish/subscribe mechanism.

## Usage
The mimbl library provides a custom JSX factory function calld `jsx`. In order for this function to be invoked by the TypeScript compiler, the tsconfig.json must have the following option:

```json
"compilerOptions":
{
    "jsx": "react",
    "jsxFactory": "mim.jsx"
}
 ```

The .tsx files must import the mimbl module as mim: import * as mim from "mimbl":

```tsx
import * as mim from "mimbl"

// Define a component
class MyComp extends mim.Component
{
    @mim.prop txtColor: string;

    constructor( txtColor: string = "black")
    {
        super();
        this.txtColor = txtColor;
    }
    
    render(): any
    {
        return <span style={ {color: this.txtColor} }>Hello World!</span>;
    }
}
```

For more details please see the following resources:
* [About](https://mmichlin66.github.io/mimbl/mimblAbout.html)
* [API Reference](https://mmichlin66.github.io/mimurl/mimblReference.html)
* [Playground](https://mmichlin66.github.io/mimurl/mimblDemo.html) (work in progress)

