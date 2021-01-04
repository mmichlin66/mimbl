///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Common types
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The IDisposer interface allows clients to inform the object that it can clear its internal
 * resources. The object cannot be used after it has been disposed off.
 */
export interface IDisposer
{
    /** Clears internal resources. */
    dispose(): void;
}



/** Type for functions that accept any number of parameters and return any type */
export type AnyAnyFunc = (...args: any[]) => any;

/** Type for functions that accept no parameters and return values of any type */
export type NoneTypeFunc<T> = () => T;

/** Type for functions that accept no parameters and don't return any value */
export type NoneVoidFunc = () => void;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Triggers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The ITrigger interface represents an object that keeps a value and notifies all attached wathers
 * when this value changes.
 */
export interface ITrigger<T = any>
{
    // Retrieves the current value
    get(): T;

    // Sets a new value
    set( v: T): void;
}



/**
 * The TriggerDepth enumeration defines possible ways of how triggers deal with container data;
 * that is, objects, arrays, maps and sets. For triggers with values of non-container types
 * this enumeration is irrelevant.
 */
enum TriggerDepth
{
    /**
     * Only changes in the value itself are handled. Actions of adding, removing and modifying
     * items in the container are ignored.
     */
    Value = 0,

    /**
     * Changes in the value itself and of the immediate container items are handled. Actions of
     * adding and removing items in the container cause change to be triggerred; however actions
     * of modifying items themselfs are ignored. For triggers with values of non-container types
     * this value is equivalent to Value.
     */
    Shallow = 1,

    /**
     * Changes in the value itself and of items on all levels are handled. Items added to the
     * container are converted to deep triggers. For triggers with values of non-container types
     * this value is equivalent to Value.
     */
    Deep = 100,
}



/**
 * Creates a trigger object of the given depth with the given initial value.
 * @param v
 */
export function createTrigger<T = any>( depth: number, v?: T): ITrigger<T>
{
    return new Trigger( depth < 0 ? 0 : depth, v);
}



/**
 * The Trigger class represents an object that keeps a value and notifies all attached watchers
 * when this value changes.
 */
class Trigger<T = any> implements ITrigger<T>
{
    constructor( depth?: number, v?: T)
    {
        this.depth = depth;
        this.v = triggerrize( v, this, depth);
    }

    // Retrieves the current value
    public get(): T
    {
        this.notifyRead();
        return this.v;
    }

    // Sets a new value
    public set( v: T): void
    {
        // nothing to do if the value is the same
        if (v === this.v)
            return;

        this.v = triggerrize( v, this, this.depth);

        this.notifyChanged();
    }

    // Notifies the manager that the trigger's value has been read
    public notifyRead(): void
    {
        g_manager.notifyTriggerRead(this)
    }

    // Notifies the manager that the trigger's value has been changed. We only notify the manager
    // if there is at least one watcher attached to our trigger;
    public notifyChanged(): void
    {
        if (this.watchers.size > 0)
            g_manager.notifyTriggerChanged( this);
    }



    // Number indicating to what level the items of container types should be triggerrized.
    public depth: number;

    // Value being get and set
    private v: T;

    // Set of watchers watching over this trigger's value. This member serves as a storage instead
    // of having the manager to map of triggers to the set of watchers.
    public watchers = new Set<Watcher>();
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Watchers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The IWatcher interface represents a callable object that wraps a function and has the same
 * signature as this function. When a watcher is called it cals the wrapped function and attaches
 * to all triggers whose values were read during the course of the call. When values of these
 * triggers change, a responder function is called. The responder function is provided when the
 * watcher is created, but it can be changed later.
 */
export interface IWatcher<T extends AnyAnyFunc = any> extends IDisposer
{
    /** This is a callable interface, which is implement as a function. */
    (...args: Parameters<T>): ReturnType<T>;

