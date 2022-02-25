///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Common types
//
///////////////////////////////////////////////////////////////////////////////////////////////////

import {EventSlot, IEventSlot} from "../internal";

/** Type for functions that accept any number of parameters and return any type */
export type AnyAnyFunc = (...args: any[]) => any;

/** Type for functions that accept no parameters and return values of any type */
export type NoneTypeFunc<T> = () => T;

/** Type for functions that accept no parameters and don't return any value */
export type NoneVoidFunc = () => void;

/** Type for functions that accept one parameter of the given type and don't return any value */
export type TypeVoidFunc<T> = (v: T) => void;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Triggers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The ITrigger interface represents an object that keeps a value and notifies all attached wathers
 * when this value changes.
 * @typeparam T Type of the trigger value.
 */
export interface ITrigger<T = any> extends IEventSlot<TypeVoidFunc<T>>
{
    /** Retrieves the current value */
    get(): T;

    /** Sets a new value */
    set( v: T): void;
}



/**
 * Creates a trigger object of the given depth with the given initial value.
 * @typeparam T Type of the trigger value.
 * @param depth Depth of the trigger, whcih determines how many levels of nested properties of
 * arrays, maps, sets and objects should trigger changes.
 * @param v Optional initial value
 */
export function createTrigger<T = any>( v?: T, depth?: number): ITrigger<T>
{
    return new Trigger( v, depth);
}



/**
 * The Trigger class represents an object that keeps a value and notifies all attached watchers
 * when this value changes.
 */
class Trigger<T = any> extends EventSlot<TypeVoidFunc<T>> implements ITrigger<T>
{
    constructor( v?: T, depth?: number)
    {
        super();
        this.depth = depth;
        this.v = triggerrize( v, this, depth);
    }

    // Retrieves the current value
    public get(): T
    {
        currentWatcher?.notifyTriggerRead(this);
        return this.v;
    }

    // Sets a new value
    public set( v: T): void
    {
        // nothing to do if the value is the same
        if (v === this.v)
            return;

        this.v = triggerrize( v, this, this.depth);
        this.fire(v);
    }

    /** Notifies the current watcher (if exists) that trigger value has been read */
    public notifyRead()
    {
        currentWatcher?.notifyTriggerRead(this);
    }

    /** Fires the "change" event with the current value */
    public notifyWrite()
    {
        this.fire( this.v);
    }

    // Number indicating to what level the items of container types should be triggerrized.
    private depth: number;

    // Value being get and set
    private v: T;
}



/**
 * Checks whether the given object is a trigger.
 * @param obj Object to check whether it is a trigger
 * @returns True if the object is a trigger and false otherwise
 */
export const isTrigger = (obj: object): obj is ITrigger => obj instanceof Trigger;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Watchers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The IWatcher interface represents a callable object that wraps a function and has the same
 * signature as this function. When a watcher is called it calls the wrapped function and attaches
 * to all triggers whose values were read during the course of the call. When values of these
 * triggers change, a responder function is called. The responder function is provided when the
 * watcher is created, but it can be changed later.
 * @typeparam T Type (signature) of the function to be watched.
 */
export interface IWatcher<T extends AnyAnyFunc = any>
{
    /** This is a callable interface, which is implement as a function. */
    (...args: Parameters<T>): ReturnType<T>;

    /** Clears internal resources. */
    dispose(): void;
}



/**
 * This function bound to an instance of the Watcher class is returned from the
 * createWatcher function.
 * @param args
 * @returns
 */
function watcherExecute( this: Watcher, ...args: any[]): any
{
    return this.execute( args);
}

/**
 * This function bound to an instance of the Watcher class is set to the `dispose` property of the
 * bound watcherExecute function.
 * @returns
 */
function watcherDispose( this: Watcher): void
{
    this.dispose();
}

