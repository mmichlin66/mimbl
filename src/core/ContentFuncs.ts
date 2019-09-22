import * as mim from "./mim"
import {VN} from "./VN"
import {InstanceVN} from "./InstanceVN"
import {ClassVN} from "./ClassVN"
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
	else if (content instanceof VN)
		return content;
	else if (typeof content.render === "function")
	{
		// if the component (this can only be an Instance component) is already attached to VN, add
		// this existing VN; otherwise create a new one.
		return (content as mim.IComponent).site
						? (content as mim.IComponent).site as VN
						: new InstanceVN( content as mim.IComponent);

		// return [new InstanceVN( content as mim.IComponent)];
	}
	else if (Array.isArray( content))
	{
		if (content.length === 0)
			return null;

		let nodes: VN[] = [];
		for( let item of content)
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
		return createNodesFromContent( children);
	else if (typeof tag === "function")
	{
		if (typeof tag.prototype.render === "function")
			return new ClassVN( tag as mim.IComponentClass, props, children);
		else
			return new FuncVN( tag as mim.FuncCompType, props, children);
	}

	/// #if DEBUG
	else
		throw new Error( "Invalid tag in jsx processing function: " + tag);
	/// #endif
}



