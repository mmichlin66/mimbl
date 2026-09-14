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
 * The IWatcher interface represents an object that wraps a function. When the watcher's `run()`
 * method is called, it calls the wrapped function and attaches to all triggers whose values were
 * read during the course of the call. When a value of any of these triggers changes, a responder
 * function is called.
 * @typeParam T Type (signature) of the function to be watched.
 */
export interface IWatcher<T extends (...args: any[]) => any = any>
{
    /** This is a callable interface, which is implement as a function. */
    run(...args: Parameters<T>): ReturnType<T>;

    /**
     * Invokes the responder function independent of the trigger changes.
     */
    respond(): void;

    /**
     * Detaches the watcher from all its current triggers. The responder function will not be
     * called until the `run()` method is called again and attaches to new triggers.
     */
    detach(): void;
}