/**
 * Creates a watcher function with the same signature as the given regular function. When the
 * watcher function is invoked it invokes the original function and it notices all trigger objects
 * that were read during its execution. When any of these trigger objects have their values
 * changed, the responder function will be called.
 *
 * @typeparam T Type (signature) of the function to be watched.
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
    // create a new watcher object and bind the watcher function to this object.
    let watcherObj = new Watcher( func, responder, funcThis, responderThis);
    let watcherFunc = watcherExecute.bind( watcherObj);

    // bind the watcher dispose function to the watcher object and set it as the property on
    // the previously bound instance of the watcher function
    watcherFunc.dispose = watcherDispose.bind( watcherObj)

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
     * Executes the original function while noticing read notificaions from triggers.
     */
    public execute( args: any[]): any
    {
        // check whether our watcher has been already disposed
        if (!this.func)
        {
            /// #if DEBUG
            console.error( "Disposed watcher was called.");
            /// #endif

            return;
        }

        // move all current triggers to a temporary set
        let oldTriggers = this.triggers;
        this.triggers = new Set();

        // install our watcher at the top of the watchers stack
        let prevWatcher = currentWatcher;
        currentWatcher = this;

        // call the function
        try
        {
            return this.func.apply( this.funcThis, args);
        }
        finally
        {
            // remove our watcher from the top of the watchers stack
            currentWatcher = prevWatcher;

            // remove our watcher from those triggers in the old set that are not in the current set
            oldTriggers.forEach( trigger => !this.triggers.has(trigger) && trigger.detach(this.onTriggerChanged));
        }
    }

    /** Clears internal resources. */
    public dispose(): void
    {
        // check whether the object is already disposed
        if (!this.func)
            return;

        // detaches this watcher from all the triggers and the triggers from this watcher.
        this.triggers.forEach( trigger => trigger.detach( this.onTriggerChanged));
        this.triggers.clear();

        // remove this watcher from the deferred set
        deferredWatchers.delete( this);

        // indicate that the watcher has been disposed
        this.func = null;
        this.responder = null;
    }

    /**
     * Notifies that the value of the given trigger object has been read.
     */
    public notifyTriggerRead( trigger: Trigger): void
    {
        this.triggers.add( trigger);
        trigger.attach( this.onTriggerChanged);
    }

    /**
     * Handler for change events fired by all triggers this watcher is listening to. We don't need
     * to distinguish between triggers and we also don't need the trigger's value.
     */
    private onTriggerChanged = () =>
        mutationScopesRefCount ? deferredWatchers.add( this) : this.respond();

    // Notifies the watcher that it should call the responder function. This occurs when there
    // are triggers whose values have been changed
    public respond(): void
    {
        // check whether our watcher has been already disposed. It can happen if after all mutation
        // scopes exited the manager notifies multiple watchers and one of the watchers' responder
        // disposes of another watcher.
        this.responder?.apply( this.responderThis);
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

    // Set of triggers currently being watched by this watcher. The purpose of knowing what
    // triggers are used by what watcher is to remove the watcher from all these triggers when
    // the watcher is disposed.
    public triggers = new Set<Trigger>();
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Computed triggers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a computed trigger object whose value is calculated by the given function and with an
 * optional initial value.
 *
 * @typeparam T Type of the computed value.
 * @param func Function, method or get accessor that produces the computed value.
 * @param funcThis Optional `this` value to use when invoking the computing function.
 * @returns Trigger object that will trigger changes only when the computed value changes.
 */
export function createComputedTrigger<T = any>( func: NoneTypeFunc<T>, funcThis?: any): ITrigger<T>
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
class ComputedTrigger<T = any> extends Trigger<T>
{
    constructor( func: NoneTypeFunc<T>, funcThis?: any)
    {
        super();

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

    public detach( listener: TypeVoidFunc<T>): void
    {
        super.detach( listener);

        // we keep our function watcher only if we still have somebody watching us.
        if (this.funcWatcher && this.has())
        {
            this.funcWatcher.dispose();
            this.funcWatcher = null;
            this.isStale = true;
        }
    }

    /**
     * This method is invoked when our watcher is notified of changes in its trigger values. We
     * respond by invoking the function (through the watcher) and setting its return value as
     * our new value. This can trigger changes in watchers that are using our value. Note that
     * we only invoke our watcher if there is at least one watcher that watches our value.
     */
    private responder(): void
    {
        if (this.funcWatcher)
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
// Global functionality of the trigger-watcher mechanism. It includes a stack of watcher objects
// currently executing their functions and watching for trigger objects to be read. When a trigger
// object is being read (that is its get() method is called), all the watchers in the stack are
// notified, because they all depend on the trigger object's value for their functionality.
//
// It also maintains a reference count of mutation scopes and handles notifying watchers of
// mutations only when the last mutation scope has exited. The triggers don't notify the watchers
// directly; instead, they notify the manager, which accumulates the information and notifies all
// the watchers once out of the last mutation scope.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

// Current watcher objects that will receive notification when trigger values are read.
let currentWatcher: Watcher;

// Number of currently active mutation scopes. When a trigger notifies that its value has been
// changed while this number is not 0, the trigger will be remembered in the internal set.
// After all mutation scopes are finished, the watchers attached to all triggers in the set
// will be notified. When a trigger notifies that its value has been changed while there are
// no mutation scopes present, the watchers attached to the trigger are notified immediately.
let mutationScopesRefCount = 0;

// Set of watchers that should be notified when the last mutation scope exits. Using Set
// ensures that no matter how many triggers reference a watcher, the watcher will be present
// only once.
const deferredWatchers = new Set<Watcher>();



/**
 * Sets the given watcher object as the current watcher and returns the previous watcher
 */
const setCurrentWatcher = (watcher: Watcher): Watcher =>
{
    let prevWatcher = currentWatcher;
    currentWatcher = watcher;
    return prevWatcher;
}

/**
 * Increments mutation scope reference count
 */
export const enterMutationScope = (): void =>
{
    mutationScopesRefCount++;
}

/**
 * Decrements mutation scope reference count. If it reaches zero, notifies all deferred watchers.
 */
export const exitMutationScope = (): void =>
{
    if (mutationScopesRefCount === 0)
    {
        /// #if DEBUG
        console.error( "Unpaired call to exitMutationScope");
        /// #endif

        return;
    }

    if (--mutationScopesRefCount === 0)
    {
        // since when watchers respond, they can execute their watcher functions and that could
        // mess with the same set of watchers we are iterating over. Therefore, we make a copy
        // of this set first.
        let watchers = Array.from( deferredWatchers.keys());
        deferredWatchers.clear();
        watchers.forEach( watcher => watcher.respond());
    }
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
 * @param depth The depth on the level (starting from the trigger) that called this function.
 * If this parameter is 0, no conversion occurs and the value is returned as is. When this function
 * is called from the trigger, this parameter can be undefined: in this case, we will assign the
 * depth depending on the type of the value. Arrays, objects, maps and sets get depths of 1,
 * meaning that operations that add or remove items will trigger events, but modifications to the
 * items will not. Primitive types will be returned as is.
 */
function triggerrize<T = any>( v: T, trigger: Trigger, depth?: number): T
{
    if (!v || depth === 0 || typeof v !== "object")
        return v;

    let actDepth = depth ? depth - 1 : 0;
    if (Array.isArray(v))
        return new Proxy( v, new NonSlotHandler( trigger, actDepth)) as any as T;
    else if (v instanceof Map)
        return new Proxy( v, new MapHandler( trigger, actDepth)) as any as T;
    else if (v instanceof Set)
        return new Proxy( v, new SetHandler( trigger, actDepth)) as any as T;
    else if (v.constructor === Object)
        return new Proxy( v, new NonSlotHandler( trigger, actDepth)) as any as T;
    else
        return v;
}



/**
 * Base class for Array and plain object handlers.
 */
class NonSlotHandler implements ProxyHandler<any>
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
            let retVal = Reflect.set( target, prop, triggerrize( value, this.trigger, this.depth), receiver);
            this.trigger.notifyWrite();
            return retVal;
        }
        else
            return true;
    }

    // deleteProperty( target: any, prop: PropertyKey): boolean
    // {
    //     notifyTriggerChanged( this.trigger);
    //     return Reflect.deleteProperty( target, prop);
    // }

    // defineProperty( target: any, prop: PropertyKey, attrs: PropertyDescriptor): boolean
    // {
    //     notifyTriggerChanged( this.trigger);
    //     return Reflect.defineProperty( target, prop, attrs);
    // }

    // has( target: any, prop: PropertyKey): boolean
    // {
    //     currentWatcher?.notifyTriggerRead(this.trigger);
    //     // notifyTriggerRead( this.trigger);
    //     return Reflect.has( target, prop);
    // }

    // getPrototypeOf( target: any): object | null
    // {
    //     notifyTriggerRead( this.trigger);
    //     return Reflect.getPrototypeOf( target);
    // }

    // isExtensible( target: any): boolean
    // {
    //     notifyTriggerRead( this.trigger);
    //     return Reflect.isExtensible( target);
    // }

    // getOwnPropertyDescriptor( target: any, prop: PropertyKey): PropertyDescriptor | undefined
    // {
    //     notifyTriggerRead( this.trigger);
    //     return Reflect.getOwnPropertyDescriptor( target, prop);
    // }

    // ownKeys( target: any): ArrayLike<string | symbol>
    // {
    //     notifyTriggerRead( this.trigger);
    //     return Reflect.ownKeys( target);
    // }



    // The trigger object which should send notifications to its watchers when reads or changes
    // occur
    protected trigger: Trigger;

    // Number indicating to what level the items of container types should be triggerrized.
    protected depth: number;
}



/**
 * Base class for shallow Map/Set handlers. Methods whose names were supplied in the constructor,
 * notify change; all other methods notify read.
 *
 * For Map and Set in order to be proxied, the methods returned from get() must be
 * bound to the target. See https://javascript.info/proxy#built-in-objects-internal-slots.
 */
abstract class SlotContainerHandler implements ProxyHandler<any>
{
    constructor( trigger: Trigger, mutators: Set<PropertyKey>, depth: number)
    {
        this.trigger = trigger;
        this.mutators = mutators;
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

            if (this.mutators.has(prop))
            {
                // for mutator methods we create and return a function that, when called, invokes the
                // handler specific functionality, which knows about the structure of the arguments
                // and will create proxies for the appropriate objects if needed. This functionality
                // will also indicate whether an actual change occurs so that we can notify about it.
                method = function(): any {
                    let [val, changed] = handler.callMutator( target, prop, orgBoundMethod, ...arguments);
                    if (changed)
                        handler.trigger.notifyWrite();

                    return val;
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
    protected abstract callMutator( target: any, name: PropertyKey, orgMethod: Function,
        ...args: any[]): [any, boolean];



    // The trigger object which should send notifications to its watchers when reads or changes
    // occur
    protected trigger: Trigger;

    // Number indicating to what level the items of container types should be triggerrized.
    protected depth: number;

    // Set of method names, which mutate the contaier. All other methods only read from it.
    private mutators: Set<PropertyKey>;

    // This map keeps already wrapped methods so that we don't do binding more than once.
    private wrappedMethods = new Map<PropertyKey,Function>();
}



const mapMutatorMethodNames = new Set<PropertyKey>(["clear", "delete", "set"]);

/**
 * Handler for maps.
 */
class MapHandler extends SlotContainerHandler
{
    constructor( trigger: Trigger, depth: number)
    {
        super( trigger, mapMutatorMethodNames, depth);
    }

    /**
     * Implements map-specific mutator methods.
     * @param name
     * @param orgMethod
     * @param args Two element tuple where the first element is the return value and the second
     * element is a flag indicating whether the container has changed.
     */
    protected callMutator( target: Map<any,any>, name: PropertyKey, orgMethod: Function, ...args: any[]): [any, boolean]
    {
        if (name === "clear")
        {
            let isChanged = target.size > 0;
            orgMethod();
            return [undefined, isChanged];
        }
        else if (name === "set")
            return [orgMethod( args[0], triggerrize( args[1], this.trigger, this.depth)), true];
        else // if (name === "delete")
        {
            let deleted = orgMethod( args[0]);
            return [deleted, deleted];
        }
    }
}



const setMutatorMethodNames = new Set<PropertyKey>(["add", "delete", "clear"]);

/**
 * Handler for sets.
 */
class SetHandler extends SlotContainerHandler
{
    constructor( trigger: Trigger, depth: number)
    {
        super( trigger, setMutatorMethodNames, depth);
    }

    /**
     * Implements set-specific mutator methods.
     * @param name
     * @param orgMethod
     * @param args Two element tuple where the first element is the return value and the second
     * element is a flag indicating whether the container has changed.
     */
    protected callMutator( target: Map<any,any>, name: PropertyKey, orgMethod: Function, ...args: any[]): [any, boolean]
    {
        if (name === "add")
            return [orgMethod( triggerrize( args[0], this.trigger, this.depth)), true];
        else if (name === "clear")
        {
            let isChanged = target.size > 0;
            orgMethod();
            return [undefined, isChanged];
        }
        else // if (name === "delete")
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
export const trigger = (targetOrDepth: any, name?: string): any =>
{
    if (typeof targetOrDepth === "number")
    {
        // If the first parameter is a number, then it is an explicitly specified depth using
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
const triggerDecoratorHelper = (depth: number, target: any, name: string): void =>
{
    let sym = Symbol( name + "_trigger");

    Object.defineProperty( target, name, {
        get()
        {
            let triggerObj = this[sym] as ITrigger;
            if (!triggerObj)
                this[sym] = triggerObj = createTrigger( undefined, depth);

            return triggerObj.get();
        },
        set( val)
        {
            let triggerObj = this[sym] as ITrigger;
            if (!triggerObj)
                this[sym] = triggerObj = createTrigger( val, depth);
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
export const computed = (target: any, name: string, propDescr: PropertyDescriptor): void =>
{
    let sym = Symbol(name);

    // propDesc.value is undefined for accessors and defined for functions
    if (!propDescr.value)
    {
        if (!propDescr.get)
        {
            /// #if DEBUG
            console.error(`@computed property 'name' doesn't have get() accessor`);
            /// #endif

            return;
        }

        let orgGet = propDescr.get;
        propDescr.get = function(): any
        {
            let triggerObj = this[sym] as ITrigger;
            if (!triggerObj)
                this[sym] = triggerObj = createComputedTrigger( orgGet, this);

            return triggerObj.get();
        }

        if (propDescr.set)
        {
            let orgSet = propDescr.set;
            propDescr.set = function( v: any): void
            {
                enterMutationScope();
                try { orgSet.call( this, v); }
                finally { exitMutationScope(); }
            }
        }
    }
    else
    {
        let orgFunc = propDescr.value;
        propDescr.value = function( v: any): void
        {
            let triggerObj = this[sym] as ITrigger;
            if (!triggerObj)
                this[sym] = triggerObj = createComputedTrigger( orgFunc, this);

            return triggerObj.get();
        }
    }
}



