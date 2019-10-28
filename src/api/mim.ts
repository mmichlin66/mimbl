/**
 * Type used to define properties that can be passed to a functional component.
 * 
 * @typeparam TProps Type defining properties that can be passed to the functional component
 *		with these properties. Default type is an empty object (no properties).
 * @typeparam TChildren Type defining components, elements or other objects that can be used
 *		as children for the functional component with these properties. Default is `any`.
 */
export type FuncProps<TProps = {}, TChildren = any> = Readonly<TProps> &
	{
		readonly children?: TChildren;
	};



/**
 * Type of functions representing functional components.
 * 
 * @typeparam TProps Type defining properties that can be passed to this functional component.
 *		Default type is an empty object (no properties).
 * @typeparam TChildren Type defining components, elements or other objects that can be used
 *		as children for this functional component. Default is `any`.
 */
export type FuncCompType<TProps = {}, TChildren = any> = (props: FuncProps<TProps,TChildren>) => any;



/**
 * Type used to define properties that can be passed to a class-based component.
 * 
 * @typeparam TProps Type defining properties that can be passed to the class-based component
 *		with these properties. Default type is an empty object (no properties).
 * @typeparam TChildren Type defining components, elements or other objects that can be used
 *		as children for the class-based component with these properties. Default is `any`.
 */
export type CompProps<TProps = {}, TChildren = any> = Readonly<TProps> &
	{
		readonly children?: TChildren;
	};



/**
 * Interface that defines constructor signature for components.
 * 
 * @typeparam TProps Type defining properties that can be passed to the class-based component
 *		of this type. Default type is an empty object (no properties).
 * @typeparam TChildren Type defining components, elements or other objects that can be used
 *		as children for the class-based component of this type. Default is `any`.
 */
export interface IComponentClass<TProps = {}, TChildren = any>
{
	new( props?: TProps): IComponent<TProps,TChildren>;
	render(): any;
}



/**
 * Interface that must be implemented by all components.
 * 
 * @typeparam TProps Type defining properties that can be passed to this class-based component.
 *		Default type is an empty object (no properties).
 * @typeparam TChildren Type defining components, elements or other objects that can be used
 *		as children for this class-based component. Default is `any`.
 */
export interface IComponent<TProps = {}, TChildren = any>
{
	/**
	 * Component properties passed to the constructor. For managed components, the properties
	 * can also be set (changed) when the component's parent is updated.
	 */
	props?: CompProps<TProps,TChildren>;

	/**
	 * Components can define display name for tracing purposes; if they don't the default name
	 * used is the component's class constructor name. Note that this method can be called before
	 * the virtual node is attached to the component.
	 */
	readonly displayName?: string;

	/**
	 * Sets, gets or clears the virtual node object of the component. This property is set twice:
	 *  1. Before the component is rendered for the first time: the component must remember the
	 *    passed object.
	 *  2. Before the component is destroyed: null is passed as a parameter and the component must
	 *    release the remembered object.
	 */
	vn?: IVNode;

	/** Returns the component's content that will be ultimately placed into the DOM tree. */
	render(): any;

	/**
	 * Notifies that the component is about to render its content for the first time. This method
	 * is called when the virtual node has already been set so the component can request services
	 * from it.
	 */
	willMount?(): void;

	/**
	 * Notifies that the component's content is going to be removed from the DOM tree. After
	 * this method returns the component is destroyed.
	 */
	willUnmount?(): void;

	/**
	 * Optional method that is called before any components that are scheduled to be updated in
	 * a Mimbl tick, are updated. If implemented, this method will be called every time the
	 * component is scheduled to be updated. This method can read DOM layout information (e.g.
	 * element measurements) without the risk of causing forced layouts.
	 */
	beforeUpdate?(): void;

	/**
	 * Optional method that is called after al components that are scheduled to be updated in
	 * a Mimbl tick, are updated. If implemented, this method will be called every time the
	 * component is scheduled to be updated. This method is called after all modifications to
	 * DOM resulting from updaing components have been already done.
	 */
	afterUpdate?(): void;

	/**
	 * This method is only used by managed components.
	 * 
	 * Informs the component that new properties have been specified. At the time of the call
	 * this.props refers to the "old" properties. If the component returns true,then its render
	 * method will be called. At that time,the original props object that was passed into the
	 * component's constructor will have these new properties. If the component doesn't implement
	 * the shouldUpdate method it is as though true is returned. If the component returns
	 * false, the render method is not called and the DOM tree of the component remains unchanged.
	 * The properties of the component, however, still change.
	 * @param newProps The new properties that the parent component provides to this component.
	 * @returns True if the component should have its render method called and false otherwise.
	 */
	shouldUpdate?( newProps: CompProps<TProps,TChildren>): boolean;

	/**
	 * Handles an exception that occurred during the component's own rendering or rendering of
	 * one of its descendants. If this method is not implemented or if it throws an error, the
	 * error will be propagated up the chain of components until it reaches a component that
	 * handles it. If none of the components can handle the error, the entire tree will be
	 * unmounted.
	 * @param err An exception that was thrown during the component's own rendering or rendering
	 * of one of its descendants.
	 * @param path An array of names of components and elements from the mounted root to the
	 * component that threw the exception. This path is provided mostly for debugging and tracing
	 * purposes.
	 */
	handleError?( err: any, path: string[]): void;

	/**
	 * Retrieves update strategy object that determines different aspects of component behavior
	 * during updates.
	 */
	getUpdateStrategy?(): UpdateStrategy;
}



/**
 * The UpdateStrategy object specifies different aspects of update behavior of components and
 * elements.
 */
export type UpdateStrategy = 
{
	/**
	 * Flag determining whether non-matching new keyed sub-nodes are allowed to recycle non-
	 * matching old keyed sub-nodes. Here "non-matching" means those new or old nodes for which
	 * no old or new sub-nodes respectively were found. If this flag is false, then non-matching
	 * old sub-nodes will be removed and non-matching new sub-nodes will be inserted. If this
	 * flag is true, then non-matching old sub-nodes will be updated by the non-matching new
	 * sub-nodes - provided that the types of sub-nodes are the same.
	 * 
	 * If keyed sub-nodes recycling is allowed it can speed up an update process because
	 * less DOM nodes get removed and inserted, which is more expensive than updating. However,
	 * this can have some adverse effects under cirtain circumstances if certain data is bound
	 * to the particular instances of DOM nodes.
	 * 
	 * The flag's default value is true.
	 */
	allowKeyedNodeRecycling?: boolean;
};


