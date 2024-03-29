﻿import {ITrigger} from "./TriggerTypes"
import {IEventSlot} from "./EventSlotTypes"
import { IElementAttrs, IElementEvents } from "./ElementTypes";


// Use type DN to refer to DOM's Node class. The DOM nodes that we are dealing with are
// either of type Element or Text.
export type DN = Node | null;



/**
 * Type that combines readonly component properties and component events. For each event, the
 * *ComponentProps* type defines a property named $on_event, where "event" is the name of the
 * property from the *TEvents* generic type. This allows attaching to component events in JSX
 * just like attaching to HTML element events.
 *
 * The *ComponentProps* is not usually used directly by developers; however, it defines the
 * type of the `props` property in the {@link IComponent} interface that all class-based components
 * implement.
 *
 * **Example:**
 * ```typescript
 * // Component properties
 * interface IMyCompProps
 * {
 *     title?: string
 * }
 *
 * // Component events
 * interface IMyCompEvents
 * {
 *     titleChanged?: string;
 * }
 *
 * // the following component
 * class MyComp extends Component<IMyCompProps,IMyCompEvents> {...}
 *
 * // would have its properties type equivalent to
 * type PropsAndEvents =
 * {
 *     readonly title?: string;
 *     readonly $on_titleChanged?: EventPropType<CustomEvent<string>>;
 * }
 *
 * // this allows using MyComp as the following
 * <MyComp title="Hello" $on_titleChanged={e => console.log(`Title changed to ${e.detail}`)}
 * ```
 *
 * @typeparam TProps Type defining properties that can be passed to the class-based component
 * of this type. Note that if the component is expected to accept children then the *TProps*
 * object must have the `cildren` property (usually of the `any` type). Default type is an empty
 * object (no properties and no children).
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent. Default type is an empty object (no events).
 */
export type ComponentProps<TProps extends {} = {}, TEvents extends {} = {}> =
    Readonly<TProps> &
    { readonly [K in keyof TEvents & string as `$on_${K}`]?:
        EventPropType<TEvents[K] extends Event ? TEvents[K] : CustomEvent<TEvents[K]>> }



/**
 * Interface that defines constructor signature for components.
 *
 * @typeparam TProps Type defining properties that can be passed to the class-based component
 *		of this type. Default type is an empty object (no properties).
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 */
export interface IComponentClass<TProps extends {} = {}, TEvents extends {} = {}>
{
	new( props?: ComponentProps<TProps,TEvents>): IComponent<TProps,TEvents>;
}



/**
 * Interface that must be implemented by all components. Although it has many methods that
 * components can implement, in practice, there is only one mandatory method - {@link render}.
 * Components should be ready to have the `vn` property set, although they don't have to declare
 * it.
 *
 * Note that you normally don't need to implement this interface because your components will
 * usually derive from the {@link CompAPI!Component} class that implements it.
 *
 * @typeparam TProps Type defining properties that can be passed to this class-based component.
 *		Default type is an empty object (no properties).
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 */
export interface IComponent<TProps extends {} = {}, TEvents extends {} = {}> extends EventTarget
{
	/**
	 * Components can define display name for tracing purposes; if they don't the default name
	 * used is the component's class constructor name. Note that this method can be called before
	 * the virtual node is attached to the component.
	 */
	readonly displayName?: string;

	/**
	 * Component properties. This is normally used only by managed components and is usually
     * undefined for independent components. This object can contains every property from the
     * *TProps* type and `$on_` property for every event defined in the *TEvents* type.
	 */
	props: ComponentProps<TProps,TEvents>;

	/**
	 * Sets, gets or clears the virtual node object of the component. This property is set twice:
	 *  1. Before the component is rendered for the first time: the component must remember the
	 *    passed object.
	 *  2. Before the component is destroyed: undefined is passed as a parameter and the component
     *     must release the remembered object.
	 */
	vn?: IClassCompVN;

	/**
	 * Optional update strategy object that determines different aspects of component behavior
	 * during updates.
	 */
	readonly updateStrategy?: UpdateStrategy;

	/** Returns the component's content that will be ultimately placed into the DOM tree. */
	render(): any;

