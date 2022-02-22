﻿/**
 * The IEventSlot interface represents an event with custom parameters. Multiple listeners can be
 * added/removed to/from an event.
 */
export interface IEventSlot<TFunc extends Function = Function>
{
	/**
	 * Adds the given function as a listener to the event. Note that this cannot be a lambda
	 * function because there will be no way to remove a lambda function listener later.
	 */
	attach( listener: TFunc): void;

	/** Removes the given function as a listener to the event. */
	detach( listener: TFunc): void;
}



export type EventSlotFunc = (...args: any[]) => void;


/**
 * The IEventSlotOwner interface represents an event slot from the point of view of the caller who
 * created it. The owner can fire events and clear event listeners.
 */
export interface IEventSlotOwner<TFunc extends EventSlotFunc = any> extends IEventSlot<TFunc>
{
	/**
	 * Method that raises the event and calls all the listeners (if any). It has the signature
	 * of the template function so only proper-types parameters can be passed to it.
	 */
    fire( ...a: Parameters<TFunc>): void;

	/** Removes all listeners to the event. */
	clear(): void;
}



/**
 * The EventSlot class defines an event with custom parameters as members of classes without the
 * need for the classes to derive from EventTarget and use string names for events. Multiple
 * listeners can be added/removed to/from an event.
 */
export class EventSlot<TFunc extends EventSlotFunc = any> implements IEventSlotOwner<TFunc>
{
	/**
	 * Method that raises the event and calls all the listeners (if any). It has the signature
	 * of the template function so only proper-types parameters can be passed to it.
	 */
    public fire( ...args: Parameters<TFunc>): void
    {
        this.listener?.( ...args);
        this.listeners?.forEach( listener => listener( ...args));
    }



	/**
	 * Adds the given function as a listener to the event.
	 */
	public attach( listener: TFunc): void
	{
        if (!this.listener)
            this.listener = listener;
        else
        {
            if (!this.listeners)
                this.listeners = new Set<TFunc>();

            this.listeners.add( listener);
        }
	}



	/** Removes the given function as a listener to the event. */
	public detach( listener: TFunc): void
	{
        if (this.listener === listener)
            this.listener = null;
        else if (this.listeners?.size)
			this.listeners.delete( listener);
	}



	/** Removes all listeners to the event. */
	public clear(): void
	{
		this.listener = null;
		this.listeners = null;
	}



	/**
     * The first listener function. Since many times there is only one listener to an event, we
     * optimize by not creating a set of listeners.
     */
	private listener?: TFunc;

	// Set of listener functions. When there are no listeners, this field is set to null to
	// preserve space.
	private listeners?: Set<TFunc>;
}



/**
 * The MultiEventSlot type represents an object that for each property from the template type T
 * has corresponding property, which is an event slot for a function, whose signature is the same
 * as of the original property. For example, if we have the following type:
 *
 * ```typescript
 * type IMyEvents =
 * {
 *     click: () => void;
 *     change: ( newVal: number) => void;
 * }
 * ```
 *
 * then the MultiEventSlot<IMyEvents> type will have the following shape:
 *
 * ```typescript
 * {
 *     click: IEventSlot<() => void>;
 *     change: IEventSlot(newVal: number) => void>;
 * }
 * ```
 *
 */
export type MultiEventSlot<T> =
{
	readonly [P in keyof T]: IEventSlot<Extract<T[P],EventSlotFunc>>;
}



/**
 * The MultiEventSlotOwner type represents an object that for each property from the template type
 * T has corresponding property, which is an event slot for a function, whose signature is the same
 * as of the original property. For example, if we have the following type:
 *
 * ```typescript
 * type IMyEvents =
 * {
 *     click: () => void;
 *     change: ( newVal: number) => void;
 * }
 * ```
 *
 * then the MultiEventSlotOwner<IMyEvents> type will have the following shape:
 *
 * ```typescript
 * {
 *     click: IEventSlotOwner<() => void>;
 *     change: IEventSlotOwner(newVal: number) => void>;
 * }
 * ```
 *
 */
export type MultiEventSlotOwner<T> =
{
	readonly [P in keyof T]: IEventSlotOwner<Extract<T[P],EventSlotFunc>>;
}



/**
 * Creates an object that will have event slots for each property of the template type T. The
 * caller will be the owner of the event slots; that is, it will be able to fire events and
 * clear all listeners when necessary. This allows the following code:
 *
 * ```typescript
 * type IMyEvents =
 * {
 *     click: () => void;
 *     change: ( newVal: number) => void;
 * }
 *
 * interface IMyClass
 * {
 *     events: MultiEventSlot<IMyEvents>;
 *     doSomething(): void;
 * }
 *
 * class MyClass implements IMyClass
 * {
 *     private _events = createMultiEventSlot<IMyEvents>();
 *     public get events(): MultiEventSlot<IMyEvents> { return this._events; }
 *
 *     public doSomething(): void { this._events.change.fire(1);}
 * }
 *
 * let obj: IMyClass = new MyClass();
 * obj.events.change.attach( (n: number) => console.log(n));
 * obj.doSomething();
 * ```
 */
export function createMultiEventSlot<T>(): MultiEventSlotOwner<T>
{
	return new Proxy( {}, new MultiEventSlotHandler());
}



/**
 * Implementation of the proxy handler for the MultiEventSlot object. The handler doesn't use any
 * target object - it simply creates EventSlot property in itself whenever the get method is
 * called. The TypeScript's type checking ensures that only proper event slot names can be used.
 */
class MultiEventSlotHandler
{
	public get( target: any, prop: PropertyKey, receiver: any): any
	{
		return this[prop] ? this[prop] : new EventSlotPretender( this, prop);
	}
}

/**
 * The EventSlotPretender objects are returned by the MultiEventSlotHandler if it doesn't find
 * an event slot for the given property. These lightweight objects implement all IEventSlotOwner
 * methods, but only the attach() method actually creates the EventSlot object and sets it to
 * the handler.
 */
class EventSlotPretender implements IEventSlotOwner
{
    private handler: MultiEventSlotHandler;
    private prop: PropertyKey;
    private slot: EventSlot;

    constructor( handler: MultiEventSlotHandler, prop: PropertyKey)
    {
        this.handler = handler;
        this.prop = prop;
    }

	/**
	 * Method that raises the event and calls all the listeners (if any). It has the signature
	 * of the template function so only proper-types parameters can be passed to it.
	 */
    public fire( ...args: unknown[])
    {
        this.slot?.fire( ...args);
    }

	/** Removes all listeners to the event. */
	public clear(): void
	{
        this.slot?.clear();
	}

	/**
	 * Adds the given function as a listener to the event. Note that this cannot be a lambda
	 * function because there will be no way to remove a lambda function listener later.
	 */
	public attach( listener: Function): void
	{
        if (!this.slot)
            this.slot = this.handler[this.prop] = new EventSlot();

        this.slot.attach( listener);
	}

	/** Removes the given function as a listener to the event. */
	public detach( listener: Function): void
	{
        this.slot?.detach( listener);
	}

}



