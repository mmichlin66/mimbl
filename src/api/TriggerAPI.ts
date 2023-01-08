import { AnyAnyFunc, ITrigger, IWatcher, NoneTypeFunc, NoneVoidFunc } from "./TriggerTypes";
import { ComputedTrigger, startMutations, stopMutations, Trigger, triggerDecoratorHelper, Watcher } from "../core/TriggerImpl";



/**
 * Creates a trigger object of the given depth with the given initial value. Triggers fire events
 * when their value changes. They also work in conjunction with watchers (see [[createWatcher]])
 * and notify watchers when the trigger's value is read.
 *
 * The `depth` parameter determines how many levels of nested properties of arrays, maps, sets and
 * objects should trigger read and write events. If the depth is 0, changing nested
 * properties doesn't cause the trigger to fire - only changing the property itself does. If the
 * depth is undefined, arrays, objects, maps and sets get the depth of 1, meaning that operations
 * that add or remove items will trigger events, but modifications to the items will not.
 * The `depth` parameter is ignored for primitive types.
 *
 * @typeparam T Type of the trigger value.
 * @param v Optional initial value
 * @param depth Depth of the trigger, which determines how many levels of nested properties of
 * arrays, maps, sets and objects should trigger changes. Ignored for primitive types.
 * @returns [[ITrigger]] through which the value can be set and retrieved.
 */
export const createTrigger = <T = any>(v?: T, depth?: number): ITrigger<T> =>
    new Trigger( v, depth);



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
        return triggerDecoratorHelper( undefined, targetOrDepth, name!);
    }
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
 * @returns The callable [[IWatcher]] interface, whcih represent a function with the same sigature
 * as the original function. In addition, the returned function has the `dispose` method, which
 * must be called when the watcher is not needed anymore.
 */
export const createWatcher = <T extends AnyAnyFunc>( func: T, responder: NoneVoidFunc,
        funcThis?: any, responderThis?: any): IWatcher<T> =>
    Watcher.create(func, responder, funcThis, responderThis);



/**
 * Creates a computed trigger object whose value is calculated by the given function or get
 * accessor.
 *
 * @typeparam T Type of the computed value.
 * @param func Function, method or get accessor that produces the computed value.
 * @param thisArg Optional `this` value to use when invoking the computing function.
 * @returns Trigger object that will trigger changes only when the computed value changes.
 */
export const createComputedTrigger = <T = any>(func: NoneTypeFunc<T>, thisArg?: any): ITrigger<T> =>
    new ComputedTrigger( func, thisArg);



/**
 * Decorator function for defining "get" properties or functions retuning a value so that this
 * value will automatically recalculated if any triggers on which this value depends have their
 * values changed. WHen this happens, the watcher objects attached to this computed value will
 * be notified to respond.
 */
export const computed = (target: any, name: string, propDescr: PropertyDescriptor): void =>
{
    let sym = Symbol(name + "_computed");

    const getTriggerValue = (orgFunc: () => any, obj: any): any =>
        (obj[sym] ??= new ComputedTrigger(orgFunc, obj) as ITrigger).get();

    // propDesc.value is undefined for accessors and defined for functions
    if (!propDescr.value)
    {
        if (!propDescr.get)
        {
            /// #if DEBUG
            console.error(`@computed property '${name}' doesn't have get() accessor`);
            /// #endif

            return;
        }

        let orgGet = propDescr.get;
        propDescr.get = function(): any { return getTriggerValue(orgGet, this); }

        if (propDescr.set)
        {
            let orgSet = propDescr.set;
            propDescr.set = function(v: any): void
            {
                startMutations();
                try { orgSet.call( this, v); }
                finally { stopMutations(); }
            }
        }
    }
    else
    {
        let orgFunc = propDescr.value;
        propDescr.value = function(): any { return getTriggerValue(orgFunc, this); }
    }
}



/**
 * Increments mutation scope reference count
 */
export const enterMutationScope = startMutations;

/**
 * Decrements mutation scope reference count. If it reaches zero, notifies all deferred watchers.
 */
export const exitMutationScope = stopMutations;



