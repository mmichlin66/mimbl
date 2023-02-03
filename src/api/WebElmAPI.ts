import {
    WebElmAttrChangeHandler, WebElmAttrOptions, WebElmConstructor, WebElmFromHtmlConverter, WebElmOptions, WebElmToHtmlConverter
} from "./WebElmTypes";
import { IVN } from "../core/VNTypes";
import { IComponent, PropType } from "./CompTypes";
import { mimcss } from "../core/StyleScheduler";
import { trigger } from "./TriggerAPI";
import { mount, unmount } from "./CompAPI";
import { ComponentMixin } from "../core/CompImpl";
import { applyMixins } from "../utils/UtilFunc";
import { registerElmProp, setAttrValue } from "../core/Props";
import { symToVNs } from "../core/Reconciler";
import { IndependentCompVN } from "../core/IndependentCompVN";
import { ClassCompVN } from "../core/ClassCompVN";



/**
 * Structure defining options that determine an attribute behavior.
 */
export type WebElmAttrDefinition =
{
    /** Name of the element attribute. This is always defined */
    attrName: string;

    /**
     * Name of the element property. This can be undefined if the attribute definition was created
     * not via the `@attr` decorator but either in the `@webElm` decorator or in the registerWebElm
     * function. This can be useful if there is no need to have a property reflecting the attribute
     * in the custom Web elemetn class, but there is a need to be notified when the attribute's
     * value is changed.
     */
    propName?: string;

    /** Optional converter function and some other options controlling the attribute's behavior */
    options?: WebElmAttrOptions;
}



/**
 * Structure that is kept on the WebElm class constructor, which keeps all the necessary
 * information to properly implement WebElm methods.
 */
