import { AnyAnyFunc, ITrigger, IWatcher, NoneTypeFunc, NoneVoidFunc } from "../api/TriggerTypes";
import {EventSlot} from "../api/EventSlotAPI";



/// #if DEBUG
let nextTriggerDebugId = 1;
let nextWatcherDebugId = 1;
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Triggers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The Trigger class represents an object that keeps a value and notifies the current watcher (if
 * any) when this value changes.
 */
export class Trigger<T = any> extends EventSlot<NoneVoidFunc> implements ITrigger<T>
{
    /// #if DEBUG
    debugId: number = nextTriggerDebugId++;
    /// #endif

    // Number indicating to what level the items of container types should be triggerrized.
    private depth?: number;

    // Value being get and set
    private v: T;

    constructor(v?: T, depth?: number)
    {
        super();

        this.depth = depth;
        this.v = triggerize(v, depth) as T;
    }

    // Retrieves the current value
    public get(): T
    {
        currentWatcher?.notifyTriggerRead(this);
        return this.v;
    }

    // Sets a new value
    public set(v: T): void
    {
        // nothing to do if the value is the same
        if (untriggerize(v) !== untriggerize(this.v))
        {
            this.v = triggerize(v, this.depth);
            this.fire();
        }
    }

    /** Notifies the current watcher (if exists) that trigger value has been read */
    public notifyRead()
    {
        currentWatcher?.notifyTriggerRead(this);
    }

    /** Fires the "change" event */
    public notifyWrite()
    {
        this.fire();
    }
}



/**
 * Checks whether the given object is a trigger.
 * @param obj Object to check whether it is a trigger
 * @returns True if the object is a trigger and false otherwise
 */
export const isTrigger = (obj: object): obj is ITrigger =>
    obj instanceof Trigger;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Watchers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The Watcher class encapsulates the functionality of watching for trigger objects encountered
 * during a function execution. When the trigger objects are read, they are remembered by the
 * Watcher object. Whenever a value is changed in any of these triggers, the watcher object is
 * notified and calls the responder function.
 */
export class Watcher<T extends AnyAnyFunc = any>
{
    /**
     * Creates a watcher function with the same signature as the given regular function. When the
     * watcher function is invoked it invokes the original function and it notices all trigger objects
     * that were read during its execution. When any of these trigger objects have their values
     * changed, the responder function will be called.
     *
     * @typeParam T Type (signature) of the function to be watched.
     * @param func Function to be watched
     * @param responder Function to be invoked when values of the trigger objects encountered during
     * the original function's last execution change.
     * @param funcThis Optional value of "this" that will be used to call the original function.
     * @param responderThis Optional value of "this" that will be used to call the responder function.
     * If this value is undefined, the "this" value for the original function will be used.
     */
    static create<T extends AnyAnyFunc>( func: T, responder: NoneVoidFunc,
        funcThis?: any, responderThis?: any): IWatcher<T>
    {
        // create a new watcher object and bind the watcher function to this object.
        let watcherObj = new Watcher( func, responder, funcThis, responderThis);
        let watcherFunc = watcherObj.execute.bind( watcherObj) as IWatcher<T>;

        // bind the watcher dispose function to the watcher object and set it as the property on
        // the previously bound instance of the watcher function
        watcherFunc.dispose = watcherObj.dispose.bind( watcherObj);
        return watcherFunc;
    }



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
    public execute( ...args: any[]): any
    {
        // check whether our watcher has been already disposed
        if (!this.func)
        {
            /// #if DEBUG
            console.error( "Disposed watcher was called.");
            /// #endif

            return;
        }

        // move all current triggers to a temporary set. We don't detach our watcher from these
        // triggers yet, because the function might read the same triggers again and we don't want
        // to detach and reattach in this case. Instead, we will be just increasing their reference
        // count. We will detach our watcher from all the old triggers after the function has been
        // executed, and this will decrease the reference count or detach from the trigger completely.
        let oldTriggers = this.triggers;
        this.triggers = new Set();

        // install our watcher at the top of the watchers stack
        let prevWatcher = currentWatcher;
        currentWatcher = this;

        // call the function
        try
        {
            return this.func.apply(this.funcThis, args);
        }
        finally
        {
            // remove our watcher from the top of the watchers stack
            currentWatcher = prevWatcher;

            // remove our watcher from old triggers. This when we forget about the triggers that
            // were read during the previous execution of the function and that are not read during
            // this execution.
            oldTriggers.forEach(trigger => trigger.detach(this.onTriggerChanged));
        }
    }