/**
 * Type of functions scheduled to be called either before or after the update cycle.
 */
export type ScheduledFuncType = () => void;



/**
 * Defines event handler that is invoked when reference value changes.
 */
export type RefFunc<T> = (newRef: T) => void;



import {IEventSlot, EventSlot} from "../utils/EventSlot"



/**
 * Reference class to use whenever a reference to an object is needed - for example, with JSX `ref`
 * attributes and services.
 */
export class Ref<T>
{
	private _r: T;

	/** Event that is fired when the referenced value changes */
	private changedEvent: IEventSlot<RefFunc<T>> = new EventSlot<RefFunc<T>>();

	constructor( listener?: RefFunc<T>, initialReferene?: T)
	{
		if (listener !== undefined)
			this.changedEvent.add( listener);

		this._r = initialReferene;
	}

	/** Adds a callback that will be invoked when the value of the reference changes. */
	public addListener( listener: RefFunc<T>)
	{
		this.changedEvent.add( listener);
	}

	/** Removes a callback that was added with addListener. */
	public removeListener( listener: RefFunc<T>)
	{
		this.changedEvent.remove( listener);
	}

	/** Get accessor for the reference value */
	public get r(): T { return this._r; }

	/** Set accessor for the reference value */
	public set r( newRef: T)
	{
		if (this._r !== newRef)
		{
			this._r = newRef;
			this.changedEvent.fire( newRef);
		}
	}

	/** Clears the reference value and also clears all all registered listeners */
	public clear(): void
	{
		this._r = undefined;
		this.changedEvent.clear();
	}
}



/**
 * The IServiceDefinitions interface serves as a mapping between service names and service types.
 * This interface is intended to be augmented by modules that define and/or use specific services.
 * This allows performing service publishing and subscribing in type-safe manner.
 */
export interface IServiceDefinitions
{
	/** Built-in error handling service. */
	"StdErrorHandling": IErrorHandlingService;

	/**
	 * Built-in service for lazy people - can be used for quick prototypes without the need to
	 * augment the interface.
	 */
	"any": any;
}



/**
 * The IErrorHandlingService interface represents a service that can be invoked when an error -
 * usually an exception - is encountered but cannot be handled locally. A component that implements
 * this service would normally remember the error and request to update itself,so that in its
 * render method it will present the error to the user.
 *
 * The IErrorHandlingService is implemented by the Root Virtual Node as a last resort for error
 * handling. The Root VN will display a simple UI showing the error and will allow the user to
 * restart - in the hope that the error will not repeat itself.
 */
export interface IErrorHandlingService
{
	reportError( err: any, path: string[]): void;
}



// ///////////////////////////////////////////////////////////////////////////////////////////////////
// //
// // Decorator function for creating reference properties without the need to manually create
// // Ref<> instances. This allows for the following code pattern:
// //
// //	class A extends Component
// //	{
// //		@ref myDiv: HTMLDivElement;
// //		render() { return <div ref={myDiv}>Hello</div>; }
// //	}
// //
// // In the above example, the myDiv property will be automatically created when first accessed. The
// // actual object will be a Proxy to Ref<> of the given type (HTMLDivElement in this case).
// //
// ///////////////////////////////////////////////////////////////////////////////////////////////////
// export function ref( target, name)
// {
// 	function refGet( obj, key)
// 	{
// 		if (key === "r")
// 			return obj.r;
// 		else
// 			return obj.r[key];
// 	}

// 	function refSet( obj, key, val, receiver): boolean
// 	{
// 		if (key === "r")
// 			obj.r = val;
// 		else
// 			obj.r[key] = val;

// 		return true;
// 	}

// 	function ensureProxy( thisObj: any, attrName: string): any
// 	{
// 		let proxy = thisObj[attrName];
// 		if (!proxy)
// 		{
// 			proxy = new Proxy( new Ref<any>(), { get: refGet, set: refSet });
// 			thisObj[attrName] = proxy;
// 		}
// 		return proxy;
// 	}

// 	let attrName = "_ref_" + name;
// 	Object.defineProperty( target, name,
// 		{
// 			set( val) { ensureProxy( this, attrName).r = val; },
// 			get() { return ensureProxy( this, attrName); }
// 		}
// 	);
// }



/**
 * Type of ref property that can be passed to JSX elements and components. This can be either the
 * [[Ref]] class or [[RefFunc]] function.
 */
export type RefPropType<T = any> = Ref<T> | RefFunc<T>;



/**
 * Helper function to set the value of the reference that takes care of the different types of
 * references. The optional `onlyIf` parameter may specify a value so that only if the reference
 * currently has the same value it will be replaced. This might be needed to not clear a
 * reference if it already points to a different object.
 * @param ref [[Ref]] object to which the new value will be set
 * @param val Reference value to set to the Ref object
 * @param onlyIf An optional value to which to compare the current (old) value of the reference.
 * The new value will be set only if the old value equals the `onlyIf` value.
 */
export function setRef<T>( ref: RefPropType<T>, val: T, onlyIf?: T): void
{
	if (typeof ref === "object")
	{
		let refObj = ref as Ref<T>;
		if (onlyIf === undefined || refObj.r === onlyIf)
			refObj.r = val;
	}
	else if (typeof ref === "function")
		(ref as RefFunc<T>)(val);
}



/**
 * Decorator function for defining properties with a set method that calls the updateMe method
 * whenever the property value changes.
 *	```tsx
 *	class Child extends Component
 *	{
 *		@mim.updatable text: string = "Hello!";
 *		render()
 *		{
 *	 		return <div>{text}</div>
 *		}
 *	}
 *
 *	class Parent extends Component
 *	{
 *		child = new Child();
 *		render()
 *		{
 *			return <div click={() => this.child.text += " again"}>{this.child}</div>
 *		}
 *	}
 *	```
 * In the above example, the Child component will be re-rendered when its `text` property changes.
 * 
 * @param target 
 * @param name 
 */
export function updatable( target, name: string)
{
	let attrName = "_m_" + name;
	Object.defineProperty( target, name,
		{
			set( val)
			{
				if (this[attrName] !== val)
				{
					this[attrName] = val;
					let vn: IVNode = this.vn;
					if (vn && !vn.updateRequested)
						this.vn.requestUpdate();
				}
			},
			get() { return this[attrName]; }
		}
	);
}



