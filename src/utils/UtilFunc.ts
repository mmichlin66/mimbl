///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Element namespace constants.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

export const HtmlNamespace = "http://www.w3.org/1999/xhtml";
export const SvgNamespace = "http://www.w3.org/2000/svg";
export const MathmlNamespace = "http://www.w3.org/1998/Math/MathML";



/**
 * Compares the two given values going only one level down to their properties (if objects or arrays)
 * @param o1
 * @param o2
 */
export const s_shallowCompare = (o1: any, o2: any): boolean =>
    s_deepCompare( o1, o2, 1);



/**
 * Compares the two given values going down to their properties if these are arrays or objects
 * up to the given maximum level
 * @param o1
 * @param o2
 */
export const s_deepCompare = (o1: any, o2: any, level: number = -1): boolean =>
{
	if (o1 === o2)
		return true;
	else if (o1 == null && o2 == null)
        return true;
    else if (level === 0)
        return false;
	else if (o1 == null || o2 == null)
		return false;
	else if (typeof o1 !== typeof o2)
		return false;
	else if (Array.isArray(o1) !== Array.isArray(o2))
		return false;
	else if (Array.isArray(o1))
	{
		if (o1.length !== o2.length)
			return false;
		else
		{
			for( let i = 0, len = o1.length; i < len; i++)
			{
				if (!s_deepCompare( o1[i], o2[i], level - 1))
					return false;
			}

            return true;
		}
	}
	else if (typeof o1 === "object")
	{
		for( let p in o1)
		{
			if (!s_deepCompare( o1[p], o2[p], level - 1))
				return false;
		}

		for( let p in o2)
		{
			if (!(p in o1))
				return false;
		}

        return true;
	}
	else
	{
		// we are here if these are strings, numbers, booleans or functions and they are different
		return false;
	}
}



// export function hashObject( o: any): number
// {
// 	if (o === undefined)
// 		return 0;
// 	else if (o === null)
// 		return 1;
// 	else if (isNaN(0))
// 		return 2;
// 	else if (o === true)
// 		return 3;
// 	else if (o === false)
// 		return 4;

// 	let h = 10;

// 	if (typeof o === "number")
// 		return 10 + o;
// 	else if (typeof o === "string")
// 		return hashString( o);
// 	else if (typeof o === "function")
// 		return hashString( o.name);
// 	else if (Array.isArray(o))
// 	{
// 		let len = o.length;
// 		let h = 10 + len;
// 		for( let i = 0; i < len; i++)
// 			 h += i + hashObject( o[i]);
// 		return h;
// 	}
// 	else
// 	{
// 		let h = 10;
// 		for( let p in o)
// 			h += hashString(p) + hashObject(o[p]);
// 		return h;
// 	}
// }



// export function hashString( s: string): number
// {
// 	if (!s)
// 		return 5;

// 	let len = s.length;
// 	let h = 10 + len;
// 	for( let i = 0; i < len; i++)
// 		h += s.charCodeAt(i);
// 	return h;
// }



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Utility functions for determining whether an element is an SVG.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Determines whether the given element is one of the elements from the SVG spec; that is, <svg>
 * or any other from SVG.
 * @param elm Element to test
 */
export const s_isSvg = (elm: Element): boolean =>
	"ownerSVGElement" in (elm as any);



/**
 * Determines whether the given element is the <svg> element.
 * @param elm  Element to test
 */
export const s_isSvgSvg = (elm: Element): boolean =>
	elm.tagName === "svg";
	// (elm as any).ownerSVGElement === null;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Mixins.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Copies all members from the prototypes of the given source constructor functions to the
 * prototype of the given source constructor function.
 * @param target Class to which to copy source members.
 * @param sources Mixin classes from which to copy members to the target.
 */
export function applyMixins(target: any, ...sources: any[]): void
{
    let targetPrototype = target.prototype;
    for (let source of sources)
    {
        let sourcePrototype = source.prototype;
        copyMixinProp(targetPrototype, sourcePrototype, Object.getOwnPropertyNames(sourcePrototype)
            .filter(name => name !== "constructor"));
        copyMixinProp(targetPrototype, sourcePrototype, Object.getOwnPropertySymbols(sourcePrototype));
    }
}

/**
 * Copies the definitions of the given properties from the source object to the target object. This
 * can be used for copying instace methods and accessors from prototype to prototype; or for
 * copying static methods and accessors from class to class.
 */
export const copyMixinProp = (target: object, source: object, props: PropertyKey[]) =>
    props.forEach(prop =>
        Object.defineProperty(target, prop, Object.getOwnPropertyDescriptor(source, prop)!));