	/**
	 * Notifies that the component is about to render its content for the first time. This method
	 * is called when the virtual node has already been set so the component can request services
	 * from it.
	 */
	willMount?(): void;

    /**
	 * This method is only used by independent components.
	 *
     * Notifies the component that it replaced the given component. This allows the new
     * component to copy whatever internal state it needs from the old component.
     */
    didReplace?(oldComp: IComponent<TProps>): void;

    /**
	 * Notifies that the component's content is going to be removed from the DOM tree. After
	 * this method returns, a managed component is destroyed.
	 */
	willUnmount?(): void;

	/**
	 * This method is only used by managed components.
	 *
	 * Informs the component that new properties have been specified. At the time of the call
	 * this.props refers to the "old" properties. They will be changed to the new props right
     * after the call returns. If the component returns true, then its render
	 * method will be called. If the component doesn't implement the `shouldUpdate` method it is
     * as though true is returned. If the component returns false, the render method is not
     * called and the DOM tree of the component remains unchanged. The component will have its
     * {@link props} member set to the new properties regardless of this method's return value.
     *
     * If the component creates its internal structures based on properties, this call is the
     * opportunity to change the internal structures to correspond to the new properties.
     *
	 * @param newProps The new properties that the parent component provides to this component.
	 * @returns True if the component should have its render method called and false otherwise.
	 */
	shouldUpdate?(newProps: TProps): boolean;

	/**
	 * Handles an exception that occurred during the rendering of one of the component's children.
     * If this method is not implemented or if it throws an error, the error will be propagated up
     * the chain of components until it reaches a component that handles it. If none of the
     * components can handle the error, the entire tree will be unmounted.
     *
     * This method should only change the internal state of the component so that the {@link render}
     * method, which will be invoked right after the `handleError` method returns, will return
     * content reflecting the error.
     *
	 * @param err An error object that was thrown during the component's own rendering or rendering
	 * of one of its descendants.
	 */
	handleError?(err: unknown): void;

	/**
	 * If the component is scheduled to be updated, this method is invoked during the Mimbl tick
     * before any component scheduled to be updated in this tick (including this one) are updated.
     * This method should be implemented by components that require some DOM-based calculations
     * (like sizes and positions) for rendering. When this method is called, reading DOM
     * information should be safe in regards to not causing layout thrashing. Don't do any DOM-
     * writing activities in this method.
	 */
	beforeUpdate?(): void;

	/**
	 * If the component is scheduled to be updated, this method is invoked during the Mimbl tick
     * after all components scheduled to be updated in this tick (including this one) has already
     * been updated. This method should be implemented by components that require some
     * DOM-writing after rendering. When this method is called, writing DOM information should be
     * safe in regards to not causing layout thrashing. Don't do any DOM-reading activities in
     * this method.
	 */
	afterUpdate?(): void;
}



/**
 * Type for the `shadow` property in the {@link IComponent} interface. This can be one of the following:
 * - boolean - if the value is true, a `<div>` element will be created and shadow root attached to
 *   it with mode "open".
 * - string - an element with this name will be created and shadow root attached to
 *   it with mode "open".
 * - ShadowRootInit - a `<div>` element will be created and shadow root attached to
 *   it with the given initialization prameters.
 * - two-item tuple - the first item is the name of the element to create and attach a shadow
 *   root to; the second item specifies the shadow root initialization prameters.
 */
export type ComponentShadowOptions = boolean | string | ShadowRootInit |
    [tag: string, init: ShadowRootInit]



/**
 * Represents component functionality that is implemented by the Mimbl base classes for
 * regular components and custom Web element.
 *
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 */
export interface IComponentEx<TEvents extends {} = {}>
{
	/**
	 * Remembered virtual node object through which the component can request services. This
	 * is undefined in the component's costructor but will be defined before the call to the
	 * (optional) willMount method.
	 */
	vn?: IClassCompVN;

    /**
     * Determines whether the component is currently mounted. If a component has asynchronous
     * functionality (e.g. fetching data from a server), component's code may be executed after
     * it was already unmounted. This property allows the component to handle this situation.
     */
	readonly isMounted: boolean;

	/**
	 * This method is called by the component to request to be updated.
     */
	updateMe(): void;

