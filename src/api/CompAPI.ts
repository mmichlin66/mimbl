import {
    CallbackWrappingOptions, ComponentShadowOptions, IClassCompVN, IComponent, ICustomAttributeHandlerClass,
    IPublication, IRef, IServiceDefinitions, ISubscription, ITextVN, IVNode, PromiseProxyProps, PropType,
    RefFunc, RenderMethodType, ScheduledFuncType, TickSchedulingType, DN, IComponentEx
} from "./CompTypes";
import {EventSlot} from "./EventSlotAPI"
import { shadowDecorator } from "../core/ClassCompVN";
import { TextVN } from "../core/TextVN";
import { ElmVN, registerElmProp } from "../core/ElmVN";
import { IndependentCompVN } from "../core/IndependentCompVN";
import { FuncProxyVN } from "../core/FuncProxyVN";
import { ManagedCompVN } from "../core/ManagedCompVN";
import { PromiseProxyVN } from "../core/PromiseProxyVN";
import { mountRoot, unmountRoot } from "../core/RootVN";
import { CallbackWrapper, getCurrentClassComp, symJsxToVNs, symToVNs } from "../core/Reconciler";
import { s_initStyleScheduler } from "../core/StyleScheduler";
import { isTrigger } from "./TriggerAPI";
import { symRenderNoWatcher, VN } from "../core/VN";


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
export function wrapCallback<T extends Function>( func: T, options?: CallbackWrappingOptions): T
{
    let comp = getCurrentClassComp();
    return CallbackWrapper.bind( {
        func,
        thisArg: options?.thisArg ?? comp,
        arg: options?.arg,
        comp: options?.comp ?? comp,
        schedulingType: options?.schedulingType
    });
}



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

		this.v = initialReference as T;
	}

	/** Get accessor for the reference value */
	public get r(): T { return this.v; }

	/** Set accessor for the reference value */
	public set r( v: T)
	{
		if (this.v !== v)
		{
			this.v = v;
			this.fire( v);
		}
	}

	/** Current referenced value */
	private v: T;
}



/**
 * Decorator function for creating reference properties without the need to manually create Ref<>
 * instances. This allows for the following code pattern:
 *
 * ```typescript
 * class A extends Component
 * {
 *     @ref myDiv: HTMLDivElement;
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
 * the @ref decorator. Only the "r" property has special handling (because it is used by the
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
 * Base class for components. Components that derive from this class must implement the render
 * method.
 *
 * @typeparam TProps type of the components properties object. By default, it contains an optional
 * `children` property of type `any`. This allows components that don't explicitly specify any
 * type, to accept children. Note that if a component provides its own type for the properties
 * object and wants to accept children, this type must have the `children` property of the desired
 * type. If not, the component will not be able to accept children (which, oftentimes, might be a
 * desired behavior)
 */
export abstract class Component<TProps extends {} = {children?: any}> implements IComponent<TProps>, IComponentEx
{
	/**
	 * Remembered virtual node object through which the component can request services. This
	 * is undefined in the component's costructor but will be defined before the call to the
	 * (optional) willMount method.
	 */
	public vn: IClassCompVN;

	/**
	 * Component properties passed to the constructor. This is normally used only by managed
	 * components and is usually undefined for independent components.
	 */
	public props?: Readonly<TProps>;

	constructor( props?: TProps)
	{
        this.props = props;
	}

	/**
     * Returns the component's content that will be ultimately placed into the DOM tree. This
     * method is abstract because it must be implemented by every component.
     */
	abstract render(): any;

    /**
     * Stores the new properties in the [[props]] field. If the component overrides this method
     * it must call the parent's implementation.
     * @param newProps
     */
	updateProps( newProps: TProps): void
    {
        this.props = newProps;
    }

    /**
     * Determines whether the component is currently mounted. If a component has asynchronous
     * functionality (e.g. fetching data from a server), component's code may be executed after
     * it was alrady unmounted. This property allows the component to handle this situation.
     */
	get isMounted(): boolean { return this.vn != null; };

	/**
	 * This method is called by the component to request to be updated. If no arguments are
	 * provided, the entire component is requested to be updated. If arguments are provided, they
	 * indicate what rendering function should be updated.
     * @param func Optional rendering function to invoke
     * @param arg Optional argument to pass to the rendering function.
     */
	updateMe( func?: RenderMethodType, arg?: any): void
	{
		this.vn?.updateMe( func, arg);
	}

