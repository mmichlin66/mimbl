import {
    IClassCompVN, IComponentEx, IPublication, IServiceDefinitions, ISubscription, RenderMethodType,
    ScheduledFuncType, TickSchedulingType
} from "../api/CompTypes";


/**
 * Component mixin that contains functionality that is shared between regular components and
 * custom Web elements.
 *
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 */
export abstract class ComponentMixin<TEvents extends {} = {}> implements IComponentEx<TEvents>
{
	/**
	 * Remembered virtual node object through which the component can request services. This
	 * is undefined in the component's costructor but will be defined before the call to the
	 * (optional) willMount method.
	 */
	public vn?: IClassCompVN;

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
        return this.vn!.wrap( func, thisArg ?? this, arg, schedulingType);
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
        return this.vn!.publishService(id, value, depth);
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
        return this.vn!.subscribeService(id, defaultValue, useSelf);
    }


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
        useSelf?: boolean): IServiceDefinitions[K]
    {
        return this.vn!.getService(id, defaultValue);
    }

    fireEvent<K extends string & keyof TEvents>(key: K, detail: TEvents[K]): boolean
    {
        let event = detail instanceof Event ? detail : new CustomEvent(key, {detail});
        return this.dispatchEvent(event);
    }

    abstract addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;
    abstract dispatchEvent(event: Event): boolean;
    abstract removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}



