import {
    WebElmAttrChangeHandler, WebElmAttrOptions, WebElmConstructor, WebElmFromHtmlConverter, WebElmOptions
} from "./WebElmTypes";
import { mimcss } from "../core/StyleScheduler";
import { trigger } from "./TriggerAPI";
import { mount, unmount } from "./CompAPI";
import { setAttrValue } from "../core/ElmVN";
import { ComponentMixin } from "../core/CompImpl";
import { applyMixins } from "../utils/UtilFunc";



/**
 * Structure defining options that determine an attribute behavior.
 */
export type WebElmAttrDefinition =
{
    /** Name of the element attribute */
    attrName?: string;

    /** Name of the element property */
    propName?: string;

    /** Optional converter function */
    options?: WebElmAttrOptions;
}



/**
 * Structure that is kept on the WebElm class constructor, which keeps all the necessary
 * information to properly implement WebElm methods.
 */
type WebElmDefinition =
{
    /** Custom Web Element name - the name for which the WebElm class is registered. */
    name?: string;

    /** Shadow DOM and form association options */
    options: WebElmOptions;

    /** Attribute/Property definitions by attribute names; that is, names used in HTML. */
    attrs: { [attrName: string]: WebElmAttrDefinition}

    /** Attribute/Property definitions by property names; that is, names used in the WebElm object. */
    props: { [propName: string]: WebElmAttrDefinition}
}



/**
 * Symbol on the Web Element class constructor under which we keep Web Element definition
 * parameters. These parameters include the custom Web Element name, shadow DOM options, form
 * association options and attribute options.
 */
const symWebElmDef = Symbol("webElmDef");



/**
 * Creates and returns a new class from which custom Web elements should derive.
 * The class returned from this function inherits from the HTMLElement-derived class specified
 * as the parameter and implements the [[IComponent]] and [[IComponentEx]] interfaces.
 *
 * **Usage:**
 *
 * ```typescript
 * @mim.webElm("custom-button")
 * class MyCustomButton extends mim.WebElmEx(HTMLButtonElement)
 * {
 *    render(): any { return ... }
 * }
 * ```
 *
 * @typeparam TElm Class deriving from HTMLElement, from which the resulting class will inherit.
 * @typeparam TAttrs Type that maps attribute names to attribute types.
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 *
 * @param elmClass HTMLElement-derived class from which the returned class will derive.
 * @returns Class that inherits from the given HTMLElement-derived class that imlements all
 * the internal logic of custom Web elements.
 */
