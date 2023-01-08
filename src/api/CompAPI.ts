import {
    CallbackWrappingOptions, ComponentShadowOptions, IComponent, ICustomAttributeHandlerClass,
    IRef, ITextVN, PropType, RefFunc, RenderMethodType, DN, IComponentEx,
    ComponentProps, ExtendedElement, IRootVN, AwaiterProps, AwaiterEvents, FunctorProps
} from "./CompTypes";
import { IVN } from "../core/VNTypes";
import {EventSlot} from "./EventSlotAPI"
import { ClassCompVN, shadowDecorator } from "../core/ClassCompVN";
import { TextVN } from "../core/TextVN";
import { ElmVN } from "../core/ElmVN";
import { IndependentCompVN } from "../core/IndependentCompVN";
import { ManagedCompVN } from "../core/ManagedCompVN";
import { mountRoot, unmountRoot } from "../core/RootVN";
import { content2VNs, setCurrentClassComp, symJsxToVNs, symToVNs, wrapFunc } from "../core/Reconciler";
import { s_initStyleScheduler } from "../core/StyleScheduler";
import { createWatcher, isTrigger } from "./TriggerAPI";
import { symRenderNoWatcher, VN } from "../core/VN";
import { ComponentMixin } from "../core/CompImpl";
import { applyMixins } from "../utils/UtilFunc";
import { registerElmProp } from "../core/Props";
import { IWatcher } from "./TriggerTypes";


/**
 * Decorator function for components that allows them to use shadow DOM.
 *
 * **Examples:**
 *
 * ```typescript
 * // A `<div>` element will be created with shadow DOM in open mode
 * @mim.withShadow
 * class MyComponent extends mim.Component {...}
 *
 * // A `<span>` element will be created with shadow DOM in open mode
 * @mim.withShadow("span")
 * class MyComponent extends mim.Component {...}
 *
 * // A `<div>` element will be created with shadow DOM in closed mode
 * @mim.withShadow( {mode: "closed"})
 * class MyComponent extends mim.Component {...}
 *
 * // A `<span>` element will be created with shadow DOM in closed mode
 * @mim.withShadow( ["span", {mode: "closed"}])
 * class MyComponent extends mim.Component {...}
 * ```
 */
export const withShadow = (options: Function | ComponentShadowOptions): any =>
    typeof options === "function"
        ? shadowDecorator( true, options)
        : shadowDecorator.bind( undefined, options)



/**
 * Wraps the given callback and returns a function with identical signature.
 * @param options
 */
export const wrapCallback = <T extends Function>(func: T, options?: CallbackWrappingOptions): T =>
    wrapFunc(func, options)



/**
 * Reference class to use whenever a reference to an object is needed - for example, with JSX `ref`
 * attributes and services.
 */
export class Ref<T = any> extends EventSlot<RefFunc<T>> implements IRef<T>
{
	constructor( listener?: RefFunc<T>, initialReference?: T)
	{
        super();

        if (listener)
            this.attach( listener);

		this.v = initialReference;
	}

	/** Get accessor for the reference value */
	public get r(): T | undefined { return this.v; }

	/** Set accessor for the reference value */
	public set r( v: T | undefined)
	{
		if (this.v !== v)
		{
			this.v = v;
			this.fire(v as any);
		}
	}

	/** Current referenced value */
	private v?: T;
}



/**
 * Decorator function for creating reference properties without the need to manually create Ref<>
 * instances. This allows for the following code pattern:
 *
 * ```typescript
 * class A extends mim.Component
 * {
 *     @mim.ref myDiv: HTMLDivElement;
 *     render() { return <div ref={this.myDiv}>Hello</div>; }
 * }
 * ```
 *
 * In the above example, the myDiv property will be set to point to the HTML div element.
 */
export function ref( target: any, name: string)
{
    let sym = Symbol( name + "_ref");
    function ensureHandler( obj: any): RefProxyHandler
    {
        let handler = obj[sym];
        if (!handler)
        {
            obj[sym] = handler = new RefProxyHandler();
            handler.proxy = new Proxy( {}, handler);
        }

        return handler;
    }

	Object.defineProperty( target, name,
		{
            set( v: any) { ensureHandler(this).obj = v; },
            get() { return ensureHandler(this).proxy; }
		}
	);
}

