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

	/** Returns the number of currently attached listeners. */
	readonly count: number;
}



/**
 * The IEventSlotOwner interface represents an event slot from the point of view of the caller who
 * created it. The owner can fire events and clear event listeners.
 */
export interface IEventSlotOwner<TFunc extends Function = Function> extends IEventSlot<TFunc>
{
	/**
	 * Method that raises the event and calls all the listeners (if any). It has the signature
	 * of the template function so only proper-types parameters can be passed to it.
	 */
	fire: TFunc;

	/** Removes all listeners to the event. */
	clear(): void;
}



/**
 * The EventSlot class defines an event with custom parameters as members of classes without the
 * need for the classes to derive from EventTarget and use string names for events. Multiple
 * listeners can be added/removed to/from an event.
 */
export class EventSlot<TFunc extends Function = Function> implements IEventSlotOwner<TFunc>
{
	/**
	 * Method that raises the event and calls all the listeners (if any). It has the signature
	 * of the template function so only proper-types parameters can be passed to it.
	 */
	public fire: TFunc = this.realFire as any as TFunc;



	/**
	 * Adds the given function as a listener to the event. Note that this cannot be a lambda
	 * function because there will be no way to remove a lambda function listener later.
	 */
	public attach( listener: TFunc): void
	{
		if (!this.listeners)
			this.listeners = new Set<TFunc>();

		this.listeners.add( listener);
	}



	/** Removes the given function as a listener to the event. */
	public detach( listener: TFunc): void
	{
		if (this.listeners)
		{
			this.listeners.delete( listener);
			if (this.listeners.size === 0)
				this.listeners = null;
		}
	}



	/** Returns the number of currently attached listeners. */
    public get count(): number { return this.listeners ? this.listeners.size : 0; }



	/** Removes all listeners to the event. */
	public clear(): void
	{
		this.listeners = null;
	}



	// Set of listener functions. When there are no listeners, this field is set to null to
	// preserve space.
	private listeners: Set<TFunc>;



	// This method really calls the listeners in a loop. It deconstucts the "arguments" value
	// in order to pass the proper parameters to the listeners.
	private realFire(): void
	{
		if (this.listeners)
		{
			for( let listener of this.listeners)
				listener( ...arguments);
		}
	}
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
	readonly [P in keyof T]: IEventSlot<Extract<T[P],Function>>;
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
	readonly [P in keyof T]: IEventSlotOwner<Extract<T[P],Function>>;
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
    public fire()
    {
        if (this.slot)
            this.slot.fire( ...arguments);
    }

	/** Removes all listeners to the event. */
	public clear(): void
	{
        if (this.slot)
            this.slot.clear();
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
        if (this.slot)
            this.slot.detach( listener);
	}

	/** Returns the number of currently attached listeners. */
    public get count(): number
    {
        return this.slot ? this.slot.count : 0;
    }

}