    /** Clears internal resources. */
    public dispose(): void
    {
        // check whether the object is already disposed
        if (!this.func)
        {
            /// #if DEBUG
            console.error("Disposing already disposed watcher.");
            /// #endif

            return;
        }

        // detaches this watcher from all the triggers and the triggers from this watcher.
        this.triggers.forEach( trigger => trigger.detach(this.onTriggerChanged));
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
    public notifyTriggerRead(trigger: Trigger): void
    {
        // if we have already seen this trigger, we don't need to attach to it again. That means
        // that during a watch function run we will be attaching to each encountered trigger only
        // once. This is necessary because when the trigger is not encountered on a subsequent run,
        // we will detach from it only once.
        if (!this.triggers.has(trigger))
        {
            this.triggers.add( trigger);
            trigger.attach(this.onTriggerChanged);
        }
    }

    /**
     * Handler for change events fired by all triggers this watcher is listening to. We don't need
     * to distinguish between triggers and we also don't need the trigger's value.
     */
    private onTriggerChanged = () =>
        mutationScopesRefCount ? deferredWatchers.add(this) : this.respond();

    // Notifies the watcher that it should call the responder function. This occurs when there
    // are triggers whose values have been changed
    public respond(): void
    {
        // check whether our watcher has been already disposed. It can happen if after all mutation
        // scopes exited the manager notifies multiple watchers and one of the watchers' responder
        // disposes of another watcher.
        this.responder?.apply(this.responderThis);
    }



    /// #if DEBUG
    debugId: number = nextWatcherDebugId++;
    /// #endif

    /**
     * Function being watched; that is, during which we should listen to triggers being read, so
     * that we can remember them and later respond when they notify that their values have been
     * changed.
     **/
    private func: T | null;

    // Function to be invoked when the the value of one of the triggers changes
    private responder: NoneVoidFunc | null;

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
 * The ComputedTrigger class represents a value that is calculated by a function. This is a
 * combination of Trigger and Watcher. It is a watcher because it watches over the function and
 * calls it whenever any triggers this function uses are changed. It is a trigger because it
 * triggers change when the function returns a new value.
 *
 * The important fact about a computed trigger is that it only invokes the watched function
 * if it's value is being used by at least one watcher.
 */
export class ComputedTrigger<T = any> extends Trigger<T>
{
    constructor(func: NoneTypeFunc<T>, thisArg?: any)
    {
        super();

        this.func = func;
        this.thisArg = thisArg;

        // we don't create the watcher until the get method is called
        this.isStale = true;
    }

    // Retrieves the current value
    public get(): T
    {
        if (this.isStale)
        {
            // we need to create the watcher if this is the first time the get method is called.
            if (!this.watcher)
                this.watcher = Watcher.create(this.func, this.responder, this.thisArg, this);

            super.set(this.watcher());
            this.isStale = false;
        }

        return super.get();
    }

    public detach(listener: NoneVoidFunc): void
    {
        super.detach(listener);

        // we keep our function watcher only if we still have somebody watching us.
        if (this.watcher && !this.has())
        {
            this.watcher.dispose();
            this.watcher = null;
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
        if (this.watcher)
            super.set(this.watcher());
        else
            this.isStale = true;
    }



    // Function we will be watching
    private func: NoneTypeFunc<T>;

    // "this" value to apply to the watched function when calling it.
    private thisArg: any;

    // Watcher over our function
    private watcher: IWatcher<NoneTypeFunc<T>> | null | undefined;

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
 * Increments mutation scope reference count
 */
export const startMutations = (): void =>
{
    mutationScopesRefCount++;
}

/**
 * Decrements mutation scope reference count. If it reaches zero, notifies all deferred watchers.
 */
export const stopMutations = (): void =>
{
    if (mutationScopesRefCount === 0)
    {
        /// #if DEBUG
        console.error( "Unpaired call to exitMutationScope");
        /// #endif

        return;
    }

    if (--mutationScopesRefCount === 0 && deferredWatchers.size)
    {
        // since when watchers respond, they can execute their watcher functions and that could
        // mess with the same set of watchers we are iterating over. Therefore, we make a copy
        // of this set first.
        let watchers = Array.from(deferredWatchers);
        deferredWatchers.clear();
        for(let watcher of watchers)
            watcher.respond();
    }
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Triggerizing. This is the process of converting a non-primitive value into a Proxy object that
// can be used with a trigger. That is, watchers reading values from this proxy will start tracking
// its value and be notified when the value changes. The triggerizing process can start when a
// class property is decorated with @trigger or when the `triggerize` function is called directly.
// The triggerizing process is recursive, that is, if the value is a container (object, array, map
// or set), its items will be triggerized as well when accessed (read or written). No triggerization
// occurs for values that are not accessed. The depth of this recursion can be controlled by the depth
// parameter of the @trigger decorator or the `triggerize` function. A depth of 0 means that no
// triggerizing occurs and the value is returned as is. Note again that only non-primitive values
// are triggerized. Primitive values are always returned as is.
//
// The Proxy object returned by the `triggerize` function has in its handler a Trigger object,
// which is responsible for notifying of reads and writes that change the container as opposed to
// the individual items. For example, this occurs when the number of items in the container changes.
// The container trigger notifies of reads any time an item is accessed and it notifies of changes
// when an item is added or removed from the container. When an item is read or assigned a new value,
// the trigger for that item is created and it is this trigger that will notify of reads and changes
// in the item's value.
//
// The Proxy object returned by the `triggerize` function is marked with a special symbol pointing
// to the target object, while the target object is marked with another symbol pointing to the
// proxy. This is used to avoid triggerizing the same object multiple times.
//
///////////////////////////////////////////////////////////////////////////////////////////////////



/**
 * A symbol to mark proxy objects for triggerized values. The value of this symbol is the original
 * object that was triggerized to create the proxy. This is used to avoid triggerizing
 * the same object multiple times.
 */
const symTarget = Symbol("symTarget");

/**
 * A symbol to mark objects that have been alredy triggerized. The value of this symbol is the Proxy
 * object created when the object was triggerized for the first time. This is used to avoid triggerizing
 * the same object multiple times.
 */
const symProxy = Symbol("symProxy");



/**
 * Determines whether the given value can be triggerized on the current depth level. Triggerization
 * is not possible in the following cases:
 *   - the value is null or undefined
 *   - the depth is 0, meaning that we don't actually want to triggerize the value
 *   - the value is not an object (that is, it is a primitive type)
 *   - the value is already a trigger proxy
 * If triggerization is possible, it might happen that the object has alreay been triggerized. In
 * this case, the original proxy object createed during the prior triggerization is also returned.
 * @param v Value to check whether it can be triggerized
 * @param depth Optional depth of the level that called this function. If this parameter is 0, no
 * triggerization occurs and the value is returned as is. If undefined or negative, no restriction
 * on depth is applied. If positive, only that number of levels is subject to triggerization.
 * @returns Tuple with three elements:
 *   - The first element is a flag indicating whether the input value can be triggerized (this is
 *     also true if the value is already triggerized).
 *   - The second element is either undefined if the value has not been triggerized yet, or is the
 *     proxy object created on the previous triggerization of the value.
 *   - The third element is the target object of the proxy if the value is a proxy; otherwise, it
 *     is the value itself. In other words, the third element is always the untriggerized object
 *     including null, undefined and values of primitive types.
 */
export function canTriggerize<T>(v: T, depth?: number): [boolean, T | undefined, T]
{
    if (!v || typeof v !== "object" || depth === 0)
        return [false, undefined, v];

    // if symTarget is in v, it means v is a proxy; if symProxy is in v, it means v is already
    // triggerized and v[symProxy] returns the proxy; otherwse, there is no proxy (undefined).
    let proxy = symTarget in v ? v : v[symProxy];

    // if symProxy is in v, it means v is the untriggerized object; if symTarget is in v, it means
    // v is a proxy and v[symTarget] returns the object; otherwise, v is not yet triggerized.
    let obj = symProxy in v ? v : proxy?.[symTarget] ?? v;

    return [true, proxy, obj];
}



/**
 * Depending on the given trigger depth and on the value type, either returns the same value or, if
 * it is a container (object, array, map or set), returns a proxy to the value that knows to
 * notify read and change when its methods and properties are invoked.
 * @param v Value to triggerize. If it is a primitive value, it is returned as is. If it is a container,
 * it is triggerized.
 * @param depth Optional depth of the level that called this function. If this parameter is 0, no
 * triggerization occurs and the value is returned as is. If undefined or negative, no restriction
 * on depth is applied. If positive, only that number of levels is subject to triggerization.
 * @returns A proxy to the triggerized input value or the value itself if it cannot be triggerized.
 */
export function triggerize<T>(v: T, depth?: number): T
{
    // if depth is undefined, we assign a negative value to it. Note that if depth is 0,
    // it will still be 0.
    depth = depth ?? -1;

    // check whether the value can be triggerized at the given level and whether it is already
    // a proxy of the triggerized object or an already triggerized object itself. If it cannot be
    // triggerized or it is already/has a proxy, return the value as is.
    let [canBeTriggerized, proxy] = canTriggerize(v, depth);
    if (!canBeTriggerized)
        return v;
    else if (proxy)
        return proxy;

    // We are here only if v is an untriggerized-yet object. For arrays, plain objects, maps and
    // sets we will create a trigger proxy. For other types of objects we don't create a proxy and
    // return the original value.
    let handlerClass: new (depth: number, target: any) => ProxyHandler<any>;
    if (Array.isArray(v) || (v as any).constructor === Object)
        handlerClass = ArrayObjectHandler;
    // else if (v instanceof Map)
    //     handlerClass = MapHandler;
    else if (v instanceof Set)
        handlerClass = SetHandler;
    else
        return v;

    return v[symProxy] = new Proxy( v as any as object, new handlerClass(depth - 1, v)) as any as T;
}



/**
 * Determines whether the given value is a trigger proxy and, if it is, returns the target value.
 * @param v Value to check whether it is a trigger proxy
 * @returns If the given value is not a trigger proxy, returns the value as is; otherwise,
 * returns the value, whcih is the target of the proxy.
 */
export function untriggerize(v: any): any
{
    // proxy's target is kept under the symTriggerProxyTarget returned by the proxy's handler.
    return v && typeof v === "object" && symTarget in v ? v[symTarget] : v;
}



/**
 * Base handler class for all containers: Array, plain object, Map and Set.
 */
abstract class BaseContainerHandler<T extends object> implements ProxyHandler<T>
{
    /** The target object being proxied. */
    protected target: T;

    /**
     * Trigger object which notifies of reads or changes in the container as a whole. For example,
     * when the number of items in the container changes. This trigger is notified of reads anytime
     * an item is accessed and it is notified of changes when an item is added or removed from the
     * container. This trigger doesn't hold any particular value (that is, it is undefined); it is
     * triggerred only through its notifyRead and notifyWrite methods.
     */
    protected trigger: Trigger;

    /**
     * Triggers for individual items - object fields or array elements.
     */
    protected itemTriggers = new Map<any, Trigger>();

    /**
     * Number indicating to what level the items of this container should be triggerized.
     */
    protected depth: number;



    constructor(depth: number, target: T)
    {
        this.depth = depth;
        this.target = target;
        this.trigger = new Trigger();
    }

    // Abstract declaration - neded only to satisfy the compiler that we indeed implement
    // the ProxyHandler interface.
    abstract get(target: T, prop: PropertyKey, receiver: any): any;
}



/**
 * Names of array mutating methods. If a get() trap is invoked for one of them, we don't need to
 * notify read on the container trigger, because the function will notify write on the container
 * trigger when called.
 */
const ArrayMutatingMethods: PropertyKey[] = ["copyWithin", "fill", "pop", "push", "reverse", "shift", "sort", "splice", "unshift"];



/**
 * Base class for Array and plain object handlers.
 */
class ArrayObjectHandler<T extends object> extends BaseContainerHandler<T>
{
    /** Indicates whether the target is an array. */
    isArray: boolean;

    constructor(depth: number, target: T)
    {
        super(depth, target);
        this.isArray = Array.isArray(target);
    }

    get(target: T, prop: PropertyKey, receiver: any): any
    {
        // handle our artificial symbol that marks trigger proxies. We don't call the target
        // and we always return the target itself - this is the way to expose it through the proxy.
        if (prop === symTarget)
            return this.target;

        // check whether we already have a trigger. If no, get the value from the target and
        // create a trigger for it if needed.
        let itemTrigger = this.itemTriggers.get(prop);
        let orgVal: any = undefined;
        if (!itemTrigger)
        {
            // get the value from the target.
            orgVal = Reflect.get(target, prop, receiver);

            // if the target is an array, check the property against the names of array methods. If
            // it is one of them, we don't need to notify read on the container trigger, because the
            // function will notify write on the container trigger when called.
            if (this.isArray && ArrayMutatingMethods.includes(prop))
                return orgVal;

            // if it is a symbol or if the depth is 0, we don't triggerizing the value; otherwise,
            // create a trigger for the property and add it to our internal map.
            if (typeof prop !== "symbol" && this.depth !== 0)
            {
                itemTrigger = new Trigger(orgVal, this.depth - 1);
                this.itemTriggers.set(prop, itemTrigger);
            }
        }

        this.trigger.notifyRead();
        return itemTrigger ? itemTrigger.get() : orgVal;
    }

    set(target: T, prop: PropertyKey, value: any, receiver: any): boolean
    {
        // we use untriggerized values in the target object, so get it now
        let untriggerizedValue = untriggerize(value);

        // if the property is a symbol, we don't need to do anything else. We also don't need to do
        // anything if the depth is 0, because we don't want to triggerize the value.
        if (typeof prop === "symbol" || this.depth === 0)
            return Reflect.set(target, prop, untriggerizedValue, receiver);

        // change the value in the target
        let result = Reflect.set(target, prop, untriggerizedValue, receiver);

        // check if we already have a trigger for this property. If we don't, we will create one
        // with the new value. If trigger already exists, we set the new value to it, which should
        // invoke the listeners if there are any.
        let itemTrigger = this.itemTriggers.get(prop);
        if (!itemTrigger)
        {
            // check whether the property exists on the target. If it doesn't, we will notify the
            // container trigger of a change.
            if (!Reflect.has(target, prop))
                this.trigger.notifyWrite();

            // create a trigger for the property and add it to our internal map
            itemTrigger = new Trigger(value, this.depth - 1);
            this.itemTriggers.set(prop, itemTrigger);
        }
        else
        {
            // this notifies the trigger of a change if the new value is different from the old one
            itemTrigger.set(untriggerizedValue);
        }

        return result;
    }

    deleteProperty(target: T, prop: PropertyKey): boolean
    {
        // delete the property on the target. If it didn't exist, we don't need to do anything.
        let result = Reflect.deleteProperty( target, prop);
        if (!result)
            return false;

        // since the property was deleted, we notify the container trigger of a change
        this.trigger?.notifyWrite();

        // remove the trigger for this property from our internal map.
        let itemTrigger = this.itemTriggers.get(prop);
        if (itemTrigger)
        {
            itemTrigger.clear();
            this.itemTriggers.delete(prop);
        }

        return result;
    }

    has(target: T, prop: PropertyKey): boolean
    {
        // handle our artificial symbol that marks trigger proxies.
        if (prop === symTarget)
            return true;

        this.trigger.notifyRead();
        return Reflect.has(target, prop);
    }

    ownKeys(target: T): ArrayLike<string | symbol>
    {
        this.trigger.notifyRead();
        return Reflect.ownKeys(target);
    }
}



/**
 * Base class for Map/Set handlers. Methods whose names were supplied in the constructor,
 * notify change; all other methods notify read.
 *
 * For Map and Set in order to be proxied, the methods returned from get() must be
 * bound to the target. See https://javascript.info/proxy#built-in-objects-internal-slots.
 */
abstract class MapSetBaseHandler<T extends Map<any,any> | Set<any>> extends BaseContainerHandler<T>
{
    /**
     * Map of method names to their corresponding functions that will be returned from the get()
     * method. This base class takes care of certain methods like `clear` and `delete`, but the
     * derived classes will add other methods to this map. When the methods are called, they
     * will be invoked on this instance and will be passed the original method and the arguments.
     * They will be responsible for calling the original method, for notifying the container trigger
     * of reads and changes and for creating triggers for the items in the container.
     */
    protected wrappers = new Map<PropertyKey, Function>();



    constructor(depth: number, target: T)
    {
        super(depth, target);

        this.registerMethodWrapper("clear", this.clear_wrapper);
        this.registerMethodWrapper("forEach", this.forEach_wrapper);
    }

    /**
     * Registers a wrapper for the given method name using the given function. The wrapper will be
     * returned from the get() method and when called, it will invoke the original method on the
     * target and notify the container trigger of reads and changes. The wrapper will also be
     * responsible for creating triggers for the items in the container. The wrapper will be bound
     * to this instance and to the original method, which is itself bound to the target object.
     * @param prop Name or symbol of the method to register a wrapper for.
     * @param wrappingMethod The method of this or derived class to use as the wrapper.
     */
    protected registerMethodWrapper(prop: PropertyKey, wrappingMethod: Function): void
    {
        this.wrappers.set(prop, wrappingMethod.bind(this, this.target[prop].bind(this.target)));
    }

    /** get() trap */
    get(target: T, prop: PropertyKey, receiver: any): any
    {
        if (prop === symTarget)
            return this.target;

        // if we have a wrapper for the requested property, return it. Otherwise, return the
        // original value from the target. Each wrapper decides whether to notify read or write.
        let wrapper = this.wrappers.get(prop);
        if (wrapper)
            return wrapper;
        else
        {
            // for all unwrapped methods (and the size property) we notify read. Note that we use
            // the target as the receiver, because we want to have the original method's "this"
            // bound to the target, not to the proxy.
            this.trigger.notifyRead();
            let result = Reflect.get(target, prop, target);
            return typeof result === "function" ? result.bind(target) : result;
        }
    }

    /** has() trap */
    has(target: T, prop: PropertyKey): boolean
    {
        // handle our artificial symbol that marks trigger proxies.
        if (prop === symTarget)
            return true;

        return Reflect.has(target, prop);
    }

    /** Wrapper for the clear() method. */
    clear_wrapper(orgMethod: Function): void
    {
        if (this.target.size)
        {
            this.trigger.notifyWrite();
            orgMethod();
        }
    }

    /** Wrapper for the forEach() method */
    forEach_wrapper(orgMethod: Function, callback: (v: any, k: any, c: T) => void, thisArg: any): any
    {
        this.trigger.notifyRead();

        // if depth is 0, just invoke the original method because we don't need to triggerize the items.
        if (this.depth === 0)
            return orgMethod(callback, thisArg);
        else
            return orgMethod(this.forEachCallback.bind(this, callback, thisArg));
    }

    /**
     * Callback passed to the original forEach invocation. This method is bound to this, original
     * callback and original callback's thisArg.
     */
    forEachCallback(orgCallback: (v: any, k: any, c: T) => void, orgThisArg: any,
        v: any, k: any, c: T): void
    {
        // triggerize value and key and pass them to the original callback alone with the proxy of the map/set
        orgCallback.call(orgThisArg, triggerize(v, this.depth - 1), triggerize(k, this.depth - 1), this.target[symProxy]);
    }
}



/**
 * Handler for the Set class providing wrapping methods for all Set's methods. It notifies the
 * container trigger of reads and changes and it creates triggers for the items in the set (if
 * depth is not 0).
 */
class SetHandler extends MapSetBaseHandler<Set<any>>
{
    constructor(depth: number, target: Set<any>)
    {
        super(depth, target);

        this.registerMethodWrapper("add", this.add_wrapper);
        this.registerMethodWrapper("delete", this.delete_wrapper);

        this.registerMethodWrapper(Symbol.iterator, this.iter_wrapper);
        this.registerMethodWrapper("keys", this.iter_wrapper);
        this.registerMethodWrapper("values", this.iter_wrapper);
        this.registerMethodWrapper("entries", this.iter_wrapper);
    }

    /** Wrapper for the `Set.add` method */
    add_wrapper(orgMethod: Function, v: any): Set<any>
    {
        // call original method passing untriggerized value
        let untriggerizedValue = untriggerize(v);

        // check whether the target already has the value. If it does, we don't need to do anything;
        // otherwise, we notify the container trigger of a change and call the original method.
        if (!this.target.has(untriggerizedValue))
        {
            this.trigger.notifyWrite();
            orgMethod(untriggerizedValue);
        }

        // the add() method always returns the Set object itself
        return this.target;
    }

    /** Wrapper for the `Set.delete` method */
    delete_wrapper(orgMethod: Function, v: any): boolean
    {
        // since value can be a proxy to a real value, we need to get the real value
        let untriggerizedValue = untriggerize(v);

        // delete the item from the target - it will tell whether the value was in the set. If it
        // was not, we don't need to do anything; otherwise, we notify the container trigger of a
        // change and remove a trigger if we had one.
        if (!orgMethod(untriggerizedValue))
            return false;

        this.trigger.notifyWrite();
        return true;
    }

    /** Wrapper for methods that return an iterator */
    iter_wrapper(orgMethod: Function): any
    {
        this.trigger.notifyRead();

        let orgIter = orgMethod();

        // if depth is not 0, wrap original iterator in our proxy, which will call the
        // iteratorProxyCallback method for each item so that we can triggerize them.
        if (this.depth === 0)
            return orgIter;
        else
            return new Proxy(orgIter, new IteratorHandler(orgIter, this.iteratorProxyCallback))
    }

    /** Processes items during iteration over the container */
    iteratorProxyCallback = (item: any): any =>
    {
        // for "entries" iterator, item is a tuple of [key, value]; for other iterators, it is just value
        let v = Array.isArray(item) ? item[1] : item;
        return triggerize(v, this.depth - 1);
    }
}



/**
 * Type of function that is invoked by the iterator proxy
 */
type IteratorProxyCallback = (item: any) => void;


/**
 * Proxy handler for an iterator. When the iteration over the proxy is in progress, it delivers
 * each item to the given item callback function.
 */
class IteratorHandler implements ProxyHandler<any>
{
    /** The callback function to be called for each iterated item. */
    protected itemCallback: IteratorProxyCallback;

    /** The original next() method from the target iterator. */
    protected orgNext: () => IteratorResult<any>;

    constructor(target: any, itemCallback: IteratorProxyCallback)
    {
        this.itemCallback = itemCallback;

        // get the next() method from the target iterator and bind it to it so that we can invoke
        // it readily when needed.
        this.orgNext = Reflect.get(target, "next", target).bind(target);
    }

    get(target: any, prop: PropertyKey, receiver: any): any
    {
        if (prop === "next")
            return this.next_wrapper

        const value = Reflect.get(target, prop, target);
        return (typeof value === 'function') ? value.bind(target) : value;
    }

    next_wrapper = (): IteratorResult<any> =>
    {
        const result = this.orgNext();
        if (!result.done)
            result.value = this.itemCallback(result.value);

        return result;
    }
}



// /**
//  * Base class for shallow Map/Set handlers. Methods whose names were supplied in the constructor,
//  * notify change; all other methods notify read.
//  *
//  * For Map and Set in order to be proxied, the methods returned from get() must be
//  * bound to the target. See https://javascript.info/proxy#built-in-objects-internal-slots.
//  */
// abstract class SlotContainerHandler extends BaseHandler
// {
//     constructor(mutators: Set<PropertyKey>, depth: number, trigger?: Trigger)
//     {
//         super(depth);

//         this.trigger = trigger;
//         this.mutators = mutators;
//     }

//     // Retrieve container methods and properties. We always notify read and we wrap methods in
//     // functions that when called will notify either read or change depending on whether the
//     // method is a mutator.
//     get( target: any, prop: PropertyKey, receiver: any): any
//     {
//         if (prop === symIsTriggerProxy)
//             return true;

//         this.trigger?.notifyRead();

//         // in this context "this" is the handler; however, when the methods we return are called
//         // the "this" will be the Proxy object. Therefore, we want these methods to capture and
//         // use the handler object.
//         let handler = this;

//         // check whether this method is already in our internal map
//         let method = this.wrappedMethods.get( prop);
//         if (!method)
//         {
//             // get the value from the target
//             let propVal = target[prop];
//             if (typeof propVal !== "function")
//                 return propVal;

//             // bind the original method to the target object
//             let orgBoundMethod = propVal.bind( target);

//             if (this.mutators.has(prop))
//             {
//                 // for mutator methods we create and return a function that, when called, invokes the
//                 // handler specific functionality, which knows about the structure of the arguments
//                 // and will create proxies for the appropriate objects if needed. This functionality
//                 // will also indicate whether an actual change occurs so that we can notify about it.
//                 method = function(): any {
//                     let [val, changed] = handler.callMutator( target, prop, orgBoundMethod, ...arguments);
//                     if (changed)
//                         handler.trigger?.notifyWrite();

//                     return val;
//                 };
//             }
//             else
//             {
//                 // For non-mutator methods, we notify the read and invoke the original method.
//                 method = function(): any {
//                     handler.trigger?.notifyRead();
//                     return orgBoundMethod( ...arguments);
//                 };
//             }

//             this.wrappedMethods.set( prop, method);
//         }

//         return method;
//     }

//     /**
//      * Method that is responsible for calling a mutator method with the given name. This method
//      * provides implementation for common container methods like `clear` and `delete`. It is
//      * normally overridden in the derived classes, which add handling for other mutators.
//      * @param name
//      * @param orgMethod
//      * @param args Two element tuple where the first element is the return value and the second
//      * element is a flag indicating whether the container has changed.
//      */
//     protected callMutator( target: any, name: PropertyKey, orgMethod: Function,
//         ...args: any[]): [any, boolean]
//     {
//         if (name === "clear")
//         {
//             let isChanged = target.size > 0;
//             orgMethod();
//             return [undefined, isChanged];
//         }
//         else if (name === "delete")
//         {
//             let deleted = orgMethod( args[0]);
//             return [deleted, deleted];
//         }
//         else
//         {
//             // by default treat any other method as having one parameter and always mutating the container
//             return [orgMethod( triggerize( args[0], this.trigger, this.depth)), true];
//         }
//     }



//     // The trigger object which should send notifications to its watchers when reads or changes
//     // occur
//     protected trigger?: Trigger;

//     // Set of method names, which mutate the contaier. All other methods only read from it.
//     private mutators: Set<PropertyKey>;

//     // This map keeps already wrapped methods so that we don't do binding more than once.
//     private wrappedMethods = new Map<PropertyKey,Function>();
// }



// const mapMutatorMethodNames = new Set<PropertyKey>(["clear", "delete", "set"]);

// /**
//  * Handler for maps.
//  */
// class MapHandler extends SlotContainerHandler
// {
//     constructor(depth: number, trigger?: Trigger)
//     {
//         super(mapMutatorMethodNames, depth, trigger);
//     }

//     /**
//      * Implements map-specific mutator methods.
//      * @param name
//      * @param orgMethod
//      * @param args Two element tuple where the first element is the return value and the second
//      * element is a flag indicating whether the container has changed.
//      */
//     protected callMutator(target: Map<any,any>, name: PropertyKey, orgMethod: Function, ...args: any[]): [any, boolean]
//     {
//         if (name === "set")
//             return [orgMethod(args[0], triggerize(args[1], this.trigger, this.depth)), true];
//         else
//             return super.callMutator(target, name, orgMethod, ...args);
//     }
// }



// const setMutatorMethodNames = new Set<PropertyKey>(["add", "delete", "clear"]);

// /**
//  * Handler for sets.
//  */
// class SetHandler extends SlotContainerHandler
// {
//     constructor(depth: number, trigger?: Trigger)
//     {
//         super(setMutatorMethodNames, depth, trigger);
//     }
// }