	/**
	 * Schedules the given function to be called either before or after components update cycle.
	 * @param func Function to be called
	 * @param beforeUpdate If true, the function is called before the component updates cycle; if
     * false - after the cycle.
	 * @param arg Argument that will be passed to the function.
	 * @param thisArg Object that will be used as "this" value when the function is called. If this
	 *   parameter is undefined, the component instance will be used (which allows scheduling
	 *   regular unbound components' methods). This parameter will be ignored if the function
	 *   is already bound or is an arrow function.
     * @param tickType Defines whether and how Mimbl tick is scheduled after the function is called
	 */
	callMe(func: ScheduledFuncType, beforeUpdate: boolean, arg?: any, thisArg?: any,
        tickType?: TickSchedulingType): void;

    /**
     *
     * @param func Callback function to be wrapped
     * @param arg Optional argument to be passed to the callback in addition to the original
     * callback arguments.
     * @param thisArg Optional object to be used as `this` when calling the callback. If this
     * parameter is not defined, the component instance is used, which allows wrapping regular
     * unbound components' methods. This parameter will be ignored if the the function is already
     * bound or is an arrow function.
     * @param schedulingType Type of scheduling the Mimbl tick after the callback function returns.
     * @returns Wrapped callback that will run the original callback in the proper context.
     */
    wrap<T extends Function>( func: T, arg?: any, thisArg?: any, schedulingType?: TickSchedulingType): T;

    /**
	 * Retrieves the value for a service with the given ID registered by a closest ancestor
	 * component or the default value if none of the ancestor components registered a service with
	 * this ID. This method doesn't establish a subscription and only reflects the current state.
	 * @param id Unique service identifier
	 * @param defaultValue Default value to return if no publish service is found.
	 * @param useSelf Flag indicating whether the search for the service should start from the
     * virtual node that calls this method. The default value is `false` meaning the search starts
     * from the parent virtual node.
     * @returns Current value of the service or default value if no published service is found.
	 */
	getService<K extends keyof IServiceDefinitions>( id: K, defaultValue?: IServiceDefinitions[K],
        useSelf?: boolean): IServiceDefinitions[K];

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
        useSelf?: boolean): ISubscription<K>;

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
 * The UpdateStrategy object specifies different aspects of update behavior of components and
 * elements.
 */
export type UpdateStrategy =
{
	/**
	 * Flag determining whether or not non-matching new keyed sub-nodes are allowed to recycle non-
	 * matching old keyed sub-nodes. Here "non-matching" means those new or old nodes with keys
     * for which no old or new sub-nodes with the same key were found. If this flag is true, then
     * non-matching old sub-nodes will be removed and non-matching new sub-nodes will be inserted.
     * If this flag is false, then non-matching old sub-nodes will be updated by the non-matching
     * new sub-nodes - provided that the types of sub-nodes are the same.
	 *
	 * If keyed sub-nodes recycling is enabled it can speed up an update process because
	 * less DOM nodes get removed and inserted, which is more expensive than updating. However,
	 * this can have some adverse effects under cirtain circumstances if certain data is bound
	 * to the particular instances of DOM nodes.
	 *
	 * The flag's default value is false, that is, recycling is enabled.
	 */
    disableKeyedNodeRecycling?: boolean;

	/**
	 * Flag determining whether the reconciliation procedure should not pay attention to the keys.
     * This flag is complimentary to the disableKeyedNodeRecycling flag and take effect only if the
     * latter is false (or undefined). When the ignoreKeys flag is false (default) we try to match
     * new sub-nodes to old ones using keys. Setting the ignoreKeys flag to true completely
     * ignores keys and the matching is done by going through the lists of the new and
     * old sub-nodes sequentially. Under certain circumstances this may speed up the reconciliation
     * process
	 *
	 * The flag's default value is false, that is, keys are used for matching the nodes.
	 */
    ignoreKeys?: boolean;
};



