import * as mim from "../api/mim"
import {Styleset} from "mimcss"


export function deepCompare( o1: any, o2: any): boolean
{
	if (o1 === o2)
		return true;
	else if (o1 == null && o2 == null)
		return true;
	else if (o1 == null || o2 == null)
		return false;
	else if (typeof o1 !== typeof o2)
		return false;
	else if (typeof o1 === "object")
	{
		for( let p in o1)
		{
			if (!deepCompare( o1[p], o2[p]))
				return false;
		}

		for( let p in o2)
		{
			if (!(p in o1))
				return false;
		}
	}
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
				if (!deepCompare( o1[i], o2[i]))
					return false;
			}
		}
	}
	else
	{
		// we are here if these are strings, numbers, booleans or functions and they are different
		return false;
	}

	return true;
}



export function hashObject( o: any): number
{
	if (o === undefined)
		return 0;
	else if (o === null)
		return 1;
	else if (isNaN(0))
		return 2;
	else if (o === true)
		return 3;
	else if (o === false)
		return 4;

	let h = 10;

	if (typeof o === "number")
		return 10 + o;
	else if (typeof o === "string")
		return hashString( o);
	else if (typeof o === "function")
		return hashString( o.name);
	else if (Array.isArray(o))
	{
		let len = o.length;
		let h = 10 + len;
		for( let i = 0; i < len; i++)
			 h += i + hashObject( o[i]);
		return h;
	}
	else
	{
		let h = 10;
		for( let p in o)
			h += hashString(p) + hashObject(o[p]);
		return h;
	}
}



export function hashString( s: string): number
{
	if (!s)
		return 5;

	let len = s.length;
	let h = 10 + len;
	for( let i = 0; i < len; i++)
		h += s.charCodeAt(i);
	return h;
}



// Combines arbitrary number of class properties merging later into the earlier ones. This method
// returns a string or undefined - if all classNames were undefined.
export function mergeClasses( ...classNames: (string | string[])[]): string
{
	let resClassName: string;

	for( let className of classNames)
	{
		if (!className)
			continue;

		// parse the class if it is specified as a string
		let classNameAsString: string = typeof className === "string"
				? className as string
				: (className as string[]).join( " ");

		if (resClassName === undefined)
			resClassName = "";
		else
			resClassName += " ";

		resClassName += classNameAsString;
	}

	return resClassName;
}



// Combines arbitrary number of style objects merging later into the earlier ones. This method
// always returns an object - even if empty
export function mergeStyles( ...styles: Styleset[]): Styleset
{
	// create an empty object for accumulating style properties
	let resStyle: Styleset = {};
	mergeStylesTo( resStyle, ...styles);
	return resStyle;
}



// Combines arbitrary number of style objects merging later into the first one.
export function mergeStylesTo( resStyle: Styleset, ...styles: (Styleset | string)[] ): void
{
	for( let style of styles)
	{
		if (!style)
			continue;

		// parse the style if it is specified as a string
		let styleObj: Styleset = typeof style === "object"
				? style as Styleset
				: parseStyleString( style as string);

		// copy all properties defined in teh current style object to our resultant object			
		for( let propName in styleObj)
			resStyle[propName] = styleObj[propName];
	}
}



// Parses the given style string into the Style object.
export function parseStyleString( s: string): Styleset
{
	if (!s)
		return {};

	let retStyle: Styleset = {};

	let elms: string[] = s.split(";");
	for( let elm of elms)
	{
		let pair: string[] = elm.split( ":");
		if (!pair || pair.length === 0 || pair.length > 2)
			continue;

		retStyle[dashToCamel( pair[0].trim())] = pair[1].trim();
	}

	return retStyle;
}



/**
 * Converts names with dashes into names in camelCase, where every character after a dash is
 * capitalized and dashes are removed.
 */
export function dashToCamel( dash: string): string
{
	if (!dash)
		return dash;

	return dash.replace( /-([a-zA-Z])/g, (x, $1) => $1.toUpperCase());
}



/**
 * Converts camelCase to dash-case
 * @param camel
 */
export function camelToDash( camel: string): string
{
  return camel.replace( /([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
}



// Combines arbitrary number of Slice objects merging classes, styles, properties and content
export function mergeSlices( ...slices: mim.Slice[]): mim.Slice
{
	let resSlice: mim.Slice = {};
	mergeSlicesTo( resSlice, ...slices);
	return resSlice;
}



// Combines arbitrary number of Slice objects merging classes, styles, properties and content
// into the given resultant slice.
export function mergeSlicesTo( resSlice: mim.Slice, ...slices: mim.Slice[]): void
{
	if (resSlice === undefined || resSlice === null)
		return;

	for( let slice of slices)
	{
		if (!slice)
			continue;

		if (slice.style)
		{
			if (resSlice.style === undefined)
				resSlice.style = {};

			mergeStylesTo( resSlice.style, slice.style);
		}

		if (slice.className)
		{
			if (resSlice.className === undefined)
				resSlice.className = "";

			resSlice.className = mergeClasses( resSlice.className as string, slice.className);
		}

		if (slice.props)
		{
			if (resSlice.props === undefined)
				resSlice.props = {};

			for( let propName in slice.props)
				resSlice[propName] = slice[propName];
		}

		if (slice.content)
		{
			if (resSlice.content === undefined)
				resSlice.content = slice.content;
			else
			{
				if (!Array.isArray( resSlice.content))
				{
					let oldContent: any = resSlice.content;
					resSlice.content = [];
					resSlice.content.push( oldContent);
				}

				resSlice.content.push( slice.content);
			}
		}
	}
}



