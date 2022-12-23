﻿import {ICommonProps, IComponent, ICustomWebElements, RefPropType} from "../api/CompTypes";
import {IHtmlIntrinsicElements} from "../api/HtmlTypes";
import {ISvgIntrinsicElements} from "../api/SvgTypes";
import {IVN} from "../core/VNTypes";
import { content2VNs, symJsxToVNs } from "../core/Reconciler";



/**
 * Type that of entities that can become renderable content
 */
export type RenderableContent = object | string | number | bigint | Function | RenderableContent[];



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
	export interface IntrinsicClassAttributes<T> extends ICommonProps {
        ref?: RefPropType<T>;
    }
}



/**
 * JSX Factory function. In order for this function to be invoked by the TypeScript compiler, the
 * `tsconfig.json` file must have the following options:
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
    return tag[symJsxToVNs](props, content2VNs(realChildren));
}



/**
 * An artificial `Fragment` component that is only used as a temporary collection of other items
 * in places where JSX only allows a single item. Our JSX factory function creates a virtual node
 * for each of its children and the function is never actually called.
 *
 * The `Fragment` component can be used directly; however, the better way is to set the
 * `jsxFragmentFactory` compiler option in the `tsconfig.json` file to `mim.Fragment` and use the
 * TypeScripts `<>...</> construct as in the following example:
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
  ```

 * @param props
 */
export function Fragment(): any {}



// Add jsxToVNs method to the Fragment class object. This method is invoked by the JSX mechanism.
Fragment[symJsxToVNs] = (props: Record<string,any> | undefined,
    children: IVN[] | null): IVN | IVN[] | null | undefined => content2VNs(children);



