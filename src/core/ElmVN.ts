import * as mim from "./mim"
import {DN, VN, VNUpdateDisp} from "./VN"
import {ElmAttr, AttrPropInfo, EventPropInfo, CustomAttrPropInfo, PropType} from "./ElmAttr"
import {SvgElms} from "./SvgElms";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "./Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Represents a DOM element created using JSX.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class ElmVN extends VN implements mim.IElmVN
{
	constructor( tagName: string, props: any, children: any[])
	{
		super();

		// remember tag name and children
		this.elmName = tagName;
		this.children = children;

		// copy properties to our own object excluding framework-handled key and ref
		this.props = {};
		if (props)
		{
			for( let propName in props)
			{
				let propVal: any = props[propName];
				if (propVal === undefined || propVal === null)
				{
					// ignore properties with values undefined and null
					continue;
				}
				else if (propName === "key")
				{
					// remember key property but don't copy it to this.props object
					this.key = propVal;
				}
				else if (propName === "ref")
				{
					// remember ref property but don't copy it to this.props object
					this.ref = propVal;
				}
				else
					this.props[propName] = propVal;
			}

			// if key property was not specified, use id; if id was not specified key will remain
			// undefined.
			if (this.key === undefined)
				this.key = props.id;
		}
	}



	// IElmVN implementation
	public get ElmName(): string { return this.elmName; }
	public get Elm(): Element { return this.elm; }
	public get IsSvg(): boolean { return this.isSvg; }



	/// #if USE_STATS
		public getStatsCategory(): StatsCategory { return StatsCategory.Elm; }
	/// #endif



	// Node's type.
	public get type(): mim.VNType { return mim.VNType.Elm; }



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



	// Inserts the virtual node's content into DOM.
	// This method is part of the Commit phase.
	public mount(): void
	{
		// determine whether this is an SVG or HTML element and create the element
		let svgInfo = SvgElms.getSvgElmInfo( this.elmName);
		this.isSvg = svgInfo !== undefined && (svgInfo !== true || this.anchorDN.namespaceURI.endsWith( "svg"));
		this.elm = this.isSvg
			? this.elm = document.createElementNS( SvgElms.namespace, SvgElms.getElmName( svgInfo, this.elmName))
			: this.elm = document.createElement( this.elmName);

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
			mim.setRef( this.ref, this.elm);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Elm, StatsAction.Added);
		/// #endif
	}



	// Removes content from the DOM tree.
	// This method is part of the Commit phase.
	public unmount(): void
	{
		// unset the reference value if specified. We check whether the reference still points
		// to our element before setting it to undefined. If the same Ref object is used for
		// more than one element (and/or components) it can happen that the reference is changed
		// before our element is unmounted.
		if (this.ref !== undefined)
			mim.setRef( this.ref, undefined, this.elm);

		/// #if REMOVE_EVENT_LISTENERS
			// remove listeners. Since modern browsers don't leak when listeners are not
			// explicitly removed, we do it under the REMOVE_EVENT_LISTENERS macro (that is, we
			// normally don't do it.)
			if (this.events)
				this.removeEvents();
		/// #endif

		// terminate custom property handlers
		if (this.customAttrs)
			this.removeCustomAttrs();

		// clean up
		this.elm = null;

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Elm, StatsAction.Deleted);
		/// #endif
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: VN): boolean
	{
		// update is possible if this is the same type of element; that is, it has the same
		// name.
		return this.elmName === (newVN as ElmVN).elmName;
	}



	// Prepares this node to be updated from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned object indicates whether children
	// should be updated and whether the commitUpdate method should be called.
	// This method is part of the Render phase.
	public prepareUpdate( newVN: VN): VNUpdateDisp
	{
		const newElmVN: ElmVN = newVN as ElmVN;

		// remember the new props and children
		this.props = newElmVN.props;
		this.children = newElmVN.children;

		// commitUpdate method should be called and children will have to be updated via render
		return { shouldCommit: true, shouldRender: true };
	}



	// Commits updates made to this node to DOM.
	public commitUpdate( newVN: VN): void
	{
		const newElmVN: ElmVN = newVN as ElmVN;
		newElmVN.parseProps();

		// if reference specification changed then set or unset it as necessary
		if (newElmVN.ref !== this.ref)
		{
			// remember the new reference specification
			this.ref = newElmVN.ref;

			// if reference is now specified, set it now; note that we already determined that
			// the reference object is different.
			if (this.ref !== undefined)
				mim.setRef( this.ref, this.elm);
		}

		// remeber the new value of the key property (even if it is the same)
		this.key = newElmVN.key;

		this.updateAttrs( newElmVN.attrs);
		this.updateEvents( newElmVN.events);
		this.updateCustomAttrs( newElmVN.customAttrs);
	}



	// Returns DOM node corresponding to the virtual node itself and not to any of its sub-nodes.
	public getOwnDN(): DN
	{
		return this.elm;
	}



	// Goes over the original properties and puts them into the buckets of attributes, event
	// listeners and custom attributes.
	private parseProps(): void
	{
		for( let propName in this.props)
		{
			let propVal: any = this.props[propName];

			// get information about the property and determine its type (regular attribute, event
			// or custom attribute). Note that getPropertyInfo may return null for most regular
			// attributes and events; in this case we will check the property value.
			let propInfo = ElmAttr.getPropertyInfo( propName);
			let propType = propInfo ? propInfo.type : this.IsEventValue( propVal) ? PropType.Event : PropType.Attr;

			if (propType === PropType.Attr)
			{
				if (!this.attrs)
					this.attrs = {};

				this.attrs[propName] = { info: propInfo, val: propVal };
			}
			else if (propType === PropType.Event)
			{
				let eventInfo = this.GetPropAsEventRunTimeData( propInfo, propVal);
				if (eventInfo)
				{
					if (!this.events)
						this.events = {}

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



	// Determines whether the given property value is of the type that is used for event handlers.
	// If yes, then returns EventRunTimeData object; otherwise, returns undefined.
	private IsEventValue( propVal: any): boolean
	{
		return typeof propVal === "function" ||
			Array.isArray(propVal) && propVal.length > 0 && typeof propVal[0] === "function";
	}



	// Determines whether the given property value is of the type that is used for event handlers.
	// If yes, then returns EventRunTimeData object; otherwise, returns undefined.
	private GetPropAsEventRunTimeData( info: EventPropInfo, propVal: any): EventRunTimeData
	{
		if (typeof propVal === "function")
		{
			let orgFunc = propVal as mim.EventFuncType<any>;
			return { info, orgFunc, useCapture: false };
		}
		else if (Array.isArray(propVal) && propVal.length === 2 &&
				typeof propVal[0] === "function" && typeof propVal[1] === "boolean")
		{
			let orgFunc = propVal[0] as mim.EventFuncType<any>;
			return { info, orgFunc, useCapture: propVal[1] as boolean };
		}

		// for all other type combinations consider it to be a regular attribute
		return undefined;
	}



	// Adds DOM attributes to the Element.
	private addAttrs(): void
	{
		/// #if DEBUG
			if (!this.attrs)
				throw new Error( "ElmVN.addAttrs called with this.attrs = null");
		/// #endif

		for( let name in this.attrs)
		{
			let rtd = this.attrs[name];
			ElmAttr.setAttr( this.elm, name, rtd.info, rtd.val);
		}
	}



	// Updates DOM attributes of this Element.
	private updateAttrs( newAttrs: { [name: string]: AttrRunTimeData }): void
	{
		// "cache" several memebers for faster access
		let elm = this.elm;
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
					ElmAttr.removeAttr( elm, name, oldRTD.info);
				}
				else
				{
					// if the new property with the given name has a different value, remmeber this
					// value and set it to the attribute in the element
					ElmAttr.updateAttr( elm, name, oldRTD.info, oldRTD.val, newRTD.val);
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
				ElmAttr.setAttr( elm, name, newRTD.info, newRTD.val);
			}
		}

		this.attrs = newAttrs;
	}



	// Adds information about events to the Element.
	private addEvents(): void
	{
		/// #if DEBUG
			if (!this.events)
				throw new Error( "ElmVN.addEvents called with this.events = null");
		/// #endif

		for( let name in this.events)
			this.addEvent( name, this.events[name]);
	}



	// Using the given property name and its value set the appropriate attribute(s) on the
	// element. This method handles special cases of properties with non-trivial values.
	private addEvent( name: string, event: EventRunTimeData): void
	{
		event.wrapper = this.wrapCallback( event.orgFunc);
		this.elm.addEventListener( name, event.wrapper, event.useCapture);

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
		this.elm.removeEventListener( name, event.wrapper, event.useCapture);

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
		for( let name in newEvents)
		{
			if (oldEvents && (name in oldEvents))
				continue;

			let newEvent = newEvents[name];
			this.addEvent( name, newEvent);
		}

		this.events = newEvents;
	}



	// Determines whether the old and the new values of the event listener are different and sets
	// the updated value. Returns true if update has been performed and false if no change has
	// been detected.
	private updateEvent( name: string, oldEvent: EventRunTimeData, newEvent: EventRunTimeData): boolean
	{
		if (oldEvent.orgFunc === newEvent.orgFunc && oldEvent.useCapture === newEvent.useCapture)
		{
			newEvent.wrapper = oldEvent.wrapper;
			return false;
		}

		this.elm.removeEventListener( name, oldEvent.wrapper, oldEvent.useCapture);

		newEvent.wrapper = this.wrapCallback( newEvent.orgFunc);
		this.elm.addEventListener( name, newEvent.wrapper, newEvent.useCapture);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Event, StatsAction.Updated);
		/// #endif

		// indicate that there was change in event listener value.
		return true;
	}



	// Creates custom attributes.
	private addCustomAttrs(): void
	{
		/// #if DEBUG
			if (!this.customAttrs)
				throw new Error( "ElmVN.addCustomAttrs called with this.customAttrs = null");
		/// #endif

		// create and initialize custom property handlers
		for( let name in this.customAttrs)
		{
			let data = this.customAttrs[name];

			// create custom property handler. If we cannot create the handler, remove the property
			// from our object.
			let handler = data.info.factory.createHandler( name);
			if (!handler)
			{
				delete this.customAttrs[name];
				continue;
			}

			// initialize the handler and remember it in our object
			handler.initialize( this, name, data.val);
			data.handler = handler;
		}
	}



	// Destroys custom attributes of this element.
	private removeCustomAttrs(): void
	{
		/// #if DEBUG
			if (!this.customAttrs)
				throw new Error( "ElmVN.removeCustomAttrs called with this.customAttrs = null");
		/// #endif

		for( let name in this.customAttrs)
		{
			let info = this.customAttrs[name];
			info.handler.terminate();
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
					oldCustomAttr.handler.terminate();
				}
				else
				{
					// update the custom property and remember the new value
					oldCustomAttr.handler.update( oldCustomAttr.val, newCustomAttr.val);
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
				let handler = newCustomAttr.info.factory.createHandler( name);
				if (!handler)
					continue;

				// initialize the handler and remember it in our object
				handler.initialize( this, name, newCustomAttr.val);
				newCustomAttr.handler = handler;
			}
		}

		this.customAttrs = newCustomAttrs;
	}



	// Tag name of an Element.
	private elmName: string;

	// Properties that were passed to the element.
	private props: any;

	// Array of children objects.
	private children: any[];

	// Instance of an Element. The instance is created when the node is rendered for the first
	// time.
	private elm: Element = null;

	// Flag indicating whether the Element is SVG (as opposed to HTLM). There are some SVG
	// elements that have the same name as regular elements (e.g. <a>). Therefore, in order to
	// determine whether this is an SVG or not we need to check the namespaceURI of the parent
	// (anchore) DOM node.
	private isSvg: boolean;

	// Reference to the component that is specified as a "ref" property. Reference object is
	// set when analyzing properties in the constructor and during update. Reference value is
	// set during mount and unset during unmount. The ref property can be changed on update.
	private ref: mim.RefPropType<any>;

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
	info: AttrPropInfo | null;

	// Flag indicating whether this event should be used as Capturing (true) or Bubbling (false)
	val: any;
};



// Type defining the information we keep about each event listener
interface EventRunTimeData
{
	// Information about this event - can be null
	info: EventPropInfo | null;

	// Original event callback passed as the value of the event property in JSX
	orgFunc: mim.EventFuncType<any>;

	// Flag indicating whether this event should be used as Capturing (true) or Bubbling (false)
	useCapture: boolean;

	// Wrapper function that we create and bind to our node and the original function. We need
	// this wrapper in order to catch exception in the callback and pass them on to an error
	// handling service. The wrapper is marked optional because it is created only if a new
	// event listener is added; that is, if during update, the event listener function is the
	// same, there is no need to create new wrapper because the old one will be used.
	wrapper?:  mim.EventFuncType<any>;
};



// Type defining the information we keep about each custom property.
interface CystomAttrRunTimeData
{
	// Information about this custom attribute - cannot be null
	info: CustomAttrPropInfo;

	// Current value of the property
	val: any;

	// Handler object that knows to deal with the property values
	handler: mim.ICustomAttributeHandler<any>;
};