/** Type defining the options that can be supplied for a callback to be wrapped */
export type CallbackWrappingOptions =
{
	/** Object that will be referenced by "this" within the callback function */
	thisArg?: any;

	/** Argument that is supplied to the callback as a last parameter. */
	arg?: any;

	/** Component that will be set as a current component when the callback is invoked. */
	comp?: IComponent | null;

	/** Type of scheduling the Mimbl tick after the callback function returns. */
	tickType?: TickSchedulingType;
};



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Definitions of callback types used when passing callback functions to components.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Type that can be passed as a callback to a component's property. It allows passing a callback
 * in one of the following forms:
 * - as a function object. Note that if the function is a method of another component (or just a
 *   class), then it should be wrapped (using the {@link CompAPI!Component.wrap} method) so that the
 *   `this` parameter is properly set up when the callback is invoked.
 * - a two element tuple. The first element is the function to be called and the second element is
 *   the value to be used as the `this` parameter.
 * - an object with the properties `func` specifying the function to be called and `thisArg`
 *   specifying the value to be used as the `this` parameter.
 */
export type CallbackPropType<T extends Function = Function> =
    T | [func: T, thisArg?: any] | {func: T, thisArg?: any};



/**
 * Defines event handler that is invoked when reference value changes.
 */
export type RefFunc<T = any> = (newRef: T) => void;

/**
 * Defines event handler that is invoked when reference value changes.
 */
export interface IRef<T = any> extends IEventSlot<RefFunc<T>>
{
    r?: T;
}

/**
 * Type of ref property that can be passed to JSX elements and components. This can be either the
 * {@link IRef} interface or {@link RefFunc} function.
 */
export type RefType<T = any> = IRef<T> | RefFunc<T>;

/**
 * Type of ref property value. This can be either the {@link IRef} interface or {@link RefFunc} function
 * or the type itself.
 */
export type RefPropType<T = any> = T | RefType<T>;



/**
 * Type of the vnref property value.
 */
export type ElmRefType<T extends Element = Element> = RefType<IElmVN<T>>;

/**
 * Type of vnref property that can be passed to JSX elements.
 */
export type ElmRefPropType<T extends Element = Element> = RefPropType<IElmVN<T>>;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Definitions of property types used by HTML and SVG elements.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Type of event handler function for DOM events of type T.
 * @typeparam T DOM event type, e.g. MouseEvent
 * @param e Event object
 * @param arg Optional parameter, which is defined only if it was passed when the callback was
 * wrapped - that is, in the `arg` property of the EventObjectType object or in the 2nd item of the
 * EventTupleType tuple.
 */
export type EventFuncType<T extends Event = Event> = (e: T, arg?: any) => void;

/**
 * Type defining a tuple that can be supplied for an event listener.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export type EventTupleType<T extends Event = Event> =
    [func: EventFuncType<T>, arg?: any, thisArg?: any]

/**
 * Type defining an object that can be supplied for an event listener.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export interface EventObjectType<T extends Event> extends CallbackWrappingOptions
{
	/** Callback function */
	func: EventFuncType<T>;

    /**
     * Flag indicating whether this event should be used as Capturing or Bubbling. The default
     * value is `false`, that is, Bubbling.
     */
	useCapture?: boolean;
};

/**
 * Union type that can be passed to an Element's event.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export type EventPropType<T extends Event = Event> =
    EventFuncType<T> | EventTupleType<T> | EventObjectType<T>;



/**
 * Internal type containing names of attributes that are not "triggerized" when applying
 * the {@link ExtendedAttrs} type to the element attributes interface.
 */
export type NoTriggerAttrNames = "xmlns" | "is";



/**
 * Converts the given interface T to a type that maps an extended attribute type to each property
 * of T. The extended property contains the property type, the {@link TriggerTypes!ITrigger} for this type as well as
 * `null` and `undefined`. This is primarily useful for defining attributes of HTML elements - both
 * built-in and custom.
 *
 * **Example:**
 * ```typescript
 * interface IMyAttrs
 * {
 *     foo: string;
 *     bar: number;
 * }
 *
 * type MyExtendedAttrs = ExtendedAttrs<IMyAttrs>;
 *
 * // the MyExtendedEvents is equivalent to the following interface
 * interface MyExtendedAttrs
 * {
 *     foo: string | ITrigger<string> | null | undefined;
 *     bar: number | ITrigger<number> | null | undefined;
 * }
 * ```
 */
export type ExtendedAttrs<T> = {
    [K in keyof T]?: T[K] | null | undefined | (K extends NoTriggerAttrNames ? never : ITrigger<T[K]>)
}



