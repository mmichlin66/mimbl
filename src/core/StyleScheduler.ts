import {IScheduler} from "mimcss"
import {scheduleFuncCall} from "../internal"



/**
 * The s_mimcss variable will contain the mimcss module or undefined depending on whether the
 * Mimcss library was loaded by the time the Mimbl library is being loaded. The s_mimcss
 * variable is loaded using the dynamic import, which gives the TypeScript compiler access to
 * all Mimcss types. At runtime, the dynamic import will return undefined if the library
 * isn't already loaded. Mimbl code, therefore, checks s_mimcss every time before using it to
 * invoke Mimcss functions. Thus, if an application using Mimbl doesn't want to use Mimcss, it
 * can do so. Note that in this case, styles, classes, element IDs and some other entities cannot
 * be defined using Mimcss constructs.
 */
export let s_mimcss: any;

/**
 * Initializes style scheduler used by Mimbl to schedule writing style changes to the DOM. This
 * function is called when Mimbl code is being parsed. Note that we want to use await on the
 * dynamic import before registering a scheduler so that we have definitive answer whether
 * Mimcss exists and is already loaded.
 */
export async function s_initStyleScheduler(): Promise<number>
{
    try
    {
        s_mimcss = await import("mimcss");
    }
    catch(err)
    {
        /// #if DEBUG
            console.debug( "Mimbl doesn't have Mimcss support because Mimcss library is not loaded.")
        /// #endif
    }

    if (s_mimcss)
    {
        let schedulerType = s_mimcss.registerScheduler( new StyleScheduler());
        s_mimcss.setDefaultSchedulerType( schedulerType);
        return schedulerType;
    }
    else
        return 0;
}



/**
 * The StyleScheduler class is responsible for scheduling writing style-related informatino to
 * the DOM using the Mimbl scheduling functionality
 */
class StyleScheduler implements IScheduler
{
    // Callback to call to write changes to the DOM.
	private doDOMUpdate: () => void;

    /**
     * Initializes the scheduler object and provides the callback that should be invoked when the
     * scheduler decides to make changes to the DOM.
     */
    public init( doDOMUpdate: () => void)
    {
        this.doDOMUpdate = doDOMUpdate;
    }

	/**
	 * Is invoked when the scheduler needs to schedule its callback or event.
	 */
    public scheduleDOMUpdate(): void
    {
		scheduleFuncCall( this.onUpdate, false, this);
    }

	/**
	 * Is invoked when the scheduler needs to cancels its scheduled callback or event.
	 */
    public cancelDOMUpdate(): void
    {
    }


	/**
	 * Is invoked when the timeout expires.
	 */
	private onUpdate(): void
	{
		this.doDOMUpdate();
	}
}



