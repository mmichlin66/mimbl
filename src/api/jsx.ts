import {IManagedComponentProps, IComponent, ICustomWebElements} from "./CompTypes";
import { JsxElm } from "./ElementTypes";
import { IHtmlIntrinsicElements } from "./HtmlTypes";
import { ISvgIntrinsicElements } from "./SvgTypes";
import { IMathmlIntrinsicElements } from "./MathmlTypes";
import { content2VNs, symJsxToVNs } from "../core/Reconciler";



/**
 * Namespace defining interfaces used by TypeScript to type-check JSX expressions.
 */
export namespace JSX
{
    /**
     * Represents type returned from functional coponents and from the `render` functions of
     * class-based components. We allow any type to be returned.
     */
	export type Element = JsxElm;

    /**
     * Represents DOM tag names mapped to types defining their JSX properties.
     */
	export interface IntrinsicElements extends
        IHtmlIntrinsicElements,
        ISvgIntrinsicElements,
        IMathmlIntrinsicElements,
        ICustomWebElements
    {
    }

    /**
     * Represents the instance type of class-based components that can be used in JSX. That is,
     * all managed components must implement this interface.
     */
	export interface ElementClass extends IComponent {}

    /**
     * Defines the name of the property defining the type of the *props* object for managed
     * components. The {@link Component} base class has this property with the type defined as a
     * combination of component's property and event interfaces: {@link ComponentProps}.
     */
	export interface ElementAttributesProperty { props: {} }

    /**
     * Defines the name of the property inside the *props* object defining the type of children
     * accepted by the functional and managed components.
     */
	export interface ElementChildrenAttribute { children: {} }

	/**
     * Properties in this interface apply to functional and class-based components. Since our
     * functional components don't support keys, this interface is empty.
     */
	export interface IntrinsicAttributes {}

	/** Properties in this interface apply only to class-based components. */
	export interface IntrinsicClassAttributes<T extends IComponent> extends IManagedComponentProps<T> {}
}



/**
 * JSX Factory function. In order for this function to be invoked by the TypeScript compiler, the
 * `tsconfig.json` file must have the following options:
 *
 * ```json
 * "compilerOptions":
 * {
 *     "jsx": "react",
 *     "jsxFactory": "mim.jsx",
 *     "jsxFragmentFactory": "mim.Fragment"
 * }
 * ```
 *
 * The .tsx files must import the mimbl module as mim:
 * ```tsx
 * import * as mim from "mimbl"
 * ```
 *
 * This ensures that you have the `mim.jsx` function in scope even though it is usually not used
 * explicitly.
 *
 * @param tag
 * @param props
 * @param children
 */
export function jsx( tag: any, props: any, ...children: any[]): any
{
    // The children parameter is always an array. A component can specify that its children are
    // an array of a certain type, e.g. class A extends Component<{children: T[]}>. In this case
    // there are two ways to specify children in JSX that would be accepted by the TypeScript
    // compiler:
    //	1) <A>{t1}{t2}</A>. In this case, children will be [t1, t2] (as expected by A).
    //	2) <A>{[t1, t2]}</A>. In this case, children will be [[t1,t2]] (as NOT expected by A).
    //		This looks like a TypeScript bug.
    let realChildren = children.length === 1 && Array.isArray(children[0]) ? children[0] : children;
    return tag[symJsxToVNs](props, content2VNs(realChildren));
}



/**
 * An artificial `Fragment` component that is only used as a temporary collection of other items
 * in places where JSX only allows a single item. Our JSX factory function creates a virtual node
 * for each of its children and the function is never actually called.
 *
 * The `Fragment` component can be used directly; however, the better way is to set the
 * `jsxFragmentFactory` compiler option in the `tsconfig.json` file to `mim.Fragment` and use the
 * TypeScripts `<>...</>` construct as in the following example:
 *
 * ```tsx
 *	import * as mim from "mimbl"
 *	.....
 *	render()
 *	{
 *		return <>
 *			<div1/>
 *			<div2/>
 *			<div3/>
 *		</>
 *	}
 * ```
 *
 * Note that you must have the `mim.Fragment` function in scope (using `import * as mim from "mimbl"`)
 * even though it is not used explicitly.
 */
export function Fragment(): any {}



