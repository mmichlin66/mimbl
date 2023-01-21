import {Styleset, MediaStatement} from "mimcss"
import { TickSchedulingType, ICustomAttributeHandlerClass, PropType } from "../api/CompTypes"
import { IAriaset, DatasetPropType } from "../api/ElementTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { mimcss } from "./StyleScheduler";
import { CheckedPropType } from "../api/HtmlTypes";
import { SvgNamespace } from "../utils/UtilFunc";



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
     *
     * @param val Value to be converted to string
     * @param name Attribute name - just in case the conversion depends on an attribute
     * @param elm Element whose attribute is being converted to string
     * @returns String value to be assigned to an attribute or null.
     */
	v2s?: (val: any, name: string, elm: Element) => string | null;

	/**
     * Function that sets the value of the attribute. If this function is not defined, then the
     * value is converted to string and is set either via the element's setAttribute() function
     * or (if `isProp` property is true) by assigning the string value to the element's property.
     */
	set?: (elm: Element, val: any, name: string) => string | null;

	/**
     * Function that updates the value of the attribute based on the object that was returned from
     * the diff function. If this function is not defined, then the old and the new values are
     * converted to strings and copared. If the strings are identical, no DOM operation is
     * performed; otherwise, the value is set to the element either via the set function, if
     * defined, or via the element's setAttribute() method or (if `isProp` property is true) by
     * assigning the string value to the element's property.
     * @returns New string value if updated; null if removed; undefined if no change.
     */
	update?: (elm: Element, oldS: string | null, newVal: any, name: string) => string | null | void;

	/**
     * Function that removes the attribute. If this function is not defined, then the DOM
     * elm.removeAttribute is called with propName as attribute name.
     */
	remove?: (elm: Element, oldS: string | null, name: string) => void;

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
    let info = getPropInfo(elm.localName, name);
    if (!info || info.type === PropType.Attr)
        setElmProp(elm, name, val, info as AttrPropInfo);
}



/**
 * Using the given property name and its value set the appropriate attribute(s) on the element.
 * This method handles special cases of properties with non-trivial values. Returns the new
 * string value of the attribute or null if the attribute was removed.
 */
export function setElmProp(elm: Element, name: string, val: any, info?: AttrPropInfo): string | null
{
    let s: string | null;

    // get property info object
    if (!info)
    {
        s = valToString( val);
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
            s = set( elm, val, name);
        else
        {
            let v2s = info.v2s;
            s = v2s ? v2s(val, name, elm) : valToString( val);
            if (s != null)
            {
                setAttrValueToElement(elm, name, s, info);

                /// #if USE_STATS
                    DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
                /// #endif
            }
        }
    }

    return s;
}



/**
 * Determines whether the old and the new values of the property are different and sets the updated
 * value to the element's attribute. Returns true if update has been performed and false if no
 * change in property value has been detected.
 */
export function updateElmProp(elm: Element, name: string, oldS: string | null, newVal: any,
    info?: AttrPropInfo): string | null
{
    let s: string | null;

    // get property info object; if this is not a special case (property is not in our list)
    // just set the new value to the attribute.
    if (!info)
        s = convertCompareAndUpdateOrRemoveAttr(elm, name, oldS, newVal);
    else
    {
        let {name: nameOrFunc, update, set} = info;

        // get actual attribute/property name to use
        if (nameOrFunc)
            name = typeof nameOrFunc === "string" ? nameOrFunc : nameOrFunc(name);

        // if update method is defined use it; otherwise, if set method is defined use it;
        // otherwise, set the new value using setAttribute
        if (update)
        {
            let res = update( elm, oldS, newVal, name);
            if (res === undefined)
                s = oldS;
            else
            {
                s = res;

                /// #if USE_STATS
                    DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
                /// #endif
            }
        }
        else if (set)
        {
            s = set( elm, newVal, name);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
            /// #endif
        }
        else
            s = convertCompareAndUpdateOrRemoveAttr(elm, name, oldS, newVal, info);
    }

    return s;
}



/** Removes the attribute(s) corresponding to the given property. */
export function removeElmProp(elm: Element, name: string, oldS: string | null, info?: AttrPropInfo): void
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
            remove( elm, oldS, name);
        else
            removeAttrFromElement(elm, name, info);
    }

    /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
    /// #endif
}