/**
 * The RefProxyHandler is a proxy handler for the objects created when reference is defined using
 * the @mim.ref decorator. Only the "r" property has special handling (because it is used by the
 * setRef function); everything else is reflected from the remembered referenced object.
 */
class RefProxyHandler implements ProxyHandler<any>
{
    // Keeps the proxy object for which this is the handler
    public proxy: any;

    // Keeps the referenced object or undefined
    public obj: any;

    public get( target: any, prop: PropertyKey, receiver: any): any
    {
        if (prop === "r")
            return this.obj;

        let propVal = this.obj[prop];
        return typeof propVal === "function" ? propVal.bind( this.obj) : propVal;
    }

    public set( target: any, prop: PropertyKey, value: any, receiver: any): boolean
    {
        if (prop === "r")
            this.obj = value;
        else
            this.obj[prop] = value;

        return true;
    }
}



/**
 * Creates text virtual node, which can be used to update the text without re-rendering parent
 * element.
 * @param text Text to initialize the text node
 */
export function createTextVN( text: string): ITextVN
{
    return new TextVN( text);
}



/**
 * Registers custom attribute handler class for the given property name.
 * @param attrName Name of the custom attribute
 * @param handlerClass Class handling the custom attribute functionality
 */
export function registerCustomAttribute<T>( attrName: string, handlerClass: ICustomAttributeHandlerClass<T>): void
{
	registerElmProp( attrName, { type: PropType.CustomAttr, handlerClass });
}



/**
 * Base class for components. Components must derive from this class and must implement the render
 * method.
 *
 * @typeparam TProps Type of the components properties object. By default, it contains an optional
 * `children` property of type `any`. This allows components that don't explicitly specify any
 * type, to accept children. Note that if a component provides its own type for the properties
 * object and wants to accept children, this type must have the `children` property of the desired
 * type. If not, the component will not be able to accept children (which, oftentimes, might be a
 * desired behavior).
 * @typeparam TEvents Interface defining the component's event. This interface should map event
 * names (e.g. "change") to the types of event objects. The event object types could be either
 * types derived from the built-in Event type, in which case this will be the type passed to the
 * event handler function. If the event object type doesn't derive from the built-in Event type,
 * then the CustomEvent object will be passed to the event handler function with its `detail`
 * property of the specified type.
 */
export abstract class Component<TProps extends {} = {children?: any}, TEvents extends {} = {}>
    extends EventTarget implements IComponent<TProps,TEvents>, IComponentEx<TEvents>
{
	/**
	 * Component properties passed to the constructor. This is normally used only by managed
	 * components and is usually undefined for independent components.
	 */
	public props: ComponentProps<TProps,TEvents>;

	constructor( props?: TProps)
	{
        super();
        this.props = props ?? {} as ComponentProps<TProps,TEvents>;
	}

	/**
     * Returns the component's content that will be ultimately placed into the DOM tree. This
     * method is abstract because it must be implemented by every component.
     */
	abstract render(): any;
}

/**
 * The Component interface extends the IComponentEx class
 */
export interface Component<TProps extends {} = {children?: any}, TEvents extends {} = {}> extends IComponentEx<TEvents>
{
}

// apply the ComponentMixin, which makes the Component class to implement all IComponentEx methods
applyMixins(Component, ComponentMixin);



/**
 * Renders the given content (usually result of JSX expression) under the given HTML element
 * asynchronously.
 * @param content Content to render.
 * @param anchorDN DOM element under which to render the content. If null or undefined,then
 *				render under the document.body tag.
 */
export const mount = (content: any, anchorDN: DN = null): IRootVN | null => mountRoot( content, anchorDN);



/**
 * Removes the content that was originally generated by the mount function.
 * @param anchorDN DOM element under which the content was previously rendered.
 */
export const unmount = (anchorDN: DN = null): void => unmountRoot( anchorDN);