/**
 * Converts the given interface T to a type that maps an event type to each property of T. If
 * the property is iself an event (that is, derives from the Event interface), this event
 * becomes the type of the mapped property. Otherwise, the property is mapped to a CustomEvent
 * type whose `detail` property is defined as the original property type.
 *
 * **Example:**
 * ```typescript
 * interface IMyEvents
 * {
 *     foo: string;
 *     bar: number;
 *     baz: MouseEvent;
 * }
 *
 * type MyExtendedEvents = ExtendedEvents<IMyEvents>;
 *
 * // the MyExtendedEvents is equivalent to the following interface
 * interface MyExtendedEvents
 * {
 *     foo: CustomEvent<string>;
 *     bar: CustomEvent<number>;
 *     baz: MouseEvent;
 * }
 * ```
 */
export type ExtendedEvents<T> = {
    [K in keyof T]?: T[K] extends Event ? EventPropType<T[K]> : EventPropType<CustomEvent<T[K]>>
}



/**
 * Represents intrinsic element attributes, events and children known to Mimbl infrastucture. Each
 * built-in or custom element is defined as a JSX intrinsic element using the `ExtendedElement`
 * type by passing the correct attribute, event and children types.
 *
 * @typeparam TRef - Type that can be passed to the `ref` attribute to get a reference to the
 * element.
 * @typeparam TAttr Type listing element's attribute names mapped to attribute types.
 * @typeparam TEvents Type listing element's event names mapped to event types. Most elements
 * don't need to specify this type parameter as they only implement standard events; however,
 * there are some elements - e.g. <video> - that define additional events. Custom Web elements
 * can also define their own events - in this case, they must be specified here.
 * @typeparam TChildren Type that determines what children are allowed under the element. It
 * defaults to `any` and usually doesn't need to be specified.
 */
export type ExtendedElement<TRef extends Element = Element,
        TAttrs extends IElementAttrs = IElementAttrs,
        TEvents extends IElementEvents = IElementEvents,
        TChildren = any> =
    ExtendedAttrs<TAttrs> & ExtendedEvents<TEvents> &
    {
        /**
         * Unique key that distinguishes this JSX element from its siblings. The key can be of any type
         * except null, undefined and boolean.
         */
        readonly key?: string | number | bigint | symbol | Function | object;

        /**
         * Reference that will be set to the instance of the element after it is mounted. The
         * reference will be set to undefined after the element is unmounted.
         */
        readonly ref?: RefPropType<TRef>;

        /**
         * Reference that will be set to the element's virtual node after it is created (mounted). The
         * reference will be set to undefined after the element is unmounted.
         */
        readonly vnref?: ElmRefPropType<TRef>;

        /**
         * Update strategy object that determines different aspects of element behavior during updates.
         */
        readonly updateStrategy?: UpdateStrategy;

        /** Children that can be supplied to the element */
        readonly children?: TChildren;
    }



/**
 * This interface is intended to be augmented in order to add to it names of custom Web elements
 * mapped to their corresponding property types.
 */
export interface ICustomWebElements
{
}



/**
 * The IServiceDefinitions interface serves as a mapping between service names and service types.
 * This interface is intended to be augmented by modules that define and/or use specific services.
 * This allows performing service publishing and subscribing in type-safe manner.
 */
export interface IServiceDefinitions
{
	/** Built-in error handling service. */
	"ErrorBoundary": IErrorBoundary;
}



/**
 * The IErrorBoundary interface represents a service that can be invoked when an error -
 * usually an exception - is encountered but cannot be handled locally. A component that implements
 * this service would normally remember the error and update itself, so that in its render method
 * it will present the error to the user.
 *
 * The IErrorBoundary is implemented by the Root Virtual Node as a last resort for error
 * handling.
 */
export interface IErrorBoundary
{
	reportError(err: unknown): void;
}



/**
 * Type of functions scheduled to be called either before or after the update cycle.
 */
export type ScheduledFuncType = (arg?: any) => void;



/**
 * The IManagedComponentProps interface defines standard properties that can be used on managed
 * components, which include `key` and `ref`. These properties are not available for the components
 * themselves and should not be part of the *props* object defined by component authors.
 */