/**
 * An artificial "Fragment" component that is only used as a temporary collection of other items
 * in places where JSX only allows a single item. Our JSX factory function creates a virtual node
 * for each of its children and the function is never actually called. This function is only needed
 * because currently TypeScript doesn't allow the `<>` fragment notation if a custom JSX factory
 * function is used.
 *
 * Use it as follows:
 * ```tsx
 *	import * as mim from "mimbl"
 *	.....
 *	render()
 *	{
 *		return <mim.Fragment>
 *			<div1/>
 *			<div2/>
 *			<div3/>
 *		</mim.Fragment>
 *	}
  ```

 * @param props 
 */
export function Fragment( props: CompProps<{}>): any {}



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
 * be applied to intrinsic (HTML or SVG) elements.
 */
export interface ICustomAttributeHandler<T>
{
	/**
	 * Updates an existing custom attribute with the new value.
	 * @param newPropVal New value of the custom attribute.
	 * @returns True if changes were made and false otherwise.
	 */
	update( newPropVal: T): boolean;

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



/** Defines types of virtual DOM nodes */
export const enum VNType
{
	/** Top-level node */
	Root,

	/** Class-based (state-full) component created via new */
	IndependentComp,

	/** Class-based (state-full) component laid out using JSX */
	ManagedComp,

	/** Stateless component (simple rendering function accepting props) */
	FuncComp,

	/** DOM element (HTML or SVG) laid out using JSX. */
	Elm,

	/** Text node */
	Text,
}



/**
 * The IVNode interface represents a virtual node. Through this interface, callers can perform
 * most common actions that are available on every type of virtual node. Each type of virtual node
 * also implements a more specific interface through which the specific capabilities of the node
 * type are available.
 */
export interface IVNode
{
	/** Gets node type. */
	readonly type: VNType;

	/** Gets node's parent. This is undefined for the top-level (root) nodes. */
	readonly parent?: IVNode;

	/** Reference to the next sibling node or undefined for the last sibling. */
	readonly next?: IVNode;

	/** Reference to the previous sibling node or undefined for the first sibling. */
	readonly prev?: IVNode;

	/** List of sub-nodes. */
	readonly subNodes?: IVNode[];

	/**
	 * Gets node's display name. This is used mostly for tracing and error reporting. The name
	 * can change during the lifetime of the virtual node; for example, it can reflect an "id"
	 * property of an element.
	 */
	readonly name?: string;

	// Flag indicating that update has been requested but not yet performed. This flag is needed
	// to prevent trying to add the node to the global map every time the requestUpdate method
	// is called. 
	readonly updateRequested: boolean;



	/** This method is called by the component when it needs to be updated. */
	requestUpdate(): void;

	/**
	 * Schedules to call the given function before all the scheduled components have been updated.
	 * @param func Function to be called.
	 * @param that Object to be used as the "this" value when the function is called. This parameter
	 *   is not needed if the function is already bound or it is an arrow function.
	 */
	scheduleCallBeforeUpdate( func: ScheduledFuncType, that?: object): void;

	/**
	 * Schedules to call the given function before all the scheduled components have been updated.
	 * @param func Function to be called.
	 * @param that Object to be used as the "this" value when the function is called. This parameter
	 *   is not needed if the function is already bound or it is an arrow function.
	 */
	scheduleCallAfterUpdate( func: ScheduledFuncType, that?: object): void;



	/**
	 * Registers an object of any type as a service with the given ID that will be available for
	 * consumption by descendant components.
	 */
	publishService<K extends keyof IServiceDefinitions>( id: K, service: IServiceDefinitions[K]): void;

	/** Unregisters a service with the given ID. */
	unpublishService<K extends keyof IServiceDefinitions>( id: K): void;

	/**
	 * Subscribes to a service with the given ID. If the service with the given ID is registered
	 * by this or one of the ancestor components, the passed Ref object will reference it;
	 * otherwise, the Ref object will be set to the defaultValue (if specified) or will remain
	 * undefined. Whenever the value of the service that is registered by this or a closest
	 * ancestor component is changed,the Ref object will receive the new value.
	 * The useSelf optional parameter determines whether the component can subscribe to the
	 * service published by itself. The default is false.
	 * @param id 
	 * @param ref 
	 * @param defaultService 
	 * @param useSelf 
	 */
	subscribeService<K extends keyof IServiceDefinitions>( id: K, ref: RefPropType<IServiceDefinitions[K]>,
					defaultService?: IServiceDefinitions[K], useSelf?: boolean): void;

	/**
	 * Unsubscribes from a service with the given ID. The Ref object that was used to subscribe
	 * will be set to undefined.
	 * @param id 
	 */
	unsubscribeService<K extends keyof IServiceDefinitions>( id: K): void;

	/**
	 * Retrieves the value for a service with the given ID registered by a closest ancestor
	 * component or the default value if none of the ancestor components registered a service with
	 * this ID. This method doesn't establish a subscription and only reflects the current state.
	 * @param id 
	 * @param defaultService 
	 * @param useSelf 
	 */
	getService<K extends keyof IServiceDefinitions>( id: K, defaultService?: IServiceDefinitions[K],
					useSelf?: boolean): IServiceDefinitions[K];



	/**
	 * Creates a wrapper function with the same signature as the given callback so that if the original
	 * callback throws an exception, it is processed by the Mimbl error handling mechanism so that the
	 * exception bubbles from this virtual node up the hierarchy until a node/component that knows to
	 * handle errors is found.
	 * 
	 * This function should be called by the code that is not part of any component but still has access
	 * to the IVNode object; for example, custom attribute handlers. Components that derive from the
	 * mim.Component class should use the wrapCallback method of the mim.Component class.
	 * 
	 * Use this method before passing callbacks to document and window event handlers as well as
	 * non-DOM objects that use callbacks, e.g. promises. For example:
	 * 
	 * ```typescript
	 *	class ResizeMonitor
	 *	{
	 *		private onWindowResize(e: Event): void {};
	 *
	 * 		wrapper: (e: Event): void;
	 * 
	 * 		public startResizeMonitoring( vn: IVNode)
	 *		{
	 *			this.wrapper = vn.wrapCallback( this.onWindowResize, this);
	 *			window.addEventListener( "resize", this.wrapper);
	 *		}
	 * 
	 * 		public stopResizeMonitoring()
	 *		{
	 *			window.removeEventListener( "resize", this.wrapper);
	 *			this.wrapper = undefined;
	 *		}
	 *	}
	 * ```
	 * 
	 * @param callback Callback to be wrapped
	 * @returns Function that has the same signature as the given callback and that should be used
	 *     instead of the original callback
	 */
	wrapCallback<T extends Function>( callback: T, that?: object): T;
}



/**
 * The IClassCompVN interface represents a virtual node for a JSX-based component.
 */
export interface IClassCompVN extends IVNode
{
	/** Gets the component instance. */
	readonly comp: IComponent;
}



/**
 * The IManagedCompVN interface represents a virtual node for a JSX-based component.
 */
export interface IManagedCompVN extends IVNode
{
	/** Gets the component class. */
	readonly compClass: IComponentClass;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The IIndependentCompVN interface represents a virtual node for a component.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface IIndependentCompVN extends IVNode
{
}



/**
 *  The IElmVN interface represents a virtual node for a DOM element.
 */
export interface IElmVN extends IVNode
{
	/** Gets the DOM element name. */
	readonly elmName: string;

