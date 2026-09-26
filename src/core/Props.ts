/**
 * This modules deals with setting and updating JSX attributes of HTML/SVG/MathML and
 * custom elements. When we talk about attributes, we talk about what we see in HTML, which
 * can be only of type string and which are set using elm.setAttribute() function and removed
 * using elm.removeAttribute() function. When we talk about properties, we talk about elements
 * as regular JavaScript objects with properties of arbitrary types, which are set using
 * `elm[prop] = value` notation. Normally, properties are not deleted per se; instead, they are
 * set to `null` or `undefined`.
 *
 * The main question addressed in this module is what to do when implementing JSX structures like
 * `<elm attr={value} ... />`. First, during the first rendering, the attributes should be set.
 * Second, during the subsequent renderings based on comparison of the current and the previous
 * sets of attributes, some attributes should be set, some updated and some deleted. Third, when
 * setting or updating a JSX attribute, we need to decide whetherto do it via `elm.setAttribute()`
 * or via `elm[prop] = value`. Fourth, we want only update JSX attributes whose value has really
 * changed to save on expensive DOM operations.
 *
 * Elements of different namspaces and even elements within the same namespace deal with
 * properties/ attributes differenty. First, some but not all attributes exist as both attributes
 * and properties with the same names as in JSX. Some attributes and/or properties may have
 * different names from the JSX attributes (e.g. HTML's `class` for JSX's `className`). Some
 * attributes have counterpart properties but named slightly differently (e.g. attribute `tabindex`
 * but property `tabInex`). While HTML attributes are always strings, some of them have counterpart
 * properties with different types (e.g. `tabIndex` property is a number). Some JSX attributes
 * can only be set as HTML attributes (e.g. `aria-` attributes), while some JSX attributes can only
 * be effectively set as HTML properties (e.g. `<input>` element's `checked` and `value`). Finally,
 * JSX is happy to work with any complex types like objects and arrays, while they might sometimes
 * be converted to strings in order to be set as HTML attributes.
 *
 * Working with complex types creates another problem - understanding whether the object has been
 * changed from the previous rendering. This is a two edge sword: first, if object reference has
 * been changed, it doesn't mean that the object's content is different. Second, if the object
 * reference hasn't been changed, it doesn't mean that the object content stayed the same. Our
 * library expressly wants to allow passing an object (e.g. styles) to a JSX property and cause
 * rerendering by changing its properties.
 *
 * Custom HTML elements raise a whole new set of questions. First of all, the set of attibutes/
 * properties of HTML/SVG/MathML elements is known ahead of time (they do change but infrequently).
 * Custom Elements, however, are like components that define their own properties, so a library
 * cannot be "hard-coded" to deal with them. Second, Custom Elements frequently work with complex
 * types. Third, Custom Elements can make use of standard HTML attributes amd properties (after
 * all they all derive from the HTMLElement or even more secific DOM classes); however, it is
 * impossible to know how these standard attributes/properties are treated. A Custom Element class
 * is free to define a `style` property and we cannot know whether it treats it as an HTML `style`
 * property (e.g. assigning to one of real HTMLelements in its shadow DOM) or gives it a completely
 * different meaning.
 *
 * For Custom Elements, the following rules are established:
 *   - If the element object has a property with the same name as the JSX attribute, then the value
 *     is set to that property (`elm[prop] = value`) without any type conversion.
 *   - During updates, only the reference equality is checked.
 *
 * If the element is in the SVG namespace, values are only set/removed as attributes.
 *
 * If the JSX attribute is registered, then the registration rules are followed. We provide a way
 * for 3rd party libraries to register selected properties for selected elements.
 *
 * For the unregistered properties of non-custom non-SVG elements, the following rules are followed:
 *   - Value is converted to a `string | null` (see rules below).
 *   - If the element object has a property with the same name as the JSX attribute, then
 *     it is set as a property; otherwise, a string value is set using `elm.setAttribute()`
 *     and `null` value is removed using `elm.removeAttribute()`.
 *   - When the value is set or updated, its new value is remembered by the element's Virtual
 *     DOM Node (VN). When the value is updated, the new string representation is compared
 *     with the remembered one and only if they differ, the value is updated.
 *   - When a complex value (array or object) is set or updated, both the object value and its
 *     string representation created with a one-way stringification function are remembered
 *     in its VN. When such value is updated, then both the identities and the string
 *     representations of the new and old values are compared. If both don't match, the value is
 *     updated.
 */



