import {
    WebElmAttrChangeHandler, WebElmAttrOptions, WebElmConstructor, WebElmFromHtmlConverter, WebElmOptions, WebElmToHtmlConverter
} from "./WebElmTypes";
import { IVN } from "../core/VNTypes";
import { IComponent, PropType } from "./CompTypes";
import { ITrigger } from "./TriggerTypes";
import { mimcss } from "../core/StyleScheduler";
import { mount, unmount } from "./CompAPI";
import { ComponentMixin } from "../core/CompImpl";
import { applyMixins, copyMixinProp } from "../utils/UtilFunc";
import { ariaPropToAttrName, ariaPropToString, registerElmProp, setAttrValue } from "../core/Props";
import { symToVNs } from "../core/Reconciler";
import { IndependentCompVN } from "../core/IndependentCompVN";
import { ClassCompVN } from "../core/ClassCompVN";
import { Trigger } from "../core/TriggerImpl";



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

    /** Converter function and some other parameters controlling the attribute's behavior */
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

    /**
     * If defined, determines the tag name of a built-in HTML element that the custom element
     * extends.
     */
    extends?: string;

    /** Shadow DOM and form association options */
    options?: WebElmOptions;

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
 * Function that returns a class from which autonomous custom elements (which don't need to
 * customize existing built-in elements) should inherit. The return class derives directly from
 * HTMLElement.
 *
 * **Usage:**
 *
 * ```typescript
 * @mim.webElm("my-element")
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
 * @returns Class that inherits from the HTMLElement class that imlements all the internal logic
 * of custom Web elements.
 */
export function WebElm<TAttrs extends {} = {}, TEvents extends {} = {}>(): WebElmConstructor<HTMLElement,TAttrs,TEvents>;



/**
 * Creates and returns a new class from which customized built-in Web elements should derive.
 * The class returned from this function inherits from the HTMLElement-derived class specified
 * as the parameter and implements the {@link CompTypes!IComponent} and {@link CompTypes!IComponentEx} interfaces.
 *
 * **Usage:**
 *
 * ```typescript
 * @mim.webElm("custom-button")
 * class MyCustomButton extends mim.WebElm("button", HTMLButtonElement)
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
 * @param tag Name of the HTML element that is customized by the Web element.
 * @param elmClass HTMLElement-derived class from which the returned class will derive. This class
 * must correspond to the HTML element specified by the `tag` parameter.
 * @returns Class that inherits from the given HTMLElement-derived class that imlements all
 * the internal logic of custom Web elements.
 */
export function WebElm<TTag extends keyof HTMLElementTagNameMap, TAttrs extends {} = {}, TEvents extends {} = {}>(
        tag: TTag, elmClass: new() => HTMLElementTagNameMap[TTag]): WebElmConstructor<HTMLElementTagNameMap[TTag],TAttrs,TEvents>;



// Implementation
export function WebElm<TAttrs extends {}, TEvents extends {}>(tagToExtend?: string,
    elmClass?: new() => HTMLElement): WebElmConstructor<HTMLElement,TAttrs,TEvents>
{
    // tagToExtend is undefined for autonomous Web Elements that derive directly from HTMLElement
    if (!tagToExtend)
        elmClass = HTMLElement;

    // dynamically build the actual element class, to which component and Web Element mixins
    // will be applied
    abstract class ActualClass extends elmClass!
    {
        constructor()
        {
            super();
            this.init();
        }

        // This is only needed to satisfy the call from the constructor. Actual implementation is
        // provided by WebElmMixin
        abstract init(): void;
    }

    applyMixins(ActualClass, ComponentMixin, WebElmMixin);
    copyMixinProp(ActualClass, WebElmMixin, ["observedAttributes", "formAssociated"]);

    // if we are customizing a built-in element, set its tag name into the definition
    if (tagToExtend)
        getOrCreateWebElmDefinition(ActualClass).extends = tagToExtend;

    return ActualClass as unknown as WebElmConstructor<HTMLElement,TAttrs,TEvents>;
}



/**
 * Class whose methods are copied to every implementation of custom Web elements
 */
abstract class WebElmMixin extends HTMLElement
{
    static get observedAttributes(): string[]
    {
        // return the array of attribute names. Note that since the method is static "this" is
        // the class (that is, the costructor function) itself.
        return Object.keys((this[symWebElmDef] as WebElmDefinition).attrs);
    }

    static get formAssociated(): boolean | undefined
    {
        return (this[symWebElmDef] as WebElmDefinition).options?.formAssociated;
    }

    /** WebElm definition taken from the class constructor */
    _def: WebElmDefinition;

    /** Shadow DOM root node - can be undefined if "noShadow" was specified in the options */
    _shadowRoot?: ShadowRoot;

    /**
     * "Internals" object helping implement form associated elements. This can be undefined if
     * neither `formAssociated` nor `ariaRole` was specified in the options.
     */
    _internals?: ElementInternals;

