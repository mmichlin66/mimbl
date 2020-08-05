/**
 * The ITrigger interface represents an object that keeps a value and notifies all attached wathers
 * when this value changes.
 */
export interface ITrigger<T = any>
{
    get: () => T;
    set: (v: T) => void;
}



/**
 * Creates a trigger object with the given initial value.
 * @param v
 */
export function createTrigger<T = any>( v?: T): ITrigger<T>
{
    return new Trigger(v);
}



/**
 * The Trigger class represents an object that keeps a value and notifies all attached wathers
 * when this value changes.
 */
class Trigger<T = any> implements ITrigger<T>
{
    constructor( v?: T)
    {
        this.v = v;
    }

    public get(): T
    {
        // notify all watchers on the stack
        g_watcherStack.notifyGet(this)

        return this.v;
    }

    public set(v: T): void
    {
        // nothing to do if the value is the same
        if (v === this.v)
            return;

        this.v = v;

        if (this.watchers.size > 0)
        {
            // notify all watchers. Since this may cause the watched fuctions to be invoked and,
            // as a result watchers can be added or removed to/from our set, we first copy the set
            // into an array and iterate over the copy.
            let watchers: Watcher[] = Array.from( this.watchers.keys());

            // now we can iterate over and notify the watchers
            watchers.forEach( watcher => watcher.notifySet( this));
        }
    }

    public attachWatcher( watcher: Watcher): void
    {
        this.watchers.add( watcher);
    }

    public detachWatcher( watcher: Watcher): void
    {
        this.watchers.delete( watcher);
    }

    // Value being get and set
    private v: T;

    // Set of watchers watching over this trigger's value
    private watchers = new Set<Watcher>();
}



/**
 * A Symbol used to keep a watcher object attached to the original function.
 */
let symWatcher = Symbol( "symWatcher");



export interface IWatcher<T extends (...args: any) => any>
{
    /**
     * This is a callable interface, whihc is implement as a function.
     */
    (...args: Parameters<T>): ReturnType<T>;

    /**
     * Indicates that the watcher cannot be used any more. This also detaches from all the
     * attached triggers.
     */
    dispose(): void;
}



export interface IWatcher<T extends (...args: any) => any = any>
{
    /**
     * This is a callable interface, whihc is implement as a function.
     */
    (...args: Parameters<T>): ReturnType<T>;

    /**
     * Indicates that the watcher cannot be used any more. This also detaches from all the
     * attached triggers.
     */
    dispose(): void;
}



/**
 * Creates a watcher function with the same signature as the given regular function. When the
 * watcher function is invoked it invokes the original function and it notices all trigger objects
 * that were read during its execution. When any of these trigger objects have their values
 * changed, the responder function will be called.
 * @param func Function to be watched
 * @param responder Function to be invoked when values of the trigger objects encountered during
 * the original function's last execution change.
 * @param thisFunc Optional value of "this" that will be used to call the original function.
 * @param thisResponder Optional value of "this" that will be used to call the responder function.
 * If this value is undefined, the "this" value for the original function will be used.
 */
export function watch<T extends (...args: any) => any>( func: T, responder: () => void, thisFunc?: any, thisResponder?: any): IWatcher<T>
{
    function watcherFunc(...args: any[]): any
    {
        let watcher: Watcher = watcherFunc[symWatcher];

        // if the value of "this" for the original function was not supplied but now when the
        // watcher executes, "this" is defined, we remember it.
        return watcher.execute( this, args);
    }

    // keep the watcher object in the function object itself using a symbol.
    watcherFunc[symWatcher] = new Watcher( func, responder, thisFunc, thisResponder);

    // implement the dispose method
    (watcherFunc as IWatcher).dispose = function()
    {
        let watcher = watcherFunc[symWatcher] as Watcher;
        watcher && watcher.dispose();
        delete watcherFunc[symWatcher];
    } 

    return watcherFunc as IWatcher<T>;
}



/**
 * The Watcher class encapsulates the functionality of watching for trigger objects encountered
 * during a function execution. When the trigger objects are read, they are remembered by the
 * Watcher object. Whenever a value is changed in any of these triggers, the watcher object is
 * notified and calls the responder function.
 */