import {Styleset, MediaStatement} from "mimcss"
import { TickSchedulingType, ICustomAttributeHandlerClass, PropType } from "../api/CompTypes"
import { IAriaset, DatasetPropType } from "../api/ElementTypes";

/// #if USE_STATS
import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { mimcss } from "./StyleScheduler";
import { CheckedPropType } from "../api/HtmlTypes";
import { CustomNamespace, HtmlNamespace, MathmlNamespace, SvgNamespace } from "../utils/UtilFunc";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Information about attributes and events and functions to set/update/remove them.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Information about attributes that contains functions for setting, diffing, updating and removing
 * attribute(s) corresponding to the property.
 */
export interface AttrPropInfo<T extends Element = Element>
{
	// Indicates that the property describes an attribute.
	type?: PropType.Attr | PropType.Framework;

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
	v2s?: (val: any, name: string, elm: T) => string | null;

	/**
     * Function that sets the value of the attribute. If this function is not defined, then the
     * value is converted to string and is set either via the element's setAttribute() function
     * or by assigning the value to the element's property.
     */
	set?: (elm: T, val: any, name: string) => string | null;

	/**
     * Function that updates the value of the attribute based on comparing the old and new values.
     * If the values are identical, no DOM operation is performed; otherwise, the value is set to
     * the element either via the set function, if defined, or via the element's setAttribute()
     * method or by assigning the value to the element's property.
     * @returns New string value if updated; null if removed; undefined if no change.
     */
	update?: (elm: T, oldS: string | null, newVal: any, name: string) => string | null | void;

	/**
     * Function that removes the attribute. If this function is not defined, then the DOM
     * elm.removeAttribute is called with propName as attribute name.
     */
	remove?: (elm: T, oldS: string | null, name: string) => void;

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
     * Flag indicating that this property can only be set/removed using setAttribute/removeAttribute
     * methods and not as an element property (that is, elm[prop] = value).
     */
    attrOnly?: boolean;
}



/** Information about events. */
export interface EventPropInfo
{
	// Indicates that the property describes an event.
	type: PropType.Event;

    // Type of scheduling the Mimbl tick after the event handler function returns
	schedulingType?: TickSchedulingType;

	// // Flag indicating whether the event bubbles. If the event doesn't bubble, the event handler
	// // must be set on the element itself; otherwise, the event handler can be set on the root
	// // anchor element, which allows having a single event handler registered for many elements,
	// // which is more performant.
	// isBubbling?: boolean;
}



/** Information about custom attributes. */
export interface CustomAttrPropInfo
{
	// Indicates that the property describes a custom attribute.
	type: PropType.CustomAttr;

	// Class object that creates custom attribute handlers.
	handlerClass: ICustomAttributeHandlerClass<any>;
}



/** Type combining information about regular attributes or events or custom attributes. */
export type PropInfo = AttrPropInfo | EventPropInfo | CustomAttrPropInfo;



// /**
//  * Sets the value of the given attribute on the given element. This method handles special cases
//  * of properties with non-trivial values.
//  */
// export function setAttrValue(elm: Element, name: string, val: any): void
// {
//     let elmName = elm.localName;
//     let info = getPropInfo(getElmNS(elmName), elmName, name);
//     if (!info || info.type === PropType.Attr)
//         setElmProp(elm, name, val, info);
// }



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
        s = setOrRemoveElmProp(elm, name, name, val);
    else
    {
        let {name: nameOrFunc, set} = info;

        // get actual attribute/property name to use
        if (nameOrFunc)
            name = typeof nameOrFunc === "string" ? nameOrFunc : nameOrFunc(name);

        if (set)
        {
            s = set(elm, val, name);

            /// #if USE_STATS
            DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
            /// #endif
        }
        else
            s = setOrRemoveElmProp(elm, name, name, val, info);
    }

    return s;
}