	/** Gets the flag indicating whether this element is an SVG (as opposed to HTML). */
	readonly isSvg: boolean;

	/** Gets the DOM element object. */
	readonly elm: Element;

	/** Component that created this element in its render method (or undefined). */
	readonly creator: IComponent;
}



/**
 * The ITextVN interface represents a virtual node for a text DOM node.
 */
export interface ITextVN extends IVNode
{
	/** Text of the node. */
	text: string;

	/** Text DOM node. */
	textNode: Text;
}



/**
 * The Slice type defines an object structure describing
 * parameters for rendering an element. They include: Class, Style, Properties, Content. This
 * structure is intended to be passed either in the constructor or via the protected methods of
 * derived classes, so that they can control parameters of elements rendered by the upper classes.
 * The main purpose of this structure is to combine parameters defining an element into a single
 * object to minimize the number of properties callers of classes should deal with.
 */
export type Slice =
{
	className?: string;
	style?: StylePropType;
	props?: object
	content?: any;
};



/**
 *  Type for the `style` element property.
 */
export type StylePropType = Partial<CSSStyleDeclaration>;



/**
 * Type of event handler function for DOM events of type T.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export type EventFuncType<T extends Event> = (e: T) => void;

/**
 * Tuple combining the event handler type and object that will be bound as "this" when the handler
 * is invoked.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export type EventFuncAndThisType<T extends Event> = [EventFuncType<T>, object];

/**
 * Tuple combining the event handler type and the Boolean flag indicating whether the event
 * handler should be attached to the capture (true) or to the bubble (false) phase.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export type EventFuncAndFlagType<T extends Event> = [EventFuncType<T>, boolean];

/**
 * Tuple combining the event handler type, object that will be bound as "this" when the handler
 * is invoked and the Boolean flag indicating whether the event handler should be attached to the
 * capture (true) or to the bubble (false) phase.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export type EventFuncAndThisAndFlagType<T extends Event> = [EventFuncType<T>, object, boolean];

/**
 * Union type that can be passed to an Element's event.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export type EventPropType<T extends Event> = EventFuncType<T> | EventFuncAndThisType<T> |
				EventFuncAndFlagType<T> | EventFuncAndThisAndFlagType<T>;



/**
 * The ICommonProps interface defines standard properties that can be used on all JSX elements -
 * intrinsic (HTML and SVG) as well as functional and class-based components.
 */
export interface ICommonProps
{
	/** Unique key that distinguishes this JSX element from its siblings. The key can be of any type. */
	key?: any;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Definitions of property types used by HTML and SVG elements.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Type that is used to specify color values for different style properties.
 */
export type ColorPropType = string;
export type CrossoriginPropType = "anonymous" | "use-credentials";
export type FormenctypePropType = "application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain";
export type FormmethodPropType = "get" | "post" | "dialog";
export type FormtargetPropType = string | "_self" | "_blank" | "_parent"| "_top";
export type ReferrerPolicyPropType = "no-referrer" | "no-referrer-when-downgrade" | "origin" |
		"origin-when-cross-origin" | "unsafe-url";

/**
 * The IElementProps interface defines standard properties (attributes and event listeners)
 * that can be used on all HTML and SVG elements.
 */
export interface IElementProps<TRef,TChildren = any> extends ICommonProps
{
	/**
	 * Reference that will be set to the instance of the element after it is created (mounted). The
	 * reference will be set to undefined after the element is unmounted.
	 */
	ref?: RefPropType<TRef>;

	/**
	 * Update strategy object that determines different aspects of element behavior during updates.
	 */
	updateStrategy?: UpdateStrategy;

	/** Children that can be supplied to the element */
	children?: TChildren;

	// standard HTML and SVG element properties
	class?: string
	draggable?: boolean;
	dropzone ?: "copy" | "move" | "link";
	id?: string | number;
	lang?: string;
	role?: string;
	style?: StylePropType;
	tabindex?: number;

