﻿import {Styleset, IIDRule, ClassMoniker} from "mimcss"



/**
 * Type of entities that can become renderable content. This type should be used when defining
 * types of children that elements and coponents can accept. This type is also set as the
 * Element type in the global JSX namespace.
 *
 * Note that functional components and `render()` methods in class-based components DO NOT need to
 * use this type as their return type - they can use `any`. Moreover, they can return `null` or
 * `undefined` (or even `true` and `false`) to indicate no-content.
 */
export type JsxElm = object | string | number | bigint | Function;



/**
 * Type for defining the id property of HTML elements
 */
export type IDPropType = string | number | IIDRule;



// Types for some common HTML and SVG properties

/** Type for `crossorigin` attribute used for some HTML and SVG elements */
export type CrossoriginPropType = "anonymous" | "use-credentials" | boolean;

/** Type for `formenctype` attribute used for some HTML and SVG elements */
export type FormenctypePropType = "application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain";

/** Type for `formmethod` attribute used for some HTML and SVG elements */
export type FormmethodPropType = "get" | "post" | "dialog";

/** Type for `formtarget` attribute used for some HTML and SVG elements */
export type FormtargetPropType = string | "_self" | "_blank" | "_parent"| "_top";

/** Type for `referrerpolicy` attribute used for some HTML and SVG elements */
export type ReferrerPolicyPropType = "no-referrer" | "no-referrer-when-downgrade" | "origin" |
		"origin-when-cross-origin" | "unsafe-url";

/** Type for `fetchpriority` attribute used for some HTML and SVG elements */
export type FetchpriorityPropType = "high" | "low" | "auto";

/**
 * Type for `dataset` attribute that Combines `data-*` properties into one object, so that it
 * is easier (less verbose) to specify them.
 */
export type DatasetPropType = { [K: string]: any };



/**
 * Boolean values in aria are specified as strings `"true"` or `"false"`
 */
export type AriaBoolean =  boolean | "true" |"false";



/**
 * Defines a set of aria properties. All properties in this interface except `role` are serialized
 * by appending `"aria-"` to the property name. The `role` attribute is added here for convenience
 * to keep all ARIA-related attributes in one place.
 */
export interface IAriaset
{
    role?: string;
    activedescendant?: IDPropType;
    atomic?: AriaBoolean;
    autocomplete?: "none" | "inline" | "list" | "both";
    braillelabel?: string;
    brailleroledescription?: string;
    busy?: AriaBoolean;
    checked?: AriaBoolean | "mixed" | "undefined";
    colcount?: number;
    colindex?: number;
    colindextext?: string;
    colspan?: number;
    controls?: IDPropType | IDPropType[];
    current?: AriaBoolean | "page" | "step" | "location" | "date" | "time";
    describedby?: IDPropType | IDPropType[];
    description?: string;
    details?: IDPropType | IDPropType[];
    disabled?: AriaBoolean;
    errormessage?: IDPropType | IDPropType[];
    expanded?: AriaBoolean | "undefined";
    flowto?: IDPropType | IDPropType[];
    haspopup?: AriaBoolean | "menu" | "listbox" | "tree" | "grid" | "dialog";
    hidden?: AriaBoolean | "undefined";
    invalid?: AriaBoolean | "grammar" | "spelling";
    keyshortcuts?: string | string[];
    label?: string;
    labelledby?: IDPropType | IDPropType[];
    level?: number;
    live?: "assertive" | "off" | "polite";
    modal?: AriaBoolean;
    multiline?: AriaBoolean;
    multiselectable?: AriaBoolean;
    orientation?: "horizontal" | "vertical" | "undefined";
    owns?: IDPropType | IDPropType[];
    placeholder?: string;
    posinset?: number;
    pressed?: AriaBoolean | "mixed" | "undefined";
    readonly?: AriaBoolean;
    relevant?: "additions" | "all" | "removals" | "text" | "additions text";
    required?: AriaBoolean;
    roledescription?: string;
    rowcount?: number;
    rowindex?: number;
    rowindextext?: string;
    rowspan?: number;
    selected?: AriaBoolean | "undefined";
    setsize?: number;
    sort?: "ascending" | "descending" | "none" | "other";
    valuemax?: number;
    valuemin?: number;
    valuenow?: number;
    valuetext?: string;
}



/**
 * Represents standard element properties present on all elements
 */
export interface IElementAttrs
{
	class?: ClassMoniker;
	draggable?: "true" | "false";
	id?: IDPropType;
	lang?: string;
	role?: string;
	style?: string | Styleset;
	tabindex?: number;
    xmlns?: string;

    /**
     * Combines `data-*` properties into one object, so that it is easier (less verbose) to specify
     * them. When this object is serialized to HTML element, each property name is converted to
     * dash-style and prefixed with the `data-` string. The values are always converted to strings
     * according to the following rules:
     *   - strings are returned as is.
     *   - arrays are converted by converting their items using these rules and joining them with spaces.
     *   - everything else is converted by calling the toString method.
     */
    dataset?: DatasetPropType;

    /**
     * Combines `aria-*` properties into one object, so that it is easier (less verbose) to specify
     * them. When this object is serialized to HTML element, each property name is converted to
     * dash-style and prefixed with the `aria-` string. The values are always converted to strings
     * according to the following rules:
     *   - strings are returned as is.
     *   - arrays are converted by converting their items using these rules and joining them with spaces.
     *   - everything else is converted by calling the toString method.
     */
    aria?: IAriaset;
}



/**
 * Represents standard element events that can be fired by all elements.
 */
export interface IElementEvents extends GlobalEventHandlersEventMap, ElementEventMap, DocumentAndElementEventHandlersEventMap
{
}



