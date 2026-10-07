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
 *   - Since Custom elements are HTML elements, the standard HTML attrbutes/properties
 *     transformation logic applies to them unless the properties are defined on the element itself
 *     or itsprototype - that is, if they are overridden by the custom element's class.
 *
 * If the element is in the SVG namespace, values are only set/removed as attributes except for
 * the "style" attribute that is treated in the exact same way as HTML's style attribute.
 *
 * If the JSX attribute is registered, then the registration rules are followed. We provide a way
 * for 3rd party libraries to register selected properties for selected elements. Registration
 * allows specifying the following (all optional):
 *   - A function that converts JSX attribute value to the HTML attribute or element proerty value.
 *   - A function that completely overrides the default behavior of setting a JSX attribute value.
 *   - A function that completely overrides the default behavior of updating a JSX attribute value.
 *   - A function that completely overrides the default behavior of removing a JSX attribute.
 *   - A flag defining whether the JSX attribute should only be set/removed as HTML atribute.
 *   - Name to use for HTML attribute if different from the JSX attribute name.
 *   - Name to use for element property if different from the JSX attribute name.
 *
 * For the unregistered properties of non-custom non-SVG elements, the following rules are followed:
 *   - If the element object has a property with the same name as the JSX attribute, then
 *     it is set as a property; otherwise, non-null value is set using `elm.setAttribute()`
 *     and `null` value is removed using `elm.removeAttribute()`.
 *   - If the JSX attribute should be set as an HTML attribute, it is converted to string.
 *   - If the JSX attribute should be set as an element's property, it is converted to the
 *     appropriate type: we keep lists of HTML element properties of non-string types (numbers and
 *     booleans) and convert them to those types. All other values are converted to strings.
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
import { NamespaceCode } from "../utils/UtilFunc";



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
     * Function that converts JSX attribute value to a "real value" that will be used to set the
     * element's attribute or property. This value will also be remembered and later supplied to
     * updateElmProp() or removeElmProp(). Note that for complex situations (usually objects),
     * where the value to be set is different from the value to be remembered, the set() and
     * update() methods should be defined.
     *
     * If this function is not defined, a standard algorithm is used, in which:
     *   - string is returned as is.
     *   - true is converted to an empty string.
     *   - false is converted to null.
     *   - null and undefined are converted to null.
     *   - arrays are converted by calling this function recursively on the elements and separating
     *     them with spaces.
     *   - everything else is converted by calling the toString method.
     *
     * @param val JSX attribute value to be converted
     * @param name JSX attribute name - just in case the conversion depends on an attribute
     * @param elm Element whose property or attribute is being set/updated
     * @returns Value to be remembered and later supplied to updateElmProp() or removeElmProp().
     */
	v2rv?: (val: any, name: string, elm: T) => any;

	/**
     * Function that sets the value of the JSX attribute. If this function is not defined, then the
     * value is converted to string and is set either via the element's setAttribute() function
     * or by assigning the value to the element's property.
     *
     * @param elm Element whose property or attribute is being set
     * @param val JSX attribute value to be set
     * @param name JSX attribute name - just in case the conversion depends on an attribute
     * @param info This attribute information object
     * @returns Value to be remembered and later supplied to updateElmProp() or removeElmProp().
     */
	set?: (elm: T, val: any, name: string, info: AttrPropInfo) => any;

	/**
     * Function that updates the value of the JSX attribute based on comparing the old and new values.
     * If the values are identical, no DOM operation is performed; otherwise, the value is set to
     * the element either via the set function, if defined, or via the element's setAttribute()
     * method or by assigning the value to the element's property.
     *
     * @param elm Element whose property or attribute is being updated
     * @param rval "Real value" of the JSX attribute remembered from the previous call to setElmProp()
     * or updateElmProp().
     * @param val New JSX attribute value
     * @param name JSX attribute name - just in case the conversion depends on an attribute
     * @param info This attribute information object
     * @returns Value to be remembered and later supplied to updateElmProp() or removeElmProp(). A
     * special symbol `symNoChanges` is returned if no change is done.
     */
	update?: (elm: T, rval: any, newVal: any, name: string, info: AttrPropInfo) => any;

	/**
     * Function that removes the JSX attribute. If this function is not defined, then either the
     * element's property is set to its type-specific default value or elm.removeAttribute() is
     * called.
     *
     * @param elm Element whose property or attribute is being removed
     * @param rval "Real value" of the JSX attribute remembered from the previous call to setElmProp()
     * or updateElmProp().
     * @param name JSX attribute name - just in case the conversion depends on an attribute
     * @param info This attribute information object
     */
	remove?: (elm: T, rval: any, name: string, info: AttrPropInfo) => void;

	/**
     * The actual name of the HTML attribute. This is sometimes needed if the HTML attribute name
     * cannot be used as JSON attribute name - for example, if attribute name contains characters
     * are not allowed in TypeScript identifier (e.g. dash).
     *
     * This field can also specify a function that gets the JSX attribute name and returns a different
     * name. This can be usefull, for example, to convert property name from one form to another,
     * e.g. from camelCase to dash-case
     */
	attrName?: string | ((name: string) => string);

	/**
     * The name of the element property. This is sometimes needed if instead of using the
     * `setAttribute()` method we want to set the element's property directly and the property
     * name is different from the attribute name. For example, `class` -> `className` or
     * `for` -> `htmlFor`.
     *
     * This field can also specify a function that gets the JSX attribute name and returns a different
     * name. This can be usefull, for example, to convert property name from one form to another,
     * e.g. from dash-case to camelCase
     */
	propName?: string | ((name: string) => string);

    /**
     * Flag indicating that this property can only be set/removed using setAttribute/removeAttribute
     * methods and not as an element property (that is, elm[prop] = value).
     */
    asAttr?: boolean;
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