/**
 * Decorator function for tagging a component's render function (or other rendering functions)
 * so that it will not be wrapped in a watcher.
 */
export function noWatcher( target: any, name: string, propDescr: PropertyDescriptor)
{
    // propDesc.value is undefined for accessors and defined for functions
    if (propDescr.value)
        propDescr.value[symRenderNoWatcher] = true;

    /// #if DEBUG
    else
        console.error("@noWatcher decorator can only be applied to methods.");
    /// #endif
}



// Add toVNs method to the Boolean class. This method is invoked to convert rendered content to
// virtual node or nodes. For Booleans, it simply returns null, so neither true nor false create
// any rendered content. For Symbols, it simply returns null.
Symbol.prototype[symToVNs] = Boolean.prototype[symToVNs] = () => null



// Add toVNs method to the String class. This method is invoked to convert rendered content to
// virtual node or nodes.
String.prototype[symToVNs] = function(this: string): IVN | IVN[] | null | undefined
{
    return this.length === 0 ? null : new TextVN( this);
}



// Add toVNs method to the Function class. This method is invoked to convert rendered content to
// virtual node or nodes.
Function.prototype[symToVNs] = function(this: Function): IVN | IVN[] | null | undefined
{
    return new ManagedCompVN(Functor, {func: this as RenderMethodType});
};



// Add toVNs method to the Array class. This method is invoked to convert rendered content to
// virtual node or nodes. This method is invoked for JSX element children almost every time a
// JSX element is processed (exceptions are when a component has a special treatment of children,
// which is rare); therefore, the following optimzations are done for most common cases:
//   - when the array is empty (e.g. element or component without children)
//   - when there is 1 item in the array (e.g. most of cases for elements with text nodes)
//   - when all array items are already VNs (e.g. when all children are JSX elements)
//   - when all array items produce VNs one to one; that is, for no array item the toVNs
Array.prototype[symToVNs] = function(this: Array<any>): IVN | IVN[] | null | undefined
{
    let count = this.length;
    if (count === 0)
        return null;
    else if (count === 1)
        return this[0]?.[symToVNs]();

    // if an item in the array is already a single VN, do nothing; otherwise, switch to a new array.
    let i = 0;
    let vn: IVN | IVN[] | null | undefined;
    for( let item of this)
    {
        vn = item?.[symToVNs]();
        if (!vn || vn !== item || Array.isArray(vn))
            break;

        i++;
    }

    // we can be here either if we processed the entire array without any changes (that is, all
    // items were already VNs), or if we discovered a non-VN item. In the former case, we just
    // return the original array ("this"); in the latter case, we copy the already processed part
    // of the array (if any) to a new array and then put the new VNs into this new array.
    if (i === count)
        return this;

    // copy the already processed part of the original array or create a new array
    let nodes: IVN[] = i === 0 ? [] : this.slice(0, i);

    // copy the VN(s) for which we broke out of the prevous loop to the new array
    if (Array.isArray(vn))
        nodes.push(...vn);
    else if (vn)
        nodes.push(vn as IVN);

    // loop over the rest of the original array, convert items to VN and copy them to the new array
    for( i += 1; i < count; i++)
    {
        vn = this[i]?.[symToVNs]();
        if (Array.isArray(vn))
            nodes.push(...vn);
        else if (vn)
            nodes.push(vn as IVN);
    }
    return nodes.length > 0 ? nodes : null;
};



// Add toVNs method to the Object class. This method is invoked to convert rendered content to
// virtual node or nodes.
Object.prototype[symToVNs] = function(): IVN | IVN[] | null | undefined
{
    if (typeof this.render === "function")
        return this.vn ?? new IndependentCompVN( this);
    else if (isTrigger(this))
        return new TextVN( this);
    else
    {
        let s = this.toString();
        return !s ? null : new TextVN( s);
    }
};



// Add toVNs method to the VN class. This method is invoked to convert rendered content to
// virtual node or nodes.
VN.prototype[symToVNs] = function(this: VN): IVN | IVN[] | null | undefined
{
    return this;
};



