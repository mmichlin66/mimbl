import * as css from "mimcss"
import {scheduleFuncCall} from "./Scheduler"



/**
 * The StyleScheduler class is responsible for scheduling writing style-related informatino to
 * the DOM using the Mimbl scheduling functionality
 */
class StyleScheduler implements css.IScheduler
{
    // Callback to call to write changes to the DOM.
	private doActivation: () => void;

    /**
     * Initializes the scheduler object and provides the callback that should be invoked when the
     * scheduler decides to make changes to the DOM.
     */
    public init( doActivation: () => void)
    {
        this.doActivation = doActivation;
    }

	/**
	 * Is invoked when the scheduler needs to schedule its callback or event.
	 */
    public scheduleActivation(): void
    {
		scheduleFuncCall( this.onUpdate, false, this);
    }

	/**
	 * Is invoked when the scheduler needs to cancels its scheduled callback or event.
	 */
    public unscheduleActivation(): void
    {
    }


	/**
	 * Is invoked when the timeout expires.
	 */
	private onUpdate(): void
	{
		// this.isCallScheduled = false;
		this.doActivation();
	}
}



/**
 * Initializes style scheduler used by Mimbl to schedule writing style changes to the DOM.
 */
export function initializeMimblStyleScheduler(): number
{
    let schedulerType = css.registerScheduler( new StyleScheduler());
    css.setDefaultSchedulerType( schedulerType);
    return schedulerType;
}