/** Symbol that can be returned from update functions indicating that there were no changes. */
const symNoChanges = Symbol("NoChanges");



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
 * Returns element property name to be used for the given JSX attribute. This returns either the
 * property name specified in the attribute information object or the JSX name itself.
 */
function getPropNameFromAttrInfo(name: string, info?: AttrPropInfo): string
{
    let propName = info?.propName ?? name;
    return typeof propName === "function" ? propName(name) : propName;
}

/**
 * Returns element attribute name to be used for the given JSX attribute. This returns either the
 * attribute name specified in the attribute information object or the JSX name itself.
 */
function getAttrNameFromAttrInfo(name: string, info?: AttrPropInfo): string
{
    let attrName = info?.attrName ?? name.toLowerCase();
    return typeof attrName === "function" ? attrName(name) : attrName;
}

/**
 * Helper function that returns three things:
 *   - Flag indicating whether to set value as element property (true) or as HTML attribute (false);
 *   - Element property name or HTML attribute name to use when setting property or attribute.
 *   - Value to set. For setting as element property, this can be of any type; for HTML attribute,
 *     it will be either string or null.
 */
function getPropValueForElm(nscode: number, elm: Element, val: any, name: string, info?: AttrPropInfo): [boolean, string, any]
{
    // determine whether this property should be set/removed as attribute
    let propName = getPropNameFromAttrInfo(name, info);

    // we need to determine whether to set value to element's property or as an attribute
    let asProp: boolean;
    if (nscode === NamespaceCode.SVG)
        asProp = false;
    else
    {
        // if the property is in the element and it is a custom HTML element, check whether the
        // property is defined on the custom class itself or on its prototype (versus on the HTML Element
        // it derives from). If yes, we know this property is handled by the custom class itself and we
        // don't need to convert the value to anything and will pass it as is.
        asProp = propName in elm;
        if (asProp && nscode === NamespaceCode.Custom &&
            (Object.hasOwn(elm, propName) || Object.hasOwn(Object.getPrototypeOf(elm), propName)))
        {
            return [true, propName, val];
        }
    }

    // by now we have the asProp set. If v2rv function is defined in the AttrInfo, use it to convert
    // the value to the needed type. If it is not defined, the value will be converted differently
    // for properties (depending on the property type) and attributes (string).
    let v2rv = info?.v2rv;
    let rval: any = v2rv?.(val, name, elm);
    let actName: string;
    if (asProp)
    {
        actName = propName;

        // if value was not converted yet, find out the type from the element itself and convert to it
        if (!v2rv)
        {
            let t = typeof elm[propName];

            // for many numeric properties negative values cannot be set directly. The val2n function
            // returns null for such properties. This is an indication that it should be deleted as
            // an attribute.
            if (t === "number")
            {
                rval = val2n(val, propName);
                if (rval == null)
                {
                    asProp = false;
                    actName = propName.toLowerCase();
                }
            }
            else
                rval = t === "string" ? val2s(val) ?? "" : t === "boolean" ? Boolean(val) : val;
        }
    }
    else
    {
        actName = getAttrNameFromAttrInfo(name, info);

        // if value was not converted yet, convert value to string
        if (!v2rv)
            rval = val2s(val);

    }

    return [asProp, actName, rval];
}