// Add toVNs method to the Component class. This method is invoked to convert rendered content to
// virtual node or nodes.
Component.prototype[symToVNs] = function(this: IComponent): IVN | IVN[] | null | undefined
{
    // if the component (this can only be an Instance component) is already attached to VN,
    // return this existing VN; otherwise create a new one.
    return this.vn as ClassCompVN ?? new IndependentCompVN( this);
};



// Add toVNs method to the Promise class. This method is invoked to convert rendered content to
// virtual node or nodes.
Promise.prototype[symToVNs] = function(this: Promise<any>): IVN | IVN[] | null | undefined
{
    return new ManagedCompVN(Awaiter, {promise: this});
};



// Add jsxToVNs method to the Component class object, which creates virtual node for managed
// components. This method is invoked by the JSX mechanism.
Component[symJsxToVNs] = function(props: Record<string,any> | undefined,
    children: IVN[] | null): IVN | IVN[] | null | undefined
{
    return new ManagedCompVN( this, props, children);
}



// Add jsxToVNs method to the String class, which creates ElmVN with the given parameters. This
// method is invoked by the JSX mechanism.
String.prototype[symJsxToVNs] = function(props: ExtendedElement<Element> | undefined,
    children: IVN[] | null): IVN | IVN[] | null | undefined
{
    return new ElmVN( this, props, children);
};



// Add jsxToVNs method to the Function class, which works for functional components. This method
// is invoked by the JSX mechanism.
Function.prototype[symJsxToVNs] = function(props: Record<string,any> | undefined,
    children: IVN[] | null): IVN | IVN[] | null | undefined
{
    // invoke the function right away. The return value is treated as rendered content. This way,
    // the function runs under the current Mimbl context (e.g. creator object used as "this" for
    // event handlers).
    return content2VNs(this(props, children));
};



/** Mimbl style scheduler as the default scheduler for style-related DOM-writing operations. */
export let mimblStyleSchedulerType: number;
s_initStyleScheduler().then( n => mimblStyleSchedulerType = n);
// export let mimblStyleSchedulerType = await s_initStyleScheduler();



/**
 * Given a promise returns an object, which will throw a promise for any property access until
 * the promise is settled. If the promise is successfully resolved, property access will proceed
 * to the object returned by the promise. If the promise is rejected, property access will throw
 * `null-property-access` exception.
 *
 * Although this can be used with any promise, this should be primarily used for dynamic imports
 * in conjunction with code-splitting, for example:
 *
 * ```tsx
 * // dynamically import OtherModule
 * const OtherModule = mim.lazy(import("./delayed/OtherModule"));
 *
 * function MyComp(): any
 * {
 *     return <OtherModule.OtherComp />
 * }
 * ```
 *
 * OR alternatively:
 *
 * ```tsx
 * // dynamically import OtherModule
 * const OtherComp = mim.lazy(import("./delayed/OtherModule")).OtherComp;
 *
 * function MyComp(): any
 * {
 *     return <OtherComp />
 * }
 * ```
 *
 * @param importPromise Promise to wait for
 * @returns Object providing property access to the object returned when the promise is resolved.
 */
export const lazy = <T>(importPromise: Promise<T>): T =>
    createNewLazyProxy(importPromise) as T;



/**
 * Constructor function, which does nothing and only serves as the basis for creating a proxy
 * with LazyHandler. We need a function and not just an object in order to be able to call
 * the "new" operator on the Proxy.
 */
function DummyConstructor() {}



/**
 * Proxy handler for lazy loading modules and module members
 */
class LazyHandler implements ProxyHandler<any>
{
    /**
     * Keeps the promise from the dynamic import or from the lower-level opertaions. After the
     * promise settles, this is set to null.
     */
    promise?: Promise<any> | undefined;

    /**
     * Value after the promise has settled. It contains different things for different kinds
     * of promises:
     *   - For original promises, contains the object the promise has resolved to.
     *   - For get operations, contains the result of the get opertion
     *   - For construct operations, contains the result of the new opertion
     *   - For function calls, contains the return value from the function.
     */
    val?: any;

    /**
     * Error if the promise has been rejected.
     */
    err?: any | undefined;

