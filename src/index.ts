// Type definitions for mimbl

export * from "./utils/EventSlot"
export * from "./utils/TriggerWatcher"

export * from "./api/UtilAPI"
export * from "./api/HtmlTypes"
export * from "./api/SvgTypes"
export * from "./api/mim"


///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Mimbl-specific style scheduler that coordinates Mimcss DOM writing with Mimbl
//
///////////////////////////////////////////////////////////////////////////////////////////////////
import {s_initStyleScheduler} from "./internal"

// Set Mimbl style scheduler as the default scheduler for style-related DOM-writing operations.
export let mimblStyleSchedulerType
s_initStyleScheduler().then( n => mimblStyleSchedulerType = n);



