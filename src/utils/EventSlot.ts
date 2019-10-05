///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The IEventSlot interface represents an event with custom parameters. Multiple
// listeners can be added/removed to/from an event.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface IEventSlot<TFunc extends Function>
{
	// Method that raises the event and calls all the listeners (if any). It has the signature
	// of the template function so only proper-types parameters can be passed to it.
	fire: TFunc;

	// Adds the given function as a listener to the event. Note that this cannot be a lambda
	// function because there will be no way to remove a lambda function listener later.
	add( listener: TFunc): void;

	// Removes the given function as a listener to the event.
	remove( listener: TFunc): void;

	// Removes all listeners to the event.
	clear(): void;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The EventSlot class defines an event with custom parameters as members of classes without the
// need for the classes to derive from EventTarget and use string names for events. Multiple
// listeners can be added/removed to/from an event.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class EventSlot<TFunc extends Function> implements IEventSlot<TFunc>
{
	// Method that raises the event and calls all the listeners (if any). It has the signature
	// of the template function so only proper-types parameters can be passed to it.
	public fire: TFunc = this.realFire as any as TFunc;



	// Adds the given function as a listener to the event. Note that this should not be a lambda
	// function because there will be no way to remove a lambda function listener later.
	public add( listener: TFunc): void
	{
		if (this.listeners === null)
			this.listeners = new Set<TFunc>();

		this.listeners.add( listener);
	}



	// Removes the given function as a listener to the event.
	public remove( listener: TFunc): void
	{
		if (this.listeners !== null)
		{
			this.listeners.delete( listener);
			if (this.listeners.size === 0)
				this.listeners = null;
		}
	}



	// Removes all listener to the event.
	public clear(): void
	{
		this.listeners = null;
	}



	// Set of listener functions. When there are no listeners, this field is set to null to
	// preserve space.
	private listeners: Set<TFunc> = null;



	// This method really calls the listeners in a loop. It deconstucts the "arguments" value
	// in order to pass the proper parameters to the listeners.
	private realFire(): void
	{
		if (this.listeners !== null)
		{
			for( let listener of this.listeners)
				listener( ...arguments);
		}
	}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The EventMultiSlot class allows registering listeners for multiple events. Events are identified
// using the specified template type, which is usually (but not necessarily) a number- or
// string-based enumeration or union type.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class EventMultiSlot<T>
{
	// Adds a new listener to the given event
	public addListener( event: T, eventFunc: Function): void
	{
		if (this.slots === undefined)
			this.slots = new Map<T,EventSlot<Function>>();

		let slot = this.slots.get( event);
		if (slot === undefined)
		{
			slot = new EventSlot<Function>();
			this.slots.set( event, slot);
		}

		slot.add( eventFunc);
	}



	// Removes the given listener from the given event
	public removeListener( event: T, eventFunc: Function): void
	{
		if (this.slots !== undefined)
		{
			let slot = this.slots.get( event);
			if (slot !== undefined)
				slot.remove( eventFunc);
		}
	}

	private slots: Map<T,EventSlot<Function>>;
}



// Interface and class for simple events accepting no parameters.
export interface ISimpleEventSlot extends IEventSlot<()=>void> {}
export class SimpleEventSlot extends EventSlot<()=>void> {}