export interface IManagedComponentProps<T extends IComponent>
{
	/**
     * Unique key that distinguishes this JSX element from its siblings. The key can be of any type
     * except null, undefined and boolean.
     */
	readonly key?: string | number | bigint | symbol | Function | object;

    /** Object that receives the reference to the component instance */
    readonly ref?: RefPropType<T>;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Publishing and subscribing to services
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Represents a publication of a service.
 */
export interface IPublication<K extends keyof IServiceDefinitions>
{
    /** Returns the current value of the service */
    value?: IServiceDefinitions[K];

    /** Deletes this publication */
    unpublish(): void;
}



/**
 * Represents a subscription to a service. This interface allows getting the current value of the
 * service and getting notifications on when the value is changed.
 */
export interface ISubscription<K extends keyof IServiceDefinitions>
{
    /** Returns the current value of the service */
    readonly value?: IServiceDefinitions[K];

    /**
     * Attaches the given callback to the "change" event.
     * @param callback Function that will be called when the value of the service changes.
     */
    attach( callback: (value?: IServiceDefinitions[K]) => void): void;

    /**
     * Detaches the given callback from the "change" event.
     * @param callback Function that was attached to the "change" event by the {@link attach} method.
     */
    detach( callback: (value?: IServiceDefinitions[K]) => void): void;

    /** Deletes this subscription */
    unsubscribe(): void;
}



/**
 * The IVNode interface represents a virtual node. Through this interface, callers can perform
 * most common actions that are available on every type of virtual node. Each type of virtual node
 * also implements a more specific interface through which the specific capabilities of the node
 * type are available.
 */
export interface IVNode
{
	/** Gets node's parent. This is undefined for the top-level (root) nodes. */
	readonly parent?: IVNode | null;

	/** Level of nesting at which the node resides relative to the root node. */
	readonly depth?: number;

	/** Component that created this node. */
	readonly creator?: IComponent | null;

	/**
     * Zero-based index of this node in the parent's list of sub-nodes. This is zero for the
     * root nodes that don't have parents.
     */
	readonly index: number;

	/** List of sub-nodes. */
	readonly subNodes?: IVNode[] | null;

	/**
	 * Gets node's display name. This is used mostly for tracing and error reporting. The name
	 * can change during the lifetime of the virtual node; for example, it can reflect an "id"
	 * property of an element.
	 */
	readonly name?: string;



    /**
	 * Retrieves the value for a service with the given ID registered by a closest ancestor
	 * component or the default value if none of the ancestor components registered a service with
	 * this ID. This method doesn't establish a subscription and only reflects the current state.
	 * @param id Unique service identifier
	 * @param defaultValue Default value to return if no publish service is found.
	 * @param useSelf Flag indicating whether the search for the service should start from the
     * virtual node that calls this method. The default value is `false` meaning the search starts
     * from the parent virtual node.
     * @returns Current value of the service or default value if no published service is found.
	 */
	getService<K extends keyof IServiceDefinitions>( id: K, defaultValue?: IServiceDefinitions[K],
					useSelf?: boolean): IServiceDefinitions[K];
}



/**
 * The IClassCompVN interface represents a virtual node for a JSX-based component.
 */
export interface IRootVN extends IVNode
{
	/** Sets the content to be rendered under this root node and triggers update. */
	setContent(content: any): void;
}



/**
 * The IClassCompVN interface represents a virtual node for a JSX-based component.
 */
export interface IClassCompVN extends IVNode
{
	/** Gets the component instance. */
    readonly comp?: IComponent;

    /**
     * Object that is used mainly by the managed components. It keeps the properties first passed
     * to the componet's constructor and then changed when the component is updated through its
     * parent updates.
     */
	readonly props: any;

    /**
     * If the component specifies the {@link CompAPI!withShadow} decorator, the `shadowRoot`
     * property will be set to the shadow root element under which the component's content returned
     * from the `render()` method will be placed. If the component doesn't specify the
     * {@link CompAPI!withShadow} decorator, the `shadowRoot` property will be undefined.
     * Components can access the shadow root via their `vn.shadowRoot` property.
     */
    readonly shadowRoot?: ShadowRoot;