	// global events
	abort?: EventPropType<UIEvent>;
	animationcancel?: EventPropType<AnimationEvent>;
	animationend?: EventPropType<AnimationEvent>;
	animationiteration?: EventPropType<AnimationEvent>;
	animationstart?: EventPropType<AnimationEvent>;
	auxclick?: EventPropType<Event>;
	blur?: EventPropType<FocusEvent>;
	cancel?: EventPropType<Event>;
	canplay?: EventPropType<Event>;
	canplaythrough?: EventPropType<Event>;
	change?: EventPropType<Event>;
	click?: EventPropType<MouseEvent>;
	close?: EventPropType<Event>;
	contextmenu?: EventPropType<MouseEvent>;
	cuechange?: EventPropType<Event>;
	dblclick?: EventPropType<MouseEvent>;
	durationchange?: EventPropType<Event>;
	emptied?: EventPropType<Event>;
	ended?: EventPropType<Event>;
	error?: EventPropType<ErrorEvent>;
	focus?: EventPropType<FocusEvent>;
	gotpointercapture?: EventPropType<PointerEvent>;
	input?: EventPropType<Event>;
	invalid?: EventPropType<Event>;
	keydown?: EventPropType<KeyboardEvent>;
	keypress?: EventPropType<KeyboardEvent>;
	keyup?: EventPropType<KeyboardEvent>;
	load?: EventPropType<Event>;
	loadeddata?: EventPropType<Event>;
	loadedmetadata?: EventPropType<Event>;
	loadend?: EventPropType<ProgressEvent>;
	loadstart?: EventPropType<Event>;
	lostpointercapture?: EventPropType<PointerEvent>;
	mousedown?: EventPropType<MouseEvent>;
	mouseenter?: EventPropType<MouseEvent>;
	mouseleave?: EventPropType<MouseEvent>;
	mousemove?: EventPropType<MouseEvent>;
	mouseout?: EventPropType<MouseEvent>;
	mouseover?: EventPropType<MouseEvent>;
	mouseup?: EventPropType<MouseEvent>;
	pause?: EventPropType<Event>;
	play?: EventPropType<Event>;
	playing?: EventPropType<Event>;
	pointercancel?: EventPropType<PointerEvent>;
	pointerdown?: EventPropType<PointerEvent>;
	pointerenter?: EventPropType<PointerEvent>;
	pointerleave?: EventPropType<PointerEvent>;
	pointermove?: EventPropType<PointerEvent>;
	pointerout?: EventPropType<PointerEvent>;
	pointerover?: EventPropType<PointerEvent>;
	pointerup?: EventPropType<PointerEvent>;
	progress?: EventPropType<ProgressEvent>;
	ratechange?: EventPropType<Event>;
	reset?: EventPropType<Event>;
	resize?: EventPropType<UIEvent>;
	scroll?: EventPropType<UIEvent>;
	//securitypolicyviolation?: EventPropType<SecurityPolicyViolationEvent>;
	seeked?: EventPropType<Event>;
	seeking?: EventPropType<Event>;
	select?: EventPropType<UIEvent>;
	stalled?: EventPropType<Event>;
	submit?: EventPropType<Event>;
	suspend?: EventPropType<Event>;
	timeupdate?: EventPropType<Event>;
	toggle?: EventPropType<Event>;
	touchcancel?: EventPropType<TouchEvent>;
	touchend?: EventPropType<TouchEvent>;
	touchenter?: EventPropType<TouchEvent>;
	touchleave?: EventPropType<TouchEvent>;
	touchmove?: EventPropType<TouchEvent>;
	touchstart?: EventPropType<TouchEvent>;
	transitioncancel?: EventPropType<TransitionEvent>;
	transitionend?: EventPropType<TransitionEvent>;
	transitionrun?: EventPropType<TransitionEvent>;
	transitionstart?: EventPropType<TransitionEvent>;
	volumechange?: EventPropType<Event>;
	waiting?: EventPropType<Event>;
	wheel?: EventPropType<WheelEvent>;

	// Element's events
	fullscreenchange?: EventPropType<Event>;
	fullscreenerror?: EventPropType<Event>;

