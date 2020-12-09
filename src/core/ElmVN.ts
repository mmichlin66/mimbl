import {
    IElmVN, setRef, EventFuncType, UpdateStrategy, RefPropType, ICustomAttributeHandler, IElementProps
} from "../api/mim"
import {
    VN, DN, VNUpdateDisp, s_deepCompare, PropInfo, PropType, CustomAttrPropInfo,
    AttrPropInfo, EventPropInfo, getElmPropInfo, setElmProp, removeElmProp, updateElmProp
} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Represents a DOM element created using JSX.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class ElmVN extends VN implements IElmVN
{
	// Tag name of an Element.
	public elmName: string;

	// Instance of an Element. The instance is created when the node is rendered for the first
	// time.
	public get elm(): Element { return this.ownDN as Element }

	// Flag indicating whether the Element is SVG (as opposed to HTLM). There are some SVG
	// elements that have the same name as regular elements (e.g. <a>). Therefore, in order to
	// determine whether this is an SVG or not we need to check the namespaceURI of the parent
	// (anchore) DOM node.
	public isSvg: boolean;



	constructor( tagName: string, props: IElementProps<any>, children: any[])
	{
		super();

		this.elmName = tagName;
		this.props = props;
		this.children = children;

		if (props)
		{
			// get the key property. If key property was not specified, use id; if id was not
			// specified key will remain undefined.
			this.key = props.key;
			if (this.key === undefined)
                this.key = props.id;
            else
                delete props.key;

            if (props.ref)
            {
                // remember ref property
                this.ref = props.ref;
                delete props.ref;
            }

            if (props.updateStrategy)
            {
                // remember updateStrategy property
                this.updateStrategy = props.updateStrategy;
                delete props.updateStrategy;
            }
        }
	}



	/// #if USE_STATS
		public get statsCategory(): StatsCategory { return StatsCategory.Elm; }
	/// #endif



	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string
	{
		// node name is the element's name plus key (or id) if specified.
		let name = this.elmName;
		if (this.key != null)
			name += "@" + this.key;

		return name;
	}



	// Generates list of sub-nodes according to the current state
	public render(): any
	{
		return this.children;
	}



	// Creates and returns DOM node corresponding to this virtual node.
	// This method is part of the Commit phase.
	public mount(): DN
	{
        // create the element. If namespace is provided use it; otherwise, try to determine
        // whether this is an SVG or HTML element
        if (this.props?.xmlns)
        {
            this.isSvg = this.props.xmlns.endsWith( "svg");
            this.ownDN = document.createElementNS( this.props.xmlns, this.elmName);
        }
        else
        {
            // assume that names of all SVG elements are in the svgElmInfos object
            let svgInfo = svgElmInfos[this.elmName];
            this.isSvg = svgInfo === undefined
                ? false
                : svgInfo === false || this.anchorDN.namespaceURI.endsWith( "svg");

            this.ownDN = this.isSvg
                ? document.createElementNS( SvgNamespace, getSvgElmName( svgInfo, this.elmName))
                : document.createElement( this.elmName);
        }

		// translate properties into attributes, events and custom attributes
		this.parseProps();

		if (this.attrs)
			this.addAttrs();

		if (this.events)
			this.addEvents();

		if (this.customAttrs)
			this.addCustomAttrs();

		// set the value of the reference (if specified)
		if (this.ref !== undefined)
            setRef( this.ref, this.ownDN);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Elm, StatsAction.Added);
		/// #endif

		return this.ownDN;
	}



	// Releases reference to the DOM node corresponding to this virtual node.
	// This method is part of the Commit phase.
	public unmount(): void
	{
		// unset the reference value if specified. We check whether the reference still points
		// to our element before setting it to undefined. If the same Ref object is used for
		// more than one element (and/or components) it can happen that the reference is changed
		// before our element is unmounted.
		if (this.ref !== undefined)
			setRef( this.ref, undefined, this.ownDN);

		/// #if REMOVE_EVENT_LISTENERS
			// remove listeners. Since modern browsers don't leak when listeners are not
			// explicitly removed, we do it under the REMOVE_EVENT_LISTENERS macro (that is, we
			// normally don't do it.)
			if (this.events)
				this.removeEvents();
		/// #endif

		// terminate custom property handlers
		if (this.customAttrs)
			this.removeCustomAttrs( true);

		// clean up
		this.ownDN = null;

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Elm, StatsAction.Deleted);
		/// #endif
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: ElmVN): boolean
	{
		// update is possible if this is the same type of element; that is, it has the same
		// name.
		return this.elmName === newVN.elmName;
	}



	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	public prepareUpdate( newVN: ElmVN): VNUpdateDisp
	{
		// commitUpdate method should be called if new props are different from the current ones
		let shouldCommit = !s_deepCompare( this.props, newVN.props);

		// render method should be called if either old or new node has children
		let shouldRender = this.children && this.children.length > 0 || newVN.children && newVN.children.length > 0;

		// remember the new props and children
		this.props = newVN.props;
		this.children = newVN.children;

		return VNUpdateDisp.getStockValue( shouldCommit, shouldRender);
	}



	// Commits updates made to this node to DOM.
	public commitUpdate( newVN: ElmVN): void
	{
		newVN.parseProps();

		// if reference specification changed then set or unset it as necessary
		if (newVN.ref !== this.ref)
		{
			// remember the new reference specification
			this.ref = newVN.ref;

			// if reference is now specified, set it now; note that we already determined that
			// the reference object is different.
			if (this.ref !== undefined)
				setRef( this.ref, this.ownDN);
		}

		// remeber the new value of the key, updateStartegy and creator property (even if the
		// values are the same)
		this.key = newVN.key;
		this.updateStrategy = newVN.updateStrategy;

		this.updateAttrs( newVN.attrs);
		this.updateEvents( newVN.events);
		this.updateCustomAttrs( newVN.customAttrs);
	}



	// Goes over the original properties and puts them into the buckets of attributes, event
	// listeners and custom attributes.
	private parseProps(): void
	{
		if (!this.props)
			return;

        let propVal: any, propInfo: PropInfo, propType: PropType;
		for( let propName in this.props)
		{
            // ignore properties with values undefined, null and false
			propVal = this.props[propName];
			if (propVal != null && propVal !== false)
			{
				// get information about the property and determine its type (regular attribute, event
				// or custom attribute).
				propInfo = getElmPropInfo( propName);
				propType = ElmVN.determineAttrType( propInfo, propVal);
				if (propType === PropType.Attr)
				{
					if (!this.attrs)
						this.attrs = { [propName]: { info: propInfo, val: propVal } };
                    else
					    this.attrs[propName] = { info: propInfo, val: propVal };
				}
				else if (propType === PropType.Event)
				{
					let eventInfo = getPropAsEventRunTimeData( propInfo, propVal);
					if (eventInfo)
					{
						if (!this.events)
							this.events = { [propName]: eventInfo }
                        else
						    this.events[propName] = eventInfo;
					}
				}
				else // if (propType === PropType.CustomAttr)
				{
					if (!this.customAttrs)
						this.customAttrs = {};

					// remember custome attributes value. Handler will be created later.
					this.customAttrs[propName] = { info: propInfo as CustomAttrPropInfo, val: propVal,
									handler: undefined};
				}
			}
		}
	}

    // Determines property type (regular attribute, event or custom attribute) based on the
    // property information object if exists and if not by looking at the value.
    private static determineAttrType( propInfo: AttrPropInfo, propVal: any): PropType
	{
        if (propInfo)
            return propInfo.type;
        else if (typeof propVal === "function" ||
                Array.isArray(propVal) && propVal.length > 0 && typeof propVal[0] === "function")
            return PropType.Event
        else
            return PropType.Attr;
	}

	// Adds DOM attributes to the Element.
	private addAttrs(): void
	{
		for( let name in this.attrs)
		{
			let rtd = this.attrs[name];
			setElmProp( this.ownDN as Element, name, rtd.info, rtd.val);
		}
	}



	// Updates DOM attributes of this Element.
	private updateAttrs( newAttrs: { [name: string]: AttrRunTimeData }): void
	{
		// "cache" several memebers for faster access
		let elm = this.ownDN as Element;
		let oldAttrs = this.attrs;

		// loop over existing attributes, remove those that are not found among the new ones and
		// update those whose value has changed
		if (oldAttrs)
		{
			for( let name in oldAttrs)
			{
				let oldRTD = oldAttrs[name];
				let newRTD = newAttrs ? newAttrs[name] : undefined;
				if (!newRTD || !newRTD.val)
				{
					// if there is no new property with the given name, remove the old property and
					// remove the attribute from the element
					removeElmProp( elm, name, oldRTD.info);
				}
				else
				{
					// if the new property with the given name has a different value, remmeber this
					// value and set it to the attribute in the element
					updateElmProp( elm, name, oldRTD.info, oldRTD.val, newRTD.val);
				}
			}
		}

		// loop over new attributes; add those that are not found among the old ones
		if (newAttrs)
		{
			for( let name in newAttrs)
			{
				if (oldAttrs && (name in oldAttrs))
					continue;

				let newRTD = newAttrs[name];
				setElmProp( elm, name, newRTD.info, newRTD.val);
			}
		}

		this.attrs = newAttrs;
	}



	// Adds information about events to the Element.
	private addEvents(): void
	{
		for( let name in this.events)
			this.addEvent( name, this.events[name]);
	}



	// Using the given property name and its value set the appropriate attribute(s) on the
	// element. This method handles special cases of properties with non-trivial values.
	private addEvent( name: string, event: EventRunTimeData): void
	{
		event.wrapper = this.createEventWrapper( event);
		this.ownDN.addEventListener( name, event.wrapper, event.useCapture);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Event, StatsAction.Added);
		/// #endif
	}



	/// #if REMOVE_EVENT_LISTENERS
		// remove listeners. Since modern browsers don't leak when listeners are not
		// explicitly removed, we do it under the REMOVE_EVENT_LISTENERS macro (that is, we
		// normally don't do it.)
		private removeEvents(): void
		{
			/// #if DEBUG
				if (!this.events)
					throw new Error( "ElmVN.removeEvents called with this.events = null");
			/// #endif

			for( let name in this.events)
				this.removeEvent( name, this.events[name]);
		}
	/// #endif



	// Removes the given event listener from the Element.
	private removeEvent( name: string, event: EventRunTimeData): void
	{
		this.ownDN.removeEventListener( name, event.wrapper, event.useCapture);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Event, StatsAction.Deleted);
		/// #endif
	}



	// Adds event listeners to the Element.
	private updateEvents( newEvents: { [name: string]: EventRunTimeData }): void
	{
		let oldEvents = this.events;

		// loop over existing event listeners, remove those that are not found among the new
		// ones and update those whose value has changed
		if (oldEvents)
		{
			for( let name in oldEvents)
			{
				let oldEvent = oldEvents[name];
				let newEvent = newEvents ? newEvents[name] : undefined;
				if (!newEvent)
					this.removeEvent( name, oldEvent);
				else
					this.updateEvent( name, oldEvent, newEvent);
			}
		}

		// loop over new event listeners and add those that are not found among the old ones
		if (newEvents)
		{
			for( let name in newEvents)
			{
				if (oldEvents && (name in oldEvents))
					continue;

				this.addEvent( name, newEvents[name]);
			}
		}

		this.events = newEvents;
	}



	// Determines whether the old and the new values of the event listener are different and sets
	// the updated value. Returns true if update has been performed and false if no change has
	// been detected.
	private updateEvent( name: string, oldEvent: EventRunTimeData, newEvent: EventRunTimeData): void
	{
		// double-equal-sign for useCapture is on purpose, because useCapture can be undefined or boolean
		if (oldEvent.orgFunc === newEvent.orgFunc &&
			oldEvent.that === newEvent.that &&
			oldEvent.useCapture == newEvent.useCapture)
		{
			newEvent.wrapper = oldEvent.wrapper;
		}
		else
		{
			// remove old event listener
			this.ownDN.removeEventListener( name, oldEvent.wrapper, oldEvent.useCapture);

			// create new wrapper and add it as event listener
			newEvent.wrapper = this.createEventWrapper( newEvent);
			this.ownDN.addEventListener( name, newEvent.wrapper, newEvent.useCapture);

			/// #if USE_STATS
				DetailedStats.stats.log( StatsCategory.Event, StatsAction.Updated);
			/// #endif
		}
	}



	// Returns a wrapper function that will be used as an event listener. The wrapper is bound to
	// the instance of ElmVN and thus can intercept exceptions and process them using the standard
	// error service. Unless the original callback is already a bound function, it will be called
	// with "this" set to either the "event.that" object or, if the latter is undefined, to the
	// "creator" object, which is the class-based component that created the element i its render
	// method.
	private createEventWrapper( event: EventRunTimeData): EventFuncType<Event>
	{
		return this.wrapCallback( event.orgFunc, event.that ? event.that : this.creator);
	}



	// Creates custom attributes.
	private addCustomAttrs(): void
	{
		// create and initialize custom property handlers
		for( let name in this.customAttrs)
		{
			let customAttr = this.customAttrs[name];

			// create custom property handler. If we cannot create the handler, remove the property
			// from our object.
			try
			{
				customAttr.handler = new customAttr.info.handlerClass( this, customAttr.val, name);
			}
			catch( err)
			{
				console.error( `Error creating handler for custom attribute '${name}': ${err.message}`);
				delete this.customAttrs[name];
				continue;
			}
		}
	}



	// Destroys custom attributes of this element.
	private removeCustomAttrs( isRemoval: boolean): void
	{
		for( let name in this.customAttrs)
		{
			let customAttr = this.customAttrs[name];
			try
			{
				customAttr.handler.terminate( isRemoval);
			}
			catch( err)
			{
				console.error( `Error terminating handler for custom attribute '${name}': ${err.message}`);
			}
		}
	}



	// Updates custom attributes of this node.
	private updateCustomAttrs( newCustomAttrs: { [name: string]: CystomAttrRunTimeData }): void
	{
		let oldCustomAttrs = this.customAttrs;

		// loop over existing custom properties, remove those that are not found among the new
		// ones and update those whose value has changed
		if (oldCustomAttrs)
		{
			for( let name in oldCustomAttrs)
			{
				const oldCustomAttr = oldCustomAttrs[name];
				const newCustomAttr = newCustomAttrs ? newCustomAttrs[name] : undefined;
				if (!newCustomAttr)
				{
					// if there is no new property with the given name, remove the old property and
					// terminate its handler
					try
					{
						oldCustomAttr.handler.terminate( false);
					}
					catch( err)
					{
						console.error( `Error terminating handler for custom attribute '${name}': ${err.message}`);
					}
				}
				else
				{
					// update the custom property and remember the new value
					try
					{
						oldCustomAttr.handler.update( newCustomAttr.val);
					}
					catch( err)
					{
						console.error( `Error updating handler for custom attribute '${name}': ${err.message}`);
					}

					newCustomAttr.handler = oldCustomAttr.handler;
				}
			}
		}

		// loop over new custom properties and add those that are not found among the old ones
		if (newCustomAttrs)
		{
			for( let name in newCustomAttrs)
			{
				if (oldCustomAttrs && (name in oldCustomAttrs))
					continue;

				let newCustomAttr = newCustomAttrs[name];

				// create custom property handler. If we cannot create the handler, remove the property
				// from our object.
				try
				{
					newCustomAttr.handler = new newCustomAttr.info.handlerClass( this, newCustomAttr.val, name);
				}
				catch( err)
				{
					console.error( `Error creating handler for custom attribute '${name}': ${err.message}`);
					delete newCustomAttrs[name];
					continue;
				}
			}
		}

		this.customAttrs = newCustomAttrs;
	}



	// Node's key. The derived classes set it based on their respective content. A key
	// can be of any type.
	public key: any;

	// Optional UpdateStrategy object defining different aspects of node behavior during updates.
	public updateStrategy: UpdateStrategy;

	// Properties that were passed to the element.
	private props: any;

	// Array of children objects.
	private children: any[];

	// Reference to the component that is specified as a "ref" property. Reference object is
	// set when analyzing properties in the constructor and during update. Reference value is
	// set during mount and unset during unmount. The ref property can be changed on update.
	private ref: RefPropType<any>;

	// Object that serves as a map between attribute names and their current values.
	private attrs: { [name: string]: AttrRunTimeData };

	// Object that serves as a map between names of event listeners and their respective
	// parameters.
	private events: { [name: string]: EventRunTimeData };

	// Object that serves as a map between names of custom element properties and their respective
	// handler objects and values.
	private customAttrs: { [name: string]: CystomAttrRunTimeData };
}