type WebElmDefinition =
{
    /** Custom Web Element name - the name for which the WebElm class is registered. */
    name: string;

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
 * as the parameter and implements the {@link CompTypes!IComponent} and {@link CompTypes!IComponentEx} interfaces.
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
    abstract class ActualClass extends (elmClass as (new() => HTMLElement))
    {
        static get observedAttributes(): string[]
        {
            // return the array of attribute names. Note that since the method is static "this" is
            // the class (that is, the costructor function) itself.
            return Object.keys((this[symWebElmDef] as WebElmDefinition).attrs);
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
                this.#shadowRoot = this.attachShadow({mode: options?.mode ?? "open"});
        }

        connectedCallback(): void
        {
            mount(this, this.#shadowRoot ?? this);
        }

        disconnectedCallback(): void
        {
            unmount(this.#shadowRoot ?? this);
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
            let {propName, options} = attrDef;
            let onchanged = options?.onchanged;
            if (!propName && !onchanged)
                return;

            // determine the actual new value that should be set to the property and convert it to
            // the proper type if necessary
            let fromHtml = options?.fromHtml;
            let actNewValue = fromHtml ? fromHtml(newValue, attrDef.attrName) : newValue;

            // set the new value to the property. Since by default properties with the @attr
            // decorators are reactive, this will trigger re-rendering. Note that property may not
            // be specified if the attribute was only declared for notification or writing purpose.
            if (propName)
                this[propName] = actNewValue;

            // call the `onchanged` method if defined. Note that it is called bound to the instance
            // of our custom element.
            onchanged?.call(this, actNewValue, attrDef.attrName, propName);
        }

        // /** The render() function should be overridden in the derived class */
        // abstract render(): any;

        // Necessary IWebElm members
        processStyles(func: () => void, useAdoption: boolean = true)
        {
            // no matter what useAdoption says, if we don't have Mimcss library or if the element
            // doesn't have a shadow DOM root, we call the function with the current context (which,
            // normally, will create/remove style elements in the document's head).
            if (!mimcss || !this.#shadowRoot)
                func();
            else
            {
                mimcss.pushRootContext(this.#shadowRoot, useAdoption);
                try
                {
                    func();
                }
                finally
                {
                    mimcss.popRootContext(this.#shadowRoot, useAdoption)
                }
            }
        }

        setAttr<K extends string & keyof TAttrs>(attrName: K, value: TAttrs[K] | null | undefined): void
        {
            let toHtml = this.#definition.attrs[attrName]?.options?.toHtml;
            let actualValue = toHtml ? toHtml(value, attrName) : value;
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

    // Add toVNs method to the actual class. This method is invoked to convert rendered content to
    // virtual node or nodes.
    ActualClass.prototype[symToVNs] = function(this: IComponent): IVN | IVN[] | null | undefined
    {
        // if the component (this can only be an Instance component) is already attached to VN,
        // return this existing VN; otherwise create a new one.
        return this.vn as ClassCompVN ?? new IndependentCompVN( this);
    }

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
 */
export function webElm(name: string, options?: WebElmOptions, attrs?: WebElmAttrDefinition[])
{
    return webElmDecorator.bind( undefined, name, options, attrs);
}



/**
 * Decorator function for custom element components.
 */
function webElmDecorator(name: string, options: WebElmOptions | undefined,
    attrs: WebElmAttrDefinition[] | undefined, webElmClass: WebElmConstructor): void
{
    mergeWebElmDefinition(webElmClass, name, options, attrs);

    if (!options?.deferred)
        registerWebElm(webElmClass);
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
        attrDecorator(arg2!, undefined, arg1, arg2!)
}



/** Actual decorator implementation */
function attrDecorator(attrName: string | undefined, options: WebElmAttrOptions | undefined,
    target: any, propName: string): any
{
    // get definition that might be already set via prior @attr decorators
    // or create a new one associated with the given class.
    let definition = getOrCreateWebElmDefinition(target.constructor);

    addWebElmAttr(definition, {attrName: attrName ?? propName, propName, options})

    // make it a trigger unless the "noTrigger" flag was set to true
    if (propName && !options?.noTrigger)
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
        let options = attrDef.options;
        let onchanged = options?.onchanged;
        if (!onchanged)
        {
            onchanged = webElmClass.prototype[`onchanged_${propName}`] as WebElmAttrChangeHandler | undefined;
            if (onchanged)
            {
                if (options)
                    options.onchanged = onchanged;
                else
                    attrDef.options = options = {onchanged}
            }
        }

        // if attribute specifies toHtml converter, then register this attribute as JSX property with
        // the v2s method set to toHtml
        let toHtml = options?.toHtml;
        if (toHtml)
            registerElmProp( attrDef.attrName, {type: PropType.Attr, v2s: toHtml})
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
    return webElmClass[symWebElmDef] ??= { name: "", attrs: {}, props: {} }
}



/**
 * Merges the given attribute into the given Web Element definition. Note that if multiple `@attr`
 * decorators with the same attribute name exist within the same class, the latest wins.
 *
 * @param definition Definition object from the custom Web Element class
 * @param attrDef Information about the element attribute
 */
function addWebElmAttr(definition: WebElmDefinition, attrDef: WebElmAttrDefinition): void
{
    // when attributes' values change custom element is notified with the lower-case attribute
    // name; therefore, we keep it in the map in lower-case.
    definition.attrs[attrDef.attrName.toLowerCase()] = attrDef;

    // propName can be undefined if the attribute definition was created not via the `@attr`
    // decorator but either in the `@webElm` decorator or in the registerWebElm function.
    if (attrDef.propName)
        definition.props[attrDef.propName] = attrDef;
}



/**
 * Built-in attribute converter that converts string value to a number.
 */
export const attrToFloat: WebElmFromHtmlConverter = (stringValue: string | null | undefined): number =>
    parseFloat(stringValue!);



/**
 * Built-in attribute converter that converts string value to an integer number.
 */
export const attrToInt: WebElmFromHtmlConverter = (stringValue: string | null | undefined): number =>
    parseInt(stringValue!);



/**
 * Built-in attribute converter that converts string value to a Boolean value.
 */
export const attrToBool: WebElmFromHtmlConverter = (stringValue: string | null | undefined): boolean =>
    !!stringValue;



/**
 * Built-in attribute converter that converts string value to a Boolean value.
 */
export const attrToObj: WebElmFromHtmlConverter = (stringValue: string | null | undefined): any =>
    !stringValue ? null : JSON.parse(stringValue);



/**
 * Built-in converter that converts property object value to a string by using JSON.stringify.
 */
export const objToAttr: WebElmToHtmlConverter = (obj: object | null | undefined): string | null =>
    !obj ? null : JSON.stringify(obj);



