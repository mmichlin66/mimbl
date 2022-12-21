import {Styleset, MediaStatement} from "mimcss"
import { TickSchedulingType, ICustomAttributeHandlerClass, PropType } from "../api/CompTypes"
import { Ariaset, DatasetPropType } from "../api/ElementTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { mimcss } from "./StyleScheduler";
import { CheckedPropType } from "../api/HtmlTypes";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Information about attributes and events and functions to set/update/remove them.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Base interface describing information kept about property that can be specified for an element.
 */
export interface PropInfoBase
{
	// Type of the property.
	type: PropType;
}



/**
 * Information about attributes that contains functions for setting, diffing, updating and removing
 * attribute(s) corresponding to the property.
 */
export interface AttrPropInfo extends PropInfoBase
{
	/**
     * Function that converts attribute value to string. If this function is not defined, a
     * standard algorithm is used, in which:
     *   - string is returned as is.
     *   - true is converted to an empty string.
     *   - false is converted to null.
     *   - null and undefined are converted to null.
     *   - arrays are converted by calling this function recursively on the elements and separating
     *     them with spaces.
     *   - everything else is converted by calling the toString method.
     */
	v2s?: (name: string, val: any) => string | null;

	/**
     * Function that sets the value of the attribute. If this function is not defined, then the
     * value is converted to string and is set either via the element's setAttribute() function
     * or (if `isProp` property is true) by assigning the string value to the element's property.
     */
	set?: (elm: Element, name: string, val: any) => void;

	/**
     * Function that updates the value of the attribute based on the object that was returned from
     * the diff function. If this function is not defined, then the old and the new values are
     * converted to strings and copared. If the strings are identical, no DOM operation is
     * performed; otherwise, the value is set to the element either via the set function, if
     * defined, or via the element's setAttribute() method or (if `isProp` property is true) by
     * assigning the string value to the element's property.
     */
	update?: (elm: Element, name: string, oldVal: any, newVal: any) => boolean | void;

	/**
     * Function that removes the attribute. If this function is not defined, then the DOM
     * elm.removeAttribute is called with propName as attribute name.
     */
	remove?: (elm: Element, name: string, oldVal: any) => void;

	/**
     * The actual name of the attribute/property. This is sometimes needed if the attribute name
     * cannot be used as property name - for example, if attribute name contains characters not
     * allowed in TypeScript identifier (e.g. dash). It is also used if instead of using the
     * `setAttribute()` method we want to set the element's property directly and the property
     * name is different from the attribute name. For example, `class` -> `className` or
     * `for` -> `htmlFor`.
     *
     * This field can also specify a function that gets the attribute name and returns a different
     * name. This can be usefull, for example, to convert property name from one form to another,
     * e.g. from camelCase to dash-case
     */
	name?: string | ((name: string) => string);

    /**
     * Flag indicating that the attribute's value can be set to the element via property assignment
     * instead of the setAttribute() method.
     */
    isProp?: boolean;
}



/** Information about events. */
export interface EventPropInfo extends PropInfoBase
{
	// Type of scheduling the Mimbl tick after the event handler function returns
	schedulingType?: TickSchedulingType;

	// // Flag indicating whether the event bubbles. If the event doesn't bubble, the event handler
	// // must be set on the element itself; otherwise, the event handler can be set on the root
	// // anchor element, which allows having a single event handler registered for many elements,
	// // which is more performant.
	// isBubbling?: boolean;
}



/** Information about custom attributes. */
export interface CustomAttrPropInfo extends PropInfoBase
{
	// Class object that creates custom attribute handlers.
	handlerClass: ICustomAttributeHandlerClass<any>;
}



/** Type combining information about regular attributes or events or custom attributes. */
export type PropInfo = AttrPropInfo | EventPropInfo | CustomAttrPropInfo;



/** Registers information about the given property. */
export function registerElmProp( propName: string, info: AttrPropInfo | EventPropInfo | CustomAttrPropInfo): void
{
    if (propName in propInfos)
    {
        /// #if DEBUG
        console.error( `Element property ${propName} is already registered.`);
        /// #endif

        return;
    }

    propInfos[propName] = info;
}



