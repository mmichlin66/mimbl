import { IComponent, IComponentEx } from "./CompTypes";
/**
 * Defines function signature for converting an attribute string value to the corresponding
 * property's type. Converter functions are specified as part of attribute options, e.g. in the
 * [[attr]] decorator.
 * @param stringValue Attribute's string value to convert to the corresponding type.
 * @param attrName Name of the attribute
 */
export declare type WebElmFromHtmlConverter = (stringValue: string | null, attrName: string) => any;
/**
 * Defines function signature for converting a property value to the corresponding attributes's
 * string. Converter functions are specified as part of attribute options, e.g. in the
 * [[attr]] decorator.
 */
export declare type WebElmToHtmlConverter = (value: any, attrName: string) => string | null;
/**
 * Defines function signature for attribute change notification handler.
 */
export declare type WebElmAttrChangeHandler<T = any> = (newValue: T, attrName: string) => any;
/**
 * Options specified when defining an element attribute.
 */
export declare type WebElmAttrOptions = {
    /**
     * Flag indicating that no trigger should be created for the property reflecting the
     * attribute's value.
     */
    noTrigger?: boolean;
    /** Converter function that converts the string attribute value to a property native type */
    fromHtml?: WebElmFromHtmlConverter;
    /** Notification function that is called when the attribute value changes */
    onchanged?: WebElmAttrChangeHandler;
};
/**
 * Options determining behavior of the custom element. They include ShadowRootInit properties
 * (including the shadow root mode) and several additional configuration parameters.
 */
export declare type WebElmOptions = Partial<ShadowRootInit> & {
    /**
     * If defined, determines the tag name of a built-in HTML element that the custom element
     * extends.
     */
    extends?: string;
    /**
     * Determines whether or not shadow DOM root node should be created under the element. If
     * undefined or false, shadow DOM is created. If true, shadow DOM is not created.
     */
    noShadow?: boolean;
};
/**
 * Maps every property of the given type to an optional "onchanged" function that accepts the old
 * and the new values of a changed property.
 */
export declare type OnPropChangeHandlers<T> = {
    [P in keyof T & string as `onchanged_${P}`]?: (oldValue: T[P], newValue?: T[P]) => any;
};
/**
 * Represents the Mimbl component side of the custom element implementation.
 * @typeparam TAttrs Type or interface mapping attribute names to attribute types.
 * @typeparam TEvents Type or interface mapping event names to the types of the `detail`
 * property of the `CustomEvent` objects for the events.
 */
export interface IWebElm<TAttrs = {}, TEvents = {}> extends IComponent, IComponentEx {
    /**
     * Invokes the given function in the "style adoption context"; which allows all Mimcss style
     * manipulations to be reflected in the adoption context of the element's shadow DOM.
     * @param func Function that is called while Mimcss adoption context related to the element's
     * shadow root is set.
     */
    processStyles(func: () => void): void;
    /**
     * Sets the value of the given attribute converting it to string if necessary.
     * @param attrName Attribute name, which is a key from the `TAttrs` type
     * @param value Value to set to the attribute. It is converted to string if necessary.
     */
    setAttr<K extends string & keyof TAttrs>(attrName: K, value: TAttrs[K]): void;
    /**
     * Gets the current value of the given attribute converting it from string to the
     * attributes type.
     * @param attrName Attribute name, which is a key from the `TAttrs` type
     * @returns value The current value of the attribute.
     */
    getAttr<K extends string & keyof TAttrs>(attrName: K): TAttrs[K];
    /**
     * Fires a custom event with `details` of appropriate type.
     * @param eventType Event type name, which is a key from the `TEvents` type
     * @param detail Event data, whose type is defined by the type mapped to the key
     * in the `TEvents` type.
     */
    fireEvent<K extends string & keyof TEvents>(eventType: K, detail: TEvents[K]): boolean;
}
/**
 * Represents a constructor for the HTMLElement-derived classes.
 *
 * @typeparam TElm Class deriving from HTMLElement, from which the resulting class will inherit.
 * @typeparam TAttrs Type or interface mapping attribute names to attribute types.
 * @typeparam TEvents Type or interface mapping event names to the types of the `detail`
 * property of the `CustomEvent` objects for the events.
 */
export interface WebElmConstructor<TElm extends HTMLElement = HTMLElement, TAttrs = {}, TEvents = {}> {
    new (): TElm & IWebElm<TAttrs, TEvents>;
}
//# sourceMappingURL=WebElmTypes.d.ts.map