/**
 * If the value is null/undefined, removes the attribute; otherwise sets it converting it to
 * string if necessary.
 */
function setOrRemoveElmProp(elm: Element, attrName: string, propName: string, val: any, info?: AttrPropInfo): string | null
{
    let s = info?.v2s ? info.v2s(val, attrName, elm) : val2s(val);
    if (!info?.attrOnly && propName in elm)
    {
        elm[propName] = elm.localName.includes("-") ? val : s;

        /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
        /// #endif
    }
    else
    {
        if (s != null)
        {
            elm.setAttribute(attrName, s);

            /// #if USE_STATS
            DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
            /// #endif
        }
        else
        {
            elm.removeAttribute(attrName);

            /// #if USE_STATS
            DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
            /// #endif
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
        s = updateOrRemoveElmProp(elm, name, name, oldS, newVal);
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
            s = updateOrRemoveElmProp(elm, name, name, oldS, newVal, info);
    }

    return s;
}



/**
 * Converts the new value to string and compares it to the given old string value. If the strings
 * are identical, just removes this value. If the strings are different and the new value is not
 * null or undefined, then updtes the element's attribute; otherwise, removes the attribute.
 * @returns New string value if the attribute was updated; null if the attribute was removed;
 * old string value if there was no change in the attribute's value.
 */
function updateOrRemoveElmProp(elm: Element, attrName: string, propName: string, oldS: string | null,
    newVal: any, info?: AttrPropInfo): string | null
{
    let newS = info?.v2s ? info.v2s(newVal, attrName, elm) : val2s( newVal);
    // if (oldS === newS)
    //     return oldS;

    if (!info?.attrOnly && propName in elm)
    {
        elm[propName] = elm.localName.includes("-") ? newVal : newS;

        /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
        /// #endif
    }
    else
    {
        if (newS != null)
        {
            elm.setAttribute(attrName, newS);

            /// #if USE_STATS
            DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
            /// #endif
        }
        else
        {
            elm.removeAttribute(attrName);

            /// #if USE_STATS
            DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
            /// #endif
        }
    }

    return newS;
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

        remove ? remove( elm, oldS, name) : elm.removeAttribute(name);
    }

    /// #if USE_STATS
    DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
    /// #endif
}



