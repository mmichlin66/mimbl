import {
    IComponent, IPublication, IServiceDefinitions, ISubscription,
    ScheduledFuncType, TickSchedulingType, UpdateStrategy
} from "../api/CompTypes";
import { symPropStorage } from "../utils/UtilFunc";
import { ClassCompVN } from "./ClassCompVN";
import { scheduleFunc, wrapFunc } from "./Reconciler";



/**
 * Component mixin that contains functionality that is shared between regular components and
 * custom Web elements.
 *
 * @typeParam TProps Type defining properties that can be passed to this class-based component.
 *		Default type is an empty object (no properties).
 * @typeParam TEvents Type that maps event names (a.k.a event types) to either Event-derived
 * classes (e.g. MouseEvent) or any other type. The latter will be interpreted as a type of the
 * `detail` property of a CustomEvent.
 */
export function ComponentMixin
    <
        TProps extends {} = {children?: any},
        TEvents extends {} = {},
        TBase extends new (...args: any[]) => EventTarget = new (...args: any[]) => EventTarget,
    >
    (Base: TBase):
    TBase & (abstract new (...args: any[]) => IComponent<TProps,TEvents>)
{
    abstract class Internal extends Base implements IComponent<TProps,TEvents>
    {
        /**
         * Storage for property values for properties augmented with a decorator that defines getters
         * and/or setters.
         */
        public [symPropStorage]: Record<string,any>;

    	displayName?: string;
        vn?: ClassCompVN;
        updateStrategy?: UpdateStrategy;

        constructor(...args: any[])
        {
            super(...args);
            this[symPropStorage] = {};
            this.vn = undefined;
            this.updateStrategy = undefined;
        }

        get isMounted(): boolean { return !!this.vn; };

        updateMe(): void
        {
            this.vn?.requestUpdate();
        }

        callMe(func: ScheduledFuncType, beforeUpdate: boolean, arg?: any, thisArg?: any,
            tickType?: TickSchedulingType): void
        {
            scheduleFunc(func, beforeUpdate, {thisArg: thisArg ?? this, arg, comp: this, tickType});
        }

        wrap<T extends Function>(func: T, arg?: any, thisArg?: any, tickType?: TickSchedulingType): T
        {
            return wrapFunc({func, thisArg: thisArg ?? this, arg, comp: this, tickType});
        }

        getService<K extends keyof IServiceDefinitions>(id: K, defaultValue?: IServiceDefinitions[K],
            useSelf?: boolean): IServiceDefinitions[K]
        {
            return this.vn!.getService(id, defaultValue, useSelf);
        }

        publishService<K extends keyof IServiceDefinitions>(id: K, value: IServiceDefinitions[K],
            depth?: number): IPublication<K>
        {
            return this.vn!.publishService(id, value, depth);
        }

        subscribeService<K extends keyof IServiceDefinitions>(id: K, defaultValue?: IServiceDefinitions[K],
            useSelf?: boolean): ISubscription<K>
        {
            return this.vn!.subscribeService(id, defaultValue, useSelf);
        }

        fireEvent<K extends string & keyof TEvents>(eventType: K, detail: TEvents[K]): boolean
        {
            let event = detail instanceof Event ? detail : new CustomEvent(eventType, {detail});
            return this.dispatchEvent(event);
        }

        abstract render(): any;
    }

    return Internal;
}