/**
 * Sets the value of the given attribute on the given element. This method handles special cases
 * of properties with non-trivial values.
 */
export function setAttrValue(elm: Element, name: string, val: any): void
{
    let info = propInfos[name];
    if (info && info.type !== PropType.Attr)
        return;

    setElmProp(elm, name, info as AttrPropInfo, val);
}



/**
 * Using the given property name and its value set the appropriate attribute(s) on the element.
 * This method handles special cases of properties with non-trivial values.
 */
export function setElmProp(elm: Element, name: string, info: AttrPropInfo | null, val: any): void
{
    // get property info object
    if (!info)
    {
        let s = valToString( val);
        if (s != null)
        {
            elm.setAttribute( name, s);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
            /// #endif
        }
    }
    else
    {
        let {name: nameOrFunc, set} = info;

        // get actual attribute/property name to use
        if (nameOrFunc)
            name = typeof nameOrFunc === "string" ? nameOrFunc : nameOrFunc(name);

        if (set)
            set( elm, name, val);
        else
        {
            let {v2s} = info;
            let s = v2s ? v2s(name, val) : valToString( val);

            if (s != null)
            {
                setAttrValueToElement(elm, name, s, info);

                /// #if USE_STATS
                    DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
                /// #endif
            }
        }
    }
}



/**
 * Determines whether the old and the new values of the property are different and sets the updated
 * value to the element's attribute. Returns true if update has been performed and false if no
 * change in property value has been detected.
 */
export function updateElmProp(elm: Element, name: string, info: AttrPropInfo | null,
    oldVal: any, newVal: any): void
{
    // get property info object; if this is not a special case (property is not in our list)
    // just set the new value to the attribute.
    if (!info)
        convertCompareAndUpdateOrRemoveAttr(elm, name, oldVal, newVal);
    else
    {
        let {name: nameOrFunc, update, set} = info;

        // get actual attribute/property name to use
        if (nameOrFunc)
            name = typeof nameOrFunc === "string" ? nameOrFunc : nameOrFunc(name);

        // if update method is defined use it; otherwise, if set methid is defined use it;
        // otherwise, set the new value using setAttribute
        if (update)
        {
            /// #if USE_STATS
                if (update( elm, name, oldVal, newVal))
                    DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
            /// #else
                update( elm, name, oldVal, newVal);
            /// #endif
        }
        else if (set)
        {
            set( elm, name, newVal);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
            /// #endif
        }
        else
            convertCompareAndUpdateOrRemoveAttr(elm, name, oldVal, newVal, info);
    }
}



/** Removes the attribute(s) corresponding to the given property. */
export function removeElmProp(elm: Element, name: string, info: AttrPropInfo | null, oldVal: any): void
{
    // get property info object
    if (!info)
        elm.removeAttribute( name);
    else
    {
        let {name: nameOrFunc, remove} = info;

        // get actual attribute/property name to use
        if (nameOrFunc)
            name = typeof nameOrFunc === "string" ? nameOrFunc : nameOrFunc(name);

        if (remove)
            remove( elm, name, oldVal);
        else
            removeAttrFromElement(elm, name, info);
    }

    /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
    /// #endif
}



/**
 * Converts the old and new values to strings and compares them. If the strings are identical, does
 * nothing. If the strings are different and the new value is not null or undefined, then updtes
 * the element's attribute; otherwise, removes the attribute.
 */
function convertCompareAndUpdateOrRemoveAttr(elm: Element, name: string, oldVal: any, newVal: any,
    info?: AttrPropInfo | null): void
{
    let v2s = info?.v2s;
    let oldS = v2s ? v2s(name, oldVal) : valToString( oldVal);
    let newS = v2s ? v2s(name, newVal) : valToString( newVal);
    if (oldS !== newS)
    {
        if (newS != null)
        {
            setAttrValueToElement(elm, name, newS, info);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
            /// #endif
        }
        else
        {
            removeAttrFromElement(elm, name, info);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
            /// #endif
        }
    }
}



/**
 * Helper function that depending on the info.isProp flag either uses the element's setAttribute()
 * method or sets the value to the element's property.
 */
function setAttrValueToElement(elm: Element, name: string, val: string, info?: AttrPropInfo | null): void
{
    if (info?.isProp)
        elm[name] = val;
    else
        elm.setAttribute( name, val);
}