export function WebElmEx<TElm extends HTMLElement = HTMLElement, TAttrs extends {} = {}, TEvents extends {} = {}>(
    elmClass: new() => TElm): WebElmConstructor<TElm,TAttrs,TEvents>
{
    // dynamically build the actual element class and implement the necessary interfaces
    class ActualClass extends (elmClass as (new() => HTMLElement))
    {
        static get observedAttributes(): string[]
        {
            // return the array of attribute names. Note that since the method is static "this" is
            // the class (that is, the costructor function) itself.
            let definition = this[symWebElmDef] as WebElmDefinition;
            let attrs = Object.keys(definition.attrs);
            return attrs;
        }

        static get formAssociated(): boolean
        {
            return false;
        }

        /** WebElm definition taken from the class constructor */
        #definition: WebElmDefinition;

        /** Shadow DOM root node - can be undefined if "noShadow" was specified in the options */
        #shadowRoot?: ShadowRoot;

        constructor()
        {
            super();

            // by the time the constructor is called, we have all the information setup via the
            // @webElm and @attr decorators
            this.#definition = this.constructor[symWebElmDef];
            let options = this.#definition.options;
            if (!options?.noShadow)
                this.#shadowRoot = this.attachShadow({mode: options.mode ?? "open"});
        }

        connectedCallback(): void
        {
            mount( this, this.#shadowRoot ?? this);
        }

        disconnectedCallback(): void
        {
            unmount( this.#shadowRoot ?? this);
        }

        attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void
        {
            // get property name corresponding to the attribute. If no such attribute is defined
            // for our class, do nothing (this shouldn't happen because the callback is only called
            // for defined attributes).
            let attrDef = this.#definition.attrs[name];
            if (!attrDef)
                return;

            // get attributes parameters and check whether we actually need to do anything with
            // the new attribute value
            let {attrName, propName, options} = attrDef;
            let onchanged = options?.onchanged;
            if (!propName && !onchanged)
                return;

            // determine the actual new value that should be set to the property and convert it to
            // the proper type if necessary
            let actNewValue: any = newValue;
            let fromHtml = options?.fromHtml;
            if (fromHtml)
                actNewValue = fromHtml.call(this, actNewValue, attrName);

            // set the new value to the property. Since by default properties with the @attr
            // decorators are reactive, this will trigger re-rendering. Note that property may not
            // be specified if the attribute was only declared for notification or writing purpose.
            if (propName)
                this[propName] = actNewValue;

            // call the `onchanged` method if defined.
            onchanged?.call(this, actNewValue, attrName, propName);
        }

        /** The render() function should be overridden in the derived class */
        render(): any {}

        // Necessary IWebElm members
        processStyles(flagOrFunc: boolean | (() => void), func?: () => void)
        {
            // if the first parameter is Boolean, then it is the `useAdoption` flag. In this case
            // the function to run is in the second parameter.
            let useAdoption = true;
            if (typeof flagOrFunc === "boolean")
                useAdoption = flagOrFunc;
            else
                func = flagOrFunc;

            // no matter what useAdoption says, if we don't have Mimcss library or if the element
            // doesn't have a shadow DOM root, we call the function with the current context (which,
            // normally, will create/remove style elements in the document's head).
            if (!mimcss || !this.#shadowRoot)
                func!();
            else
            {
                mimcss.pushRootContext(this.#shadowRoot, useAdoption);
                try
                {
                    func!();
                }
                finally
                {
                    mimcss.popRootContext(this.#shadowRoot, useAdoption)
                }
            }
        }

        setAttr<K extends string & keyof TAttrs>(attrName: K, value: TAttrs[K] | null | undefined): void
        {
            let actualValue: typeof value | string = null;

            // if conversion function is defined in the attribute options, use it
            let toHtml = this.#definition.attrs[attrName]?.options?.toHtml;
            if (toHtml)
                actualValue = toHtml.call(this, value, attrName);

            if (actualValue == null)
                this.removeAttribute(attrName);
            else
                setAttrValue( this, attrName, actualValue);
        }

        getAttr<K extends string & keyof TAttrs>(attrName: K): string | null
        {
            return this.getAttribute(attrName);
        }

        hasAttr<K extends string & keyof TAttrs>(attrName: K): boolean
        {
            return this.hasAttribute(attrName);
        }
    }

    // apply the ComponentMixin, which makes the actual class to implement all IComponentEx methods
    applyMixins(ActualClass, ComponentMixin);
    return ActualClass as unknown as WebElmConstructor<TElm,TAttrs,TEvents>;
}



/**
 * Function that returns a class from which regular custom Web elements (which don't need to
 * customize existing built-in elements) should inherit. The return class derives directly from
 * HTMLElement.
 *
 * **Usage:**
 *
 * ```typescript
 * @mim.webElm("my-elelemnt")
 * class MyCustomElement extends mim.WebElm()
 * {
 *    render(): any { return ... }
 * }
 * ```
 *
 * @typeparam TAttrs Type that maps attribute names to attribute types.
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 */
export const WebElm = <TAttrs extends {} = {}, TEvents extends {} = {}>() =>
    WebElmEx<HTMLElement,TAttrs,TEvents>(HTMLElement);



/**
 * Decorator function for custom element components.
 *
 * @param name Name of the custom HTML element
 * @param options Configuration options for the custom element.
 * @param attrs Information about the element's attributes
 */
export function webElm(name: string, options?: WebElmOptions, attrs?: WebElmAttrDefinition[])
{
    return (webElmClass: WebElmConstructor) => {
        mergeWebElmDefinition(webElmClass, name, options, attrs);
        registerWebElm(webElmClass);
    };
}



/**
 * Decorates a property of custom Web Element class without providing any options. The name
 * of the HTML attribute is set to be the name of the property.
 * @param target Custom Web Element class
 * @param propName Property name to which the decorator was applied
 */
export function attr(target: any, propName: string): any;

/**
 * Decorates a property of custom Web Element class specifying the name of the HTML attribute.
 * @param attrName Name of HTML attribute to be reflected by the property.
 */
export function attr(attrName: string): any;

/**
 * Decorates a property of custom Web Element class specifying some attribute options.
 * @param attrOptions Options defining attribute/property behavior.
 */
export function attr(attrOptions: WebElmAttrOptions): any;

/**
 * Decorates a property of custom Web Element class specifying the name of the HTML attribute
 * and some attribute options.
 * @param attrName Name of HTML attribute to be reflected by the property.
 * @param attrOptions Options defining attribute/property behavior.
 */
export function attr(attrName: string, attrOptions: WebElmAttrOptions): any;

// implementation
export function attr(arg1: any, arg2?: any): any
{
    if (typeof arg1 === "string")
        return attrDecorator.bind( undefined, arg1, arg2);
    else if (arg1.constructor === Object)
        return attrDecorator.bind(undefined, undefined, arg1)
    else
        attrDecorator(undefined, undefined, arg1, arg2!)
}



function attrDecorator(attrName: string | undefined, options: WebElmAttrOptions | undefined,
    target: any, propName: string): any
{
    // get definition that might be already set via prior @attr decorators
    // or create a new one associated with the given class.
    let definition = getOrCreateWebElmDefinition(target.constructor);

    addWebElmAttr(definition, {attrName, propName, options})

    // make it a trigger unless the "noTrigger" flag was set to true
    if (!options?.noTrigger)
        trigger(target, propName);
}



/**
 * Registers the given Web Element with optional parameters.
 *
 * @param webElmClass custom Web Element class
 * @param name Name of the custom Web Element to use in HTML
 * @param options Shadow DOM and form-related options
 * @param attrs Information about the element's attributes
 */
export function registerWebElm(webElmClass: WebElmConstructor, name?: string,
    options?: WebElmOptions, attrs?: WebElmAttrDefinition[]): void
{
    // merge definition that already exists on the class (which can be a default empty one or the
    // one filled via @webElm and @attr decorators) with the parameters.
    let definition = mergeWebElmDefinition(webElmClass, name, options, attrs);

    // if the name is not defined, throw an error.
    if (!definition.name)
        throw new Error("WebElm name is not defined.");

    // loop over attribute definitions and try to find `onchanged_${propName}` methods in the class
    // prototype.
    for( let [propName, attrDef] of Object.entries(definition.props))
    {
        let onchanged = attrDef.options?.onchanged;
        if (!onchanged)
        {
            onchanged = webElmClass.prototype[`onchanged_${propName}`] as WebElmAttrChangeHandler | undefined;
            if (onchanged)
            {
                if (attrDef.options)
                    attrDef.options.onchanged = onchanged;
                else
                    attrDef.options = {onchanged}
            }
        }
    }
    // by now the definition has been adjusted, so we can register the custom element according
    // to the definition values.
    const tag = definition.options?.extends;
    customElements.define( definition.name!, webElmClass, tag ? {extends: tag} : undefined);
}



/**
 * Merges the given Web Element options into the definition existing on the given Web Element class.
 *
 * @param webElmClass Custom Web Element class
 * @param name Name of the custom Web Element to use in HTML
 * @param options Shadow DOM and form-related options
 * @param attrs Information about the element's attributes
 * @returns Adjusted Web Element definition object
 */
function mergeWebElmDefinition(webElmClass: WebElmConstructor, name?: string,
    options?: WebElmOptions, attrs?: WebElmAttrDefinition[]): WebElmDefinition
{
    // get definition that might be already set via @webElm and/or @attr decorators
    // or create a new one associated with the given class.
    let definition = getOrCreateWebElmDefinition(webElmClass);

    // if the name parameter is given, replace the name in the definition
    if (name)
        definition.name = name;

    // if options are given, merge the options in the definition
    if (options)
        definition.options = Object.assign(definition.options ?? {}, options);

    // if attributes array is given, add new attributes to the definition
    if (attrs)
    {
        for( let attr of attrs)
            addWebElmAttr(definition, attr);
    }

    return definition;
}



/**
 * Obtains existing or creates new definition object for the given Web Element class.
 * @param webElmClass Custom Web Element class
 * @returns Web Element definition object associated with the given class.
 */
function getOrCreateWebElmDefinition(webElmClass: WebElmConstructor): WebElmDefinition
{
    // get definition that might be undefined or already set via @webElm and/or @attr decorators.
    let definition = webElmClass[symWebElmDef] as WebElmDefinition;
    if (!definition)
        webElmClass[symWebElmDef] = definition = { options: {}, attrs: {}, props: {} };

    return definition;
}



/**
 * Merges the given attribute into the given Web Element definition
 *
 * @param definition Definition object from the custom Web Element class
 * @param attrDef Information about the element attribute
 */
function addWebElmAttr(definition: WebElmDefinition, attrDef: WebElmAttrDefinition): void
{
    let attrName = attrDef.attrName?.toLowerCase();
    let propName = attrDef.propName;

    // we must have either attribute or property name.
    if (!attrName && !propName)
        return;

    // check if the definition already has such attribute
    if (attrName && definition.attrs[attrName] || propName && definition.props[propName])
        return;

    // if attribute name is not defined, it should be the same as the property name (which is
    // defined as we have already checked)
    if (!attrName)
        attrName = attrDef.attrName = propName!.toLowerCase();

    // by now attrName is defined
    definition.attrs[attrName!] = attrDef;

    if (propName)
        definition.props[propName] = attrDef;
}



/**
 * Built-in attribute converter that converts string value to a number.
 */
export const NumberConverter: WebElmFromHtmlConverter = (stringValue: string | null | undefined): number =>
    stringValue ? parseFloat(stringValue) : NaN;



/**
 * Built-in attribute converter that converts string value to an integer number.
 */
export const IntConverter: WebElmFromHtmlConverter = (stringValue: string | null | undefined): number =>
    stringValue ? parseInt(stringValue) : NaN;



/**
 * Built-in attribute converter that converts string value to a Boolean value.
 */
export const BoolConverter: WebElmFromHtmlConverter = (stringValue: string | null | undefined): boolean =>
    !!stringValue




