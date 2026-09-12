///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Element namespace constants.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

export const HtmlNamespace = "http://www.w3.org/1999/xhtml";
export const SvgNamespace = "http://www.w3.org/2000/svg";
export const MathmlNamespace = "http://www.w3.org/1998/Math/MathML";



/** Comma-separated list of all SVG element names */
const SvgTagNamesAsString =
    "svgA,animate,animateMotion,animateTransform,circle,clipPath,defs,desc,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,image,line,linearGradient,marker,mask,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,svgScript,set,stop,svgStyle,svg,switch,symbol,text,textPath,svgTitle,tspan,use,view";

// /** Array of all SVG element names */
// const SvgTagNames = SvgTagNamesAsString.split(",");

/** Comma-separated list of all MathML element names */
const MathmlTagNamesAsString =
    "math,merror,mfrac,mi,mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,mspace,msqrt,mstyle,msub,msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,semantics,annotation,annotation-xml";

// /** Array of all MathML element names */
// const MathmlTagNames = MathmlTagNamesAsString.split(",");

/**
 * Map of SVG and MathML element names to their respective namespaces - an efficient name to know
 * the namespace required to create an element (see {@link getElmNS}). HTML elements are nt in this
 * map because they don't need to indicate namespace to be created.
 */
const ElementNamespaces = new Map<string, string>([
    ...SvgTagNamesAsString.split(",").map((tag): [string, string] => [tag, SvgNamespace]),
    ...MathmlTagNamesAsString.split(",").map((tag): [string, string] => [tag,MathmlNamespace])
]);

// /**
//  * Returns namespace string for the given element name (SVG or MathML) and null if the name is a
//  * regular HTML element.
//  */
// export const getElmNS = (elmName: string): string | null =>
//     SvgTagNames.includes(elmName) ? SvgNamespace :
//     MathmlTagNames.includes(elmName) ? MathmlNamespace :
//     null;

/**
 * Returns namespace string for the given element name (SVG or MathML) and undefined if the name is a
 * regular HTML element.
 */
export const getElmNS = (elmName: string): string | undefined => ElementNamespaces.get(elmName)



/**
 * Some SVG elements have the same names as HTML. To distinguish them we are using special names,
 * and this object maps the special names to the names that should be used in DOM.
 */
const RealElementNames: { [elmName:string]: string } =
{
    svgA: "a",
    svgTitle: "title",
    svgScript: "script",
    svgStyle: "style",
}

/**
 * Returns a "real" element name to use in HTML for certain SVG elements that have names identical
 * to HTML elements. In JSX, these SVG elements must be specified by differen names; for example,
 * to use SVG's `<a>` element, JSX must use `<svgA>`.
 */
export const getElmRealName = (elmName: string): string => RealElementNames[elmName] ?? elmName;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Utility functions.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

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
    // check by identity - regardess of type
	if (o1 === o2)
		return true;

    // treat null and undefined as equal
	if (o1 == null && o2 == null)
        return true;

    // treat two NaN as equal
	if (isNaN(o1) && isNaN(o2))
        return true;

    // if this is the last level of comparizon, parameters are not equal because only identity or
    // null/undefined equality would do and it was already checked.
    if (level === 0)
        return false;

    // if only one is null/undefined - not equal.
	if (o1 == null || o2 == null)
		return false;

    // from here on, both parameters are defined and not null
	if (typeof o1 !== typeof o2)
		return false;

    // from here on, the types of the two parameters are the same
	if (Array.isArray(o1) !== Array.isArray(o2))
		return false;

    // arrays must be of the same length and elements should be deeply comparable.
	if (Array.isArray(o1))
	{
		if (o1.length !== o2.length)
			return false;

        for (let i = 0, len = o1.length; i < len; i++)
        {
            if (!s_deepCompare(o1[i], o2[i], level - 1))
                return false;
        }

        return true;
	}

    // check Date
    if (o1 instanceof Date && o2 instanceof Date)
        return o1.valueOf() == o2.valueOf();

    // check Date
    if (o1 instanceof RegExp && o2 instanceof RegExp)
        return o1.source == o2.source && o1.flags === o2.flags;

    // check Set; since there is no efficient way to perform deep comparizon of the elements in
    // the sets we rely on key identities.
    if (o1 instanceof Set && o2 instanceof Set)
	{
        if (o1.size !== o2.size)
            return false;

		for (let v of o1)
		{
			if (!o2.has(v))
				return false;
		}
	}

    // check Map; since there is no efficient way to perform deep comparizon of the keys in
    // the maps we rely on key identities; however, we deeply compare the values of the same
    // keys. Note that we treat an absence of a key and the existence of the key with the
    // undefined value as a difference.
    if (o1 instanceof Map && o2 instanceof Map)
	{
        if (o1.size !== o2.size)
            return false;

		for (let k of o1)
		{
			if (!o2.has(k))
				return false;

            if (!s_deepCompare(o1.get(k), o2.get(k), level - 1))
				return false;
		}
	}

    // check general objects by comparing their enumerable properties' values. Note that we treat
    // an absence of a property and the existence of the property with the undefined value as a
    // difference.
	if (typeof o1 === "object")
	{
        if (Object.keys(o1).length !== Object.keys(o2).length)
            return false;

		for (let p in o1)
		{
			if (!(p in o2))
				return false;

			if (!s_deepCompare(o1[p], o2[p], level - 1))
				return false;
		}

        return true;
	}

    // we are here if these are strings, numbers, booleans or functions and they are different
    return false;
}



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