/**
 * Helper function that depending on the info.isProp flag either uses the element's removeAttribute()
 * method or sets null to the element's property.
 */
function removeAttrFromElement(elm: Element, name: string, info?: AttrPropInfo | null): void
{
    if (info?.isProp)
        elm[name] = null;
    else
        elm.removeAttribute(name);
}



/** Converts string from camelCase to dash-case */
const camelToDash = (s: string): string => s.replace( /([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();



/** Joins array elements with comma */
const array2s = (val: any[], sep: string): string =>
    val == null ? "" : val.map( item => valToString(item)).filter( item => !!item).join(sep);

/** Joins array elements with comma */
const array2sWithComma = (elm: Element, name: string, val: any[]): string => array2s(val, ",");

/** Joins array elements with semicolon */
const array2sWithSemicolon = (elm: Element, name: string, val: any[]): string => array2s(val, ";");



/**
 * Helper function that converts the given value to string or null. Null is an indication that
 * the attribute should not be set or should be deleted.
 *   - strings are returned as is.
 *   - true is converted to an empty string.
 *   - false is converted to null.
 *   - null and undefined are converted to null.
 *   - arrays are converted by calling this function recursively on the elements and separating
 *     them with spaces.
 *   - everything else is converted by calling the toString method.
 *
 * Note that although this functiondoes handles null and undefined, it is normally should
 * not be called with these values as the proper action is to remove attributes with such values.
 */
const valToString = (val: any): string | null =>
    val == null || val === false ? null :
    val === true ? "" :
	typeof val === "string" ? val :
    Array.isArray(val) ? array2s(val, " ") :
    val.toString();



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of "object" properties - properties whose value is an object and every object's
// property corresponds to a separate element attribute. For example, dataset and aria are
// examles of such object properties.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/** Type describing the most generic form of object properties */
type ObjectPropValueType = { [K: string]: any };

/** Type for function that converts object property name to element attribute name */
type ObjectPropToAttrNameFunc = (propName: string) => string;

/** Type for function that converts object property value to string */
type ObjectPropValToStringFunc = (val: any) => string;



/** Sets object attributes like `data-*` or `aria-*` */
function setObjectProp(elm: HTMLInputElement, name: string, val: ObjectPropValueType,
    nameFunc: ObjectPropToAttrNameFunc, valFunc: ObjectPropValToStringFunc): void
{
    for( let key in val)
        elm.setAttribute(nameFunc(key), valFunc(val[key]));
}



/** Updates object attributes like `data-*` or `aria-*` */
function updateObjectProp(elm: HTMLInputElement, name: string,
    oldVal: ObjectPropValueType, newVal: ObjectPropValueType,
    nameFunc: ObjectPropToAttrNameFunc, valFunc: ObjectPropValToStringFunc): boolean
{
    let hasChanges = false;

    // loop over old data properties: remove those not found in the new data set and change
    // those that have different values in the new data set compared to the old data set.
    for( let dataPropName in oldVal)
    {
        if (!(dataPropName in newVal))
        {
            elm.removeAttribute(nameFunc(dataPropName));
            hasChanges = true;
        }
        else
        {
            let dataPropValOld = oldVal[dataPropName];
            let dataPropValNew = newVal[dataPropName];
            if (dataPropValOld !== dataPropValNew)
            {
                let dataPropStringNew = valFunc(dataPropValNew);
                if (dataPropToString(dataPropValOld) !== dataPropStringNew)
                {
                    elm.setAttribute(nameFunc(dataPropName), dataPropStringNew);
                    hasChanges = true;
                }
            }
        }
    }

    // loop over old data properties: set those not found in the old data set.
    for( let dataPropName in newVal)
    {
        if (!(dataPropName in oldVal))
        {
            elm.setAttribute(nameFunc(dataPropName), valFunc(newVal[dataPropName]));
            hasChanges = true;
        }
    }

    return hasChanges;
}



/** Removes object attributes like `data-*` or `aria-*` */
function removeObjectProp(elm: HTMLInputElement, name: string, oldVal: ObjectPropValueType,
    nameFunc: ObjectPropToAttrNameFunc): void
{
    for( let key in oldVal)
        elm.removeAttribute(nameFunc(key));
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of some special properties.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Function that does nothing - sometimes needed to avoid doing anything when setting, updating
 * or removing attributes.
 */
const doNothing = () => {}



function setCheckedProp(elm: HTMLInputElement, name: string, val: CheckedPropType): void
{
    if (typeof val == "boolean")
    {
        elm.checked = val;
        elm.indeterminate = false;
    }
    else
    {
        elm.checked = false;
        elm.indeterminate = true;
    }
}



function removeCheckedProp(elm: HTMLInputElement, name: string): void
{
    elm.checked = false;
}



function setDefaultCheckedProp(elm: HTMLInputElement, name: string, val: CheckedPropType): void
{
    if (typeof val == "boolean")
    {
        elm.checked = elm.defaultChecked = val;
        elm.indeterminate = false;
    }
    else
    {
        elm.checked = elm.defaultChecked = false;
        elm.indeterminate = true;
    }
}



function setDefaultValueProp(elm: HTMLInputElement, name: string, val: string): void
{
    elm.value = elm.defaultValue = val;
}



/**
 * SVG presentation attributes can be used as CSS style properties and, therefore, there
 * conversions to strings are already handled by Mimcss library. If Mimcss library is not included,
 * then value can only be a string. If it is not, we set the attribute to empty string. Note that
 * SVG attribute names can be provided in camelCase, so they are converted to dash-case.
 */
const svgAttrToStylePropString = (name: string, val: any): string =>
    mimcss ? mimcss.getStylePropValue(name, val) : typeof val === "string" ? val : "";



/**
 * Converts style property value using Mimcss library if available.
 */
const styleToString = (name: string, val: string | Styleset): string | null =>
    // if Mimcss library is not included, then style attributes can only be strings. If they are
    // not, this is an application bug and we cannot handle it.
    typeof val === "string" ? val : mimcss ? mimcss.stylesetToString(val) : null;



/**
 * Converts media property value using Mimcss library if available.
 */
const mediaToString = (name: string, val: MediaStatement): string | null =>
    // if Mimcss library is not included, then style attributes can only be strings. If they are
    // not, this is an application bug and we cannot handle it.
    typeof val === "string" ? val : mimcss ? mimcss.mediaToString(val) : null;


/** Converts property of the data set to a `data-*` name */
const dataPropToAttrName = (propName: any): string => `data-${camelToDash(propName)}`

/** Converts property of the data set to string */
const dataPropToString = (val: any): string =>
    Array.isArray(val) ? val.map( item => dataPropToString(item)).join(" ") : "" + val;

/** Sets `data-* attributes */
const setDataProp = (elm: HTMLInputElement, name: string, val: DatasetPropType): void =>
    setObjectProp(elm, name, val, dataPropToAttrName, dataPropToString);

/** Updates `data-* attributes */
const updateDataProp = (elm: HTMLInputElement, name: string, oldVal: DatasetPropType, newVal: DatasetPropType): boolean =>
    updateObjectProp(elm, name, oldVal, newVal, dataPropToAttrName, dataPropToString);

/** Removes `data-* attributes */
const removeDataProp = (elm: HTMLInputElement, name: string, oldVal: DatasetPropType): void =>
    removeObjectProp(elm, name, oldVal, dataPropToAttrName);



/** Converts property of the aria set to a `aria-*` name */
const ariaPropToAttrName = (propName: any): string => `aria-${propName}`

/** Converts property of the aria set to string */
const ariaPropToString = (val: any): string => dataPropToString(val);

/** Sets `aria-* attributes */
const setAriaProp = (elm: HTMLInputElement, name: string, val: Ariaset): void =>
    setObjectProp(elm, name, val, ariaPropToAttrName, ariaPropToString);

/** Updates `aria-* attributes */
const updateAriaProp = (elm: HTMLInputElement, name: string, oldVal: Ariaset, newVal: Ariaset): boolean =>
    updateObjectProp(elm, name, oldVal, newVal, ariaPropToAttrName, ariaPropToString);

/** Removes `aria-* attributes */
const removeAriaProp = (elm: HTMLInputElement, name: string, oldVal: Ariaset): void =>
    removeObjectProp(elm, name, oldVal, ariaPropToString);



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Mapping of attributes including framework-specific attributes, element attributes and event
// attributes to objects defining their behavior.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

const StdFrameworkPropInfo = { type: PropType.Framework };

// // sets and removes an attribute using element's property
// const AttrAsPropInfo = { type: PropType.Attr, isProp: true };

// Produces comma-separated list from array of values
const ArrayWithCommaPropInfo = { type: PropType.Attr, v2s: array2sWithComma };

// Produces semicolon-separated list from array of values
const ArrayWithSemicolonPropInfo = { type: PropType.Attr, v2s: array2sWithSemicolon };

// Handles conversion of SVG presentation attributes as Mimcss style properties to strings
const SvgAttrAsStylePropInfo = { type: PropType.Attr, v2s: svgAttrToStylePropString };

// Handles conversion of SVG presentation attributes' names from camelCase to dash case
const SvgAttrNameConversionPropInfo = { type: PropType.Attr, name: camelToDash };

// Handles conversion of SVG presentation attributes as Mimcss style properties to strings and
// conversion of camelCase propery names to dash case.
const SvgAttrAsStyleWithNameConversionPropInfo = { type: PropType.Attr, v2s: svgAttrToStylePropString, name: camelToDash };

/**
 * Object that maps property names to PropInfo-derived objects. Information about custom
 * attributes is added to this object when the registerProperty method is called.
 */
export const propInfos: {[P:string]: PropInfo} =
{
    // framework attributes.
    key: StdFrameworkPropInfo,
    ref: StdFrameworkPropInfo,
    vnref: StdFrameworkPropInfo,
    updateStrategy: StdFrameworkPropInfo,

    // attributes - only those attributes are listed that have non-trivial treatment or whose value
    // type is object or function.
    class: { type: PropType.Attr, name: "className", isProp: true },
    for: { type: PropType.Attr, name: "htmlFor", isProp: true },
    tabindex: { type: PropType.Attr, name: "tabIndex", isProp: true },
    checked: { type: PropType.Attr, set: setCheckedProp, remove: removeCheckedProp },
    defaultChecked: { type: PropType.Attr, set: setDefaultCheckedProp, update: doNothing, remove: doNothing },
    value: { type: PropType.Attr, isProp: true },
    defaultValue: { type: PropType.Attr, set: setDefaultValueProp, update: doNothing, remove: doNothing },
    style: { type: PropType.Attr, v2s: styleToString },
    media: { type: PropType.Attr, v2s: mediaToString },
    dataset: { type: PropType.Attr, set: setDataProp, update: updateDataProp, remove: removeDataProp },
    aria: { type: PropType.Attr, set: setAriaProp, update: updateAriaProp, remove: removeAriaProp },

    coords: ArrayWithCommaPropInfo,
    sizes: ArrayWithCommaPropInfo,
    srcset: ArrayWithCommaPropInfo,

    // SVG presentational attributes that require special conversion to string. This also takes
    // care of converting the attribute name from camelCase to dash-case if necessary.
	baselineShift: SvgAttrAsStylePropInfo,
	color: SvgAttrAsStylePropInfo,
	cursor: SvgAttrAsStylePropInfo,
	fillColor: { type: PropType.Attr, v2s: svgAttrToStylePropString, name: "fill" },
	fillOpacity: SvgAttrAsStyleWithNameConversionPropInfo,
	filter: SvgAttrAsStylePropInfo,
	floodColor: SvgAttrAsStyleWithNameConversionPropInfo,
	floodOpacity: SvgAttrAsStyleWithNameConversionPropInfo,
	fontSize: SvgAttrAsStyleWithNameConversionPropInfo,
	fontStretch: SvgAttrAsStyleWithNameConversionPropInfo,
	letterSpacing: SvgAttrAsStyleWithNameConversionPropInfo,
	lightingColor: SvgAttrAsStyleWithNameConversionPropInfo,
	markerEnd: SvgAttrAsStyleWithNameConversionPropInfo,
	markerMid: SvgAttrAsStyleWithNameConversionPropInfo,
	markerStart: SvgAttrAsStyleWithNameConversionPropInfo,
	mask: SvgAttrAsStylePropInfo,
	stopColor: SvgAttrAsStyleWithNameConversionPropInfo,
	stopOpacity: SvgAttrAsStyleWithNameConversionPropInfo,
	stroke: SvgAttrAsStylePropInfo,
	strokeOpacity: SvgAttrAsStyleWithNameConversionPropInfo,
	transform: SvgAttrAsStylePropInfo,
	transformOrigin: SvgAttrAsStyleWithNameConversionPropInfo,

    // SVG attributes that don't require conversion of the value but do require conversion of the
    // attribute name from camelCase to dash-case. All SVG presentation atributes with a dash
    // in the name are here.
	alignmentBaseline: SvgAttrNameConversionPropInfo,
	clipPath: SvgAttrNameConversionPropInfo,
	clipRule: SvgAttrNameConversionPropInfo,
	colorInterpolation: SvgAttrNameConversionPropInfo,
	colorInterpolationFilters: SvgAttrNameConversionPropInfo,
	dominantBaseline: SvgAttrNameConversionPropInfo,
	fillRule: SvgAttrNameConversionPropInfo,
	fontFamily: SvgAttrNameConversionPropInfo,
	fontSizeAdjust: SvgAttrNameConversionPropInfo,
	fontStyle: SvgAttrNameConversionPropInfo,
	fontVariant: SvgAttrNameConversionPropInfo,
	fontWeight: SvgAttrNameConversionPropInfo,
	imageRendering: SvgAttrNameConversionPropInfo,
	pointerEvents: SvgAttrNameConversionPropInfo,
	shapeRendering: SvgAttrNameConversionPropInfo,
	strokeDasharray: SvgAttrNameConversionPropInfo,
	strokeDashoffset: SvgAttrNameConversionPropInfo,
	strokeLinecap: SvgAttrNameConversionPropInfo,
	strokeLinejoin: SvgAttrNameConversionPropInfo,
	strokeMiterlimit: SvgAttrNameConversionPropInfo,
	strokeWidth: SvgAttrNameConversionPropInfo,
	textAnchor: SvgAttrNameConversionPropInfo,
	textDecoration: SvgAttrNameConversionPropInfo,
	textRendering: SvgAttrNameConversionPropInfo,
	unicodeBidi: SvgAttrNameConversionPropInfo,
	vectorEffect: SvgAttrNameConversionPropInfo,
	wordSpacing: SvgAttrNameConversionPropInfo,
	writingMode: SvgAttrNameConversionPropInfo,

    // SVG element atributes
    values: ArrayWithSemicolonPropInfo,
    begin: ArrayWithSemicolonPropInfo,
    end: ArrayWithSemicolonPropInfo,
    keyTimes: ArrayWithSemicolonPropInfo,
    keySplines: ArrayWithSemicolonPropInfo,

    // // global events
    // click: { type: PropType.Event, schedulingType: TickSchedulingType.Sync },
};



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// An element VN can be updated by a new VN, which was created by the different component. We do
// allow updating the element because it saves us the time necessary to remove one element and add
// a new one. However, in such cases we need to "clean" some special properties of some special
// elements. For example, the "checked" property of the HTMLInputElement reflects the actual
// "checked" state of a checkbox or a radio input elements; however, there is no attribute that
// reflects this state. If a new element doesn't define the "checked" property in its JSX, our
// code wouldn't try to set the element's "checked" property and, therefore, it will remain in the
// left over from the previous user action. If this previous state was "on", this will be a wrong
// state for the new rendering.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Cleans certain properties of the given element by looking at the elmPropsToClean structure
 */
export function cleanElmProps(elmName: string, elm: Element): void
{
    let props = elmPropsToClean[elmName];
    if (props)
    {
        for( let [propName, propVal] of Object.entries(props))
            elm[propName] = propVal;
    }
}

/**
 * Type mapping a "clean" value for certain properties of certain elements. The "clean" value is
 * the value that should be set when an element is updated by a different "creator" component.
 */
type ElmPropsToClean =
{
    [tag: string]: { [prop: string]: any }
}

const elmPropsToClean: ElmPropsToClean = {
    input: {
        checked: false,
        defaultChecked: false,
        intermediate: false,
    }
}


