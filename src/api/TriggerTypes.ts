import {IEventSlot} from "./EventSlotTypes";



/**
 * The IContainerTrigger interface represents a container object that keeps an arbitrary number of
 * elements that can added to and removed from it. When this happens, the `notifyRead()` or
 * `notifyWrite()` methods should be called so that watchers attached to this container trigger
 * can respond.
 */
export interface IContainerTrigger extends IEventSlot<() => void>
{
    /** Notifies that the container has been read from */
    notifyRead(): void;

    /**
     * Notifies that the container's content has been changed - that is, elements have been added
     * to or deleted from it.
     */
    notifyWrite(): void
}



/**
 * The ITrigger interface represents an object that keeps a value and notifies the current watcher
 * (if any) when this value is read so that the watchers can attach to it. When the value changes,
 * the watchers will respond.
 * @typeParam T Type of the trigger value.
 */
export interface ITrigger<T = any> extends IEventSlot<(v: T) => void>
{
    /** Retrieves the current value */
    get(): T;

    /** Sets a new value */
    set(v: T): void;
}



/**
 * The IWatcher interface represents a callable object that wraps a function and has the same
 * signature as this function. When a watcher is called it calls the wrapped function and attaches
 * to all triggers whose values were read during the course of the call. When values of these
 * triggers change, a responder function is called. The responder function is provided when the
 * watcher is created, but it can be changed later.
 * @typeParam T Type (signature) of the function to be watched.
 */
export interface IWatcher<T extends (...args: any[]) => any = any>
{
    /** This is a callable interface, which is implement as a function. */
    (...args: Parameters<T>): ReturnType<T>;

    /** Clears internal resources. */
    dispose(): void;
}



