﻿import { IComponent, IComponentEx } from "./CompTypes";
import { IAriaset } from "./ElementTypes";



/**
 * Defines function signature for converting an attribute string value to the corresponding
 * property's type. Converter functions are specified as part of attribute options, e.g. in the
 * {@link WebElmAPI!attr} decorator.
 *
 * @param stringValue Attribute's string value to convert to the corresponding type.
 * @param attrName Name of the attribute whose value is being converted from string
 */
export type WebElmFromHtmlConverter = (stringValue: string | null | undefined,
    attrName: string) => any;



/**
 * Defines function signature for converting a value to the corresponding attributes's
 * string. Converter functions are specified as part of attribute options, e.g. in the
 * {@link WebElmAPI!attr} decorator.
 *
 * @param value Value to convert to string.
 * @param attrName Name of the attribute whose value is being converted to string
 */
export type WebElmToHtmlConverter = (value: any, attrName: string) => string | null;



/**
 * Defines function signature for attribute change notification handler.
 */
export type WebElmAttrChangeHandler<T = any> = (newValue: T, attrName: string) => any;



/**
 * Options specified when defining an element attribute.
 */
export type WebElmAttrOptions =
{
    /**
     * Flag indicating that no trigger should be created for the property reflecting the
     * attribute's value.
     */
    triggerDepth?: number;

    /** Converter function that converts the string attribute value to a property native type */
    fromHtml?: WebElmFromHtmlConverter;

    /** Converter function that converts a value to a string that can be set to the HTML attribute */
    toHtml?: WebElmToHtmlConverter;

    /** Notification function that is called when the attribute value changes */
    onchanged?: WebElmAttrChangeHandler;
}



/**
 * Options determining behavior of the custom element. They include ShadowRootInit properties
 * (including the shadow root mode) and several additional configuration parameters.
 */
export type WebElmOptions = Partial<ShadowRootInit> &
{
    /**
     * Flag indicating that the custom element class should not be immediately registered.
     * If this is true, the class will be registered when the {@link WebElmAPI!registerWebElm} function
     * is called for it.
     */
    deferred?: boolean;

    /**
     * Flag indicating whether the element should be associated with a form.
     */
    formAssociated?: boolean;

    /**
     * Provides default values for ARIA (`aria-*`) attributes.
     */
    aria?: IAriaset;

    /**
     * Determines whether or not shadow DOM root node should be created under the element. If
     * undefined or false, shadow DOM is created. If true, shadow DOM is not created.
     */
    noShadow?: boolean;
}



/**
 * Maps every property of the given type to an optional "onchanged" function that accepts the old
 * and the new values of a changed property.
 */
export type OnPropChangeHandlers<TEvents> =
{
    [P in keyof TEvents & string as `onchanged_${P}`]?: (oldValue: TEvents[P], newValue?: TEvents[P]) => any
}



/**
 * Represents the Mimbl component side of the custom element implementation.
 * @typeparam TAttrs Type that maps attribute names to attribute types.
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 */
export interface IWebElm<TAttrs extends {} = {}, TEvents extends {} = {}>
    extends IComponent<TAttrs,TEvents>, IComponentEx<TEvents>
{
    /**
     * Invokes the given function in the "style adoption context"; which allows all Mimcss style
     * manipulations to be reflected in the adoption context of the element's shadow DOM.
     *
     * @param func Function that is called while Mimcss adoption context related to the element's
     * shadow root is set.
     * @param useAdoption Flag indicating that stylesheets should be adopted by instead of
     * created under the shadow root. The flag is ignored if the adoption is not supported or if
     * the shadow root does not exist.
     */
    processStyles(func: () => void, useAdoption?: boolean): void;

    /**
     * Sets the value of the given attribute converting it to string if necessary.
     * @typeparam K Defines a range of possible values for the `attrName` parameter. K is a key
     * from the `TAttr` type.
     * @param attrName Attribute name, which is a key from the `TAttrs` type
     * @param value Value to set to the attribute. It is converted to string if necessary.
     */
    setAttr<K extends string & keyof TAttrs>(attrName: K, value: TAttrs[K]): void;

    /**
     * Gets the current string value of the given attribute.
     * @typeparam K Defines a range of possible values for the `attrName` parameter. K is a key
     * from the `TAttr` type.
     * @param attrName Attribute name, which is a key from the `TAttrs` type
     * @returns The current value of the attribute.
     */
    getAttr<K extends string & keyof TAttrs>(attrName: K): string | null;

    /**
     * Determines whether the element has the attribute with the given name.
     * @typeparam K Defines a range of possible values for the `attrName` parameter. K is a key
     * from the `TAttr` type.
     * @param attrName Attribute name, which is a key from the `TAttrs` type
     * @returns True if the attribute with the given name exists on the element.
     */
    hasAttr<K extends string & keyof TAttrs>(attrName: K): boolean;

    /**
     * Fires an event of the given type. The `detail` parameter is interpreted differently for
     * built-in and custom events. For built-in events (that is, events whose type derives from
     * Event), this is the event object itself. For custom events, it becomes the value of the
     * `detail` property of the CustomEvent object.
     * @typeparam K Defines a range of possible values for the `eventType` parameter. K is a key
     * from the `TEvent` type.
     * @param eventType Event type name, which is a key from the `TEvents` type
     * @param detail Event data, whose type is defined by the type mapped to the key
     * in the `TEvents` type.
     */
    fireEvent<K extends string & keyof TEvents>(eventType: K, detail: TEvents[K]): boolean;
}



/**
 * Represents a constructor for the HTMLElement-derived classes. This constructor is returned from
 * the {@link WebElmAPI!WebElm} and {@link WebElmAPI!WebElmEx} functions.
 *
 * @typeparam TElm Class deriving from HTMLElement, from which the resulting class will inherit.
 * @typeparam TAttrs Type that maps attribute names to attribute types.
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 */
export interface WebElmConstructor<TElm extends HTMLElement = HTMLElement, TAttrs extends {} = {}, TEvents extends {} = {}>
{
    new (): TElm & IWebElm<TAttrs, TEvents>;
}