/** Converts string from camelCase to dash-case */
const camelToDash = (s: string): string => s.replace( /([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();



/**
 * Helper function that converts the given value to string or null. Null is an indication that
 * the attribute should not be set or should be deleted.
 *   - strings are returned as is.
 *   - numbers (including bigint) use .toString();
 *   - true is converted to an empty string.
 *   - false is converted to null.
 *   - null and undefined are converted to null.
 *   - arrays are converted by calling this function recursively on the elements and separating
 *     them with spaces.
 *   - objects are "stringified" using recursive one-way function going over properties and their
 *     values.
 *   - for everything else (functions and symbols), the typeof val is returned.
 *
 * Note that although this function does handle null and undefined, it is normally should
 * not be called with these values as the proper action is to remove attributes with such values.
 */
const val2s = (val: any): string | null =>
	["string", "number", "bigint"].includes(typeof val) ? val.toString() :
    val == null || val === false ? null :
    val === true ? "" :
    Array.isArray(val) ? arr2s(val, " ") :
    typeof val === "object" ? obj2s(val) :
    typeof val;



/** Joins array elements (recursively) with the given separator */
const arr2s = (val: any | any[], sep: string): string | null =>
    Array.isArray(val) ? val.map(v => val2s(v)).filter(v => !!v).join(sep) : val2s(val);



/**
 * One-way function that produces unique string for a given object. Doesn't handle circular
 * references.
 */
function obj2s(obj: Record<string, any>,
    keyFunc?: (key: string) => string, valFunc?: (val: any) => string | null): string
{
    if (Symbol.toPrimitive in obj || (obj.toString && obj.toString !== Object.prototype.toString))
        return String(obj);

    let s = "";
    for (let key in obj)
    {
        let val = obj[key];
        s += keyFunc ? keyFunc(key) : key;
        s += valFunc ? valFunc(val) : val2s(val)
    }
    return s;
}



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
type ObjectPropValToStringFunc = (val: any) => string | null;



/**
 * We cannot use JSON stringify on object properties because some fields could be of complex types.
 * Instead, we just create a string with pipe-separated keys and values (converted to strings)
 */
function stringifyObjectProp(val: ObjectPropValueType,
    nameFunc: ObjectPropToAttrNameFunc, valFunc: ObjectPropValToStringFunc): string
{
    return Object.entries(val).reduce( (s, [k, v]) => s + `${nameFunc(k)}|${valFunc(v)}|`, "");
}



/**
 * Parse the string created by {@link stringifyObjectProp} into object, where each key has a
 * string value.
 */
function unstringifyObjectProp(s: string): ObjectPropValueType
{
    let o: ObjectPropValueType = {};
    let items = s.split("|");
    for( let i = 0, count = items.length - 1; i < count; i += 2)
        o[items[i]] = items[i+1];

    return o;
}



/** Sets object attributes like `data-*` or `aria-*` */
function setObjectProp(elm: Element, val: ObjectPropValueType,
    nameFunc: ObjectPropToAttrNameFunc, valFunc: ObjectPropValToStringFunc): string | null
{
    for( let key in val)
    {
        let v = valFunc(val[key]);
        v != null && elm.setAttribute(nameFunc(key), v);
    }

    return stringifyObjectProp(val, nameFunc, valFunc);
}



/** Updates object attributes like `data-*` or `aria-*` */
function updateObjectProp(elm: Element, oldS: string | null, newVal: ObjectPropValueType,
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
                if (newPropString != null)
                    elm.setAttribute(nameFunc(propName), newPropString);
                else
                    elm.removeAttribute(nameFunc(propName));

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
            let v = valFunc(newVal[propName]);
            v != null && elm.setAttribute(nameFunc(propName), v);

            /// #if USE_STATS
            DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
            /// #endif

            hasChanges = true;
        }
    }

    return hasChanges ? stringifyObjectProp(newVal, nameFunc, valFunc) : undefined;
}



/** Removes object attributes like `data-*` or `aria-*` */
function removeObjectProp(elm: Element, oldS: string | null,
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



/** Sets the given value to the element's `value` property */
const setValueProp = (elm: HTMLInputElement, val: any): string | null => (elm as any).value = val2s(val) ?? "";



/** Removes the `value` attribtue */
const removeValueProp = (elm: Element): void => { (elm as any).value = ""; }



/** Removes the `value` attribtue */
const removeProgressValueProp = (elm: Element): void => elm.removeAttribute("value");



/** Sets `checked` element property */
const setCheckedProp = (elm: Element, val: CheckedPropType): string | null =>
{
    let inputElm = elm as HTMLInputElement;
    if (typeof val == "boolean")
        inputElm.checked = val, inputElm.indeterminate = false;
    else
        inputElm.checked = false, inputElm.indeterminate = true;

    return "" + val;
}

/** Unchecks checkbox or radio button */
const removeCheckedProp = (elm: HTMLInputElement): void => { (elm as HTMLInputElement).checked = false; }



/**
 * Converts the given value to string using the Mimcss conversion rules for the given syntax,
 * which is either a property name or a syntax like "<length>".
 */
const mimcssPropToString = (val: any, syntax: string): string =>
    mimcss ? mimcss.getStylePropValue(syntax, val) : typeof val === "string" ? val : "";



/**
 * SVG presentation attributes can be used as CSS style properties and, therefore, there
 * conversions to strings are already handled by Mimcss library. If Mimcss library is not included,
 * then value can only be a string. If it is not, we set the attribute to empty string.
 *
 * Since for most transformations SVG only supports unitless lengths and angles, we disable units
 * in number conversions before calling the Mimcss's mimcssPropToString function and restore them
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
const dataPropToString = (val: any): string | null =>
    val == null ? null : Array.isArray(val) ? val.map( item => dataPropToString(item)).join(" ") : "" + val;

/** Sets `data-* attributes */
const setDataProp = (elm: Element, val: DatasetPropType) =>
    setObjectProp(elm, val, dataPropToAttrName, dataPropToString);

/** Updates `data-* attributes */
const updateDataProp = (elm: Element, oldS: string | null, newVal: DatasetPropType) =>
    updateObjectProp(elm, oldS, newVal, dataPropToAttrName, dataPropToString);

/** Removes `data-* attributes */
const removeDataProp = (elm: Element, oldS: string | null) =>
    removeObjectProp(elm, oldS, dataPropToAttrName);



/** Converts property of the aria set to a `aria-*` name unless it is `"role"` */
export const ariaPropToAttrName = (propName: any): string => propName === "role" ? propName : `aria-${propName}`

/** Converts property of the aria set to string - same as for dataset */
export const ariaPropToString = (val: any): string | null => dataPropToString(val);

/** Sets `aria-* attributes */
const setAriaProp = (elm: Element, val: IAriaset) =>
    setObjectProp(elm, val, ariaPropToAttrName, ariaPropToString);

/** Updates `aria-* attributes */
const updateAriaProp = (elm: Element, oldS: string | null, newVal: IAriaset) =>
    updateObjectProp(elm, oldS, newVal, ariaPropToAttrName, ariaPropToString);

/** Removes `aria-* attributes */
const removeAriaProp = (elm: Element, oldS: string | null) =>
    removeObjectProp(elm, oldS, ariaPropToAttrName);



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Mapping of attributes including framework-specific attributes, element attributes and custom
// attributes to objects defining their behavior.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

const FrameworkPropInfo: AttrPropInfo = { type: PropType.Framework };

/** Produces comma-separated list from array of values */
const ArrayWithCommaPropInfo: AttrPropInfo = { v2s: val => arr2s(val, ",") };

/** Produces semicolon-separated list from array of values */
const ArrayWithSemicolonPropInfo: AttrPropInfo = { v2s: val => arr2s(val, ";") };

/** Handles conversion of CssLength-typed attributes to strings */
const CssLengthPropInfo: AttrPropInfo = { v2s: (val: any) => mimcssPropToString(val, "<length>") };

/** Handles conversion of CssColor-typed attributes to strings */
const CssColorPropInfo: AttrPropInfo = { v2s: (val: any) => mimcssPropToString(val, "color") };

/** For SVG elements' properties property assignment doesn't work - must go via setAttribute */
const SvgDefaultPropInfo: AttrPropInfo = { attrOnly: true };

/** Handles conversion of SVG presentation attributes as Mimcss style properties to strings */
const SvgAttrAsStylePropInfo: AttrPropInfo = { v2s: svgAttrToStylePropString, attrOnly: true };

/** Handles conversion of SVG presentation attributes' names from camelCase to dash case */
const SvgAttrNameConversionPropInfo: AttrPropInfo = { name: camelToDash, attrOnly: true };

/**
 * Handles conversion of SVG presentation attributes as Mimcss style properties to strings and
 * conversion of camelCase propery names to dash case.
 */
const SvgAttrAsStyleWithNameConversionPropInfo: AttrPropInfo = { v2s: svgAttrToStylePropString, name: camelToDash, attrOnly: true };



/**
 * Object that maps property names to PropInfo-derived objects. Information about custom
 * attributes is added to this object when the registerElmProp method is called.
 *
 * There are a few attributes that have different meaning when applied to different elements.
 * For exampe, the `fill` attribute means shape-filling color when applied to such elements as
 * circle, rect or path, while it means the final state of animation when applied to such
 * elements as animate or animateMotion. To distinguish between different meaning (and,
 * therefore different treatment) of the attributes, the value can be set to a function, which
 * will return the actual AttrPropInfo given the attribute and element names.
 */
const globalPropRegistry: { [P: string]: PropInfoOrFunc } =
{
    // framework attributes.
    key: FrameworkPropInfo,
    ref: FrameworkPropInfo,
    vnref: FrameworkPropInfo,
    updateStrategy: FrameworkPropInfo,

    // attributes - only those attributes are listed that have non-trivial treatment or whose value
    // type is object or function.
    checked: { set: setCheckedProp, remove: removeCheckedProp },
    defaultChecked: { set: setCheckedProp, update: doNothing, remove: doNothing },
    value: { set: setValueProp, remove: removeValueProp },
    defaultValue: { set: setValueProp, update: doNothing, remove: doNothing },
    style: { v2s: styleToString },
    media: { v2s: mediaToString },
    dataset: { set: setDataProp, update: updateDataProp, remove: removeDataProp },
    aria: { set: setAriaProp, update: updateAriaProp, remove: removeAriaProp },

    coords: ArrayWithCommaPropInfo,
    sizes: ArrayWithCommaPropInfo,
    srcset: ArrayWithCommaPropInfo,
    imageSrcset: ArrayWithCommaPropInfo,

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
    height: CssLengthPropInfo,
    voffset: CssLengthPropInfo,
    width: CssLengthPropInfo,

    // global events
    click: { type: PropType.Event, schedulingType: TickSchedulingType.Sync },
};



/**
 * Retrieves info about a registered property
 */
export function getPropInfo(ns: string, elmName: string, attrName: string): PropInfo | undefined
{
    let info = globalPropRegistry[attrName];

    if (typeof info === "function")
        info = info(elmName, attrName);

    if (ns === SvgNamespace)
    {
        if (!info)
            info = SvgDefaultPropInfo;
        else
            Object.assign(info, SvgDefaultPropInfo);
    }

    return info;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// A hierarchy of types describing "property information containers", which map property
// information objects to a combination of HTML element namespace, element local name and property
// name. For some global properties such as aria- or data-, neither namespace nor local name are
// neeeded, others have special rules depending on the local name and some on the combination of
// all three.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/** Type combining PropInfo or function that returns PropEinfo for the given eement and property names */
type PropInfoOrFunc = PropInfo | ((elmName: string, attrName: string) => PropInfo);

/**
 * Container that matches property information objects to property names. Such container can exist
 * under container of namespaces or of element local names. It also defines an optional default
 * property info object, which (if defined) will be used if matching by namespace, local name and
 * property name fails. It is optional, because not having a property with a matching information
 * object is OK - it just gets the default handling.
 */
type PropContainer = {
    props?: { [PropName: string]: PropInfoOrFunc },
    default?: PropInfoOrFunc,
}

/**
 * Container that matches property information objects to property names and element names. Such
 * container can exist under container of namespaces or under the global container.
 */
type ElmContainer = PropContainer & {
    elms?: { [ElmName: string]: PropContainer }
}

/**
 * Container that matches property information objects to property names, element names and
 * namespace names. Such container can exist only under the global container.
 */
type NamespaceContainer = ElmContainer & {
    namespaces?: { [NSName: string]: ElmContainer }
}



/** List of names of framework attributes */
const frameworkAttrNames=["key", "ref", "vnref", "updateStrategy"];


/** Hierarchy of attribute information objects */
const propRegistry: NamespaceContainer = {
    props: {
        // properties common for all namespaces and all elements.
        style: { v2s: styleToString },
        media: { v2s: mediaToString },
        dataset: { set: setDataProp, update: updateDataProp, remove: removeDataProp },
        aria: { set: setAriaProp, update: updateAriaProp, remove: removeAriaProp },
        children: { attrOnly: true },
    },
    namespaces: {
        [HtmlNamespace]: {
            elms: {
                input: {
                    props: {
                        checked: { set: setCheckedProp, remove: removeCheckedProp },
                        defaultChecked: { set: setCheckedProp, update: doNothing, remove: doNothing },
                        value: { set: setValueProp, remove: removeValueProp },
                        defaultValue: { set: setValueProp, update: doNothing, remove: doNothing },
                    }
                },
                progress: {
                    props: {
                        value: { remove: removeProgressValueProp },
                    }
                }
            },
            props: {
                coords: ArrayWithCommaPropInfo,
                sizes: ArrayWithCommaPropInfo,
                srcset: ArrayWithCommaPropInfo,
                imageSrcset: ArrayWithCommaPropInfo,
            }
        },
        [SvgNamespace]: {
            props: {
                style: { v2s: styleToString },

                // SVG presentational attributes that require special conversion to string. This also takes
                // care of converting the attribute name from camelCase to dash-case if necessary.
                baselineShift: SvgAttrAsStylePropInfo,
                color: SvgAttrAsStylePropInfo,
                cursor: SvgAttrAsStylePropInfo,
                cx: SvgAttrAsStylePropInfo,
                cy: SvgAttrAsStylePropInfo,
                fill: (elmName) => ({
                    v2s: elmName.startsWith("animate") || elmName === "set"
                        ? undefined
                        : svgAttrToStylePropString,
                    attrOnly: true,
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
            },
            default: { attrOnly: true }
        },
        [MathmlNamespace]: {
            props: {
                mathbackground: CssColorPropInfo,
                mathcolor: CssColorPropInfo,
                mathsize: CssLengthPropInfo,
                linethickness: CssLengthPropInfo,
                lspace: CssLengthPropInfo,
                maxsize: CssLengthPropInfo,
                minsize: CssLengthPropInfo,
                rspace: CssLengthPropInfo,
                depth: CssLengthPropInfo,
                height: CssLengthPropInfo,
                voffset: CssLengthPropInfo,
                width: CssLengthPropInfo,
            }
        },
        [CustomNamespace]: {
            // for all Custom Elements, the standard property/attribute setting mechanism will be used.
            default: {}
        },
    }
}



/**
 * Registers information about the given property either for all elements or for the specific
 * element.
 * @param propName Name of the property
 * @param info Information about the property
 * @param elmName Optional element name. If this is undefined, the property information is
 * registered for all elements; otherwise, only for the specified element
 */
export function registerElmProp(propName: string, info: PropInfoOrFunc, elmName?: string): void
{
    // // use element-specific registry if element name was specified and global registry otherwise
    // let registry: { [P: string]: PropInfoOrFunc };
    // if (elmName)
    // {
    //     registry = elementPropRegistries[elmName];
    //     if (!registry)
    //         elementPropRegistries[elmName] = registry = {}
    // }
    // else
    //     registry = globalPropRegistry;

    // if (propName in registry)
    // {
    //     /// #if DEBUG
    //     console.error( `Element property '${propName}' for element '${elmName ?? "global"}' is already registered.`);
    //     /// #endif

    //     return;
    // }

    // registry[propName] = info;
}



// /**
//  * Retrieves info about a registered property
//  */
// export function getPropInfo(ns: string, elmName: string, attrName: string): PropInfo | undefined
// {
//     if (frameworkAttrNames.includes(attrName))
//         return StdFrameworkPropInfo;

//     let info = findPropInfoByNSName(propRegistry, ns, elmName, attrName);
//     return typeof info === "function" ? info(elmName, attrName) : info;
// }



// function findPropInfoByNSName(container: NamespaceContainer, ns: string, elm: string, prop: string): PropInfoOrFunc | undefined
// {
//     let info = container.namespaces && ns in container.namespaces ? findPropInfoByElmName(container.namespaces[ns], elm, prop) : undefined;
//     info ??= findPropInfoByElmName(propRegistry, elm, prop) ?? findPropInfoByPropName(propRegistry, prop);
//     return info;
// }

// function findPropInfoByElmName(container: ElmContainer, elm: string, prop: string): PropInfoOrFunc | undefined
// {
//     let info = container.elms && elm in container.elms ? findPropInfoByPropName(container.elms[elm], prop) : undefined;
//     info ??= findPropInfoByPropName(container, prop);
//     return info;
// }

// function findPropInfoByPropName(container: PropContainer, prop: string): PropInfoOrFunc | undefined
// {
//     let info = container.props && prop in container.props ? container.props[prop] : undefined;
//     info ??= container.default;
//     return info;
// }

// function registerPropInfo(info: PropInfoOrFunc, prop?: string, elm?: string, ns?: string): void
// {
//     let elmContainter: ElmContainer = ns ? propRegistry[ns] ??= {} : propRegistry;
//     let propContainter: ElmContainer = elm ? elmContainter[elm] ??= {} : elmContainter;
//     if (prop)
//         propContainter[prop] = info;
//     else
//         propContainter.default = info;
// }



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