    // /** Sets a responder function */
    // setResponder( responder: NoneVoidFunc, responderThis?: any): void;
}



/**
 * A Symbol used to keep a watcher object attached to the watcher function.
 */
let symWatcher = Symbol( "symWatcher");



/**
 * Creates a watcher function with the same signature as the given regular function. When the
 * watcher function is invoked it invokes the original function and it notices all trigger objects
 * that were read during its execution. When any of these trigger objects have their values
 * changed, the responder function will be called.
 * @param func Function to be watched
 * @param responder Function to be invoked when values of the trigger objects encountered during
 * the original function's last execution change.
 * @param funcThis Optional value of "this" that will be used to call the original function.
 * @param responderThis Optional value of "this" that will be used to call the responder function.
 * If this value is undefined, the "this" value for the original function will be used.
 */
export function createWatcher<T extends AnyAnyFunc>( func: T, responder: NoneVoidFunc,
    funcThis?: any, responderThis?: any): IWatcher<T>
{
    function watcherFunc(...args: any[]): any
    {
        let watcher: Watcher = watcherFunc[symWatcher];

        // if the value of "this" for the original function was not supplied but now when the
        // watcher executes, "this" is defined, we remember it.
        return watcher.execute( this, args);
    }

    // keep the watcher object in the function object itself using a symbol.
    watcherFunc[symWatcher] = new Watcher( func, responder, funcThis, responderThis);

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
class Watcher<T extends AnyAnyFunc = any>
{
    constructor( func: T, responder: NoneVoidFunc, funcThis?: any, responderThis?: any)
    {
        this.func = func;
        this.responder = responder;
        this.funcThis = funcThis;

        // if responder "this" is not defined use the one for the function
        this.responderThis = responderThis ? responderThis : funcThis;
    }

    /**
     * Executes the original function while updating the set of attached triggers. The "funcThis"
     * parameter is the "this" under which the internal watcher function has been called. It
     * will be used to set the "this" to apply when invoking the original function if it wasn't
     * set yet.
     */
    public execute( funcThis: any, args: any[]): any
    {
        // check whether our watcher has been already disposed
        if (!this.func)
            throw new Error( "Disposed watcher was called.");

        // Fix our "this" if it hasn't been set so far
        if (!this.funcThis && funcThis)
        {
            this.funcThis = funcThis;
            if (!this.responderThis)
                this.responderThis = funcThis;
        }

        // clear all current triggers
        this.clean();

        // install our watcher at the top of the watchers stack
        g_manager.pushWatcher( this)

        // call the function
        try
        {
            return this.func.apply( this.funcThis, args);
        }
        finally
        {
            // remove our watcher from the top of the watchers stack
            g_manager.popWatcher()
        }
    }

    /** Clears internal resources. */
    public dispose(): void
    {
        // check whether the object is already disposed
        if (!this.func)
            return;

        // clear all triggers
        this.clean();

        // set the func and responder properties to null to indicate that the watcher has been disposed
        this.func = null;
        this.responder = null;
        this.funcThis = null;
        this.responderThis = null;
    }

    // Notifies the watcher that it should call the responder function. This occurs when there
    // are triggers whose values have been changed
    public respond(): void
    {
        // check whether our watcher has been already disposed. It can happen if after all mutation
        // scopes exited the manager notifies multiple watchers and one of the watchers' responder
        // disposes of another watcher.
        if (!this.responder)
            return;

        this.responder.apply( this.responderThis);
    }

    /**
     * Cleans the state of the watcher, so that it is detached from any triggers and is removed
     * from the manager's set of deferred watchers.
     */
    private clean(): void
    {
        // detaches this watcher from all the triggers and the triggers from this watcher.
        this.triggers.forEach( trigger => trigger.watchers.delete( this));
        this.triggers.clear();

        // ask the manager to forget about this watcher if it is currently in te deferred set
        g_manager.removeDeferredWatcher( this);
    }



    // Function being watched; that is, during which we should listen to triggers being read, so
    // that we can remember them and later respond when they notify that their values have been
    // changed.
    private func: T;

    // Function to be invoked when the the value of one of the triggers changes
    private responder: NoneVoidFunc;

    // "this" value to apply to the watched function when calling it.
    private funcThis: any;

    // "this" value to apply to responder function when calling it.
    private responderThis: any;

    // Set of triggers currently being watched by this watcher. This member is used by the
    // manager. It is essentially a storage, which is used instead of the manager having a
    // map of watchers to the sets of triggers. The purpose of knowing what triggers are used
    // by what watcher is to remove the watcher from all these triggers before the watched
    // function is called.
    public triggers = new Set<Trigger>();
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Manager
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The TriggerWatcherManager class is a singleton class that represents the global functionality
 * of the trigger-watcher mechanism. It includes a stack of watcher objects currently executing
 * their functions and watching for trigger objects to be read. When a trigger object is being
 * read (that is its get() method is called), all the watchers in the stack are notified, because
 * they all depend on the trigger object's value for their functionality.
 *
 * It also maintains a reference count of mutation scopes and handles notifying watchers of
 * mutations only when the last mutation scope has exited. The triggers don't notify the watchers
 * directly; instead, they notify the manager, which accumulates the information and notifies all
 * the watchers once out of the last mutation scope.
 */
class TriggerWatcherManager
{
    /**
     * Pushes the given watcher object to the top of the stack
     */
    public pushWatcher( watcher: Watcher): void
    {
        this.watcherStack.push( watcher);
    }

    /**
     * Removes the watcher object currently on the top of the stack
     */
    public popWatcher(): void
    {
        this.watcherStack.pop();
    }

    /**
     * Removes the watcher object from the set of deferred watchers
     */
    public removeDeferredWatcher( watcher: Watcher): void
    {
        this.deferredWatchers.delete( watcher);
    }

    /**
     * Increments mutation scope reference count
     */
    public enterMutationScope(): void
    {
        this.mutationScopesRefCount++;
    }

    /**
     * Decrements mutation scope reference count. If it reaches zero, notifies all deferred watchers.
     */
    public exitMutationScope(): void
    {
        if (this.mutationScopesRefCount === 0)
            throw Error( "Unpaired call to exitMutationScope");

        if (--this.mutationScopesRefCount === 0)
        {
            // since when watchers respond, they can execute their watcher functions and that could
            // mess with the same set of watchers we are iterating over. Therefore, we make a copy
            // of this set first.
            let watchers = Array.from( this.deferredWatchers.keys());
            this.deferredWatchers.clear();
            watchers.forEach( watcher => watcher.respond());
        }
    }

    /**
     * Notifies that the value of the given trigger object has been read.
     */
    public notifyTriggerRead( trigger: Trigger): void
    {
        // attach all watchers currently on the stack to the trigger
        for( let watcher of this.watcherStack)
        {
            watcher.triggers.add( trigger);
            trigger.watchers.add( watcher);
        }
    }

    /**
     * Notifies that the value of the given trigger object has been changed. If this happens while
     * within a mutation scope, we don't notify the watchers of this trigger but put them in a
     * deferred set. If this happens outside of any mutation scope. In this case we notify the
     * watchers of this trigger right away.
     */
    public notifyTriggerChanged( trigger: Trigger): void
    {
        // this method is supposed to be called only if the trigger has watchers
        /// #if DEBUG
            if (trigger.watchers.size === 0)
                console.error( "notifyTriggerChanged was called by a trigger without watchers");
        /// #endif

        if (this.mutationScopesRefCount > 0)
            trigger.watchers.forEach( watcher => this.deferredWatchers.add( watcher));
        else
        {
            // since when watchers respond, they can execute their watcher functions and that could
            // mess with the same set of watchers we are iterating over. Therefore, we make a copy
            // of this set first.
            let watchers = Array.from( trigger.watchers.keys());
            watchers.forEach( watcher => watcher.respond());
        }
    }



    // Stack of watcher objects. Watchers are pushed on top before they call the watched
    // function and removed after this function returns. When a trigger notifies that its value
    // has been changed, all the watchers in the stack are attached to this trigger. This means
    // that the trigger's value is used by the watched functions.
    private watcherStack: Watcher[] = [];

    // Number of currently active mutation scopes. When a trigger notifies that its value has been
    // changed while this number is not 0, the trigger will be remembered in the internal set.
    // After all mutation scopes are finished, the watchers attached to all triggers in the set
    // will be notified. When a trigger notifies that its value has been changed while there are
    // no mutation scopes present, the watchers attached to the trigger are notified immediately.
    private mutationScopesRefCount = 0;

    // Set of watchers that should be notified when the last mutation scope exits. Using Set
    // ensures that no matter how many triggers reference a watcher, the watcher will be present
    // only once.
    private deferredWatchers = new Set<Watcher>();
}



/** Singleton TriggerWatcherManager bject */
let g_manager = new TriggerWatcherManager();



/**
 * Increments mutation scope reference count
 */
export function enterMutationScope(): void
{
    g_manager.enterMutationScope();
}

/**
 * Decrements mutation scope reference count. If it reaches zero, notifies all deferred watchers.
 */
export function exitMutationScope(): void
{
    g_manager.exitMutationScope();
}

///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Computed triggers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The IComputedTrigger interface represents a value that is calculated by a function. This is a
 * combination of Trigger and Watcher. It is a watcher because it watches over the function and
 * calls it whenever any triggers this function uses are changed. It is a trigger because it
 * triggers change when the function returns a new value.
 *
 * The important fact about a computed trigger is that it only invokes the watched function
 * if it's value is being used by at least one watcher.
 */
export interface IComputedTrigger<T = any> extends ITrigger<T>, IDisposer
{
}



/**
 * Creates a computed trigger object whose value is calculated by the given function and with an
 * optional initial value.
 * @param v
 */
export function createComputedTrigger<T = any>( func: NoneTypeFunc<T>, funcThis?: any): IComputedTrigger<T>
{
    return new ComputedTrigger( func, funcThis);
}



/**
 * The ComputedTrigger class represents a value that is calculated by a function. This is a
 * combination of Trigger and Watcher. It is a watcher because it watches over the function and
 * calls it whenever any triggers this function uses are changed. It is a trigger because it
 * triggers change when the function returns a new value.
 *
 * The important fact about a computed trigger is that it only invokes the watched function
 * if it's value is being used by at least one watcher.
 */
class ComputedTrigger<T = any> extends Trigger<T> implements IComputedTrigger<T>
{
    constructor( func: NoneTypeFunc<T>, funcThis?: any)
    {
        super( TriggerDepth.Value);

        this.func = func;
        this.funcThis = funcThis;

        // we don't create the watcher until the get method is called
        this.isStale = true;
    }

    // Retrieves the current value
    public get(): T
    {
        if (this.isStale)
        {
            // we need to create the watcher if this is the first time the get method is called.
            if (!this.funcWatcher)
                this.funcWatcher = createWatcher( this.func, this.responder, this.funcThis, this);

            super.set( this.funcWatcher());
            this.isStale = false;
        }

        return super.get();
    }

    /** Clears internal resources. */
    public dispose(): void
    {
        // check whether the object is already disposed
        if (!this.func)
            return;

        if (this.funcWatcher)
        {
            this.funcWatcher.dispose();
            this.funcWatcher = null;
        }

        this.func = null;
    }

    /**
     * This method is invoked when our watcher is notified of changes in its trigger values. We
     * respond by invoking the function (through the watcher) and setting its return value as
     * our new value. This can trigger changes in watchers that are using our value. Note that
     * we only invoke our watcher if there is at least one watcher that watches our value.
     */
    private responder(): void
    {
        if (this.watchers.size > 0)
            super.set( this.funcWatcher());
        else
            this.isStale = true;
    }



    // Function we will be watching
    private func: NoneTypeFunc<T>;

    // "this" value to apply to the watched function when calling it.
    private funcThis: any;

    // Watcher over our function
    private funcWatcher: IWatcher<NoneTypeFunc<T>>;

    // Flag indicating that the value  kept by the trigger might not reflect the actual computed
    // value. This flag is true under the following circumstances:
    // 1. Right after the object has been created. We don't even create the watcher because we
    //    wait until the get method is called.
    // 2. When the responder has been invoked, but our trigger didn't have any watcher. Again, we
    //    will wait until the get method is called.
    private isStale: boolean;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Mutators
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The IMutator interface represents a callable object that wraps a function and has the same
 * signature as this function. When a watcher is called it cals the wrapped function and attaches
 * to all triggers whose values were read during the course of the call. When values of these
 * triggers change, a responder function is called. The responder function is provided when the
 * watcher is created, but it can be changed later.
 */
export interface IMutator<T extends AnyAnyFunc = any> extends IDisposer
{
    /** This is a callable interface, which is implement as a function. */
    (...args: Parameters<T>): ReturnType<T>;
}



/**
 * A Symbol used to keep a mutator object attached to the mutator function.
 */
let symMutator = Symbol( "symMutator");



/**
 * Creates a mutator function with the same signature as the given regular function which executes
 * the wrapped function within a mutation scope. Watchers for triggers that have their values
 * changed during execution of this function are not notified immediately. Instead, the watchers
 * are "deferred" and will be notified only once after the last mutation scope exits. This can be
 * useful since usually watchers depend on many triggers and we don't want the watchers being
 * notified many time but rather only once after all the changes have been done.
 * @param func Function around which to establish a mutation scope. If this is a class method,
 * then either provide the funcThis parameter or bind the function before passing it in. Note
 * that arrow functions are already bound.
 * @param funcThis The "this" value to apply when calling the function. This is necessary if the
 * function is an unboundclass method.
 */
export function createMutator<T extends AnyAnyFunc>( func: T, funcThis?: any): IMutator<T>
{
    function mutatorFunc(...args: any[]): any
    {
        let mutator: Watcher = mutatorFunc[symWatcher];

        // if the value of "this" for the original function was not supplied but now when the
        // watcher executes, "this" is defined, we remember it.
        return mutator.execute( this, args);
    }

    // keep the mutator object in the function object itself using a symbol.
    mutatorFunc[symMutator] = new Mutator( func, funcThis);

    // implement the dispose method
    (mutatorFunc as IMutator).dispose = function()
    {
        let mutator = mutatorFunc[symMutator] as Watcher;
        mutator && mutator.dispose();
        delete mutatorFunc[symMutator];
    }

    return mutatorFunc as IWatcher<T>;
}



/**
 * The Mutator class encapsulates the functionality of executing a wrapped function under a
 * mutation scope.
 */
class Mutator<T extends AnyAnyFunc = any>
{
    constructor( func: T, funcThis?: any)
    {
        this.func = func;
        this.funcThis = funcThis;
    }

    /**
     * Executes the original function in a mutation scope.
     */
    public execute( funcThis: any, args: any[]): any
    {
        // check whether our watcher has been already disposed
        if (!this.func)
            throw new Error( "Disposed mutator was called.");

        // Fix our "this" if it hasn't been set so far
        if (!this.funcThis && funcThis)
            this.funcThis = funcThis;

        g_manager.enterMutationScope();
        try { return this.func.apply( this.funcThis, args); }
        finally { g_manager.exitMutationScope(); }
    }

    /** Clears internal resources. */
    public dispose(): void
    {
        // check whether the object is already disposed
        if (!this.func)
            return;

        // set the func and responder properties to null to indicate that the watcher has been disposed
        this.func = null;
        this.funcThis = null;
    }

    // Function being wrapped.
    private func: T;

    // "this" value to apply to the wrapped function when calling it.
    private funcThis: any;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Triggerizing containers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Depending on the given trigger depth and on the value type, either returns the same value if
 * it is a container (object, array, map or set), returns a proxy to the value that knows to
 * notify read and change when its methods and properties are invoked.
 * @param v Value to convert if necessary
 * @param trigger Trigger that will be notified when read or change events occur in the converted
 * values
 * @param depth The depth on the level (starting from the trigger)that called this function.
 * If this parameter is 0, no conversion occurs and the value is returned as is. When this function
 * is called from the trigger, this parameter can be undefined: in this case, we will assign the
 * depth depending on the type of the value. Arrays, maps and sets get depths of Shallow(1),
 * meaning that operations that add or remove items will trigger events, but modifications to the
 * items will not. Objects get the depth of Deep (1000), which essentially means that any changes
 * to the object properties on any level will trigger events.
 */
function triggerrize<T = any>( v: T, trigger: Trigger, depth?: number): T
{
    if (!v || depth === 0)
        return v;
    else if (Array.isArray(v))
        return new Proxy( v, new NonSlotContainerHandler( trigger, (depth ? depth : TriggerDepth.Shallow) - 1)) as any as T;
    else if (v instanceof Map)
        return new Proxy( v, new MapHandler( trigger, (depth ? depth : TriggerDepth.Shallow) - 1)) as any as T;
    else if (v instanceof Set)
        return new Proxy( v, new SetHandler( trigger, (depth ? depth : TriggerDepth.Shallow) - 1)) as any as T;
    else if (v.constructor === Object)
        return new Proxy( v, new NonSlotContainerHandler( trigger, (depth ? depth : TriggerDepth.Deep) - 1)) as any as T;
    else
        return v;
}



/**
 * Base class for Array and plain object handlers.
 */
class NonSlotContainerHandler implements ProxyHandler<any>
{
    constructor( trigger: Trigger, depth: number)
    {
        this.trigger = trigger;
        this.depth = depth;
    }

    get( target: any, prop: PropertyKey, receiver: any): any
    {
        this.trigger.notifyRead();
        return Reflect.get( target, prop, receiver);
    }

    set( target: any, prop: PropertyKey, value: any, receiver: any): boolean
    {
        let oldValue = Reflect.get( target, prop, receiver);
        if (oldValue != value)
        {
            this.trigger.notifyChanged();
            return Reflect.set( target, prop, triggerrize( value, this.trigger, this.depth), receiver);
        }
        else
            return true;
    }

    deleteProperty( target: any, prop: PropertyKey): boolean
    {
        this.trigger.notifyChanged();
        return Reflect.deleteProperty( target, prop);
    }

    defineProperty( target: any, prop: PropertyKey, attrs: PropertyDescriptor): boolean
    {
        this.trigger.notifyChanged();
        return Reflect.defineProperty( target, prop, attrs);
    }

    has( target: any, prop: PropertyKey): boolean
    {
        this.trigger.notifyRead();
        return Reflect.has( target, prop);
    }

    getPrototypeOf( target: any): object | null
    {
        this.trigger.notifyRead();
        return Reflect.getPrototypeOf( target);
    }

    isExtensible( target: any): boolean
    {
        this.trigger.notifyRead();
        return Reflect.isExtensible( target);
    }

    getOwnPropertyDescriptor( target: any, prop: PropertyKey): PropertyDescriptor | undefined
    {
        this.trigger.notifyRead();
        return Reflect.getOwnPropertyDescriptor( target, prop);
    }

    ownKeys( target: any): PropertyKey[]
    {
        this.trigger.notifyRead();
        return Reflect.ownKeys( target);
    }



    // The trigger object which should send notifications to its watchers when reads or changes
    // occur
    protected trigger: Trigger;

    // Number indicating to what level the items of container types should be triggerrized.
    protected depth: number;
}



// /**
//  * Handler for arrays.
//  */
// class ArrayHandler extends NonSlotContainerHandler
// {
//     get( target: Array<any>, prop: PropertyKey, receiver: any): any
//     {
//         this.trigger.notifyRead();
//         return Reflect.get( target, prop, receiver);
//     }
// }



// /**
//  * Handler for on plain objects.
//  */
// class ObjectHandler extends NonSlotContainerHandler
// {
//     get( target: any, prop: PropertyKey, receiver: any): any
//     {
//         return Reflect.get( target, prop, receiver);
//     }
// }



/**
 * Base class for shallow Map/Set handlers. Methods whose names were supplied in the constructor,
 * notify change; all other methods notify read.
 *
 * For Map and Set in order to be proxied, the methods returned from get() must be
 * bound to the target. See https://javascript.info/proxy#built-in-objects-internal-slots.
 */
class SlotContainerHandler implements ProxyHandler<any>
{
    constructor( trigger: Trigger, mutatorMethodNames: Set<PropertyKey>, depth: number)
    {
        this.trigger = trigger;
        this.mutatorMethodNames = mutatorMethodNames;
        this.depth = depth;
    }

    // Retrieve container methods and properties. We always notify read and we wrap methods in
    // functions that when called will notify either read or change depending on whether the
    // method is a mutator.
    get( target: any, prop: PropertyKey, receiver: any): any
    {
        this.trigger.notifyRead();

        // in this context "this" is the handler; however, when the methods we return are called
        // the "this" will be the Proxy object. Therefore, we want these methods to capture and
        // use the handler object.
        let handler = this;

        // check whether this method is already in our internal map
        let method = this.wrappedMethods.get( prop);
        if (!method)
        {
            // get the value from the target
            let propVal = target[prop];
            if (typeof propVal !== "function")
                return propVal;

            // bind the original method to the target object
            let orgBoundMethod = propVal.bind( target);

            if (this.mutatorMethodNames.has(prop))
            {
                // for mutator methods we create and return a function that, when called, invokes the
                // handler specific functionality, which knows about the structure of the arguments
                // and will create proxies for the appropriate objects if needed. This functionality
                // will also indicate whether an actual change occurs so that we can notify about it.
                method = function(): any {
                    let ret: [any, boolean] = handler.callOrgMutatorMethod( target, prop, orgBoundMethod, ...arguments);
                    if (ret[1])
                        handler.trigger.notifyChanged();

                    return ret[0];
                    // return orgBoundMethod( ...arguments);
                };
            }
            else
            {
                // For non-mutator methods, we notify the read and invoke the original method.
                method = function(): any {
                    handler.trigger.notifyRead();
                    return orgBoundMethod( ...arguments);
                };
            }

            this.wrappedMethods.set( prop, method);
        }

        return method;
    }

    /**
     * Method that must be overridden in the derived classes and which is responsible for calling
     * a muutator method with the given name.
     * @param name
     * @param orgMethod
     * @param args Two element tuple where the first element is the return value and the second
     * element is a flag indicating whether the container has changed.
     */
    protected callOrgMutatorMethod( target: any, name: PropertyKey, orgMethod: Function, ...args: any[]): [any, boolean]
    {
        return [undefined,false];
    }



    // The trigger object which should send notifications to its watchers when reads or changes
    // occur
    protected trigger: Trigger;

    // Number indicating to what level the items of container types should be triggerrized.
    protected depth: number;

    // Set of method names, which mutate the contaier. All other methods only read from it.
    private mutatorMethodNames: Set<PropertyKey>;

    // This map keeps already wrapped methods so that we don't do binding more than once.
    private wrappedMethods = new Map<PropertyKey,Function>();
}



/**
 * Handler for maps.
 */
class MapHandler extends SlotContainerHandler
{
    private static mutatorMethodNames = new Set<PropertyKey>(["clear", "delete", "set"]);

    constructor( trigger: Trigger, depth: number)
    {
        super( trigger, MapHandler.mutatorMethodNames, depth);
    }

    /**
     * Implements map-specific mutator methods.
     * @param name
     * @param orgMethod
     * @param args Two element tuple where the first element is the return value and the second
     * element is a flag indicating whether the container has changed.
     */
    protected callOrgMutatorMethod( target: Map<any,any>, name: PropertyKey, orgMethod: Function, ...args: any[]): [any, boolean]
    {
        if (name === "clear")
        {
            let isChanged = target.size > 0;
            orgMethod();
            return [undefined, isChanged];
        }
        else if (name === "set")
            return [orgMethod( args[0], triggerrize( args[1], this.trigger, this.depth)), true];
        else if (name === "delete")
        {
            let deleted = orgMethod( args[0]);
            return [deleted, deleted];
        }
    }
}



/**
 * Handler for sets.
 */
class SetHandler extends SlotContainerHandler
{
    private static mutatorMethodNames = new Set<PropertyKey>(["add", "delete", "clear"]);

    constructor( trigger: Trigger, depth: number)
    {
        super( trigger, SetHandler.mutatorMethodNames, depth);
    }

    /**
     * Implements set-specific mutator methods.
     * @param name
     * @param orgMethod
     * @param args Two element tuple where the first element is the return value and the second
     * element is a flag indicating whether the container has changed.
     */
    protected callOrgMutatorMethod( target: Map<any,any>, name: PropertyKey, orgMethod: Function, ...args: any[]): [any, boolean]
    {
        if (name === "add")
            return [orgMethod( triggerrize( args[0], this.trigger, this.depth)), true];
        else if (name === "clear")
        {
            let isChanged = target.size > 0;
            orgMethod();
            return [undefined, isChanged];
        }
        else if (name === "delete")
        {
            let deleted = orgMethod( args[0]);
            return [deleted, deleted];
        }
    }
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Decorators
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Decorator function for defining properties so that changing their value will any watcher
 * objects attached to them to respond.
 * The form `@trigger` designates a default trigger decorator, whose depth will be assigned
 * depending on the value type: Shallow for arrays, maps and sets and Deep for objects.
 * The form `@trigger(n)` designates a trigger decorator factory with the specified depth.
 */
export function trigger( targetOrDepth: any, name?: string): any
{
    if (typeof targetOrDepth === "number")
    {
        // If the first parameter is a number that it is an explicitly specified depth using
        // decorator factory.
        return triggerDecoratorHelper.bind( undefined, targetOrDepth);
    }
    else
    {
        // undefined depth means that that the actual depth will be assigned dependig on the
        // value of the trigger: Shallow for maps, sets and arrays and Deep for objects.
        return triggerDecoratorHelper( undefined, targetOrDepth, name);
    }
}



/**
 * Helper function for defining `@trigger` decorators.
 */
function triggerDecoratorHelper( depth: number, target: any, name: string): void
{
    let sym = Symbol( name + "_trigger");

    Object.defineProperty( target, name, {
        get()
        {
            let triggerObj = this[sym] as ITrigger;
            if (!triggerObj)
                this[sym] = triggerObj = createTrigger( depth);

            return triggerObj.get();
        },
        set( val)
        {
            let triggerObj = this[sym] as ITrigger;
            if (!triggerObj)
                this[sym] = triggerObj = createTrigger( depth, val);
            else
                triggerObj.set( val)
        },
	});
}



/**
 * Decorator function for defining "get" properties or functions retuning a value so that this
 * value will automatically recalculated if any triggers on which this value depends have their
 * values changed. WHen this happens, the watcher objects attached to this computed value will
 * be notified to respond.
 */
export function computed( target: any, name: string, propDescr: PropertyDescriptor)
{
    let sym = Symbol(name);

    // propDesc.value is undefined for accessors and defined for functions
    if (!propDescr.value)
    {
        if (!propDescr.get)
            throw new Error("@computed property requires get() accessor");

        let orgGet = propDescr.get;
        propDescr.get = function(): any
        {
            let triggerObj = this[sym] as IComputedTrigger;
            if (!triggerObj)
                this[sym] = triggerObj = createComputedTrigger( orgGet, this);

            return triggerObj.get();
        }

        if (propDescr.set)
        {
            let orgSet = propDescr.set;
            propDescr.set = function( v: any): void
            {
                g_manager.enterMutationScope();
                try { orgSet.call( this, v); }
                finally { g_manager.exitMutationScope(); }
            }
        }
    }
    else
    {
        let orgFunc = propDescr.value;
        propDescr.value = function( v: any): void
        {
            let triggerObj = this[sym] as IComputedTrigger;
            if (!triggerObj)
                this[sym] = triggerObj = createComputedTrigger( orgFunc, this);

            return triggerObj.get();
        }
    }
}



