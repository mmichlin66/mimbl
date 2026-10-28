import {
    IWebElm, WebElmAttrChangeHandler, WebElmAttrOptions, WebElmConstructor, WebElmOptions
} from "./WebElmTypes";
import { IVN } from "../core/VNTypes";
import { IComponent } from "./CompTypes";
import { ITrigger } from "./TriggerTypes";
import { Trigger } from "./TriggerAPI";
import { mimcss } from "../core/StyleScheduler";
import { mount, unmount } from "./CompAPI";
import { ComponentMixin } from "../core/CompImpl";
import { symPropStorage } from "../utils/UtilFunc";
import { ariaPropToAttrName, ariaPropToString } from "../core/Props";
import { symToVNs } from "../core/Reconciler";
import { IndependentCompVN } from "../core/IndependentCompVN";
import { ClassCompVN } from "../core/ClassCompVN";



/**
 * Structure defining options that determine an attribute behavior.
 */
export type WebElmAttrDefinition =
{
    /**
     * Name of the element property. This is always the name of the property to which the `@attr`
     * decorator is applied.
     */
    propName: string;

    /**
     * Name of the element attribute. This is always defined and by default is the same as `propName`.
     */
    attrName: string;

    /** Optional parameters controlling the attribute's behavior */
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
 * Symbol that keeps a map of attribute names to names of attribute change handling methods
 */
const symChangeHandlers = Symbol('changeHandlers');



/**
 * Mixin class that implements the internal logic of custom Web elements, including attribute/
 * property synchronization, shadow DOM creation, form association and ARIA attributes.
 */
function WebElmMixin
    <
        TAttrs extends Record<string, any> = {},
        TEvents extends {} = {},
        TBase extends new (...args: any[]) => HTMLElement = new (...args: any[]) => HTMLElement,
    >
    (Base: TBase):
    TBase & (abstract new (...args: any[]) => IWebElm<TAttrs,TEvents>)
{
    abstract class Internal extends ComponentMixin<TAttrs, TEvents, TBase>(Base) implements IWebElm<TAttrs,TEvents>
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
        #elmDef: WebElmDefinition;

        /** Shadow DOM root node - can be undefined if "noShadow" was specified in the options */
        #shadowRoot?: ShadowRoot;

        /**
         * "Internals" object helping implement form associated elements. This can be undefined if
         * neither `formAssociated` nor `ariaRole` was specified in the options.
         */
        #internals?: ElementInternals;

        /**
         * Flag indicating that an attribute is being changed as a result of a call to setAttribute().
         * For observable attributes, this call usually ends up setting the element's property
         * corresponding to the attribute. This flag indicates that in such case, we don't need to call
         * setAttribute() again from the property setter.
         */
        #inSetAttr: boolean;
        get inSetAttr(): boolean { return this.#inSetAttr; }
        set inSetAttr(value: boolean) { this.#inSetAttr = value; }

        /**
         * Flag indicating that a property is being changed as a result of a direct assignment.
         * Usually, this assignment ends up calling setAttribute() to change the element's attribute
         * corresponding to the property. For observable attributes, this flag indicates that we
         * don't need to set the property again.
         */
        #inSetProp: boolean;
        get inSetProp(): boolean { return this.#inSetProp; }
        set inSetProp(value: boolean) { this.#inSetProp = value; }



        // by the time the constructor is called, we have all the information setup via the @webElm
        // and @attr decorators. If this is a customized Web Component (that is, it derives from an
        // HTML element class other than HTMLElement), it has neither shadow DOM not Internals.
        constructor(...args: any[])
        {
            super(...args);

            // set default values to our properties so that the shape of the instances is always the same.
            let def: WebElmDefinition = this.#elmDef = this.constructor[symWebElmDef];
            this.#shadowRoot = undefined;
            this.#internals = undefined;
            this.#inSetAttr = false;
            this.#inSetProp = false;

            let options = def.options;
            if (options && !def.extends)
            {
                if (!options.noShadow)
                    this.#shadowRoot = super.attachShadow({mode: options.mode ?? "open"});

                if (options.formAssociated || options.aria)
                {
                    this.#internals = super.attachInternals();

                    // if specified, set default ARIA role and other ARIA attributes to the
                    // `internals` object
                    if (options.aria)
                    {
                        for (let name in options.aria)
                            this.#internals[ariaPropToAttrName(name)] = ariaPropToString(options.aria[name]);

                    }
                }
            }
        }

        connectedCallback(): void
        {
            mount(this, this.#shadowRoot ?? this);
        }

        disconnectedCallback(): void
        {
            unmount(this.#shadowRoot ?? this);
        }

        attributeChangedCallback(attrName: string, oldValue: string | null, newValue: string | null): void
        {
            // this method is invoked even if the attribute value is not actually changed, so we
            // check for that first. Also, if the attribute has been changed as a result of setting
            // property value, don't do it again.
            if (oldValue === newValue || this.inSetProp)
                return;

            // if no such attribute is defined in our class, do nothing (this shouldn't happen because
            // the callback is only called for defined attributes).
            let attrDef = this.#elmDef.attrs[attrName];
            if (!attrDef)
            {
                /// #if DEBUG
                console.warn(`Attribute definition not found for attribute '${attrName}' in attributeChangedCallback`)
                /// #endif

                return;
            }

            // determine the actual new value that should be set to the property and convert it to
            // the proper type if necessary
            let propName = attrDef.propName;
            let options = attrDef.options;
            let defaultValue = options?.defaultValue;
            let attrRemoved = newValue === null;
            let realNewValue: any = newValue;

            // if no converter is specified, we try to use the type of the current property
            // value. If this is null or undefined, we just use the value of the attribute.
            let currentPropValue = this[propName];
            let propType = typeof currentPropValue;
            if (attrRemoved)
            {
                realNewValue = defaultValue ?? (
                    propType === "boolean" ? false :
                    propType === "number" ? 0 :
                    propType === "string" ? "" :
                    defaultValue
                );
            }
            else if (options?.fromHtml)
                realNewValue = options.fromHtml(newValue, attrDef.attrName) ?? defaultValue;
            else
            {
                realNewValue =
                    propType === "boolean" ? Boolean(newValue) :
                    propType === "number" ? attrToNumber(newValue, defaultValue ?? 0) :
                    propType === "string" ? String(newValue) :
                    newValue;
            }

            // set the new value to the property. Since by default properties with the @attr
            // decorators are reactive, this will trigger re-rendering. Since we are setting the
            // property as a result of the attribute change, indicate that we don't need to call
            // setAttribute from the property's set accessor.
            this.inSetAttr = true;
            try { this[propName] = realNewValue; }
            finally { this.inSetAttr = false; }

            // call the `onchanged` method if defined. Note that it is called bound to the instance
            // of our custom element.
            const methodKey = (this as any)[symChangeHandlers]?.get(attrName);
            let onchanged = methodKey && this[methodKey] as WebElmAttrChangeHandler;
            onchanged?.call(this, realNewValue, attrRemoved, attrDef.attrName);
        }

        /** The render() function should be overridden in the derived classes */
        abstract render(): any;

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

        setAttr<K extends string & keyof TAttrs>(attrName: K, val: TAttrs[K]): void
        {
            // if no such attribute is defined in our class, do nothing.
            let attrDef = this.#elmDef.attrs[attrName.toLowerCase()];
            if (!attrDef)
                return;

            // determine the actual new value that should be set to the attribute and convert it
            // to the proper type if necessary. if no converter is specified, we try to use the
            // type of the value.
            let toHtml = attrDef.options?.toHtml;
            let attrVal: string | null =
                toHtml ? toHtml(val, attrName) :
                val == null || val === false ? null :
                String(val);

            if (attrVal == null)
                super.removeAttribute(attrName);
            else
                super.setAttribute(attrName, attrVal);
        }

        // Add toVNs method to the actual class. This method is invoked to convert rendered content to
        // virtual node or nodes.
        [symToVNs](this: IComponent): IVN | IVN[] | null | undefined
        {
            // if the component (this can only be an Instance component) is already attached to VN,
            // return this existing VN; otherwise create a new one.
            return this.vn as ClassCompVN ?? new IndependentCompVN(this);
        }
    }

    return Internal;
}



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
 * @typeParam TAttrs Type that maps attribute names to attribute types.
 * @typeParam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 * @returns Class that inherits from the HTMLElement class that imlements all the internal logic
 * of custom Web elements.
 */
export abstract class WebElm<TAttrs extends {} = {}, TEvents extends {} = {}> extends WebElmMixin(HTMLElement)
{
    /** The render() function should be overridden in the derived class */
    abstract render(): any;

    // The following properties are declared here to make them visible to the TypeScript compiler
    // because they depend on Component's class type parameters, wchih could not be passed to the
    // mixin. They are actually implemented in the ComponentMixin function. Methods are declared
    // as properties because methods cannot be declared.
    declare fireEvent: <K extends string & keyof TEvents>(key: K, eventOrDetail: TEvents[K]) => boolean;
    declare setAttr: <K extends string & keyof TAttrs>(attrName: K, value: TAttrs[K]) => void;
    declare getAttribute: <K extends string & keyof TAttrs>(attrName: K) => string | null;
    declare hasAttribute: <K extends string & keyof TAttrs>(attrName: K) => boolean;
};



/**
 * Creates and returns a new class from which customized built-in Web elements should derive.
 * The class returned from this function inherits from the HTMLElement-derived class specified
 * as the parameter and implements the {@link CompTypes!IComponent} and {@link CompTypes!IComponentEx} interfaces.
 *
 * **Usage:**
 *
 * ```typescript
 * @mim.webElm("custom-button")
 * class MyCustomButton extends mim.WebElmEx("button", HTMLButtonElement)
 * {
 *    render(): any { return ... }
 * }
 * ```
 *
 * @typeParam TTag Tag name of the HTML lement, from which the resulting class will inherit.
 * @typeParam TAttrs Type that maps attribute names to attribute types.
 * @typeParam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 *
 * @param tag Name of the HTML element that is customized by the Web element.
 * @param elmClass HTMLElement-derived class from which the returned class will derive. This class
 * must correspond to the HTML element specified by the `tag` parameter.
 * @returns Class that inherits from the given HTMLElement-derived class that imlements all
 * the internal logic of custom Web elements.
 */
export function WebElmEx<
        TTag extends keyof HTMLElementTagNameMap,
        TAttrs extends {} = {},
        TEvents extends {} = {}
    >
    (tag: TTag, elmClass: new(...args: any[]) => HTMLElementTagNameMap[TTag]):
    WebElmConstructor<HTMLElementTagNameMap[TTag], TAttrs, TEvents>
{
    // dynamically build the actual element class, to which component and Web Element mixins will
    abstract class Internal extends WebElmMixin(elmClass as unknown as new(...args: any[]) => HTMLElement)
    {
        /** The render() function returns nothing for customized built-in elements */
        render(): any {}

        // The following properties are declared here to make them visible to the TypeScript compiler
        // because they depend on Component's class type parameters, which could not be passed to the
        // mixin. They are actually implemented in the ComponentMixin function. Methods are declared
        // as properties because methods cannot be declared.
        declare fireEvent: <K extends string & keyof TEvents>(key: K, eventOrDetail: TEvents[K]) => boolean;
        declare setAttr: <K extends string & keyof TAttrs>(attrName: K, value: TAttrs[K]) => void;
        declare getAttribute: <K extends string & keyof TAttrs>(attrName: K) => string | null;
        declare hasAttribute: <K extends string & keyof TAttrs>(attrName: K) => boolean;
    }

    // since we are customizing a built-in element, set its tag name into the definition
    getOrCreateWebElmDefinition(Internal).extends = tag;

    return Internal as unknown as WebElmConstructor<HTMLElementTagNameMap[TTag], TAttrs, TEvents>;
}



/**
 * Decorator function for custom element components.
 *
 * @param name Name of the custom HTML element
 * @param options Configuration options for the custom element.
 */
export function webElm(name: string, options?: WebElmOptions)
{
    return webElmDecorator.bind( undefined, name, options);
}



/**
 * Decorator function for custom element components.
 */
function webElmDecorator(name: string, options: WebElmOptions | undefined,
    webElmClass: WebElmConstructor): void
{
    let elmDef = getOrCreateWebElmDefinition(webElmClass);
    elmDef.name = name;
    elmDef.options = options;

    if (!options?.deferred)
        registerWebElmDef(webElmClass, elmDef);
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
    let elmDef = getOrCreateWebElmDefinition(target.constructor);

    let attrDef = {attrName: attrName ?? propName, propName, options};
    addWebElmAttr(elmDef, attrDef);

    // make it a trigger
    let depth = options?.triggerDepth;
    Object.defineProperty(target, propName,
    {
        // in this context, "this" is the custom element object
        get() { return getAttrTriggerObj(this, attrDef, depth).get(); },
        set(val)
        {
            // set the value to the property
            getAttrTriggerObj(this, attrDef, depth).set(val);

            // if this call was made as a result of setting the attribute, we don't need to
            // set the attribute again
            if (this.inSetAttr)
                return;

            this.inSetProp = true;
            try { this.setAttr(attrName ?? propName, val); }
            finally { this.inSetProp = false; }
        },
    });
}

// Helper function that returns a trigger object stored in the property storage for the given property name.
function getAttrTriggerObj(obj: any, attrDef: WebElmAttrDefinition, depth: number | undefined): ITrigger
{
    let storage = obj[symPropStorage] ??= {};
    return storage[attrDef.propName] ??= new Trigger(attrDef.options?.defaultValue, depth);
}



/**
 * Decorator for attribute change handlers.
 * @typeparam TAttrs: The state interface passed from the class
 * @typeparam K: The attribute key (e.g., 'username')
 */
export const attrChangeHandler = <TAttrs extends Record<string, any>, K extends string & keyof TAttrs>(attrName: K):
    (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<WebElmAttrChangeHandler<TAttrs[K]>>) => void =>
    attrChangeHandlerDecorator.bind(undefined, attrName);

/**
 * Decorator for attribute change handlers.
 * @typeparam TAttrs: The state interface passed from the class
 * @typeparam K: The attribute key (e.g., 'username')
 */
function attrChangeHandlerDecorator<TAttrs extends Record<string, any>, K extends string & keyof TAttrs>(
    attrName: K, target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<WebElmAttrChangeHandler<TAttrs[K]>>
)
{
    // `target` is the class prototype. We store the method name instead of the function itself
    // to avoid issues with method binding and to allow for method overriding.
    (target[symChangeHandlers] ??= new Map()).set(attrName.toLowerCase(), propertyKey);
};



/**
 * Registers the given Web Element with optional parameters.
 *
 * @param webElmClass custom Web Element class
 * @param name Name of the custom Web Element to use in HTML
 * @param options Shadow DOM and form-related options
 * @param attrs Information about the element's attributes
 */
export function registerWebElm(webElmClass: WebElmConstructor): void
{
    // merge definition that already exists on the class (which can be a default empty one or the
    // one filled via @webElm and @attr decorators) with the parameters.
    let elmDef = webElmClass[symWebElmDef];

    /// #if DEBUG
    if (!elmDef)
        throw new Error(`Class ${webElmClass.name} is not a valid Web Element. Make sure to use @webElm decorator on the class.`);
    /// #endif

    registerWebElmDef(webElmClass, elmDef);
}



/**
 * Helper function that registers the given Web Element using the given element definition.
 *
 * @param webElmClass custom Web Element class
 * @param elmDef Definition object from the custom Web Element class
 */
function registerWebElmDef(webElmClass: WebElmConstructor, elmDef: WebElmDefinition): void
{
    /// #if DEBUG
    if (!elmDef.name)
        throw new Error("WebElm name is not defined.");
    /// #endif

    const tagToExtend = elmDef.extends;
    customElements.define(elmDef.name, webElmClass, tagToExtend ? {extends: tagToExtend} : undefined);
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
 * Sets the given attribute into the given Web Element definition. Note that if multiple `@attr`
 * decorators with the same attribute name exist within the same class, the latest wins.
 *
 * @param elmDef Definition object from the custom Web Element class
 * @param attrDef Information about the element attribute
 */
function addWebElmAttr(elmDef: WebElmDefinition, attrDef: WebElmAttrDefinition): void
{
    // when attribute values change, custom element is notified with the lower-case attribute name;
    // therefore, we keep it in the map in lower-case.
    elmDef.attrs[attrDef.attrName.toLowerCase()] = attrDef;
    elmDef.props[attrDef.propName] = attrDef;
}



/**
 * Built-in attribute converter that converts string value to a number.
 */
function attrToNumber(stringValue: string | null, defaultValue?: any): number
{
    let retVal = Number(stringValue!);
    if (isNaN(retVal))
    {
        retVal = Number(defaultValue);
        if (isNaN(retVal))
            retVal = 0;
    }

    return retVal;
}