// Type defining the information we keep about each regular attribute
interface AttrRunTimeData
{
	// Information about this attribute - can be null
	info: AttrPropInfo;

	// Current attribute value
	val: any;
};



// Type defining the information we keep about each event listener
interface EventRunTimeData
{
	// Information about this event - can be null
	info: EventPropInfo;

	// Original event callback passed as the value of the event property in JSX
	orgFunc: EventFuncType<any>;

	// Object that will be referenced by "this" within the invoked function
	that?: any;

	// Flag indicating whether this event should be used as Capturing (true) or Bubbling (false)
	useCapture?: boolean;

	// Wrapper function that we create and bind to our node and the original function. We need
	// this wrapper in order to catch exception in the callback and pass them on to an error
	// handling service. The wrapper is marked optional because it is created only if a new
	// event listener is added; that is, if during update, the event listener function is the
	// same, there is no need to create new wrapper because the old one will be used.
	wrapper?:  EventFuncType<Event>;
};



// Type defining the information we keep about each custom property.
interface CystomAttrRunTimeData
{
	// Information about this custom attribute - cannot be null
	info: CustomAttrPropInfo;

	// Current value of the property
	val: any;

	// Handler object that knows to deal with the property values
	handler: ICustomAttributeHandler;
};



// Determines whether the given property value is of the type that is used for event handlers.
// If yes, then returns EventRunTimeData object; otherwise, returns undefined.
function getPropAsEventRunTimeData( info: EventPropInfo, propVal: any): EventRunTimeData
{
	if (typeof propVal === "function")
		return { info, orgFunc: propVal as EventFuncType<any> };
	else if (Array.isArray(propVal))
	{
		if (propVal.length === 2)
		{
			if (typeof propVal[1] === "boolean")
				return { info, orgFunc: propVal[0] as EventFuncType<any>, useCapture: propVal[1] as boolean };
			else
				return { info, orgFunc: propVal[0] as EventFuncType<any>, that: propVal[1] };
		}
		else if (propVal.length === 3)
			return { info, orgFunc: propVal[0] as EventFuncType<any>, that: propVal[1], useCapture: propVal[2] as boolean };
	}

	// for all other type combinations the property is not treated as an event handler
	return undefined;
}