    constructor(promise: Promise<any>)
    {
        this.promise = promise;
        promise
            .then(value => this.val = value)
            .catch(err => this.err = err)
            .finally(() => this.promise = undefined);
    }

    get(target: any, prop: PropertyKey, receiver: any): any
    {
        if ((prop === symToVNs || prop === symJsxToVNs) && (this.promise || this.err))
            return lazyHandlerToVNs.bind(this, prop);
        else
            return this.helper(obj => obj[prop]);
    }

    construct(target: any, args: any[], newTarget: Function): object
    {
        return this.helper(obj => new obj(...args));
    }

    apply(target: any, thisArg: any, args: any[]): any
    {
        return this.helper((func: Function) => func.apply(thisArg, args));
    }

    private helper(action: (v: any) => any): any
    {
        if (this.promise)
            return createNewLazyProxy(this.promise.then(action))
        else if (this.err)
            throw this.err;
        else
            return action(this.val);
    }
}



/** Creates a Proxy object using LazyHandler watching the given promise */
const createNewLazyProxy = (promise: Promise<any>): any =>
    new Proxy(DummyConstructor, new LazyHandler(promise));

/**
 * Implementation of `toVNs` and `jsxToVNs` functions for the lazy module loader. When either
 * `symToVNs` or `symJsxToVNs` properties are requested from the member of the lazy loading
 * module, this function bound to the LazyHandler instance is returned (if the promise is still
 * pending). It returns Functor for the [[lazyHandlerFunc]] function, which will either
 * throw a promise (while it is still pending), or throw an error (if the promise is rejected),
 * or call the actual `symToVNs` or `symJsxToVNs` function on the promise's resolved value.
 */
function lazyHandlerToVNs(this: LazyHandler, sym: symbol, ...args: any[]): any
{
    return new ManagedCompVN(Functor, {
        func: lazyHandlerFunc,
        thisArg: this,
        arg: [sym, args],
        watch: false
    });
}



/**
 * Function that is wrapped in Functor when either `symToVNs` or `symJsxToVNs` properties are
 * requested from the member of the lazy loading module. This function is called with `this` set
 * to the instance of the LazyHandler class and does the following:
 * - if the promise is still pending, throws it (this is supposed to be caught by a Boundary)
 *   component up the hierarchy).
 * - if the promise is rejected, throws the error (this is supposed to be caught by a Boundary
 *   component up the hierarchy).
 * - if the promise is resolved, calls either `symToVNs` or `symJsxToVNs` functions on the
 *   resolved value.
 *
 * Since functions wrapped in FunProxyVN node can accept a single parameter only, the symbol
 * (symToVNs or symJsxToVNs) and the original argument array are passed as a tuple.
 */
function lazyHandlerFunc(this: LazyHandler, arg: [sym: symbol, args: any[]]): any
{
    if (this.promise)
        throw this.promise;
    else if (this.err)
        throw this.err;
    else
        return this.val[arg[0]](...arg[1]);
}



/**
 * Component that serves as a boundary for errors and unsettled promises. If descendent components
 * throw any error, the nearest to them Boundary component catches and handles them. This component
 * provides a minimal UI informing the user about the error or the fact that it is waiting for a
 * promise. Derived components can provide their own way to display information about the errors
 * and the waiting status.
 */
export class Boundary extends Component
{
	/** String representation of the component */
	get displayName(): string { return "Boundary"; }

    constructor(props: {children: any[]})
    {
        super(props);
        this.content = props.children;
    }

	willMount(): void
    {
        // publish ErrorBoundary service
        this.publishService( "ErrorBoundary", this);
    }

    shouldUpdate(newProps: {children: any[]}): boolean
    {
        this.content = newProps.children;
        return true;
    }

    @noWatcher
    render()
    {
        return this.content;
    }

