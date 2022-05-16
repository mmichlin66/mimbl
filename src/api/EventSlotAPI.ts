import { EventSlotFunc, IEventSlotOwner, MultiEventSlotOwner } from "./EventSlotTypes";



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
        this.listeners?.forEach( (rc, listener) => listener( ...args));
    }

	/**
	 * Adds the given function as a listener to the event.
	 */
	public attach( listener: TFunc): void
	{
        if (!listener)
            return;
        else if (listener === this.listener)
            this.rc++;
        else if (!this.listener)
        {
            this.listener = listener;
            this.rc = 1;
        }
        else
        {
            if (!this.listeners)
                this.listeners = new Map();

            let rc = this.listeners.get(listener) ?? 0;
            this.listeners.set( listener, rc + 1);
        }
	}

	/** Removes the given function as a listener to the event. */
	public detach( listener: TFunc): void
	{
        if (!listener)
            return;
        else if (this.listener === listener)
        {
            if (--this.rc === 0)
                this.listener = null;
        }
        else
        {
			let rc = this.listeners?.get( listener);
            if (rc != null)
            {
                if (--rc === 0)
                    this.listeners!.delete(listener);
                else
                    this.listeners!.set( listener, rc);
            }
        }
	}

	/** Determines whether this event slot has any listeners. */
	public has(): boolean
    {
        return !!this.listener || !!this.listeners?.size;
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
	private listener?: TFunc | null;

	/**
     * Reference counter of the listener function.
     */
	private rc = 0;

	// Map of listener functions to their respective reference counts. When there are no listeners,
    // this field is set to null to preserve space.
	private listeners?: Map<TFunc,number> | null;
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

	/** Determines whether this event slot has any listeners. */
	public has(): boolean
    {
        return this.slot.has();
    }
}



