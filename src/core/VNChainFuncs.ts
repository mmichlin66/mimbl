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
	const chain = new VNChain();
	let contentType: string = typeof content;
	if (content === null || content === undefined || contentType === "boolean" || contentType === "function")
		return chain;

	if (content instanceof VN)
		chain.appendVN( content as VN);
	else if (content instanceof VNChain)
		chain.appendChain( content as VNChain);
	else if (content instanceof mim.Component)
		chain.appendVN( new InstanceVN( content as mim.Component));
	else if (Array.isArray( content))
	{
		for( let arrItem of content as Array<any>)
			chain.appendChain( createVNChainFromContent( arrItem));
	}
	else if (contentType === "string")
		chain.appendVN( new TextVN( content as string));
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

	if (tag === mim.Fragment || tag === "m")
		chain.appendChain( createVNChainFromContent( children));
	else if (mim.Component.isPrototypeOf( tag))
		chain.appendVN( new ClassVN( tag as mim.IComponentClass, props, children));
	else
	{
		let tagType: string = typeof tag;
		if (tagType === "function")
			chain.appendVN( new FuncVN( tag as mim.FuncCompType, props, children));
		else if (tagType === "string")
			chain.appendVN( new ElmVN( tag as string, props, children));

		/// #if DEBUG
		else
			throw new Error( "Invalid tag in jsx processing function: " + tag);
		/// #endif
	}

	return chain;
}



