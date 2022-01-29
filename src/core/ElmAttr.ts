import {Styleset, SchedulerType, StringStyleset, MediaStatement} from "mimcss"
import {ICustomAttributeHandlerClass, TickSchedulingType} from "../api/mim"
import {mimcss} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats";
/// #endif
; // ugly trick to not let the TypeScript compiler to strip the #endif comment



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Type of properties that can be specified for an element.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export const enum PropType
{
    /**
     * Built-in attribute that is used internally by the Mimbl infrastructure and is not set
     * to the element.
     */
	Framework = 0,

	/** Regular attributes set using Element.setAttribute */
	Attr = 1,

	/** Event listeners set using Element.addEventListener */
	Event = 2,

	/**  Custom attributes for which handler factories are registered*/
	CustomAttr = 3,
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Base interface describing information kept about property that can be specified for an element.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface PropInfoBase
{
	// Type of the property.
	type: PropType;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Information about attributes that contains functions for setting, diffing, updating and
// removing attribute(s) corresponding to the property.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface AttrPropInfo extends PropInfoBase
{
	// Function that sets the value of the attribute. If this function is not defined, then the DOM
	// elm.setAttribute is called with propName as attribute name and propVal converted to string.
	set?: (elm: Element, attrName: string, propVal: any) => void;

	// Function that compares the old and the new value of the attribute and returns an object
	// that will be passed to the updateFunc function. If undefined is returned, the value of the
	// attribute will not change (that means the old and the new values are equal). If this
	// function is not defined, property values are converted to string and compared as strings.
	// If these strings are different, the string corresponding to the  new value is returned.
	diff?: (attrName: string, oldPropVal: any, newPropVal: any) => any;

	// Function that updates the value of the attribute based on the object that was returned
	// from the diff function. If this function is not defined, then the set function is used. If
	// the set function is not defined either, the DOM elm.setAttribute is called with propName as
	// attribute name and updateVal converted to string.
	update?: (elm: Element, attrName: string, updateVal: any) => void;

	// Function that removes the attribute. If this function is not defined, then the DOM
	// elm.removeAttribute is called with propName as attribute name.
	remove?: (elm: Element, attrName: string) => void;

	// The actual name of the attribute. This is sometimes needed if the attribute name cannot be
	// used as property name - for example, if attribute name contains characters not allowed in
	// TypeScript identifier (e.g. dash).
	attrName?: string;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Information about events.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface EventPropInfo extends PropInfoBase
{
	// Type of scheduling the Mimbl tick after the event handler function returns
	schedulingType?: TickSchedulingType;

	// Flag indicating whether the event bubbles. If the event doesn't bubble, the event handler
	// must be set on the element itself; otherwise, the event handler can be set on the root
	// anchor element, which allows having a single event handler registered for many elements,
	// which is more performant.
	isBubbling?: boolean;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Information about custom attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface CustomAttrPropInfo extends PropInfoBase
{
	// Class object that creates custom attribute handlers.
	handlerClass: ICustomAttributeHandlerClass<any>;
}



/** Type combining information about regular attributes or events or custom attributes. */
export type PropInfo = AttrPropInfo | EventPropInfo | CustomAttrPropInfo;



// Object that maps property names to PropInfo-derived objects. Information about custom
// attributes is added to this object when the registerProperty method is called.
let propInfos: {[P:string]: PropInfo} =
{
    // framework attributes.
    key: { type: PropType.Framework },
    ref: { type: PropType.Framework },
    vnref: { type: PropType.Framework },
    updateStrategy: { type: PropType.Framework },

    // attributes - only those attributes are listed that have non-trivial treatment or whose value
    // type is object or function. ID and class are present here because their value can be
    // specified as Mimcss IDRule and ClassRule objects respectively.
    id: { type: PropType.Attr },
    class: { type: PropType.Attr },
    style: { type: PropType.Attr, set: setStyleProp, diff: diffStyleProp, update: updateStyleProp },
    media: { type: PropType.Attr, set: setMediaProp, diff: diffMediaProp, update: updateMediaProp },
    value: { type: PropType.Attr, set: setValueProp, diff: diffValueProp, remove: removeValueProp },
    defaultValue: { type: PropType.Attr, set: setValueProp, diff: diffDefaultValueProp, remove: removeDefaultValueProp },
    checked: { type: PropType.Attr, set: setCheckedProp, diff: diffCheckedProp, remove: removeCheckedProp },
    defaultChecked: { type: PropType.Attr, set: setCheckedProp, diff: diffDefaultValueProp, remove: removeDefaultValueProp },

    // frequently used events for speeding up the lookup
    click: { type: PropType.Event, schedulingType: TickSchedulingType.Sync },
    mousemove: { type: PropType.Event, schedulingType: TickSchedulingType.None },
    mouseover: { type: PropType.Event, schedulingType: TickSchedulingType.None },
    pointermove: { type: PropType.Event, schedulingType: TickSchedulingType.None },
    pointerover: { type: PropType.Event, schedulingType: TickSchedulingType.None },
    input: { type: PropType.Event, schedulingType: TickSchedulingType.None },
    scroll: { type: PropType.Event, schedulingType: TickSchedulingType.None },
    touchmove: { type: PropType.Event, schedulingType: TickSchedulingType.None },
    wheel: { type: PropType.Event, schedulingType: TickSchedulingType.None },

    // // events
    // mouseenter: { type: PropType.Event, isBubbling: false },
    // mouseleave: { type: PropType.Event, isBubbling: false },
    // pointerenter: { type: PropType.Event, isBubbling: false },
    // pointerleave: { type: PropType.Event, isBubbling: false },
};



/**
 * Helper function that converts the given value to string.
 *   - strings are returned as is.
 *   - null and undefined are converted to an empty string.
 *   - arrays are converted by calling this function recursively on the elements and separating
 *     them with spaces.
 *   - everything else is converted by calling the toString method.
 */

function valToString( val: any): string
{
	if (typeof val === "string")
		return val;
	else if (Array.isArray( val))
		return val.map( item => valToString(item)).filter( item => !!item).join(" ");
	else if (val == null)
		return "";
	else
		return val.toString();
}



// Registers information about the given property.
export function registerElmProp( propName: string, info: AttrPropInfo | EventPropInfo | CustomAttrPropInfo): void
{
    if (propName in propInfos)
        throw new Error( `Attribute ${propName} is already registered.`);

    propInfos[propName] = info;
}



// Registers information about the given property.
export function getElmPropInfo( propName: string): PropInfo | undefined
{
    return propInfos[propName];
}



// Using the given property name and its value set the appropriate attribute(s) on the
// element. This method handles special cases of properties with non-trivial values.
export function setElmProp( elm: Element, propName: string, info: AttrPropInfo | null, propVal: any): void
{
    // get property info object
    if (!info)
        elm.setAttribute( propName, valToString( propVal));
    else
    {
        // get actual attribute name to use
        let attrName = info.attrName || propName;

        if (info.set)
            info.set( elm, attrName, propVal);
        else
            elm.setAttribute( attrName, valToString( propVal));
    }

    /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
    /// #endif
}



// Determines whether the old and the new values of the property are different and sets the
// updated value to the element's attribute. Returns true if update has been performed and
// false if no change in property value has been detected.
export function updateElmProp( elm: Element, propName: string, info: AttrPropInfo | null, oldPropVal: any, newPropVal: any): boolean
{
    // get property info object
    if (!info)
    {
        // if this is not a special case (property is not in our list) just compare them and
        // if they are different set the attribute to the new value.
        if (oldPropVal === newPropVal)
            return false;
        else
        {
            elm.setAttribute( propName, valToString( newPropVal));

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
            /// #endif

            return true;
        }
    }

    // compare old and new value using the update function if defined; if not, just compare
    // the two values and if they are different use the new one as a value to update with.
    // Note that the neither old nor new values can be undefined or null.
    let updateVal: any;
    if (info.diff)
    {
        updateVal = info.diff( propName, oldPropVal, newPropVal);

        // if updateValue is undefined then no change has been detected.
        if (updateVal === undefined)
            return false;
    }
    else if (oldPropVal !== newPropVal)
        updateVal = newPropVal;
    else
        return false;

    // get actual attribute name to use
    let attrName = info.attrName || propName;

    // if update method is defined use it; otherwise, remove the old value and set the new one
    if (info.update)
        info.update( elm, attrName, updateVal);
    else
    {
        // if remove method is defined, use it. Note that if remove method is not defined
        // we don't use elm.removeAttribute to save time (as the following info.set or
        // elm.setAttribute will override it anyway).
        if (info.remove && !info.set)
            info.remove( elm, attrName);

        if (info.set)
            info.set( elm, attrName, updateVal);
        else
            elm.setAttribute( attrName, valToString( updateVal));
    }

    /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
    /// #endif

    // indicate that there was change in attribute value.
    return true;
}



// Removes the attribute(s) corresponding to the given property.
export function removeElmProp( elm: Element, propName: string, info: AttrPropInfo | null): void
{
    // get property info object
    if (!info)
        elm.removeAttribute( propName);
    else
    {
        // get actual attribute name to use
        let attrName = info.attrName || propName;

        if (info.remove)
            info.remove( elm, attrName);
        else
            elm.removeAttribute( attrName);
    }

    /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
    /// #endif
}



//// Register events with special names
//ElmAttr.registerProp( "smartcardInsert",
//	{ mustRemove: mustRemoveListeners, set: setListenerProp, remove: removeListenerProp, attrName: "smartcard-insert" });
//ElmAttr.registerProp( "smartcardInsertCapture",
//	{ mustRemove: mustRemoveListeners, set: setListenerCaptureProp, remove: removeListenerCaptureProp, attrName: "smartcard-insert" });
//ElmAttr.registerProp( "smartcardRemove",
//	{ mustRemove: mustRemoveListeners, set: setListenerProp, remove: removeListenerProp, attrName: "smartcard-insert" });
//ElmAttr.registerProp( "smartcardRemoveCapture",
//	{ mustRemove: mustRemoveListeners, set: setListenerCaptureProp, remove: removeListenerCaptureProp, attrName: "smartcard-remove" });



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of style property. Style property can be specified either as a string or as the
// Styleset object from the Mimcss library. If the old and new style property values are of
// different types the diff function returns the new style value. If both are of the string type,
// then the new string value is returned. If both are of the CSSStyleDeclaration type, then an
// object is returned whose keys correspond to style items that should be changed. For updated
// items, the key value is from the new style value; for removed items, the key value is undefined.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
function setStyleProp( elm: Element, attrName: string, propVal: string | Styleset): void
{
    if (mimcss)
        mimcss.setElementStyle( elm as HTMLElement, propVal, SchedulerType.Sync);
    else if (typeof propVal === "string")
        elm.setAttribute( attrName, propVal);
}



function diffStyleProp( attrName: string, oldPropVal: string | Styleset, newPropVal: string | Styleset): any
{
    if (oldPropVal === newPropVal)
        return undefined;

    // if Mimcss library is not included, then style attributes can only be strings. If they are
    // not, this is an application bug and we canont handle it.
    if (!mimcss && (typeof oldPropVal !== "string" || typeof newPropVal !== "string"))
        return undefined;
    else if (typeof oldPropVal === "string" && typeof newPropVal === "string")
        return newPropVal;
    else if (typeof oldPropVal === "object" && typeof newPropVal === "object")
    {
        // we have to return undefined because null is considered a valid update value
        let res = mimcss.diffStylesets( oldPropVal, newPropVal);
        return res == null ? undefined : res;
    }
    else if (typeof oldPropVal === "string")
    {
        let newPropValAsString = mimcss.stylesetToString( newPropVal);
        return oldPropVal !== newPropValAsString ? newPropValAsString : undefined;
    }
    else //if (typeof newPropVal === "string")
    {
        let oldPropValAsString = mimcss.stylesetToString( oldPropVal);
        return oldPropValAsString !== newPropVal ? newPropVal : undefined;
    }
}



function updateStyleProp( elm: Element, attrName: string, updateVal: string | StringStyleset): void
{
    if (typeof updateVal === "object")
    {
        if (mimcss)
            mimcss.setElementStringStyle( elm as HTMLElement, updateVal, SchedulerType.Sync);
    }
    else
        elm.setAttribute( attrName, updateVal);
}




///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of media property. Media property can be specified either as a string or as the
// MediaStatement object from the Mimcss library.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
function setMediaProp( elm: Element, attrName: string, propVal: MediaStatement): void
{
   elm[attrName] = mimcss.mediaToString( propVal);
}



function diffMediaProp( attrName: string, oldPropVal: MediaStatement, newPropVal: MediaStatement): any
{
    if (oldPropVal === newPropVal)
        return undefined;

    // if Mimcss library is not included, then media attributes can only be strings. If they are
    // not, this is an application bug and we canont handle it.
    if (!mimcss && (typeof oldPropVal !== "string" || typeof newPropVal !== "string"))
        return undefined;

    let oldString = mimcss.mediaToString( oldPropVal);
	let newString = mimcss.mediaToString( newPropVal);

	// we must return undefined because null is considered a valid update value
	return newString === oldString ? undefined : newString;
}



function updateMediaProp( elm: Element, attrName: string, updateVal: string): void
{
    elm[attrName] = updateVal;
}




///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of value property. Instead of setting value property as an attribute we set the value
// field on the element. The set and update methods work the same way. We define the remove method
// by setting the elm.value field to null.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
function setValueProp( elm: Element, attrName: string, propVal: any): void
{
	// we need to cast elm to any, because generic Element doesn't have value property.
	(elm as any).value = propVal;
}




function diffValueProp( attrName: string, oldPropValVal: any, newPropVal: any): boolean
{
	// by always returning the new property value we cause the value to always be updated to
	// that of the new property. We want always to set this value to the element because the
	// element's value may have chnged (by the user or programmatically).
	return newPropVal;
}




function removeValueProp( elm: Element, attrName: string): void
{
	// we need to cast elm to any, because generic Element doesn't have value property.
	(elm as any).value = null;
}




///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of defaultValue property. The defaultValue property works as a value property when the
// element is first mounted and is ignored upon updates and removals. This allows using
// defaultValue to initialize the control value once.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
function diffDefaultValueProp( attrName: string, oldPropValVal: any, newPropVal: any): boolean
{
	// by returning undefined we indicate that no changes were made to the property and thus the
	// update will not be called
	return undefined;
}




function removeDefaultValueProp( elm: Element, attrName: string): void
{
	// do nothing
}




///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of checked property. Instead of setting checked property as an attribute we set the
// checked field on the element. The set and update methods work the same way. We define the remove
// method by setting the elm.checked field to null.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
function setCheckedProp( elm: Element, attrName: string, propVal: any): void
{
	// we need to cast elm to any, because generic Element doesn't have value property.
	(elm as any).checked = propVal;
}




function diffCheckedProp( attrName: string, oldPropValVal: any, newPropVal: any): boolean
{
	// by always returning the new property value we cause the value to always be updated to
	// that of the new property.
	return newPropVal;
}




function removeCheckedProp( elm: Element, attrName: string): void
{
	// we need to cast elm to any, because generic Element doesn't have value property.
	(elm as any).checked = false;
}