    /**
     * Flag indicating that we don't need to call setAttribute() in a property's set() accessor
     * when a property is set as a result of the attribute change. This same flag is used to
     * indicate that attribute change notification is called as a result from setting the
     * property.
     */
    _isAttrSync: boolean = false;



    /** This method is invoked from the actual class constructor */
    init()
    {
        // by the time the constructor is called, we have all the information setup via the
        // @webElm and @attr decorators
        let def: WebElmDefinition = this._def = this.constructor[symWebElmDef];
        let options = def.options;
        if (options && !def.extends)
        {
            if (!options.noShadow)
                this._shadowRoot = this.attachShadow({mode: options.mode ?? "open"});

            if (options.formAssociated || options.aria)
            {
                this._internals = this.attachInternals();

                // if specified, set default ARIA role and other ARIA attributes to the
                // `internals` object
                if (options.aria)
                {
                    for (let [name, value] of Object.entries(options.aria))
                        this._internals[ariaPropToAttrName(name)] = ariaPropToString(value);
                }
            }
        }
    }

    /** Gets the shadow DOM root node. It is created if it doesn' exist yet */
    get shadowRoot(): ShadowRoot
    {
        return this._shadowRoot ??= this.attachShadow({mode: this._def?.options?.mode ?? "open"})
    }

    /** Gets the "internals" object. It is created if it doesn' exist yet */
    get internals(): ElementInternals
    {
        return this._internals ??= this.attachInternals();
    }

    connectedCallback(): void
    {
        mount(this, this._shadowRoot ?? this);
    }

    disconnectedCallback(): void
    {
        unmount(this._shadowRoot ?? this);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void
    {
        // if no such attribute is defined in our class, do nothing (this shouldn't happen because
        // the callback is only called for defined attributes).
        let attrDef = this._def.attrs[name];
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
        // Ignore this call if the attribute has been changed as a result of setting property vaue
        if (propName && !this._isAttrSync)
        {
            // since we are setting the property because the attribute has been changed,
            // indicate that we don't need to call setAttribute from the property's set
            // accessor.
            this._isAttrSync = true;
            this[propName] = actNewValue;
            this._isAttrSync = false;
        }

        // call the `onchanged` method if defined. Note that it is called bound to the instance
        // of our custom element.
        onchanged?.call(this, actNewValue, attrDef.attrName, propName);
    }

    /** The render() function should be overridden in the derived class */
    render(): any {}

    // Necessary IWebElm members
    processStyles(func: () => void, useAdoption: boolean = true)
    {
        // no matter what useAdoption says, if we don't have Mimcss library or if the element
        // doesn't have a shadow DOM root, we call the function with the current context (which,
        // normally, will create/remove style elements in the document's head).
        if (!mimcss || !this._shadowRoot)
            func();
        else
        {
            mimcss.pushRootContext(this._shadowRoot, useAdoption);
            try
            {
                func();
            }
            finally
            {
                mimcss.popRootContext(this._shadowRoot, useAdoption)
            }
        }
    }

    setAttr(attrName: string, value: any): void
    {
        let toHtml = this._def.attrs[attrName]?.options?.toHtml;
        let stringValue = toHtml ? toHtml(value, attrName) : value;
        if (stringValue == null)
            this.removeAttribute(attrName);
        else
            this.setAttribute(attrName, stringValue);
    }

    getAttr(attrName: string): string | null
    {
        return this.getAttribute(attrName);
    }

    hasAttr(attrName: string): boolean
    {
        return this.hasAttribute(attrName);
    }

    // Add toVNs method to the actual class. This method is invoked to convert rendered content to
    // virtual node or nodes.
    [symToVNs](this: IComponent): IVN | IVN[] | null | undefined
    {
        // if the component (this can only be an Instance component) is already attached to VN,
        // return this existing VN; otherwise create a new one.
        return this.vn as ClassCompVN ?? new IndependentCompVN( this);
    }
}



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

    // make it a trigger unless the "triggerDepth" flag was set to a negative value
    let depth = options?.triggerDepth ?? 0;
    if (propName && depth >= 0)
    {
        let sym = Symbol( propName + "_attr");

        const getTriggerObj = (obj: any, depth: number | undefined): ITrigger =>
            obj[sym] ??= new Trigger(undefined, depth) as ITrigger;

        Object.defineProperty( target, propName, {
            get() { return getTriggerObj(this, depth).get(); },
            set(val)
            {
                getTriggerObj(this, depth).set(val);
                if (!this._isAttrSync)
                {
                    this._isAttrSync = true;
                    try
                    {
                        this.setAttr(attrName ?? propName, val);
                    }
                    finally
                    {
                        this._isAttrSync = false;
                    }
                }
            },
        });
    }
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
    const tagToExtend = definition.extends;
    customElements.define( definition.name, webElmClass, tagToExtend ? {extends: tagToExtend} : undefined);
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
function getOrCreateWebElmDefinition(webElmClass: any): WebElmDefinition
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
    stringValue != null;



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



