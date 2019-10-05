import * as mim from "../api/mim"
import {VN} from "./VN"
import {VNBase} from "./VNBase"
import {IndependentCompVN} from "./IndependentCompVN"
import {ManagedCompVN} from "./ManagedCompVN"
import {FuncVN} from "./FuncVN"
import {ElmVN} from "./ElmVN"
import {TextVN} from "./TextVN"



// Creates either a single virtual node or an array of virtual nodes from the given content.
// For all types of contents other than an array, the returned value is a single VN. If the input
// content is an array, then a VN is created for each of the array elements. Since array elements
// might also be arrays, the process is recursive.
export function createNodesFromContent( content: any): VN | VN[]
{
	if (content === null || content === undefined || content === false || typeof content === "function")
		return null;
	else if (typeof content === "string")
		return new TextVN( content);
	else if (content instanceof VNBase)
		return content;
	else if (typeof content.render === "function")
	{
		// if the component (this can only be an Instance component) is already attached to VN, add
		// this existing VN; otherwise create a new one.
		return (content as mim.IComponent).vn
						? (content as mim.IComponent).vn as VN
						: new IndependentCompVN( content as mim.IComponent);
	}
	else if (Array.isArray( content))
		return createNodesFromArray( content);
	else if (content instanceof Promise)
		throw content;
	else
		return new TextVN( content.toString());
}



// Creates an array of virtual nodes from the given content. Calls the createNodesFromContent and
// if it returns a single node, wraps it in an array.
export function createVNChainFromContent( content: any): VN[]
{
	let nodes = createNodesFromContent( content);
	if (!nodes)
		return null;
	else if (Array.isArray(nodes))
		return nodes;
	else
		return [nodes];
}



// Creates a chain of virtual nodes from the data provided by the TypeScript's JSX parser.
export function createNodesFromJSX( tag: any, props: any, children: any[]): VN | VN[]
{
	if (typeof tag === "string")
		return new ElmVN( tag as string, props, children);
	else if (tag === mim.Fragment)
		return createNodesFromArray( children);
	else if (typeof tag === "function")
	{
		// children parameter is always an array. A component can specify that its children are
		// an array of a certain type, e.g. class A extends mim.Component<{},T[]>. In this case
		// there are two ways to specify children in JSX that would be accepted by the TypeScript
		// compiler:
		//	1) <A>{t1}{t2}</A>. In this case, children will be [t1, t2] (as expected by A).
		//	2) <A>{[t1, t2]}</A>. In this case, children will be [[t1,t2]] (as NOT expected by A).
		//		This looks like a TypeScript bug.
		// The realChildren variable accommodates both cases.
		let realChildren = children.length === 1 && Array.isArray( children[0]) ? children[0] : children;
		if (typeof tag.prototype.render === "function")
			return new ManagedCompVN( tag as mim.IComponentClass, props, realChildren);
		else
			return new FuncVN( tag as mim.FuncCompType, props, realChildren);
	}

	/// #if DEBUG
	else
		throw new Error( "Invalid tag in jsx processing function: " + tag);
	/// #endif
}



// Creates array of virtual nodes from the given array of items.
function createNodesFromArray( arr: any[]): VN[]
{
	if (arr.length === 0)
		return null;

	let nodes: VN[] = [];
	for( let item of arr)
	{
		let itemNodes = createNodesFromContent( item);
		if (itemNodes === null)
			continue;
		else if (Array.isArray( itemNodes))
		{
			for( let vn of itemNodes)
				nodes.push( vn);
		}
		else
			nodes.push( itemNodes);
	}

	return nodes.length > 0 ? nodes : null;
}



