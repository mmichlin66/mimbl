import {
    ComponentProps, IComponent, IComponentEx, IPublication, IServiceDefinitions, ISubscription,
    ScheduledFuncType, TickSchedulingType
} from "../api/CompTypes";
import { ClassCompVN } from "./ClassCompVN";
import { scheduleFunc, wrapFunc } from "./Reconciler";



/**
 * Component mixin that contains functionality that is shared between regular components and
 * custom Web elements.
 *
 * @typeparam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 */
export abstract class ComponentMixin<TProps extends {} = {}, TEvents extends {} = {}>
    implements IComponentEx<TEvents>, IComponent
{
	get isMounted(): boolean { return this.vn != null; };

	updateMe(): void
	{
		this.vn?.requestUpdate();
	}

	callMe(func: ScheduledFuncType, beforeUpdate: boolean, arg?: any, thisArg?: any,
        tickType?: TickSchedulingType): void
	{
		scheduleFunc( func, beforeUpdate, {thisArg: thisArg ?? this, arg, comp: this, tickType: tickType});
	}

    wrap<T extends Function>(func: T, arg?: any, thisArg?: any, tickType?: TickSchedulingType): T
    {
        return wrapFunc({func, thisArg: thisArg ?? this, arg, comp: this, tickType: tickType});
    }

	getService<K extends keyof IServiceDefinitions>( id: K, defaultValue?: IServiceDefinitions[K],
        useSelf?: boolean): IServiceDefinitions[K]
    {
        return this.vn!.getService(id, defaultValue, useSelf);
    }

	publishService<K extends keyof IServiceDefinitions>( id: K, value: IServiceDefinitions[K],
        depth?: number): IPublication<K>
    {
        return this.vn!.publishService(id, value, depth);
    }

	subscribeService<K extends keyof IServiceDefinitions>( id: K, defaultValue?: IServiceDefinitions[K],
        useSelf?: boolean): ISubscription<K>
    {
        return this.vn!.subscribeService(id, defaultValue, useSelf);
    }

    fireEvent<K extends string & keyof TEvents>(key: K, detail: TEvents[K]): boolean
    {
        let event = detail instanceof Event ? detail : new CustomEvent(key, {detail});
        return this.dispatchEvent(event);
    }

    // the following properties and methods are defined here to satisfy the implemented interfaces.
    // they are not actually part of the mixin, because they are not transfered to the classes to
    // which the mixin is applied. Instead, these classes implement these properties and methods
    // on their own.
    vn?: ClassCompVN;
	props: ComponentProps<TProps,TEvents>;
    abstract render(): any;
    abstract addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;
    abstract dispatchEvent(event: Event): boolean;
    abstract removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}



