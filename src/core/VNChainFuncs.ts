import * as mim from "./mim"
import {VN} from "./VN"
import {VNChain} from "./VNChain"
import {InstanceVN} from "./InstanceVN"
import {ClassVN} from "./ClassVN"
import {FuncVN} from "./FuncVN"
import {ElmVN} from "./ElmVN"
import {TextVN} from "./TextVN"



// Creates a chain of virtual nodes from the given content. For all types of contents other than an
// array, the returned chain contains a single VN. If the input content is an array, then
// a VN is created for each of the array elements. Since array elements might also be arrays,
// the process is recursive.
export function createVNChainFromContent( content: any): VNChain
{
	if ( content === undefined || content === null ||content === false || typeof content === "function")
		return null;

	const chain = new VNChain();
	if (typeof content === "string")
		chain.appendVN( new TextVN( content));
	else if (typeof content.render === "function")
		chain.appendVN( new InstanceVN( content as mim.IComponent));
	else if (Array.isArray( content))
	{
		for( let arrItem of content)
			chain.appendChain( createVNChainFromContent( arrItem));
	}
	else if (content instanceof VN)
		chain.appendVN( content);
	else if (content instanceof VNChain)
		chain.appendChain( content);
	else if (content instanceof Promise)
		throw content;
	else
		chain.appendVN( new TextVN( content.toString()));

	return chain;
}



// Creates a chain of virtual nodes from the data provided by the TypeScript's JSX parser.
export function createVNChainFromJSX( tag: any, props: any, children: any[]): VNChain
{
	const chain: VNChain = new VNChain();

	if (typeof tag === "string")
		chain.appendVN( new ElmVN( tag as string, props, children));
	else if (tag === mim.Fragment)
		chain.appendChain( createVNChainFromContent( children));
	else if (tag.prototype && typeof tag.prototype.render === "function")
		chain.appendVN( new ClassVN( tag as mim.IComponentClass, props, children));
	// else if (mim.Component.isPrototypeOf( tag))
	// 	chain.appendVN( new ClassVN( tag as mim.IComponentClass, props, children));
	else if (typeof tag === "function")
		chain.appendVN( new FuncVN( tag as mim.FuncCompType, props, children));
	/// #if DEBUG
	else
		throw new Error( "Invalid tag in jsx processing function: " + tag);
	/// #endif

	return chain;
}