	/**
	 * This method is called by the component to request to be updated.
     */
	updateMe(): void;
}



/**
 * The IElmVN interface represents a virtual node for a DOM element.
 */
export interface IElmVN<T extends Element = Element> extends IVNode
{
	/** Gets the DOM element name. */
	readonly elmName: string;

	/** Gets the DOM element object. */
	readonly elm: Element | null;

    /**
     * Requests update of the element properties without re-rendering of its children.
     * @param props
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
	setProps( props: ExtendedElement<T>, schedulingType?: TickSchedulingType): void;

    /**
     * Replaces the given range of sub-nodes with the new content. The update parameter determines
     * whether the old sub-nodes are simply removed and the new added or the new content is used
     * to update the old sub-nodes.
     * @param content New content to replace the range of old sub-nodes.
     * @param startIndex Index of the first sub-node in the range to be replaced by the new content.
     * If undefined, the default value is 0.
     * @param endIndex Index after the last sub-node in the range to be replaced by the new content.
     * If undefined, the range includes all sub-nodes from startIndex to the end.
     * @param update If false, the old sub-nodes are removed and the new ones are inserted. If true,
     * the reconciliation process is used to update the old sub-nodes with the new ones. The default
     * value is false.
     * @param updateStrategy If the reconciliation process is used (that is, the update parameter
     * is true), determines the update strategy. If undefined, the update strategy of the node
     * itself is used.
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
    setChildren( content?: any, startIndex?: number, endIndex?: number, update?: boolean,
        updateStrategy?: UpdateStrategy, schedulingType?: TickSchedulingType): void;

    /**
     * At the given index, removes a given number of sub-nodes and then inserts the new content.
     * @param index
     * @param countToDelete
     * @param contentToInsert
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
    spliceChildren( index: number, countToDelete?: number, contentToInsert?: any,
        schedulingType?: TickSchedulingType): void;

    /**
     * Moves a range of sub-nodes to a new location.
     * @param index Starting index of the range.
     * @param count Number of sub-nodes in the range.
     * @param shift Positive or negative number of positions the range will be moved.
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
    moveChildren( index: number, count: number, shift: number, schedulingType?: TickSchedulingType): void;

    /**
     * Swaps two ranges of the element's sub-nodes. The ranges cannot intersect.
     * @param index1
     * @param count1
     * @param index2
     * @param count2
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
    swapChildren( index1: number, count1: number, index2: number, count2: number,
        schedulingType?: TickSchedulingType): void;

    /**
     * Retains the given range of the sub-nodes unmounting the sub-nodes outside this range. This
     * method operates similar to the Array.prototype.slice method.
     * @param startIndex Index of the first sub-node in the range. If undefined, the array of
     * sub-nodes starts at index 0.
     * @param endIndex Index of the sub-node after the last sub-node in the range. If
     * this parameter is zero or undefined or greater than the length of the sub-nodes array, the
     * range will include all sub-nodes from the startIndex to the end of the array.
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
    sliceChildren( startIndex: number, endIndex?: number, schedulingType?: TickSchedulingType): void;

    /**
     * Removes the given number of nodes from the start and/or the end of the list of sub-nodes.
     * @param startCount
     * @param endCount
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
    trimChildren( startCount: number, endCount: number, schedulingType?: TickSchedulingType): void;

    /**
     * Adds the given content at the start and/or at the end of the existing children.
     * @param startContent
     * @param endContent
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
    growChildren( startContent?: any, endContent?: any, schedulingType?: TickSchedulingType): void;

    /**
     * Reverses sub-nodes within the given range.
     * @param startIndex Index of the first sub-node in the range. If undefined, the array of
     * sub-nodes starts at index 0.
     * @param endIndex Index of the sub-node after the last sub-node in the range. If
     * this parameter is zero or undefined or greater than the length of the sub-nodes array, the
     * range will include all sub-nodes from the startIndex to the end of the array.
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
    reverseChildren( startIndex?: number, endIndex?: number, schedulingType?: TickSchedulingType): void;
}



/**
 * The ITextVN interface represents a virtual node for a text DOM node.
 */
export interface ITextVN extends IVNode
{
	/** Text of the node. */
	readonly text: string | ITrigger<string>;

