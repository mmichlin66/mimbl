import * as mim from "./mim"
import {IEventSlot, EventSlot} from"./EventSlot"



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The Classes abstract class provides useful static functions for working with class properties.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class Classes
{
	// Combines arbitrary number of class properties merging later into the earlier ones. This method
	// returns a string or undefined - if all classNames were undefined.
	public static MergeClasses( ...classNames: (string | string[])[]): string
	{
		let resClassName: string;

		for( let className of classNames)
		{
			if (!className)
				continue;

			// parse the class if it is specified as a string
			let classNameAsString: string = typeof className === "string"
					? className as string
					: Classes.ArrayToString( className as string[]);

			if (resClassName === undefined)
				resClassName = "";
			else
				resClassName += " ";

			resClassName += classNameAsString;
		}

		return resClassName;
	}



	// Combines arbitrary number of class objects merging later into the earlier ones.
	public static ArrayToString( classNames: string[]): string
	{
		return classNames.join( " ");
	}

}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The Styles abstract class provides useful static functions for working with style properties.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class Styles
{
	// Combines arbitrary number of style objects merging later into the earlier ones. This method
	// always returns an object - even if empty
	public static MergeStyles( ...styles: mim.StylePropType[]): mim.StylePropType
	{
		// create an empty object for accumulating style properties
		let resStyle: mim.StylePropType = {};
		Styles.MergeStylesTo( resStyle, ...styles);
		return resStyle;
	}



	// Combines arbitrary number of style objects merging later into the first one.
	public static MergeStylesTo( resStyle: mim.StylePropType, ...styles: (mim.StylePropType | string)[] ): void
	{
		for( let style of styles)
		{
			if (!style)
				continue;

			// parse the style if it is specified as a string
			let styleObj: mim.StylePropType = typeof style === "object"
					? style as mim.StylePropType
					: Styles.ParseStyleString( style as string);

			// copy all properties defined in teh current style object to our resultant object			
			for( let propName in styleObj)
				resStyle[propName] = styleObj[propName];
		}
	}



	// Combines arbitrary number of style objects merging later into the earlier ones.
	public static ParseStyleString( s: string): mim.StylePropType
	{
		if (!s)
			return {};

		let retStyle: mim.StylePropType = {};

		let elms: string[] = s.split(";");
		for( let elm of elms)
		{
			let pair: string[] = elm.split( ":");
			if (!pair || pair.length === 0 || pair.length > 2)
				continue;

			retStyle[Styles.DashToCamel( pair[0].trim())] = pair[1].trim();
		}

		return retStyle;
	}



	// Converts names with dashes into names in camelCase, where every character after a dash is
	// capitalized and dashes are removed.
	public static DashToCamel( dash: string): string
	{
		if (!dash)
			return dash;

		let camel: string;
		let index: number = -1;
		let nextIndexToCopyFrom: number = 0;
		while( (index = dash.indexOf( "-", index + 1)) >= 0)
		{
			if (camel === undefined)
				camel = "";

			camel += dash.substr( nextIndexToCopyFrom, index - nextIndexToCopyFrom);
			if (index != dash.length - 1)
				camel += dash[index + 1].toUpperCase();

			nextIndexToCopyFrom = index + 2;
		}

		if (camel === undefined)
			return dash;
		else
		{
			if (nextIndexToCopyFrom < dash.length)
				camel += dash.substr( nextIndexToCopyFrom);

			return camel;
		}
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The Slice type defines an object structure describing
// parameters for rendering an element. They include: Class, Style, Properties, Content. This
// structure is intended to be passed either in the constructor or via the protected methods of
// derived classes, so that they can control parameters of elements rendered by the upper classes.
// The main purpose of this structure is to combine parameters defining an element into a single
// object to minimize the number of properties callers of classes should deal with.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export type Slice =
{
	className?: string;
	style?: mim.StylePropType;
	props?: Object
	content?: any;
};



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The Slices abstract class provides useful static functions for working with Slices.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class Slices
{
	// Combines arbitrary number of Slice objects merging classes, styles, properties and content
	public static MergeSlices( ...slices: Slice[]): Slice
	{
		let resSlice: Slice = {};
		Slices.MergeSlicesTo( resSlice, ...slices);
		return resSlice;
	}


	// Combines arbitrary number of Slice objects merging classes, styles, properties and content
	// into the given resultant slice.
	public static MergeSlicesTo( resSlice: Slice, ...slices: Slice[]): void
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

				Styles.MergeStylesTo( resSlice.style, slice.style);
			}

			if (slice.className)
			{
				if (resSlice.className === undefined)
					resSlice.className = "";

				resSlice.className = Classes.MergeClasses( resSlice.className as string, slice.className);
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

}