/**
 * Using the given JSX attribute name and value, set the appropriate property or attribute on the
 * element.
 */
export function setElmProp(nscode: number, elm: Element, name: string, val: any, info?: AttrPropInfo): any
{
    // get property info object
    let rval: any;
    if (info?.set)
        rval = info.set(elm, val, name, info);
    else
        rval = setElmPropInternal(nscode, elm, val, name, info);

    /// #if USE_STATS
    DetailedStats.log(StatsCategory.Attr, StatsAction.Added);
    /// #endif

    return rval;
}



/**
 * Creates new value and either sets it as the element's property or sets it as an HTML attribute
 * or removes the HTML attribute.
 */
function setElmPropInternal(nscode: number, elm: Element, val: any, name: string, info?: AttrPropInfo): any
{
    let [asProp, actName, rval] = getPropValueForElm(nscode, elm, val, name, info)

    if (asProp)
    {
        // some assignments can lead to exceptions (e.g. negative numeric values for maxLength);
        // therefore, we do the assignment within try/catch
        try {
            elm[actName] = rval;
        } catch (err) {
            /// #if DEBUG
            console.error(`Error assigning value '${rval}' to property '${actName}' of element '${elm.localName}'.`, err);
            /// #endif
        }
    }
    else if (rval != null)
        elm.setAttribute(actName, rval);
    else
        elm.removeAttribute(actName);

    return rval;
}



/**
 * Determines whether the old and the new values of the property are different and sets the updated
 * value to the element's attribute. Returns true if update has been performed and false if no
 * change in property value has been detected.
 */
export function updateElmProp(nscode: number, elm: Element, name: string, oldRVal: any, newVal: any,
    info?: AttrPropInfo): any
{
    let newRVal: any;

    if (info?.update)
        newRVal = info?.update(elm, oldRVal, newVal, name, info);
    else if (info?.set)
        newRVal = info?.set(elm, newVal, name, info);
    else
        newRVal = updateElmPropInternal(nscode, elm, oldRVal, newVal, name, info);

    if (newRVal === symNoChanges)
        return oldRVal;
    else
    {
        /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
        /// #endif

        return newRVal;
    }
}



/**
 * Generates new value, compares it to the old value and, if they are different, either sets it as
 * the element's property or sets it as an HTML attribute or removes the HTML attribute.
 */
function updateElmPropInternal(nscode: number, elm: Element, oldRVal: any, newVal: any, name: string, info?: AttrPropInfo): any
{
    let [asProp, actName, newRVal] = getPropValueForElm(nscode, elm, newVal, name, info)
    if (oldRVal !== newRVal)
    {
        if (asProp)
            elm[actName] = newRVal;
        else if (newRVal != null)
            elm.setAttribute(actName, newRVal);
        else
            elm.removeAttribute(actName);
    }

    return newRVal;
}



/** Removes the attribute(s) corresponding to the given property. */
export function removeElmProp(nscode: number, elm: Element, name: string, rval: any, info?: AttrPropInfo): void
{
    // get info object doesn't define
    if (!info?.remove)
        removeElmPropInternal(nscode, elm, name, info);
    else
        info.remove(elm, rval, name, info)

    /// #if USE_STATS
    DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
    /// #endif
}


/** Removes the attribute(s) corresponding to the given property. */
export function removeElmPropInternal(nscode: number, elm: Element, name: string, info?: AttrPropInfo): void
{
    // determine whether this property should be set/removed as attribute
    let propName = getPropNameFromAttrInfo(name, info);

    // we need to determine whether to set value to element's property or as an attribute
    let asProp = nscode === NamespaceCode.SVG ? false : propName in elm;

    if (asProp)
    {
        let t = typeof elm[propName];

        // since we don't know what value to put as a "removing" for numeric properties, we
        // revert to using removeAttribute().
        if (t === "number")
            elm.removeAttribute(propName);
        else
            elm[propName] = t === "string" ? "" : t === "boolean" ? false : null;
    }
    else
        elm.removeAttribute(getAttrNameFromAttrInfo(name, info))
}