	// Document's and Element's events
	copy?: EventPropType<ClipboardEvent>;
	cut?: EventPropType<ClipboardEvent>;
	paste?: EventPropType<ClipboardEvent>;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Utility functions for determining whether an element is an SVG.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Determines whether the given element is one of the elements from the SVG spec; that is, <svg>
 * or any other from SVG.
 * @param elm Element to test
 */
export function isSvg( elm: Element): boolean
{
	return "ownerSVGElement" in (elm as any);
}



/**
 * Determines whether the given element is the <svg> element.
 * @param elm  Element to test
 */
export function isSvgSvg( elm: Element): boolean
{
	return elm.tagName === "svg";
	// return (elm as any).ownerSVGElement === null;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// JSX namespace defining how TypeScript performs type checks on JSX elements,components
// properties and children.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
import * as html from "./HtmlTypes";
import * as svg from "./SvgTypes";



/**
 * Namespace defining interfaces used by TypeScript to type-check JSX expressions.
 */
export namespace JSX
{
	// // tslint:disable-next-line:no-empty-interface
	// export interface Element extends IVNode[] {}

	// tslint:disable-next-line:no-empty-interface
	export interface ElementClass extends IComponent {}

	export interface ElementAttributesProperty { props: {} }

	export interface ElementChildrenAttribute { children: any }
	
	export interface IntrinsicElements
	{
		// HTML elements
		a: html.IHtmlAElementProps;
		abbr: html.IHtmlElementProps;
		acronym: html.IHtmlElementProps;
		address: html.IHtmlElementProps;
		applet: html.IHtmlAppletElementProps;
		area: html.IHtmlAreaElementProps;
		article: html.IHtmlElementProps;
		aside: html.IHtmlElementProps;
		audio: html.IHtmlAudioElementProps;

		b: html.IHtmlElementProps;
		base: html.IHtmlBaseElementProps;
		basefont: html.IHtmlBasefontElementProps;
		bdi: html.IHtmlElementProps;
		bdo: html.IHtmlElementProps;
		big: html.IHtmlElementProps;
		blockquote: html.IHtmlBlockquoteElementProps;
		body: html.IHtmlElementProps;
		br: html.IHtmlBrElementProps;
		button: html.IHtmlButtonElementProps;

		canvas: html.IHtmlCanvasElementProps;
		caption: html.IHtmlCaptionElementProps;
		center: html.IHtmlElementProps;
		cite: html.IHtmlElementProps;
		code: html.IHtmlElementProps;
		col: html.IHtmlColElementProps;
		colgroup: html.IHtmlColgroupElementProps;

		data: html.IHtmlDataElementProps;
		datalist: html.IHtmlDataListElementProps;
		dd: html.IHtmlDdElementProps;
		del: html.IHtmlDelElementProps;
		details: html.IHtmlDetailsElementProps;
		dfn: html.IHtmlElementProps;
		dialog: html.IHtmlDialogElementProps;
		dir: html.IHtmlDirElementProps;
		div: html.IHtmlDivElementProps;
		dl: html.IHtmlDlElementProps;
		dt: html.IHtmlElementProps;

		em: html.IHtmlElementProps;
		embed: html.IHtmlEmbedElementProps;

		fieldset: html.IHtmlFieldsetElementProps;
		figcaption: html.IHtmlElementProps;
		figure: html.IHtmlElementProps;
		font: html.IHtmlFontElementProps;
		footer: html.IHtmlElementProps;
		form: html.IHtmlFormElementProps;
		frame: html.IHtmlFrameElementProps;
		frameset: html.IHtmlFramesetElementProps;

		h1: html.IHtmlH1ElementProps;
		h2: html.IHtmlH2ElementProps;
		h3: html.IHtmlH3ElementProps;
		h4: html.IHtmlH4ElementProps;
		h5: html.IHtmlH5ElementProps;
		h6: html.IHtmlH6ElementProps;
		head: html.IHtmlHeadElementProps;
		header: html.IHtmlElementProps;
		hgroup: html.IHtmlElementProps;
		hr: html.IHtmlHrElementProps;
		html: html.IHtmlHtmlElementProps;

		i: html.IHtmlElementProps;
		iframe: html.IHtmlIframeElementProps;
		img: html.IHtmlImgElementProps;
		input: html.IHtmlInputElementProps;
		ins: html.IHtmlInsElementProps;

		kbd: html.IHtmlElementProps;
		keygen: html.IHtmlElementProps;

		label: html.IHtmlLabelElementProps;
		legend: html.IHtmlLegendElementProps;
		li: html.IHtmlLiElementProps;
		link: html.IHtmlLinkElementProps;
		listing: html.IHtmlListingElementProps;

		main: html.IHtmlElementProps;
		map: html.IHtmlMapElementProps;
		mark: html.IHtmlElementProps;
		menu: html.IHtmlMenuElementProps;
		menuitem: html.IHtmlElementProps;
		meta: html.IHtmlMetaElementProps;
		meter: html.IHtmlMeterElementProps;

		nav: html.IHtmlElementProps;
		nobr: html.IHtmlElementProps;
		noframes: html.IHtmlElementProps;
		noscript: html.IHtmlElementProps;

		object: html.IHtmlObjectElementProps;
		ol: html.IHtmlOlElementProps;
		optgroup: html.IHtmlOptgroupElementProps;
		option: html.IHtmlOptionElementProps;
		output: html.IHtmlOutputElementProps;

		p: html.IHtmlPElementProps;
		param: html.IHtmlParamElementProps;
		picture: html.IHtmlPictureElementProps;
		pre: html.IHtmlPreElementProps;
		progress: html.IHtmlProgressElementProps;

		q: html.IHtmlQElementProps;

		rb: html.IHtmlElementProps;
		rp: html.IHtmlElementProps;
		rt: html.IHtmlElementProps;
		rtc: html.IHtmlElementProps;
		ruby: html.IHtmlElementProps;

		s: html.IHtmlElementProps;
		samp: html.IHtmlElementProps;
		script: html.IHtmlScriptElementProps;
		section: html.IHtmlElementProps;
		select: html.IHtmlSelectElementProps;
		slot: html.IHtmlSlotElementProps;
		small: html.IHtmlElementProps;
		source: html.IHtmlSourceElementProps;
		span: html.IHtmlSpanElementProps;
		strike: html.IHtmlElementProps;
		strong: html.IHtmlElementProps;
		style: html.IHtmlStyleElementProps;
		sub: html.IHtmlElementProps;
		summary: html.IHtmlElementProps;
		sup: html.IHtmlElementProps;

		table: html.IHtmlTableElementProps;
		tbody: html.IHtmlTbodyElementProps;
		td: html.IHtmlTdElementProps;
		template: html.IHtmlTemplateElementProps;
		textarea: html.IHtmlTextareaElementProps;
		tfoot: html.IHtmlTfootElementProps;
		th: html.IHtmlThElementProps;
		thead: html.IHtmlTHeadElementProps;
		time: html.IHtmlTimeElementProps;
		title: html.IHtmlTitleElementProps;
		tr: html.IHtmlTrElementProps;
		track: html.IHtmlTrackElementProps;
		tt: html.IHtmlElementProps;

		u: html.IHtmlElementProps;
		ul: html.IHtmlUlElementProps;

		var: html.IHtmlElementProps;
		video: html.IHtmlVideoElementProps;

		wbr: html.IHtmlElementProps;

		xmp: html.IHtmlXmpElementProps;

		// SVG elements
		svg: svg.ISvgSvgElementProps;

		svgA: svg.ISvgAElementProps;
		animate: svg.ISvgConditionalProcessingProps | svg.ISvgAnimationProps;
		animateMotion: svg.ISvgAnimateMotionElementProps;
		animateTarnsform: svg.ISvgConditionalProcessingProps | svg.ISvgAnimationProps;

		circle: svg.ISvgCircleElementProps;
		clipPath: svg.ISvgClipPathElementProps;
		colorProfile: svg.ISvgColorProfilePathElementProps;

		defs: svg.ISvgElementProps;
		desc: svg.ISvgElementProps;
		discard: svg.ISvgDiscardElementProps;

		ellipse: svg.ISvgEllipseElementProps;

		feBlend: svg.ISvgFeBlendElementProps;
		feColorMatrix: svg.ISvgFeColorMatrixElementProps;
		feComponentTransfer: svg.ISvgFeComponentTransferElementProps;
		feComposite: svg.ISvgFeCompositeElementProps;
		feConvolveMatrix: svg.ISvgFeConvolveMatrixElementProps;
		feDiffuseLighting: svg.ISvgFeDiffuseLightingElementProps;
		feDisplacementMap: svg.ISvgFeDisplacementMapElementProps;
		feDistantLight: svg.ISvgFeDistantLightElementProps;
		feDropShadow: svg.ISvgFeDropShadowElementProps;
		feFlood: svg.ISvgFeFloodElementProps;
		feFuncA: svg.ISvgTransferFunctionsProps;
		feFuncB: svg.ISvgTransferFunctionsProps;
		feFuncG: svg.ISvgTransferFunctionsProps;
		feFuncR: svg.ISvgTransferFunctionsProps;
		feGaussianBlur: svg.ISvgFeGaussianBlurElementProps;
		feImage: svg.ISvgFeImageElementProps;
		feMerge: svg.ISvgPresentationProps | svg.ISvgFilterPrimitiveProps;
		feMergeNode: svg.ISvgFeMergeNodeElementProps;
		feMorphology: svg.ISvgFeMorphologyElementProps;
		feOffset: svg.ISvgFeOffsetElementProps;
		fePointLight: svg.ISvgFePointLightElementProps;
		feSpecularLighting: svg.ISvgFeSpecularLightingElementProps;
		feSpotLight: svg.ISvgFeSpotLightElementProps;
		feTile: svg.ISvgFeTileElementProps;
		feTurbulence: svg.ISvgFeTurbulenceElementProps;
		filter: svg.ISvgFilterElementProps;
		foreignObject: svg.ISvgForeignObjectElementProps;

		g: svg.ISvgConditionalProcessingProps | svg.ISvgPresentationProps;

		hatch: svg.ISvgHatchElementProps;
		hatchpath: svg.ISvgHatchpathElementProps;

		image: svg.ISvgImageElementProps;

		line: svg.ISvgLineElementProps;
		linearGradient: svg.ISvgLinearGradientElementProps;

		marker: svg.ISvgMarkerElementProps;
		mask: svg.ISvgMaskElementProps;
		metadata: svg.ISvgElementProps;
		mpath: svg.ISvgMPathElementProps;

		path: svg.ISvgPathElementProps;
		pattern: svg.ISvgPatternElementProps;
		polygon: svg.ISvgPolygonElementProps;
		polyline: svg.ISvgPolylineElementProps;

		radialGradient: svg.ISvgRadialGradientElementProps;
		rect: svg.ISvgRectElementProps;

		svgScript: svg.ISvgScriptElementProps;
		set: svg.ISvgSetElementProps;
		solidcolor: svg.ISvgElementProps;
		stop: svg.ISvgStopElementProps;
		svgStyle: svg.ISvgStyleElementProps;
		switch: svg.ISvgConditionalProcessingProps | svg.ISvgPresentationProps;
		symbol: svg.ISvgSymbolElementProps;

		text: svg.ISvgTextElementProps;
		textPath: svg.ISvgTextPathElementProps;
		svgTitle: svg.ISvgElementProps;
		textSpan: svg.ISvgTextSpanElementProps;

		use: svg.ISvgUseElementProps;

		view: svg.ISvgViewElementProps;

		//[elemName: string]: any
	}

	// tslint:disable-next-line:no-empty-interface
	// Properties in this interface apply to intrinsic elements and to functional components.
	export interface IntrinsicAttributes extends ICommonProps {}

	// Properties in this interface apply to class-based components.
	export interface IntrinsicClassAttributes<T> extends ICommonProps
	{
		// Reference that will be set to the instance of the component after it is mounted. The
		// reference will be set to undefined after the component is unmounted.
		ref?: RefPropType<T>;
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Definition of mim.jsx function - JSX Factory
//
///////////////////////////////////////////////////////////////////////////////////////////////////
import {createNodesFromJSX} from "../core/ContentFuncs"

/**
 * JSX Factory function. In order for this function to be invoked by the TypeScript compiler, the
 * tsconfig.json must have the following option:
 *
 * ```json
 * "compilerOptions":
 * {
 *     "jsx": "react",
 *     "jsxFactory": "mim.jsx"
 * }
 * ```
 *
 * The .tsx files must import the mimbl module as mim: import * as mim from "mimbl"
 * @param tag 
 * @param props 
 * @param children 
 */
export function jsx( tag: any, props: any, ...children: any[]): any
{
	return createNodesFromJSX( tag, props, children);
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Provide implementation for the registerCustomAttribute exported function.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
import {ElmAttr, PropType} from "../utils/ElmAttr";

/**
 * Registers custom attribute handler class for the given property name.
 * @param propName name of the custom attribute
 * @param factory custom attribute class
 */
export function registerCustomAttribute<T>( attrName: string, handlerClass: ICustomAttributeHandlerClass<T>): void
{
	ElmAttr.registerProperty( attrName, { type: PropType.CustomAttr, handlerClass });
}

/**
 * Registers custom event for the given property name.
 * @param propName name of the custom event
 */
export function registerCustomEvent( eventName: string): void
{
	ElmAttr.registerProperty( eventName, { type: PropType.Event });
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Provide implementation of utility functions.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
import * as utils from "../utils/Utils";

/**
 * Combines arbitrary number of Slice objects merging classes, styles, properties and content
 * @param slices Array of Slice objects to merge.
 * @returns Resultant Slice object.
 */
export function mergeSlices( ...slices: Slice[]): Slice
{
	return utils.mergeSlices( ...slices);
}

/**
 * Combines arbitrary number of Slice objects merging classes, styles, properties and content
 * into the given resultant slice.
 * @param resSlice Resultant Slice object.
 * @param slices Array of Slice objects to merge.
 */
export function mergeSlicesTo( resSlice: Slice, ...slices: Slice[]): void
{
	utils.mergeSlicesTo( resSlice, ...slices);
}

/**
 * Combines arbitrary number of class properties merging later into the earlier ones. This method
 * returns a string or undefined - if all classNames were undefined.
 * @param classNames Array of strings or string arrays with class names
 * @returns Resultant class string.
 */
export function mergeClasses( ...classNames: (string | string[])[]): string
{
	return utils.mergeClasses( ...classNames);
}

/**
 * Combines arbitrary number of style objects merging later into the earlier ones. This method
 * always returns an object - even if empty
 * @param styles Array of style objects to merge.
 */
export function mergeStyles( ...styles: StylePropType[]): StylePropType
{
	return utils.mergeStyles( ...styles);
}

/**
 * Combines arbitrary number of style objects merging later into the first one.
 * @param resStyle Resultant style object
 * @param styles Array of style objects to merge.
 */
export function mergeStylesTo( resStyle: StylePropType, ...styles: (StylePropType | string)[] ): void
{
	utils.mergeStylesTo( resStyle, ...styles);
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Callback wrapping
//
///////////////////////////////////////////////////////////////////////////////////////////////////
import {wrapCallbackWithVN} from "../core/Scheduler"

/**
 * Wraps the given callback and returns a wrapper function which is executed in the context of the
 * given virtual node. The given "that" object will be the value of "this" when the callback is
 * executed. If the original callback throws an exception, it is processed by the Mimbl error
 * handling mechanism so that the exception bubles from this virtual node up the hierarchy until a
 * node/component that knows to handle errors is found. Note that the VN can be null/undefined;
 * however, in this case if the exception is caught it will not be handled by the Mimbl error
 * handling mechanism.
 * @param callback Callback to be wrapped.
 * @param that Object that will be the value of "this" when the callback is executed.
 * @param vn Virtual node in whose context the callback will be executed.
 * @returns The wrapper function that should be used instead of the original callback.
 */
export function wrapCallback<T extends Function>( callback: T, that?: object, vn?: IVNode): T
{
	return wrapCallbackWithVN( callback, that, vn);
}



/**
 * Base class for components. Components that derive from this class must implement the render
 * method.
 */
export abstract class Component<TProps = {}, TChildren = any> implements IComponent<TProps,TChildren>
{
	/** Component properties passed to the constructor */
	public props: CompProps<TProps,TChildren>;

	/** Remembered vn object through which component can request services. */
	public vn: IVNode;

	constructor( props?: CompProps<TProps,TChildren>)
	{
		if (props)
			this.props = props;
	}

	/** Returns the component's content that will be ultimately placed into the DOM tree. */
	public abstract render(): any;

	/** This method is called by the component to request to be updated. */
	protected updateMe(): void
	{
		if (this.vn)
			this.vn.requestUpdate();
	}

	/**
	 * Schedules the given function to be called before any components scheduled to be updated in
	 * the Mimbl tick are updated.
	 * @param func Function to be called
	 * @param that Object that will be used as "this" value when the function is called. If this
	 *   parameter is undefined, the component instance will be used (which allows scheduling
	 *   regular unbound components' methods). This parameter will be ignored if the the function
	 *   is already bound or is an arrow function.
	 */
	protected callMeBeforeUpdate( func: ScheduledFuncType, that?: object): void
	{
		if (this.vn)
			this.vn.scheduleCallBeforeUpdate( func, that ? that : this);
	}

	/**
	 * Schedules the given function to be called after all components scheduled to be updated in
	 * the Mimbl tick have already been updated.
	 * @param func Function to be called
	 * @param that Object that will be used as "this" value when the function is called. If this
	 *   parameter is undefined, the component instance will be used (which allows scheduling
	 *   regular unbound components' methods). This parameter will be ignored if the the function
	 *   is already bound or is an arrow function.
	 */
	protected callMeAfterUpdate( func: ScheduledFuncType, that?: object): void
	{
		if (this.vn)
			this.vn.scheduleCallAfterUpdate( func, that ? that : this);
	}

	/**
	 * Creates a wrapper function with the same signature as the given callback so that if the original
	 * callback throws an exception, it is processed by the Mimbl error handling mechanism so that the
	 * exception bubbles from this component up the hierarchy until a component that knows to
	 * handle errors is found.
	 * 
	 * Use this method before passing callbacks to document and window event handlers as well as
	 * non-DOM objects that use callbacks, e.g. promises. For example:
	 * 
	 * ```typescript
	 *	class ResizeMonitor
	 *	{
	 *		private onWindowResize(e: Event): void {};
	 *
	 * 		wrapper: (e: Event): void;
	 * 
	 * 		public startResizeMonitoring( vn: IVNode)
	 *		{
	 *			this.wrapper = vn.wrapCallback( this.onWindowResize, this);
	 *			window.addEventListener( "resize", this.wrapper);
	 *		}
	 * 
	 * 		public stopResizeMonitoring()
	 *		{
	 *			window.removeEventListener( "resize", this.wrapper);
	 *			this.wrapper = undefined;
	 *		}
	 *	}
	 * ```
	 * 
	 * @param callback Callback to be wrapped
	 * @returns Function that has the same signature as the given callback and that should be used
	 *     instead of the original callback
	 */
	protected wrapCallback<T extends Function>( callback: T, that?: object): T
	{
		return wrapCallbackWithVN( callback, this, this.vn);
	}
}



/**
 * The FuncProxy component wraps a function that produces content. Proxies can wrap instance
 * methods of classes that have access to "this" thus allowing a single class to "host" multiple
 * components that can be updated separately. This is especially useful when there is a hierarchy
 * of derived classes and (virtual) methods that deliver several pieces of content. FuncProxies
 * can wrap these virtual methods (or other methods that call them) so that the content pieces
 * can be updated separately. FuncProxy has a public Update method that should be called to cause
 * the rendering mechanism to invoke the function wrapped by the FuncProxy.
 */
export class FuncProxy extends Component
{
	constructor( func: () => any)
	{
		super();

		this.func = func;
	}

	public update = (): void =>
	{
		if (this.vn)
			this.vn.requestUpdate();
	};

	public render(): any
	{
		return this.func();
	}

	private func: () => any;
}



/**
 * The Waiting component wraps a Promise and replaces its content when the promise is settled.
 * Before the promise is settled, the component displays an optional "in-progress" content
 * specified in the constructor. If the promise is rejected, the component will either display
 * the "error" content obtained by calling a functions specified in the constructor or if such
 * function is not specified show empty content.
 */
export class Waiting extends Component
{
	/**
	 * Constructs the object
	 * @param promise Promise object to wait for
	 * @param progressContent Content to display while waiting for the promise
	 * @param errorContentFunc Content to display if the promise is rejected
	 */
	constructor( promise: Promise<any>, progressContent?: any, errorContentFunc?: (err: any) => any)
	{
		super();

		this.content = progressContent;

		this.watchPromise( promise, errorContentFunc);
	}

	public render(): any
	{
		return this.content;
	}

	private async watchPromise( promise: Promise<any>, errorContentFunc?: (err: any) => any): Promise<any>
	{
		try
		{
			this.content = await promise;
		}
		catch( err)
		{
			this.content = null;
			if (errorContentFunc !== undefined)
			{
				try
				{
					this.content = errorContentFunc( err);
				}
				catch(anotherErr)
				{
				}
			}
		}
	}

	private content: any;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Definitions of mount/unmount functions
//
///////////////////////////////////////////////////////////////////////////////////////////////////
import * as root from "../core/RootVN"

/**
 * Renders the given content (usually result of JSX expression) under the given HTML element in a
 * synchronous manner.
 * @param content Content to render.
 * @param anchorDN DOM element under which to render the content. If null or undefined, then
 * render under the document.body tag.
 */
export function mountSync( content: any, anchorDN: Node = null): void
{
	root.mountRootSync( content, anchorDN);
}

// 
/**
 * Removes the content that was originally generated by the mountSync function.
 * @param anchorDN DOM element under which the content was previously rendered.
 */
export function unmountSync( anchorDN: Node = null): void
{
	root.unmountRootSync( anchorDN);
}

/**
 * Renders the given content (usually result of JSX expression) under the given HTML element
// asynchronously.
 * @param content Content to render.
 * @param anchorDN DOM element under which to render the content. If null or undefined,then
 *				render under the document.body tag.
 */
export function mount( content: any, anchorDN: Node = null): void
{
	root.mountRoot( content, anchorDN);
}

/**
 * Removes the content that was originally generated by the mount function.
 * @param anchorDN DOM element under which the content was previously rendered.
 */
export function unmount( anchorDN: Node = null): void
{
	root.unmountRoot( anchorDN);
}



