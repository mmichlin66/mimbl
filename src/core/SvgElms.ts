///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The SvgElmInfo type defines information that can be specified for an SVG element. This
// information can be of the following types:
//	- string - actual name to use for the element. Some SVG elements have names that cannot be used
//		in JX directly (e.g. because of hyphen like in "color-profile"). In this case the string
//		value will be the actual element name to put into HTML document, while JSX will be using
//		a camel-formatted name (e.g. "colorProfile").
//	- boolean - flag indicating that the element is "dual-purpose"; that is, element with this
//		name can be used as either HTML or SVG element.
//	- tuple of two elements - string and boolean corresponding to the above items.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export type SvgElmInfo = boolean | string | [string, boolean];



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The SvgElms class contains properties with names used to define SVG elements in JSX. When
// we need to create an element, we lookup the provided tag name and if we find it in this class
// we use document.createElementNS with the proper SVG namespace string. Values of these properties
// are SvgElmInfo values.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class SvgElms
{
	// Namespace used to create SVG elements.
	public static namespace: string = "http://www.w3.org/2000/svg";



	// Registers information about the given SVG tag
	public static register( tagName: string, info: SvgElmInfo): void
	{
		SvgElms.infos[tagName] = info;
	}



	// Determines whether the given tag name can be used as an SVG element name.
	public static isSvgElm( tagName: string): boolean
	{
		return tagName in SvgElms.infos;
	}



	// Returns information object for the given tag name.
	public static getSvgElmInfo( tagName: string): SvgElmInfo | undefined
	{
		return SvgElms.infos[tagName];
	}



	// Determines whether the given information object has the "dual-purpose" flag set.
	public static isDualPurpose( info: SvgElmInfo): boolean
	{
		if (Array.isArray( info))
			return (info as Array<any>).length > 1 ? (info as [string, boolean])[1] : false;
		else
			return typeof info === "string" ? false : info as boolean;
	}



	// Determines whether the given tag name is a "dual-purpose" element; that is can be either
	// HTML and SVG element.
	public static isTagDualPurpose( tagName: string): boolean
	{
		let info: SvgElmInfo = SvgElms.infos[tagName];
		return info ? SvgElms.isDualPurpose( info) : false;
	}



	// Returns the actual name to be used based on the information object and the tag name
	public static getElmName( info: SvgElmInfo, tagName: string): string | undefined
	{
		if (Array.isArray( info))
			return (info as Array<any>).length > 0 ? (info as [string, boolean])[0] : tagName;
		else
			return typeof info === "string" ? info as string : tagName;
	}



	// Returns the actual name to be used the given tag name
	public static getElmNameForTag( tagName: string): string
	{
		let info: SvgElmInfo = SvgElms.infos[tagName];
		return info ? SvgElms.getElmName( info, tagName) : tagName;
	}



	// Object that maps SVG element names to SvgElmInfo.
	private static infos: {[elmName:string]: SvgElmInfo} =
	{
		svg: false,

		a: true,
		animate: false,
		animateMotion: false,
		animateTransform: false,

		circle: false,
		clipPath: false,
		colorProfile: "color-profile",

		defs: false,
		desc: false,
		discard: false,

		ellipse: false,

		feBlend: false,
		feColorMatrix: false,
		feComponentTransfer: false,
		feComposite: false,
		feConvolveMatrix: false,
		feDiffuseLighting: false,
		feDisplacementMap: false,
		feDistantLight: false,
		feDropShadow: false,
		feFlood: false,
		feFuncA: false,
		feFuncB: false,
		feFuncG: false,
		feFuncR: false,
		feGaussianBlur: false,
		feImage: false,
		feMerge: false,
		feMergeNode: false,
		feMorphology: false,
		feOffset: false,
		fePointLight: false,
		feSpecularLighting: false,
		feSpotLight: false,
		feTile: false,
		feTurbulence: false,
		filter: false,
		foreignObject: false,

		g: false,

		hatch: false,
		hatchpath: false,

		image: false,

		line: false,
		linearGradient: false,

		marker: false,
		mask: false,
		metadata: false,
		mpath: false,

		path: false,
		pattern: false,
		polygon: false,
		polyline: false,

		radialGradient: false,
		rect: false,

		script: true,
		set: false,
		solidcolor: false,
		stop: false,
		style: true,
		switch: false,
		symbol: false,

		text: false,
		textPath: false,
		title: true,
		textSpan: false,

		use: false,

		view: false,
	}
}