    /**
     * This method is called after an exception was thrown during rendering of the node's
     * sub-nodes.
     */
    handleError( err: any): void
    {
		if (err instanceof Promise)
		{
            // add the promise to our set of promises we are waiting for
			(this.promises ??= new Set()).add( err);

            // use callback that will remove the promise after it is settled
			err.finally(() => this.onPromise( err));

            // put simple message that will be rendered until all promises are settled
            this.content = this.getWaitingContent();
		}
		else
			this.content = this.getErrorContent(err);
    }

    /**
     * This method implements the gist of the IErrorBoundary interface.
     */
    reportError(err: any): void
    {
        this.handleError(err);
        this.updateMe();
    }

	/**
     * Removes the given (settled) promise from our internal list and if the list is empty asks to
     * re-render.
     */
	private onPromise(promise: Promise<any>): void
	{
		if (this.promises?.delete(promise) && !this.promises.size)
            this.reRender();
	}

    /** This method can be overridden to provide content to display while waiting for promises */
    protected getWaitingContent(): any { return "Waiting..."}

    /** This method can be overridden to provide content to display information about the given error */
    protected getErrorContent(err: any): any { return err?.message ?? err?.toString() ?? "Error"}

    /**
     * Re-renders the component with either the given content or, if the content parameter is
     * undefined, with the original children provided to the component in the props.
     * @param content New content to render the component with or undefined to render with the
     * original children.
     */
    protected reRender(content?: any): void
    {
        this.content = content ?? this.props.children;
        this.updateMe();
    }



	/** Content rendered under this component. */
	private content: any;

	/** Set of promises thrown by descendant nodes and not yet fulfilled. */
	private promises: Set<Promise<any>> | null | undefined;
}



/**
 * Component that accepts a single promise and when it resolves, displays its content. If the
 * promise is rejected, it throws the error out of its `render` method, which causes the error to
 * propagate up the hierarchy to the nearest [[Boundary]] component. While the promise is pending,
 * it displays whatever content was provided to it as children. Derived components can augment how
 * the resolved content is displayed as well as how to react on promise rejection error.
 */
export class Awaiter extends Component<AwaiterProps, AwaiterEvents>
{
	/** String representation of the component */
	get displayName(): string { return "Awaiter"; }

    /**
     * Awaiter is normally used as a managed component and thus is created by the Mimbl
     * infrastructure and passed its properties.
     * @param props Awaiter component properties
     */
    constructor(props: AwaiterProps)
    {
        super(props);
        this.promise = props.promise;
        this.watch();
    }

    /**
     * Updates component with new properties.
     * @ignore
     */
    shouldUpdate(newProps: AwaiterProps): boolean
    {
        // if the promise is the same we don't need to update anything
        if (this.promise === newProps.promise)
            return false;

        // otherwise, start watching the new promise and update.
        this.promise = newProps.promise;
        this.watch();
        return true;
    }

    /**
     * Renders content depending on the current state of the promise - pending, resolved or rejected.
     * @ignore
     */
    @noWatcher render(): any
    {
        return this.promise ? this.props.children :
            this.err ? this.getErrorContent(this.err) :
            this.getResolvedContent(this.val);
    }

	/**
	 * Waits for the current promise to settle
	 */
	private async watch(): Promise<void>
	{
        // remember the original promise because this.promise can be changed during an update
        // while we are still awaiting.
        let orgPromise = this.promise!;
		try
		{
			let val = await orgPromise;
            if (this.promise === orgPromise)
            {
                this.promise = null;
                this.val = val;
                this.updateMe();
                this.fireEvent("resolved", new CustomEvent("resolved", {detail: val}));
            }
		}
		catch( err)
		{
            if (this.promise === orgPromise)
            {
                this.promise = null;
                this.err = err;
                this.updateMe();
                this.fireEvent("rejected", new CustomEvent("rejected", {detail: err}));
            }
		}
	}

    /**
     * This method can be overridden to provide content to display for the resolved content. By
     * default, the resolved value itself serves as the content.
     *
     * @param val Promise's resolved value
     * @returns Content to rendered
     */
    protected getResolvedContent(val: any): any { return val}

    /**
     * This method can be overridden to provide content to display information about the given
     * error. By default, the error is thrown and is supposed to propagate up to the nearest
     * [[Boundary]] component.
     *
     * @param err Promise rejection error.
     */
    protected getErrorContent(err: any): any { throw err}



