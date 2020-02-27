import {IEventSlot, EventSlot, IEventSlotOwner} from "./EventSlot";


export type MultiEventSlotDefinition = { [K: string]: Function };



export type MultiEventSlot<T extends MultiEventSlotDefinition> =
{
	readonly [P in keyof T]: IEventSlotOwner<T[P]>;
}



// export type MultiEventSlot<T extends { [K: string]: Function }> =
// {
// 	[P in keyof T]: IEventSlot<T[P]>;
// }



export function createMultiEventSlot<T extends MultiEventSlotDefinition>(): MultiEventSlot<T>
{
	return new Proxy( {}, new MultiEventSlotHandler());
}



class MultiEventSlotHandler
{
	public get( target: any, prop: string, receiver: any): any
	{
		return this[prop] ? this[prop] : this[prop] = new EventSlot();
	}
}



// type IMyEvents =
// {
// 	click?: () => void;
// 	keyboard?: (char: number) => void;
// }



// class MyClass
// {
// 	// public events: MultiEventSlot<IMyEvents> = createMultiEventSlot();
// 	public events = createMultiEventSlot<IMyEvents>();
// }



// function foo()
// {
// 	let o = new MyClass();
// 	o.events.click.fire();
// 	o.events.keyboard.fire( 1);
// }