class Watcher<T extends Function = any>
{
    constructor( func: T, responder: () => void, thisFunc?: any, thisResponder?: any)
    {
        this.func = func;
        this.responder = responder;
        this.funcThis = thisFunc;

        // if responder "this" is not defined use the one for the function
        this.responderThis = thisResponder ? thisResponder : thisFunc;
    }

    /**
     * Clears internal data structures and indicates that the object cannot be used any more.
     */
    public dispose(): void
    {
        // clear all triggers
        this.triggers.forEach( trigger => trigger.detachWatcher( this));
        this.triggers.clear();

        // set the func and responder properties to null to indicate that the watcher has been disposed
        this.func = null;
        this.responder = null;
        this.funcThis = null;
        this.responderThis = null;
    }

    /**
     * Executes the original function while updating the set of attached triggers. The "thisFunc"
     * parameter is the "this" under which the internal watcher function has been called. It
     * will be used to set the "this" to apply when invoking the original function if it wasn't
     * set yet.
     */
    public execute( thisFunc: any, args: any[]): any
    {
        // check whether our watcher has been already disposed
        if (!this.func)
        {
            /// #if DEBUG
            console.error( "Disposed watcher function called.");
            /// #endif

            throw new Error( "Disposed watcher function called.");
        }

        // Fix our "this" if it hasn't been set so far
        if (!this.funcThis && thisFunc)
        {
            this.funcThis = thisFunc;
            if (!this.responderThis)
                this.responderThis = thisFunc;
        }
        
        // clear all current triggers
        this.triggers.forEach( trigger => trigger.detachWatcher( this));
        this.triggers.clear();

        // install our watcher at the top of the watchers stack
        g_watcherStack.push( this)

        // call the function
        try
        {
            return this.func.apply( this.funcThis, args);
        }
        finally
        {
            // remove our watcher from the top of the watchers stack
            g_watcherStack.pop()
        }
    }

    // Notifies the watcher that the value of one of the trigger objects to which the watcher
    // object is attached, has changed.
    public notifySet( trigger: Trigger): void
    {
        // check whether our watcher has been already disposed
        if (!this.func)
        {
            /// #if DEBUG
            console.error( "Disposed watcher function called.");
            /// #endif

            return;
        }

        this.responder.apply( this.responderThis);
    }

    // Notifies the watcher that the given trigger object was read during the function execution.
    // This leads to attaching our watcher to the trigger.
    public notifyGet( trigger: Trigger): void
    {
        // check whether our watcher has been already disposed
        if (!this.func)
        {
            /// #if DEBUG
            console.error( "Disposed watcher function called.");
            /// #endif

            return;
        }

        this.triggers.add( trigger);
        trigger.attachWatcher( this);
    }

    // Function during which we should listen to triggers being read, so that we can remember
    // them and later respond when they notify that their values have been changed.
    private func: T;

    // Function to be invoked when the the value of one of the triggers changes
    private responder: () => void;

    // "this" value to apply to the watched function when calling it.
    private funcThis: any;

    // "this" value to apply to responder function when calling it.
    private responderThis: any;

    // Set of triggers currently being watched by this watcher
    private triggers = new Set<Trigger>();
}



/**
 * The WatcherStack class is a singleton class that represents a stack of watcher objects
 * currently executing their functions and watching for trigger objects to be read. When
 * a trigger object is being read (that is its get() method is called), all the watchers
 * in the stack are notified, because they all depend on the trigger object's value for
 * their functionality.
 */
class WatcherStack
{
    /** Stack of watcher objects */
    private stack: Watcher[] = [];

    /**
     * Pushes the given watcher object to the top of the stack
     */
    public push( watcher: Watcher): void
    {
        this.stack.push( watcher);
    }

    /**
     * Removes the watcher object currently on the top of the stack
     */
    public pop(): void
    {
        this.stack.pop();
    }

    /**
     * Notifies that the value of the given trigger object has been read.
     */
    public notifyGet( trigger: Trigger): void
    {
        // notify all watchers currently on the stack
        for( let watcher of this.stack)
            watcher.notifyGet( trigger);
    }
}



/** Singleton WatcherStack bject */
let g_watcherStack = new WatcherStack();