	/** Promises being watched by this component. */
	private promise: Promise<any> | null;

	/** Resolved promise value. */
	private val: any;

	/** Rejected promise error. */
	private err: any;
}



/**
 * Component that wraps a function or a class method and invokes it in its `render` method. The
 * component remembers the `this` value for the function, which allows it to invoke class methods
 * with the proper `this`. A function can accept a single argument, which can be passed in the
 * `arg` property to the *Functor* component.
 *
 * Normally, the *Functor* component wraps the function in a watcher, which allows it to react to
 * triggers. It is possible to disable this functionality either by applying the [[noWatcher]]
 * decorator to a class method or by passing `false` to the `watch` property.
 *
 * The primary use of the *Functor* component is to allow class-based components' methods to render
 * different parts of the component and to update these parts independently. If the class method
 * doesn't accept any parameters, then there is no need to use the *Functor* component explicitly.
 * Such methods can be passed as JSX content and Mimbl will create the *Functor* components for
 * them.
 *
 * **Example:**
 *
 * ```typescript
 * class ToDoList extends mim.Component
 * {
 *     // array of objects of some externally defined ToDo type
 *     @mim.trigger todos: ToDo[] = [];
 *
 *     render(): any
 *     {
 *         return <main>
 *             {this.todos.map( todo => <mim.Functor func={this.renderTodo} arg={todo} />}
 *         </main>
 *     }
 *
 *     renderToDo(todo: ToDo): any
 *     {
 *         return <div>{todo.description}</div>
 *     }
 * }
 * ```
 */
export class Functor extends Component<FunctorProps>
{
	/** String representation of the component */
	get displayName(): string { return this.props.func.name; }

    /**
     * Prepares the component to be mounted.
     * @ignore
     */
    willMount(): void
    {
        // establish watcher if not disabled using the `watch` flag or the @noWatcher decorator
        this.init(this.props);
    }

    /**
     * Prepares the component to be unmounted.
     * @ignore
     */
    willUnmount(): void
    {
        // release the watcher; we don't need to set it to undefined because it will be done
        // in the next mount (if it comes)
        this.watcher?.dispose();
    }

    /**
     * Updates component with new properties.
     * @ignore
     */
    shouldUpdate(newProps: FunctorProps): boolean
    {
        // if all the properties remain the same, there is no need to re-render
        let oldProps = this.props as FunctorProps;
        if (oldProps.func === newProps.func && oldProps.thisArg === newProps.thisArg &&
            oldProps.watch === newProps.watch && oldProps.arg === newProps.arg)
        {
            return false;
        }

        // release the watcher if existed
        if (this.watcher)
        {
            this.watcher?.dispose();
            this.watcher = undefined;
        }

        // create a new watcher if necessary
        this.init(newProps);

        // indicate that re-rendering is necessary
        return true;
    }

    /**
     * Invokes the wrapped function.
     * @ignore
     */
    @noWatcher render(): any
    {
        // the render method is called with the current component set to this Functor instance. We
        // want, however, to call the function while the current component is set to the creator of
        // the Functor.
        let prevComp = setCurrentClassComp(this.vn!.creator);
        try
        {
            return this.watcher
                ? this.watcher(this.props.arg)
                : this.props.func.call(this.props.thisArg, this.props.arg);
        }
        finally
        {
            setCurrentClassComp(prevComp);
        }
    }

    /** Establishes watcher if necessary */
    private init(props: FunctorProps): void
    {
        this.thisArg = props.thisArg ?? this.vn!.creator;
        if (props.watch ?? !props.func[symRenderNoWatcher])
            this.watcher = createWatcher(props.func, this.updateMe, this.thisArg, this);
    }



    /**
     * The "this" argument for calling the function. If it is not provided, the current component
     * is used.
     */
    thisArg: any;

    /**
     * Watcher function wrapping the original function. The watcher will notice any trigger objects
     * being read during the original function execution and will request update thus triggerring
     * re-rendering.
     */
	private watcher?: IWatcher;
}