/** Converts string from camelCase to dash-case */
const camelToDash = (s: string): string => s.replace( /([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Conversion of JSX attributes to proper types for setting as either element properties (string,
// boolean, number) or HTML attributes (string only).
//
///////////////////////////////////////////////////////////////////////////////////////////////////

// /** String of comma-separated JSX attribute names that should be set as boolean */
// const booleanJsxAttrNames = "hidden,inert,autofocus,spellcheck,disbled,checked,selected,required,readOnly,multiple,noValidate,autoplay,controls,loop,muted,playsInline,open,reverse,async,defer,ismap,display,stretchy,symmetric,largeop,movablelimits,accent";

// /** String of comma-separated JSX attribute names that should be set as numbers */
// const numberJsxAttrNames = "tabIndex,maxLength,minLength,size,cols,rows,selectedIndex,colSpan,rowSpan,height,width,volume,scriptlevel";



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
 *   - for everything else (functions and symbols), the String(val) is returned.
 */
const val2s = (val: any): string | null =>
	["string", "number", "bigint"].includes(typeof val) ? val.toString() :
    val == null || val === false ? null :
    val === true ? "" :
    Array.isArray(val) ? arr2s(val, " ") :
    // typeof val === "object" ? obj2s(val) :
    String(val);



/** Names of HTML properties that allow setting their values to negative values */
const negativeNumericPropNames = ["tabIndex", "selectedIndex", "loop", "start"];

/**
 * Helper function that converts the given value to number. Returns null as an indication that
 * the attribute should be removed.
 */
function val2n(val: any, propName: string): number | null
{
    let rval = val == null ? null : Number(val);

    // negative numbers are only allowed for several properties; for all others we return null so
    // that the corresponding attribute will be deleted.
    if (rval && rval < 0 && !negativeNumericPropNames.includes(propName))
        rval = null;

    return rval;
}



/** Joins array elements (recursively) with the given separator */
const arr2s = (val: any | any[], sep: string): string | null =>
    Array.isArray(val) ? val.map(v => val2s(v)).filter(v => !!v).join(sep) : val2s(val);



// /**
//  * One-way function that produces unique string for a given object. Doesn't handle circular
//  * references.
//  */
// function obj2s(obj: Record<string, any>,
//     keyFunc?: (key: string) => string, valFunc?: (val: any) => string | null): string
// {
//     if (Symbol.toPrimitive in obj || (obj.toString && obj.toString !== Object.prototype.toString))
//         return String(obj);

//     let s = "";
//     for (let key in obj)
//     {
//         let val = obj[key];
//         s += keyFunc ? keyFunc(key) : key;
//         s += valFunc ? valFunc(val) : val2s(val)
//     }
//     return s;
// }



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
    nameFunc: ObjectPropToAttrNameFunc, valFunc: ObjectPropValToStringFunc): any
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

    return hasChanges ? stringifyObjectProp(newVal, nameFunc, valFunc) : symNoChanges;
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
const setValueProp = (elm: HTMLInputElement | HTMLTextAreaElement, val: any): string | null => elm.value = val2s(val) ?? "";



/** Removes the `value` attribtue */
const removeValueProp = (elm: HTMLInputElement | HTMLTextAreaElement): void => { elm.value = ""; }



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
function setStyleProp(elm: Element, val: string | Styleset | null | undefined): any
{
    let styleObj = (elm as any).style as CSSStyleDeclaration;

    if (val == null || typeof val === "string")
    {
        let rval = val ?? "";
        styleObj.cssText = rval;
        return rval;
    }

    // now we know that the value is an object; if Mimcss library is not included, we cannot handle it.
    if (!mimcss)
    {
        styleObj.cssText = "";
        return "";
    }

    // convert Styleset to string record and set all its properties to the element's style object
    let rval = mimcss.stylesetToRecord(val);
    for (let propName in rval)
    {
        let propVal = rval[propName];
        if (propName.startsWith("--"))
            styleObj.setProperty(propName, propVal);
        else
            styleObj[propName] = propVal;
    }

    // this is a new object so if the Mimcss style object changes internally and is used for
    // updates, it wouldn't compare with this returned value.
    return rval;
}



/**
 * Converts style property value using Mimcss library if available.
 */
function updateStyleProp(elm: Element, rval: string | Record<string, string> | null | undefined,
    newVal: string | Styleset | null | undefined): any
{
    let styleObj = (elm as any).style as CSSStyleDeclaration;

    // if the new value is null, undefined or string and new  value is not the same as the
    // remembered value, update the style's cssText.
    if (newVal == null || typeof newVal === "string")
    {
        let newRVal = newVal ?? "";
        if (newRVal !== rval)
        {
            styleObj.cssText = newRVal;
            return newRVal;
        }
        else
            return undefined;
    }

    // now we know that the new value is an object; if Mimcss library is not included, we cannot handle it.
    if (!mimcss)
    {
        styleObj.cssText = "";
        return "";
    }

    // if the remembered value is not an object (or is null), first clean the current style and then call
    // setStyleProp
    if (rval == null || typeof rval !== "object")
        return setStyleProp(elm, newVal);

    // no we know that both new value and remembered value are objects, so we can compare and set
    // the new style property by property.

    // convert Styleset to string record
    let newRVal = mimcss.stylesetToRecord(newVal);

    // prepare flag indicating whether any changes are made
    let hasChanges = false;

    // go over old properties and remove those that are not in the new style
    for (let propName in rval)
    {
        if (!(propName in newRVal))
        {
            hasChanges = true;
            if (propName.startsWith("--"))
                styleObj.removeProperty(propName);
            else
                styleObj[propName] = "";
        }
    }

    // go over new properties and remove those that are not in the new style
    for (let propName in newRVal)
    {
        let newPropVal = newRVal[propName];
        if (newPropVal !== rval[propName])
        {
            hasChanges = true;
            if (propName.startsWith("--"))
                styleObj.setProperty(propName, newPropVal);
            else
                styleObj[propName] = newPropVal;
        }
    }

    // this is a new object so if the Mimcss style object changes internally and is used for
    // updates, it wouldn't compare with this returned value.
    return hasChanges ? newRVal : symNoChanges;
}



/**
 * Converts style property value using Mimcss library if available.
 */
function removeStyleProp(elm: Element): any
{
    let styleObj = (elm as any).style as CSSStyleDeclaration;
    styleObj.cssText = "";
}



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
const ArrayWithCommaPropInfo: AttrPropInfo = { v2rv: val => arr2s(val, ",") };

/** Produces semicolon-separated list from array of values */
const ArrayWithSemicolonPropInfo: AttrPropInfo = { v2rv: val => arr2s(val, ";") };

/** Handles conversion of CssLength-typed attributes to strings */
const CssLengthPropInfo: AttrPropInfo = { v2rv: (val: any) => mimcssPropToString(val, "<length>") };

/** Handles conversion of CssColor-typed attributes to strings */
const CssColorPropInfo: AttrPropInfo = { v2rv: (val: any) => mimcssPropToString(val, "color") };

/** Handles conversion of SVG presentation attributes as Mimcss style properties to strings */
const SvgAttrAsStylePropInfo: AttrPropInfo = { v2rv: svgAttrToStylePropString };

/** Handles conversion of SVG presentation attributes' names from camelCase to dash case */
const SvgAttrNameConversionPropInfo: AttrPropInfo = { attrName: camelToDash };

/**
 * Handles conversion of SVG presentation attributes as Mimcss style properties to strings and
 * conversion of camelCase propery names to dash case.
 */
const SvgAttrAsStyleWithNameConversionPropInfo: AttrPropInfo = { v2rv: svgAttrToStylePropString, attrName: camelToDash };



/** Type combining PropInfo or function that returns PropEinfo for the given element and property names */
type PropInfoOrFunc = PropInfo | ((elmName: string, attrName: string, nscode: number) => PropInfo);



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
    children: FrameworkPropInfo,
    updateStrategy: FrameworkPropInfo,

    // JSX attributes, which are set as element properties but property name is different
    class: {propName: "className"},
    for: {propName: "htmlFor"},

    checked: { set: setCheckedProp, remove: removeCheckedProp },
    defaultChecked: { set: setCheckedProp, update: doNothing, remove: doNothing },
    value: { set: setValueProp, remove: removeValueProp },
    defaultValue: { set: setValueProp, update: doNothing, remove: doNothing },
    style: { set: setStyleProp, update: updateStyleProp, remove: removeStyleProp },
    media: { v2rv: mediaToString },
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
        v2rv: elmName.startsWith("animate") || elmName === "set"
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

    // // global events
    // click: { type: PropType.Event, schedulingType: TickSchedulingType.Sync },
};



/** Registers information about the given property. */
export function registerElmProp(propName: string, info: AttrPropInfo | EventPropInfo | CustomAttrPropInfo): void
{
    if (propName in globalPropRegistry)
    {
        /// #if DEBUG
        console.error( `Element property ${propName} is already registered.`);
        /// #endif

        return;
    }

    globalPropRegistry[propName] = info;
}



/**
 * Retrieves info about a JSX attribute
 */
export function getPropInfo(nscode: number, elmName: string, name: string): PropInfo | undefined
{
    let info = globalPropRegistry[name];
    return info === FrameworkPropInfo ? info as AttrPropInfo : typeof info === "function" ? info(elmName, name, nscode) : info;
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
        for (let propName in props)
            elm[propName] = props[propName];
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