// Namespace used to create SVG elements.
let SvgNamespace: string = "http://www.w3.org/2000/svg";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The SvgElmInfo type defines information that can be specified for an SVG element. This
// information can be of the following types:
//	- string - actual name to use for the element. Some SVG elements have names that cannot be used
//		in JX directly (e.g. because of hyphen like in "color-profile"). In this case the string
//		value will be the actual element name to put into HTML document, while JSX will be using
//		a camel-formatted name (e.g. "colorProfile").
//	- boolean - flag indicating that the element is "dual-purpose"; that is, element with this
//		name can be used as either HTML or SVG element.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export type SvgElmInfo = string | boolean;



// Object that maps SVG element names to SvgElmInfo.
let svgElmInfos: {[elmName:string]: SvgElmInfo} =
{
    svg: false,

    a: true,
    animate: false,
    animateMotion: false,
    animateTransform: false,

    circle: false,
    clipPath: false,
    colorProfile: "color-profile",

    defs: false,
    desc: false,
    discard: false,

    ellipse: false,

    feBlend: false,
    feColorMatrix: false,
    feComponentTransfer: false,
    feComposite: false,
    feConvolveMatrix: false,
    feDiffuseLighting: false,
    feDisplacementMap: false,
    feDistantLight: false,
    feDropShadow: false,
    feFlood: false,
    feFuncA: false,
    feFuncB: false,
    feFuncG: false,
    feFuncR: false,
    feGaussianBlur: false,
    feImage: false,
    feMerge: false,
    feMergeNode: false,
    feMorphology: false,
    feOffset: false,
    fePointLight: false,
    feSpecularLighting: false,
    feSpotLight: false,
    feTile: false,
    feTurbulence: false,
    filter: false,
    foreignObject: false,

    g: false,

    hatch: false,
    hatchpath: false,

    image: false,

    line: false,
    linearGradient: false,

    marker: false,
    mask: false,
    metadata: false,
    mpath: false,

    path: false,
    pattern: false,
    polygon: false,
    polyline: false,

    radialGradient: false,
    rect: false,

    script: true,
    set: false,
    solidcolor: false,
    stop: false,
    style: true,
    switch: false,
    symbol: false,

    text: false,
    textPath: false,
    title: true,
    textSpan: false,

    use: false,

    view: false,
}


// Returns the actual name to be used based on the information object and the tag name
function getSvgElmName( info: SvgElmInfo, tagName: string): string | undefined
{
    return typeof info === "string" ? info as string : tagName;
}