/**
 * Converts the new value to string and compares it to the given old string value. If the strings
 * are identical, just removes this value. If the strings are different and the new value is not
 * null or undefined, then updtes the element's attribute; otherwise, removes the attribute.
 * @returns New string value if the attribute was updated; null if the attribute was removed;
 * old string value if there was no change in the attribute's value.
 */
function convertCompareAndUpdateOrRemoveAttr(elm: Element, name: string, oldS: string | null,
    newVal: any, info?: AttrPropInfo): string | null
{
    let v2s = info?.v2s;
    let newS = v2s ? v2s(newVal, name, elm) : valToString( newVal);
    if (oldS !== newS)
    {
        if (newS != null)
        {
            setAttrValueToElement(elm, name, newS, info);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
            /// #endif

            return newS;
        }
        else
        {
            removeAttrFromElement(elm, name, info);

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
            /// #endif

            return null;
        }
    }
    else
        return oldS;
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
function removeAttrFromElement(elm: Element, name: string, info?: AttrPropInfo): void
{
    if (info?.isProp)
        elm[name] = null;
    else
        elm.removeAttribute(name);
}



/** Converts string from camelCase to dash-case */
const camelToDash = (s: string): string => s.replace( /([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();



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
 * Note that although this function does handle null and undefined, it is normally should
 * not be called with these values as the proper action is to remove attributes with such values.
 */
const valToString = (val: any): string | null =>
    val == null || val === false ? null :
    val === true ? "" :
	typeof val === "string" ? val :
    Array.isArray(val) ? array2s(val, " ") :
    val.toString();



/** Joins array elements with comma */
const array2s = (val: any[], sep: string): string =>
    val == null ? "" : val.map( item => valToString(item)).filter( item => !!item).join(sep);



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



/**
 * We cannot use JSON stringify on object properties because some fields could be of complex types.
 * Instead, we just create an array with space sparated keys and values (converted to strings)
 */
function stringifyObjectProp(val: ObjectPropValueType,
    nameFunc: ObjectPropToAttrNameFunc, valFunc: ObjectPropValToStringFunc): string
{
    return Object.entries(val).reduce( (s, [k, v]) => s + `${nameFunc(k)}|${valFunc(v)}|`, "");
}



/**
 * Parse the string created by [[stringifyObjectProp]] into object, where each key has a
 * string value.
 */
function unstringifyObjectProp(s: string): ObjectPropValueType
{
    let o: ObjectPropValueType = {};
    let items = s.split("|");
    for( let i = 0, count = items.length - 1; i < count; i += 2) o[items[i]] = items[i+1];
    return o;
}



/** Sets object attributes like `data-*` or `aria-*` */
function setObjectProp(elm: HTMLInputElement, val: ObjectPropValueType,
    nameFunc: ObjectPropToAttrNameFunc, valFunc: ObjectPropValToStringFunc): string | null
{
    for( let key in val)
        elm.setAttribute(nameFunc(key), valFunc(val[key]));

    return stringifyObjectProp(val, nameFunc, valFunc);
}



/** Updates object attributes like `data-*` or `aria-*` */
function updateObjectProp(elm: HTMLInputElement, oldS: string | null, newVal: ObjectPropValueType,
    nameFunc: ObjectPropToAttrNameFunc, valFunc: ObjectPropValToStringFunc): string | null | void
{
    // if we don't have old string value (which shouldn't happen), just use the set function
    if (!oldS)
        return setObjectProp(elm, newVal, nameFunc, valFunc);

    // oldS must be the object's stringified value
    let oldVal = unstringifyObjectProp(oldS) as ObjectPropValueType;

    let hasChanges = false;

    // loop over old data properties: remove those not found in the new data set and change
    // those that have different values in the new data set compared to the old data set.
    for( let propName in oldVal)
    {
        if (!(propName in newVal))
        {
            elm.removeAttribute(nameFunc(propName));

            /// #if USE_STATS
            DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
            /// #endif

            hasChanges = true;
        }
        else
        {
            let newPropString = valFunc(newVal[propName]);
            if (valFunc(oldVal[propName]) !== newPropString)
            {
                elm.setAttribute(nameFunc(propName), newPropString);

                /// #if USE_STATS
                DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
                /// #endif

                hasChanges = true;
            }
        }
    }

    // loop over old data properties: set those not found in the old data set.
    for( let propName in newVal)
    {
        if (!(propName in oldVal))
        {
            elm.setAttribute(nameFunc(propName), valFunc(newVal[propName]));

            /// #if USE_STATS
            DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
            /// #endif

            hasChanges = true;
        }
    }

    return hasChanges ? stringifyObjectProp(newVal, nameFunc, valFunc) : undefined;
}



/** Removes object attributes like `data-*` or `aria-*` */
function removeObjectProp(elm: HTMLInputElement, oldS: string | null,
    nameFunc: ObjectPropToAttrNameFunc): void
{
    // if we don't have old string value (which shouldn't happen), just use the set function
    if (oldS)
    {
        // oldS must be the object's stringified value
        let oldVal = unstringifyObjectProp(oldS) as ObjectPropValueType;

        for( let propName in oldVal)
        {
            elm.removeAttribute(nameFunc(propName));

            /// #if USE_STATS
            DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
            /// #endif
        }
    }
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



/** This variant is needed to use as the "set" function in AttrPropInfo */
function setCheckedProp(elm: HTMLInputElement, val: CheckedPropType): string | null;

/** This variant is needed to provide the "true" value for the "defaultCheck" property */
function setCheckedProp(elm: HTMLInputElement, val: CheckedPropType, setDefault?: boolean): string | null;

// Implementation used by both "checked" and "defaultChecked" attributes
function setCheckedProp(elm: HTMLInputElement, val: CheckedPropType, setDefault?: boolean): string | null
{
    if (typeof val == "boolean")
        elm.checked = val, elm.indeterminate = false;
    else
        elm.checked = false, elm.indeterminate = true;

    if (setDefault)
        elm.defaultChecked = elm.checked;

    return "" + val;
}



function removeCheckedProp(elm: HTMLInputElement): void
{
    elm.checked = false;
}



const setDefaultCheckedProp = (elm: HTMLInputElement, val: CheckedPropType): string | null =>
    setCheckedProp(elm, val, true);



const setDefaultValueProp = (elm: HTMLInputElement, val: string): string | null =>
    elm.value = elm.defaultValue = val;



/**
 * Converts the given value to string using the Mimcss conversion rules for the given syntax,
 * whcih is either a property name or a syntax like "<length>".
 */
const mimcssPropToString = (val: any, syntax: string): string =>
    mimcss ? mimcss.getStylePropValue(syntax, val) : typeof val === "string" ? val : "";



/**
 * SVG presentation attributes can be used as CSS style properties and, therefore, there
 * conversions to strings are already handled by Mimcss library. If Mimcss library is not included,
 * then value can only be a string. If it is not, we set the attribute to empty string.
 *
 * Since for most transformations SVG only supports unitless lengths and angles, we disable units
 * in number conversions before calling the Mimcss's getStylePropValue function and restore them
 * after it returns.
 */
const svgAttrToStylePropString = (val: any, name: string): string => {
    if (mimcss)
    {
        // don't add default units when converting numbers to strings
        let oldLenIntUnit = mimcss.Len.setIntUnit("");
        let oldLenFloatUnit = mimcss.Len.setFloatUnit("");
        let oldAngleIntUnit = mimcss.Angle.setIntUnit("");
        let oldAngleFloatUnit = mimcss.Angle.setFloatUnit("");

        let ret = mimcssPropToString(val, name);

        // restore default unit processing
        mimcss.Len.setIntUnit(oldLenIntUnit);
        mimcss.Len.setFloatUnit(oldLenFloatUnit);
        mimcss.Angle.setIntUnit(oldAngleIntUnit);
        mimcss.Angle.setFloatUnit(oldAngleFloatUnit);
        return ret;
    }
    else
        return typeof val === "string" ? val : "";
}



/**
 * SVG presentation attributes can be used as CSS style properties and, therefore, there
 * conversions to strings are already handled by Mimcss library. If Mimcss library is not included,
 * then value can only be a string. If it is not, we set the attribute to empty string.
 *
 * Since for most transformations SVG only supports unitless lengths and angles, we disable units
 * in number conversions before calling the Mimcss's getStylePropValue function and restore them
 * after it returns.
 */
const numAttrToStylePropString = (val: any, name: string, elm: Element): string => {
    if (mimcss)
    {
        return elm.namespaceURI === SvgNamespace
            ? svgAttrToStylePropString(val, name)
            : mimcssPropToString(val, name);
    }
    else
        return typeof val === "string" ? val : "";
}



/**
 * Converts style property value using Mimcss library if available.
 */
const styleToString = (val: string | Styleset): string | null =>
    // if Mimcss library is not included, then style attributes can only be strings. If they are
    // not, this is an application bug and we cannot handle it.
    typeof val === "string" ? val : mimcss ? mimcss.stylesetToString(val) : null;



/**
 * Converts media property value using Mimcss library if available.
 */
const mediaToString = (val: MediaStatement): string | null =>
    // if Mimcss library is not included, then style attributes can only be strings. If they are
    // not, this is an application bug and we cannot handle it.
    typeof val === "string" ? val : mimcss ? mimcss.mediaToString(val) : null;



/** Converts property of the data set to a `data-*` name */
const dataPropToAttrName = (propName: any): string => `data-${camelToDash(propName)}`

/** Converts property of the data set to string */
const dataPropToString = (val: any): string =>
    Array.isArray(val) ? val.map( item => dataPropToString(item)).join(" ") : "" + val;

/** Sets `data-* attributes */
const setDataProp = (elm: HTMLInputElement, val: DatasetPropType) =>
    setObjectProp(elm, val, dataPropToAttrName, dataPropToString);

/** Updates `data-* attributes */
const updateDataProp = (elm: HTMLInputElement, oldS: string | null, newVal: DatasetPropType) =>
    updateObjectProp(elm, oldS, newVal, dataPropToAttrName, dataPropToString);

/** Removes `data-* attributes */
const removeDataProp = (elm: HTMLInputElement, oldS: string | null) =>
    removeObjectProp(elm, oldS, dataPropToAttrName);



/** Converts property of the aria set to a `aria-*` name */
const ariaPropToAttrName = (propName: any): string => `aria-${propName}`

/** Converts property of the aria set to string - same as for dataset */
const ariaPropToString = (val: any): string => dataPropToString(val);

/** Sets `aria-* attributes */
const setAriaProp = (elm: HTMLInputElement, val: IAriaset) =>
    setObjectProp(elm, val, ariaPropToAttrName, ariaPropToString);

/** Updates `aria-* attributes */
const updateAriaProp = (elm: HTMLInputElement, oldS: string | null, newVal: IAriaset) =>
    updateObjectProp(elm, oldS, newVal, ariaPropToAttrName, ariaPropToString);

/** Removes `aria-* attributes */
const removeAriaProp = (elm: HTMLInputElement, oldS: string | null) =>
    removeObjectProp(elm, oldS, ariaPropToString);



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Mapping of attributes including framework-specific attributes, element attributes and event
// attributes to objects defining their behavior.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

const StdFrameworkPropInfo: AttrPropInfo = { type: PropType.Framework };

// Produces comma-separated list from array of values
const ArrayWithCommaPropInfo: AttrPropInfo = { type: PropType.Attr, v2s: (val: any[]): string => array2s(val, ",") };

// Produces semicolon-separated list from array of values
const ArrayWithSemicolonPropInfo: AttrPropInfo = { type: PropType.Attr, v2s: (val: any[]): string => array2s(val, ";") };

// Handles conversion of CssLength-typed attributes to strings
const CssLengthPropInfo: AttrPropInfo = { type: PropType.Attr, v2s: (val: any) => mimcssPropToString(val, "<length>") };

// Handles conversion of CssColor-typed attributes to strings
const CssColorPropInfo: AttrPropInfo = { type: PropType.Attr, v2s: (val: any) => mimcssPropToString(val, "color") };

// Handles conversion of SVG presentation attributes as Mimcss style properties to strings
const SvgAttrAsStylePropInfo: AttrPropInfo = { type: PropType.Attr, v2s: svgAttrToStylePropString };

// Handles conversion of numeric attributes to strings depending on whether the element that uses
// them is an SVG element. For SVG elements, units are not added, for others (in particular,
// MathML), they are added.
const NumericAttrAsStylePropInfo: AttrPropInfo = { type: PropType.Attr, v2s: numAttrToStylePropString };

// Handles conversion of SVG presentation attributes' names from camelCase to dash case
const SvgAttrNameConversionPropInfo: AttrPropInfo = { type: PropType.Attr, name: camelToDash };

// Handles conversion of SVG presentation attributes as Mimcss style properties to strings and
// conversion of camelCase propery names to dash case.
const SvgAttrAsStyleWithNameConversionPropInfo: AttrPropInfo = { type: PropType.Attr, v2s: svgAttrToStylePropString, name: camelToDash };

/**
 * Object that maps property names to PropInfo-derived objects. Information about custom
 * attributes is added to this object when the registerProperty method is called.
 *
 * There are a few attributes that have different meaning when applied to different elements.
 * For exampe, the `fill` attribute means shape-filling color when applied to such elements as
 * circle, rect or path, while it means the final state of animation when applied to such
 * elements as animate or animateMotion. To distinguish between different meaning (and,
 * therefore different treatment) of the attributes, the attribute name can be set to a
 * function, which will return the actual AttrPropInfo given the attribute and element names.
 */
const propInfos: { [P:string]: PropInfo | ((elmName: string, attrName: string) => PropInfo) } =
// const propInfos: { [P:string]: PropInfo } =
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
    cx: SvgAttrAsStylePropInfo,
    cy: SvgAttrAsStylePropInfo,
	fill: (elmName) => ({
        type: PropType.Attr,
        v2s: elmName.startsWith("animate") || elmName === "set"
            ? undefined
            : svgAttrToStylePropString
    }),
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
    r: SvgAttrAsStylePropInfo,
    rx: SvgAttrAsStylePropInfo,
    ry: SvgAttrAsStylePropInfo,
	stopColor: SvgAttrAsStyleWithNameConversionPropInfo,
	stopOpacity: SvgAttrAsStyleWithNameConversionPropInfo,
	stroke: SvgAttrAsStylePropInfo,
	strokeOpacity: SvgAttrAsStyleWithNameConversionPropInfo,
	transform: SvgAttrAsStylePropInfo,
	transformOrigin: SvgAttrAsStyleWithNameConversionPropInfo,
    x: SvgAttrAsStylePropInfo,
    y: SvgAttrAsStylePropInfo,

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

    // SVG element atributes where multiple values are separated by semicolon
    values: ArrayWithSemicolonPropInfo,
    begin: ArrayWithSemicolonPropInfo,
    end: ArrayWithSemicolonPropInfo,
    keyTimes: ArrayWithSemicolonPropInfo,
    keySplines: ArrayWithSemicolonPropInfo,

    // MathML element atributes
    mathbackground: CssColorPropInfo,
    mathcolor: CssColorPropInfo,
    mathsize: CssLengthPropInfo,
    linethickness: CssLengthPropInfo,
    lspace: CssLengthPropInfo,
    maxsize: CssLengthPropInfo,
    minsize: CssLengthPropInfo,
    rspace: CssLengthPropInfo,
    depth: CssLengthPropInfo,
    height: NumericAttrAsStylePropInfo,
    voffset: CssLengthPropInfo,
    width: NumericAttrAsStylePropInfo,

    // global events
    click: { type: PropType.Event, schedulingType: TickSchedulingType.Sync },
};



/**
 * Retrieves info about a registered property
 */
// export const getPropInfo = (name: string): PropInfo | undefined => propInfos[name];
export function getPropInfo(elmName: string, attrName: string): PropInfo | undefined
{
    let info = propInfos[attrName];
    return typeof info === "function" ? info(elmName, attrName) : info;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// An element VN can be updated by a new VN, which was created by the different component. We do
// allow updating the element because it saves us the time necessary to remove one element and add
// a new one. However, in such cases we need to "clean" some special properties of some special
// elements. For example, the "checked" property of the HTMLInputElement reflects the actual
// "checked" state of a checkbox or a radio input elements; however, there is no attribute that
// reflects this state. If a new element doesn't define the "checked" property in its JSX, our
// code wouldn't try to set the element's "checked" property and, therefore, it will remain in the
// leftover state from the previous user action. If this previous state was "on", this will be a
// wrong state for the new rendering.
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