	/**
	 * Schedules the given function to be called before any components scheduled to be updated in
	 * the Mimbl tick are updated.
	 * @param func Function to be called
	 * @param thisArg Object that will be used as "this" value when the function is called. If this
	 *   parameter is undefined, the component instance will be used (which allows scheduling
	 *   regular unbound components' methods). This parameter will be ignored if the function
	 *   is already bound or is an arrow function.
	 */
	callMeBeforeUpdate( func: ScheduledFuncType, thisArg?: any): void
	{
		this.vn?.callMe( func, true, thisArg ?? this);
	}

	/**
	 * Schedules the given function to be called after all components scheduled to be updated in
	 * the Mimbl tick have already been updated.
	 * @param func Function to be called
	 * @param thisArg Object that will be used as "this" value when the function is called. If this
	 *   parameter is undefined, the component instance will be used (which allows scheduling
	 *   regular unbound components' methods). This parameter will be ignored if the function
	 *   is already bound or is an arrow function.
	 */
	callMeAfterUpdate( func: ScheduledFuncType, thisArg?: any): void
	{
		this.vn?.callMe( func, false, thisArg ?? this);
	}

    /**
     *
     * @param func Callback function to be wrapped
     * @param arg Optional argument to be passed to the callback in addition to the original
     * callback arguments.
     * @param thisArg Optional object to be used as `this` when calling the callback. If this
     * parameter is not defined, the component instance is used, which allows wrapping regular
     * unbound components' methods. This parameter will be ignored if the the function
	 *   is already bound or is an arrow function.
     * @param schedulingType Type of scheduling the Mimbl tick after the callback function returns.
     * @returns Wrapped callback that will run the original callback in the proper context.
     */
    wrap<T extends Function>( func: T, arg?: any, thisArg?: any, schedulingType?: TickSchedulingType): T
    {
        return this.vn?.wrap( func, thisArg ?? this, arg, schedulingType);
    }

    /**
	 * Registers the given value as a service with the given ID that will be available for
     * consumption by descendant components.
     * @param id Unique service identifier
     * @param value Current value of the service
     * @param depth Number of level to watch for changes. The default value is 1; that is, the
     * subscribers will be notified if the service's value or the values of its properties have
     * changed.
     * @returns Publication object, which allows setting a new value of the service or changing
     * values of its properties.
     */
	publishService<K extends keyof IServiceDefinitions>( id: K, value: IServiceDefinitions[K],
        depth?: number): IPublication<K>
    {
        return this.vn?.publishService(id, value, depth);
    }

	/**
	 * Subscribes to a service with the given ID. If the service with the given ID is registered
	 * by this or one of the ancestor components, the returned subscription object's `value`
     * property will reference it; otherwise, the value will be set to the defaultValue (if
     * specified) or will remain undefined. Whenever the value of the service that is registered by
     * this or a closest ancestor component is changed, the subscription's `value` property will
     * receive the new value.
     *
     * If the subscription object's `value` property is used in a component's rendering code, the
     * component will be re-rendered every time the service value is changed.
     *
	 * @param id Unique service identifier
	 * @param defaultValue Optional default value that will be assigned if the service is not
     * published yet.
	 * @param useSelf Flag indicating whether the search for the service should start from the
     * virtual node that calls this method. The default value is `false` meaning the search starts
     * from the parent virtual node.
     * @returns Subscription object, which provides the value of the service and allowes attaching
     * to the event fired when the value is changed.
	 */
	subscribeService<K extends keyof IServiceDefinitions>( id: K, defaultValue?: IServiceDefinitions[K],
        useSelf?: boolean): ISubscription<K>
    {
        return this.vn?.subscribeService(id, defaultValue, useSelf);
    }
}



// Add toVNs method to the Component class. This method is invoked to convert rendered content to
// virtual node or nodes.
Component.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    // if the component (this can only be an Instance component) is already attached to VN,
    // return this existing VN; otherwise create a new one.
    let vn = this.vn ?? new IndependentCompVN( this);
    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add jsxToVNs method to the Component class object, which creates virtual node for managed
// components. This method is invoked by the JSX mechanism.
Component[symJsxToVNs] = function( props: any, children: VN[]): VN | VN[] | null
{
    return new ManagedCompVN( this, props, children);
}


/**
 * Creates a Function Proxy virtual node that wraps the given function with the given argument.
 * This allows using the same component method with different arguments, for example:
 *
 * ```typescript
 * class ToDoList extends mim.Component
 * {
 *     // array of objects of some externally defined ToDo type
 *     todos: ToDo[] = [];
 *
 *     render(): any
 *     {
 *         return <main>
 *             {this.todos.map( todo => FuncProxy(renderTodo, todo))}
 *         </main>
 *     }
 *
 *     renderToDo( todo: ToDo): any
 *     {
 *         return <div>{todo.description}</div>
 *     }
 * }
 * ```
 *
 * @param func Function (usually a component method) to be wrapped in a virtual node
 * @param arg Argument distinguishing one function invocation from another
 * @param thisArg Optional object to be used as `this` when invoking the function. If omitted,
 * the component instance will be used.
 * @returns
 */
