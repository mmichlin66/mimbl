import { EventFuncType, EventPropType, IComponent, TickSchedulingType } from "../api/CompTypes";
import { DetailedStats, StatsAction, StatsCategory } from "../utils/Stats";
import { CallbackWrapper, CallbackWrapperParams } from "./Reconciler";



/** Type defining the information we keep about an event listener */
export interface EventRunTimeData extends CallbackWrapperParams<EventFuncType>
{
	// Flag indicating whether this event should be used as Capturing (true) or Bubbling (false)
	useCapture?: boolean;

	// Wrapper function that we create and bind to our node and the original function. We need
	// this wrapper in order to catch exception in the callback and pass them on to an error
	// handling service. The wrapper is marked optional because it is created only if a new
	// event listener is added; that is, if during update, the event listener function is the
	// same, there is no need to create new wrapper because the old one will be used.
	wrapper?:  EventFuncType;
};



/**
 * Events mixin that contains event-related functionality, which is common for ElmVN and
 * ManagedCompVN.
 */
export class EventsMixin
{
    constructor(creator?: IComponent | null, events?: Record<string,EventRunTimeData>)
    {
        this.creator = creator;
        this.events = events ?? {}
    }



    /**
     * Adds a new event with the given name, creating its run-time data based on the given value.
     */
	add(name: string, val: EventPropType, schedulingType?: TickSchedulingType): void
	{
        this.events[name] = this.getEventRTD(val, schedulingType);
	}



    /**
     * Returns event handler function for the given event. This methid is supposed to be call only
     * after the events are mounted, in which case it returns an already wrapped handler. However,
     * if this method is called before the events are mounted, it will return the original handler.
     */
	getHandler(name: string): EventFuncType
	{
        let rtd = this.events[name];
        return rtd.wrapper ?? rtd.func;
	}



    /**
     * Mounts all events
     */
	mount(eventTarget?: EventTarget): void
	{
        this.eventTarget = eventTarget;
        for( let [name, rtd] of Object.entries<EventRunTimeData>(this.events))
		    this.mountEvent(name, rtd);
	}



    /**
     * Unmounts all events
     */
    unmount(): void
    {
        for( let [name, rtd] of Object.entries<EventRunTimeData>(this.events))
		    this.unmountEvent(name, rtd);

        this.events = {};
    }



	/** Updates event listeners by comparing the old and the new ones. */
	update(newMixin: EventsMixin | undefined): void
	{
        if (!newMixin)
            this.unmount();
        else
        {
            let oldEvents = this.events;
            let newEvents = newMixin.events;

            // loop over existing event listeners, remove those that are not found among the new
            // ones and update those whose value has changed
            for( let name in oldEvents)
            {
                let oldRTD = oldEvents[name];
                let newRTD = newEvents?.[name];
                if (!newRTD)
                    this.unmountEvent( name, oldRTD);
                else
                    this.updateEvent( name, oldRTD, newRTD);
            }

            // loop over new event listeners and add those that are not found among the old ones
			for( let name in newEvents)
			{
				if (oldEvents && (name in oldEvents))
					continue;

				this.mountEvent( name, newEvents[name]);
			}

            // remember the new listeners in our object
            this.events = newEvents;
		}
	}



    /**
     * Mounts/unounts or updates the event with the given name, first creating its run-time data
     * based on the given value.
     */
	updateSingleEvent(name: string, val: EventPropType, schedulingType?: TickSchedulingType): void
	{
        let oldRTD = this.events[name];
        let newRTD = val != null && this.getEventRTD(val, schedulingType);
        if (!newRTD)
        {
            if (oldRTD)
            {
                this.unmountEvent( name, oldRTD);
                delete this.events[name];
            }
        }
        else
        {
            this.events[name] = newRTD;
            if (oldRTD)
                this.updateEvent( name, oldRTD, newRTD)
            else
                this.mountEvent( name, newRTD);
        }
	}



    /** Adds the given event listener to the event target. */
	private mountEvent( name: string, rtd: EventRunTimeData): void
	{
		rtd.wrapper = CallbackWrapper.bind( rtd);
		this.eventTarget?.addEventListener( name, rtd.wrapper!, rtd.useCapture);

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Event, StatsAction.Added);
		/// #endif
	}



	/** Removes the given event listener from the event target. */
	private unmountEvent( name: string, rtd: EventRunTimeData): void
	{
		this.eventTarget?.removeEventListener( name, rtd.wrapper!, rtd.useCapture);

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Event, StatsAction.Deleted);
		/// #endif
	}



    /**
     * Determines whether the old and the new values of the event listener are different and sets
     * the updated value. Returns true if update has been performed and false if no change has
     * been detected.
     */
	private updateEvent( name: string, oldRTD: EventRunTimeData, newRTD: EventRunTimeData): void
	{
		// double-equal-sign for useCapture is on purpose, because useCapture can be undefined or
        // boolean.
		if (oldRTD.func === newRTD.func &&
			oldRTD.thisArg === newRTD.thisArg &&
			oldRTD.arg === newRTD.arg &&
			oldRTD.useCapture == newRTD.useCapture)
		{
			newRTD.wrapper = oldRTD.wrapper;
		}
		else
		{
			// remove old event listener
			this.eventTarget?.removeEventListener( name, oldRTD.wrapper!, oldRTD.useCapture);

			// create new wrapper and add it as event listener
            newRTD.wrapper = CallbackWrapper.bind( newRTD);
			this.eventTarget?.addEventListener( name, newRTD.wrapper!, newRTD.useCapture);

			/// #if USE_STATS
				DetailedStats.log( StatsCategory.Event, StatsAction.Updated);
			/// #endif
		}
	}



    /**
     * Returns EventRunTimeData object for the given value of the event property. The value can be
     * either a function or a tuple or an object.
     */
    private getEventRTD(propVal: EventPropType, schedulingType?: TickSchedulingType): EventRunTimeData
    {
        let rtd: EventRunTimeData;
        if (typeof propVal === "function")
            rtd = { func: propVal }
        else if (Array.isArray(propVal))
            rtd = { func: propVal[0], arg: propVal[1], thisArg: propVal[2] }
        else
            rtd = Object.assign( {}, propVal);

        rtd.thisArg ??= this.creator;
        rtd.schedulingType ??= schedulingType;
        rtd.comp = this.creator;
        return rtd;
    }



    /** Class component that is used as "this" when invoking event handlers. */
    creator?: IComponent | null;

    /** Object deriving from EventTarget to which the events are attached. */
    eventTarget?: EventTarget;

    /**
     * Object that serves as a map between names of events and their respective run-time
     * parameters. This is never null.
     */
	private events: Record<string,EventRunTimeData>;
}