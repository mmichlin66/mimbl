import { AnyAnyFunc, ITrigger, IWatcher, NoneTypeFunc, NoneVoidFunc, TypeVoidFunc } from "../api/TriggerTypes";
import {EventSlot} from "../api/EventSlotAPI";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Triggers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The Trigger class represents an object that keeps a value and notifies the current watcher (if
 * any) when this value changes.
 */
export class Trigger<T = any> extends EventSlot<TypeVoidFunc<T>> implements ITrigger<T>
{
    constructor( v?: T, depth?: number)
    {
        super();
        this.depth = depth;
        this.v = triggerrize( v, this, depth) as T;
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
        if (v !== this.v)
        {
            this.v = triggerrize( v, this, this.depth);
            this.fire(v);
        }
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
    private depth?: number;

    // Value being get and set
    private v: T;
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
     * @typeparam T Type (signature) of the function to be watched.
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
        {
            /// #if DEBUG
            console.error( "Disposing already disposed watcher.");
            /// #endif

            return;
        }

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
        if (!this.triggers.has(trigger))
        {
            this.triggers.add( trigger);
            trigger.attach( this.onTriggerChanged);
        }
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
    constructor( func: NoneTypeFunc<T>, thisArg?: any)
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
                this.watcher = Watcher.create( this.func, this.responder, this.thisArg, this);

            super.set( this.watcher());
            this.isStale = false;
        }

        return super.get();
    }

    public detach( listener: TypeVoidFunc<T>): void
    {
        super.detach( listener);

        // we keep our function watcher only if we still have somebody watching us.
        if (this.watcher && this.has())
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
            super.set( this.watcher());
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
// Triggerizing containers
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Depending on the given trigger depth and on the value type, either returns the same value or, if
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

    let newDepth = depth ? depth - 1 : 0;
    let handlerClass: new (trigger: Trigger, depth?: number) => ProxyHandler<any>;
    if (v instanceof Map)
        handlerClass = MapHandler;
    else if (v instanceof Set)
        handlerClass = SetHandler;
    else if (Array.isArray(v) || (v as any).constructor === Object)
        handlerClass = NonSlotHandler;
    else
        return v;

    return new Proxy( v as any as object, new handlerClass(trigger, newDepth)) as any as T;
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

    deleteProperty( target: any, prop: PropertyKey): boolean
    {
        this.trigger.notifyWrite();
        return Reflect.deleteProperty( target, prop);
    }

    has( target: any, prop: PropertyKey): boolean
    {
        this.trigger.notifyRead();
        return Reflect.has( target, prop);
    }

    ownKeys( target: any): ArrayLike<string | symbol>
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
     * Method that is responsible for calling a mutator method with the given name. This method
     * provides implementation for common container methods like `clear` and `delete`. It is
     * normally overridden in the derived classes, which add handling for other mutators.
     * @param name
     * @param orgMethod
     * @param args Two element tuple where the first element is the return value and the second
     * element is a flag indicating whether the container has changed.
     */
    protected callMutator( target: any, name: PropertyKey, orgMethod: Function,
        ...args: any[]): [any, boolean]
    {
        if (name === "clear")
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
        else
        {
            // by default treat any other method as having one parameter and always mutating the container
            return [orgMethod( triggerrize( args[0], this.trigger, this.depth)), true];
        }
    }



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
        if (name === "set")
            return [orgMethod( args[0], triggerrize( args[1], this.trigger, this.depth)), true];
        else
            return super.callMutator(target, name, orgMethod, ...args);
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
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Decorators
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Helper function for defining `@trigger` decorators.
 */
export const triggerDecoratorHelper = (depth: number | undefined, target: any, name: string): void =>
{
    let sym = Symbol( name + "_trigger");

    const getTriggerObj = (obj: any, depth: number | undefined): ITrigger =>
        obj[sym] ??= new Trigger( undefined, depth) as ITrigger;

    Object.defineProperty( target, name, {
        get() { return getTriggerObj(this, depth).get(); },
        set(val) { getTriggerObj(this, depth).set(val); },
	});
}