export const FuncProxy = (func: RenderMethodType, arg?: any, thisArg?: any): IVNode =>
    new FuncProxyVN(func, thisArg ?? getCurrentClassComp(), arg);



/**
 * The PromiseProxy component wraps a Promise and replaces its content when the promise is settled.
 * Before the promise is settled, the component displays an optional "in-progress" content
 * specified as children of the component. If the promise is rejected, the component will either
 * display the "error" content obtained by calling a functions specified in the properties or, if
 * such function is not specified, display nothing.
 */
export class PromiseProxy extends Component<PromiseProxyProps>
{
	/**
	 * Instances of the FuncProxy component are never actually created; istead, the parameters
	 * passed to it via JSX are used by an internal virtual node that handles function
	 * invocation.
	 */
	private constructor( props: PromiseProxyProps) { super( props); }

	/** The render method of the PromiseProxy component is never actually called */
	public render(): any {}
}



/**
 * Renders the given content (usually result of JSX expression) under the given HTML element
 * asynchronously.
 * @param content Content to render.
 * @param anchorDN DOM element under which to render the content. If null or undefined,then
 *				render under the document.body tag.
 */
export function mount( content: any, anchorDN: DN = null): void
{
	mountRoot( content, anchorDN);
}



/**
 * Removes the content that was originally generated by the mount function.
 * @param anchorDN DOM element under which the content was previously rendered.
 */
export function unmount( anchorDN: DN = null): void
{
	unmountRoot( anchorDN);
}



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
// any rendered content.
Boolean.prototype[symToVNs] = () => null



// Add toVNs method to the String class. This method is invoked to convert rendered content to
// virtual node or nodes.
String.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    if (this.length === 0)
        return null;

    let vn = new TextVN( this);
    if (nodes)
        nodes.push( vn);

    return vn;
}



// Add toVNs method to the Function class. This method is invoked to convert rendered content to
// virtual node or nodes.
Function.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    let vn = new FuncProxyVN(this, getCurrentClassComp());
    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add toVNs method to the Array class. This method is invoked to convert rendered content to
// virtual node or nodes.
Array.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    if (this.length === 0)
        return null;

    if (!nodes)
        nodes = [];

    this.forEach( (item: any) =>
    {
        if (item != null)
        {
            if (item instanceof VN)
                nodes!.push( item)
            else
                item[symToVNs]( nodes);
        }
    });

    return nodes.length > 0 ? nodes : null;
};



// Add toVNs method to the Object class. This method is invoked to convert rendered content to
// virtual node or nodes.
Object.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    let vn: VN;
    if (typeof this.render === "function")
        vn = this.vn ?? new IndependentCompVN( this);
    else if (isTrigger(this))
        vn = new TextVN( this);
    else
    {
        let s = this.toString();
        if (!s)
            return null;

        vn = new TextVN( s);
    }

    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add toVNs method to the VN class. This method is invoked to convert rendered content to
// virtual node or nodes.
VN.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    if (nodes)
        nodes.push( this);

    return this;
};



// Add jsxToVNs method to the PromiseProxy class object. This method is invoked by the JSX mechanism.
PromiseProxy[symJsxToVNs] = (props: PromiseProxyProps | undefined, children: VN[]): VN | VN[] | null =>
    props?.promise ? new PromiseProxyVN( props, children) : null;



// Add toVNs method to the Promise class. This method is invoked to convert rendered content to
// virtual node or nodes.
Promise.prototype[symToVNs] = function( nodes?: VN[]): VN | VN[] | null
{
    let vn = new PromiseProxyVN( { promise: this});
    if (nodes)
        nodes.push( vn);

    return vn;
};



// Add jsxToVNs method to the String class, which creates ElmVN with the given parameters. This
// method is invoked by the JSX mechanism.
String.prototype[symJsxToVNs] = function( props: any, children: VN[]): VN | VN[] | null
{
    return new ElmVN( this, props, children);
};



// Add jsxToVNs method to the Function class, which works for functional components. This method
// is invoked by the JSX mechanism.
Function.prototype[symJsxToVNs] = function( props: any, children: VN[] | null): VN | VN[] | null
{
    // invoke the function right away. The return value is treated as rendered content. This way,
    // the function runs under the current Mimbl context (e.g. creator object used as "this" for
    // event handlers).
    return this(props, children)?.[symToVNs]();
};



/** Mimbl style scheduler as the default scheduler for style-related DOM-writing operations. */
export let mimblStyleSchedulerType: number;
s_initStyleScheduler().then( n => mimblStyleSchedulerType = n);