	/** Text DOM node. */
	readonly textNode: Text | null;

	/**
     * Requests update of the text.
     * @param text Text to set to the node.
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
	setText( text: string | ITrigger<string>, schedulingType?: TickSchedulingType): void;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Custom attributes
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The ICustomAttributeHandlerClass interface represents a class of handlers of custom attributes
 * that can be applied to intrinsic (HTML or SVG) elements. The requirements on such classes are:
 * 1. Implement a constructor accepting IElmVN, attribute value and attribute name (this allows
 *   the same handler to serve different attributes).
 * 2. Implement the ICustomAttributeHandler interface
 */
export interface ICustomAttributeHandlerClass<T>
{
	/**
	 * Constructs a new custom attribute handler that will act on the given element and provides
	 * the initial value of the attribute. Attribute name is also provided in case the handler
	 * supports different attributes. By the time this constructor is called, the DOM element had
	 * already been created and standard attributes and event listeners had been applied.
	 * @param elmVN Virtual node for this element. The handler can retrieve the DOM element from
	 *   this interface and also use other methods (e.g. subscribe to services).
	 * @param attrVal Initial value of the custom attribute
	 * @param attrName Name of the custom attribute
	 */
	new( elmVN: IElmVN, attrVal: T, attrName?: string): ICustomAttributeHandler<T>;
}



/**
 * The ICustomAttributeHandler interface represents an ability to handle custom properties that can
 * be applied to intrinsic DOM elements.
 */
export interface ICustomAttributeHandler<T = any>
{
	/**
	 * Updates an existing custom attribute with the new value.
	 * @param newPropVal New value of the custom attribute.
	 */
	update(newPropVal: T): void;

	/**
	 * Terminates the functioning of the custom attribute handler. This method is invoked either
	 * when a new rendering of the element doesn't have the attribute anymore or if the element
	 * is removed. Although this method is optional, most handlers will need to implement it to
	 * properly cleanup any resources (e.g. event handlers) to avoid leaks.
	 * @param isRemoval True if the element is being removed and false if the element is being
	 *   updated and the attribute is no longer provided. If the handler adds any event
	 *   listeners to the element, then it has to remove them on update but doen't have to do it
	 *   on element removal.
	 */
	terminate?( isRemoval: boolean): void;
}



/** Type of properties that can be specified for an element. */
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



/**
 * The TickSchedulingType type defines possible ways of scheduling a Mimbl tick.
 */
export const enum TickSchedulingType
{
    /**
     * The tick is executed right away in a synchronous manner. If this scheduled type is specified
     * for a callback, the tick is executed right after the callback returns.
     */
    Sync = 1,

    /** A microtask is scheduled for executing the tick */
    Microtask,

    /** An animation frame is scheduled for executing the tick */
    AnimationFrame,
}


/**
 * Definition of type of method that renders content.
 */
export type RenderMethodType = (arg?: any) => any;



/**
 * Properties to be used with the FunctorProps component.
 */
export interface FunctorProps
{
	/**
     * Function to be called to render content. Functions wrapped by the {@link CompAPI!Functor} component
     * can accept at most one argument.
     */
	func: RenderMethodType;

    /**
     * The "this" argument for calling the function. If it is not provided, the current component
     * is used. This allows passing methods of the current component as rendering functions without
     * the need to bind them to "this".
     */
    thisArg?: any;

    /**
     * Optional argument to be passed to the rendering function. Only one argument is allowed. If
     * there is a need to pass several parameters, use either array or object.
     */
    arg?: any;
}



/**
 * Properties to be used with the Awaiter component.
 */
export interface AwaiterProps
{
	/** Promise that will be watched by the waiting node. */
	promise: Promise<any>;

    /** Optional content that is displayed until the promise is settled */
    children?: any;
}



/**
 * Properties to be used with the Awaiter component.
 */
export interface AwaiterEvents
{
	/**
     * Event fired when the promise is resolved. The `detail` property of the CustomEvent object
     * will be set to the resolved value.
     */
	resolved: CustomEvent<any>;

    /**
     * Event filred whether the promise is rejected. The `detail` property of the CustomEvent object
     * will be set to the rejection error.
     */
    rejected: CustomEvent<any>;
}



