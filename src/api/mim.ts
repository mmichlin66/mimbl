﻿import {CompProps, ICommonProps, IComponent, ICustomWebElements} from "./CompTypes";
import {IHtmlIntrinsicElements} from "./HtmlTypes";
import {ISvgIntrinsicElements} from "./SvgTypes";
import {symJsxToVNs, symToVNs, VN} from "../core/VN";


/**
 * Namespace defining interfaces used by TypeScript to type-check JSX expressions.
 */
export namespace JSX
{
	export type Element = any;

	export interface ElementClass extends IComponent {}

	export interface ElementAttributesProperty { props: {} }

	export interface ElementChildrenAttribute { children: any }

	export interface IntrinsicElements extends IHtmlIntrinsicElements, ISvgIntrinsicElements, ICustomWebElements {}

	// Properties in this interface apply to intrinsic elements and to functional components.
	export interface IntrinsicAttributes extends ICommonProps {}

	// Properties in this interface apply to class-based components.
	export interface IntrinsicClassAttributes<T> extends ICommonProps<T> {}
}



/**
 * JSX Factory function. In order for this function to be invoked by the TypeScript compiler, the
 * tsconfig.json must have the following option:
 *
 * ```json
 * "compilerOptions":
 * {
 *     "jsx": "react",
 *     "jsxFactory": "mim.jsx"
 * }
 * ```
 *
 * The .tsx files must import the mimbl module as mim: import * as mim from "mimbl"
 * @param tag
 * @param props
 * @param children
 */
export function jsx( tag: any, props: any, ...children: any[]): any
{
    // The children parameter is always an array. A component can specify that its children are
    // an array of a certain type, e.g. class A extends Component<{},T[]>. In this case
    // there are two ways to specify children in JSX that would be accepted by the TypeScript
    // compiler:
    //	1) <A>{t1}{t2}</A>. In this case, children will be [t1, t2] (as expected by A).
    //	2) <A>{[t1, t2]}</A>. In this case, children will be [[t1,t2]] (as NOT expected by A).
    //		This looks like a TypeScript bug.
    let realChildren = children.length === 1 && Array.isArray(children[0]) ? children[0] : children;
    return tag[symJsxToVNs]( props, realChildren[symToVNs]());
}



/**
 * An artificial "Fragment" component that is only used as a temporary collection of other items
 * in places where JSX only allows a single item. Our JSX factory function creates a virtual node
 * for each of its children and the function is never actually called. This function is only needed
 * because currently TypeScript doesn't allow the `<>` fragment notation if a custom JSX factory
 * function is used.
 *
 * Use it as follows:
 * ```tsx
 *	import * as mim from "mimbl"
 *	.....
 *	render()
 *	{
 *		return <Fragment>
 *			<div1/>
 *			<div2/>
 *			<div3/>
 *		</Fragment>
 *	}
  ```

 * @param props
 */
export function Fragment( props: CompProps<{}>): any {}



// Add jsxToVNs method to the Fragment class object. This method is invoked by the JSX mechanism.
Fragment[symJsxToVNs] = (props: any, children: VN[] | null): VN | VN[] | null => children;



