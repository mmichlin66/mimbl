import {
    IElmVN, setRef, EventFuncType, UpdateStrategy, RefPropType, ICustomAttributeHandler,
    IElementProps, ElmVNRef
} from "../api/mim"
import {
    VN, s_deepCompare, PropType, CustomAttrPropInfo,
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



	constructor( tagName: string, props: IElementProps, children: any[])
	{
		super();

		this.elmName = tagName;
		this.props = props;
		this.children = children;

        // get the key property. If key property was not specified, use id; if id was not
        // specified key will remain undefined.
        this.key = props && (props.key || props.id);
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



	/**
     * Requests update of the element properties without re-rendering of its children.
     */
    setProps( props: IElementProps): void
    {
        if (!props)
        {
            /// #if DEBUG
                console.error("IElmVN.requestPropsUpdate called with null");
            /// #endif
            return;
        }

        if (this.partialPropsToUpdate)
            Object.assign( props)
        else
        {
            this.partialPropsToUpdate = props;
            this.requestPartialUpdate();
        }
    }



	// Generates list of sub-nodes according to the current state
	public render(): any
	{
		return this.children;
	}



    // Creates a virtual node as a "clone" of this one. This method is invoked when an already
    // mounted node is returned during rendering. The method can either create a new virtual
    // node or it can mark the node in a special way and return the same instance. If this method
    // is not implemented, the same instance will be used.
    public clone(): VN
    {
        let newElmVN = new ElmVN( this.elmName, this.props, this.children);
        newElmVN.clonedFrom = this;
        return newElmVN;
    }

	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount(): void
	{
        // if the element already exists, this means that the node is being reused by different
        // parents. That is OK as long as the node is "static"; that is, it doesn't have any
        // dynamic behavior and its properties and children remain the same. In this case, we
        // can clone the already created element.
        let clone = this.clonedFrom;
        if (clone && clone.ownDN)
        {
            // we don't clone the children (if any) because they will be cloned by our sub-nodes
            this.ownDN = clone.ownDN.cloneNode( false);

            // copy information about attributes and events
            this.attrs = clone.attrs;
            this.events = clone.events;
            this.customAttrs = clone.customAttrs;

            // forget the fact that we were cloned
            this.clonedFrom = null;
        }
        else
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
            if (this.props)
            {
                this.parseProps( this.props);
                if (this.attrs)
                    this.addAttrs();
            }
        }

        // note that if we were cloned we don't need to add attributes and if were not cloned we
        // already added them. Now add events, custom attributes and refs.
        if (this.events)
            this.addEvents();

        if (this.customAttrs)
            this.addCustomAttrs();

        if (this.ref)
            setRef( this.ref, this.ownDN);

        if (this.vnref)
            this.vnref.vn = this;

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Elm, StatsAction.Added);
		/// #endif
	}



	// Releases reference to the DOM node corresponding to this virtual node.
	public unmount(): void
	{
		// unset the reference value if specified. We check whether the reference still points
		// to our element before setting it to undefined. If the same Ref object is used for
		// more than one element (and/or components) it can happen that the reference is changed
		// before our element is unmounted.
		if (this.ref)
			setRef( this.ref, undefined, this.ownDN);

		if (this.vnref)
			this.vnref = undefined;

		// terminate custom property handlers
		if (this.customAttrs)
			this.removeCustomAttrs();

		// clean up
        this.children = null;

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



	// Updates this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: ElmVN): boolean
	{
        // we need to update attributes and events only if the new props are different from the
        // current ones
        if (!s_deepCompare( this.props, newVN.props, 3))
        {
            if (newVN.props)
                newVN.parseProps( newVN.props);

            // if reference specification changed then set or unset it as necessary
            if (newVN.ref !== this.ref)
            {
                // remember the new reference specification
                this.ref = newVN.ref;

                // if reference is now specified, set it now; note that we already determined that
                // the reference object is different.
                if (this.ref)
                    setRef( this.ref, this.ownDN);
            }

            // if virtual node reference specification changed then set or unset it as necessary
            if (newVN.vnref !== this.vnref)
            {
                // remember the new reference specification
                this.vnref = newVN.vnref;

                // if reference is now specified, set it now; note that we already determined that
                // the reference object is different.
                if (this.vnref)
                    this.vnref.vn = this;
            }

            // remember the new value of the key and updateStartegyproperties (even if the
            // values are the same)
            this.props = newVN.props;
            this.key = newVN.key;
            this.updateStrategy = newVN.updateStrategy;

            this.updateAttrs( newVN.attrs);
            this.updateEvents( newVN.events);
            this.updateCustomAttrs( newVN.customAttrs);
        }

		// render method should be called if either old or new node has children
		let shouldRender = this.children.length > 0 || newVN.children.length > 0;

		// remember the new children for the next render
		this.children = newVN.children;

		return shouldRender;
	}



    // This method is called if the node requested a "partial" update. Different types of virtual
    // nodes can keep different data for the partial updates; for example, ElmVN can keep new
    // element properties that can be updated without re-rendering its children.
    public performPartialUpdate(): void
    {
        if (this.partialPropsToUpdate)
        {
            this.updatePropsOnly( this.partialPropsToUpdate)
            this.partialPropsToUpdate = undefined;
        }
    }



    // Updates properties of this node from the given object containing new properties values. This
    // method is invoked if only properties should be updated without re-rendering the children.
	public updatePropsOnly( props: any): void
	{
        // loop over all properties
        for( let propName in props)
		{
            // ignore properties with values undefined, null and false
            let propVal = props[propName];


            // get information about the property and determine its type.
            let propInfo = getElmPropInfo( propName);
            let propType = propInfo
                ? propInfo.type
                : typeof propVal === "function" || typeof propVal === "object"
                    ? PropType.Event
                    : PropType.Attr;

            if (propType === PropType.Attr)
                this.updateAttrOnly( propName, propInfo as AttrPropInfo, propVal);
            else if (propType === PropType.Event)
                this.updateEventOnly( propName, propInfo as EventPropInfo, propVal);
            else if (propType === PropType.CustomAttr)
                this.updateCustomAttrOnly( propName, propInfo as CustomAttrPropInfo, propVal);
            else // if (propType === PropType.Framework)
            {
                if (propName === "key")
                    this.key = propVal;
                else if (propName === "ref")
                {
                    if (propVal !== this.ref)
                    {
                        // remember the new reference specification
                        this.ref = propVal;

                        // if reference is now specified, set it now; note that we already determined that
                        // the reference object is different.
                        if (propVal)
                            setRef( propVal, this.ownDN);
                    }
                }
                else if (propName === "vnref")
                {
                    if (propVal !== this.vnref)
                    {
                        // remember the new reference specification
                        this.vnref = propVal;

                        // if reference is now specified, set it now; note that we already determined that
                        // the reference object is different.
                        if (propVal)
                            propVal.vn = this;
                    }
                }
                else if (propName === "updateStrategy")
                    this.updateStrategy = propVal;
            }
		}
	}



	// Goes over the original properties and puts them into the buckets of attributes, event
	// listeners and custom attributes.
	private parseProps( props: any): void
	{

        // loop over all properties ignoring the built-ins
        for( let propName in props)
		{
            // ignore properties with values undefined, null and false
			let propVal = props[propName];
			if (propVal != null && propVal !== false)
			{
				// get information about the property and determine its type.
				let propInfo = getElmPropInfo( propName);
                let propType = propInfo
                    ? propInfo.type
                    : typeof propVal === "function" || typeof propVal === "object"
                        ? PropType.Event
                        : PropType.Attr;

				if (propType === PropType.Attr)
				{
					if (!this.attrs)
                        this.attrs = {};

				    this.attrs[propName] = { info: propInfo, val: propVal };
				}
				else if (propType === PropType.Event)
				{
					let rtd = getPropAsEventRunTimeData( propInfo, propVal);
					if (rtd)
					{
						if (!this.events)
							this.events = {};

                        this.events[propName] = rtd;
					}
				}
                else if (propType === PropType.Framework)
                {
                    if (propName === "ref")
                        this.ref = propVal;
                    else if (propName === "vnref")
                        this.vnref = propVal;
                    else if (propName === "updateStrategy")
                        this.updateStrategy = propVal;
                }
				else // if (propType === PropType.CustomAttr)
				{
					if (!this.customAttrs)
						this.customAttrs = {};

					// remember custom attributes value. Handler will be created later.
					this.customAttrs[propName] = { info: propInfo as CustomAttrPropInfo, val: propVal, handler: undefined};
				}
			}
		}
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
				else if (oldRTD.val !== newRTD.val)
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



    // Adds, updates or removes the given DOM attribute of this Element. This method is invoked
    // when the properties of the element are updated as a result of requestPropsUpdate call; that
    // is when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateAttrOnly( name: string, info: AttrPropInfo, val: any ): void
	{
        let oldAttr = this.attrs && this.attrs[name];
        if (val == null || val === false)
        {
            if (oldAttr)
            {
                removeElmProp( this.ownDN as Element, name, info)
                delete this.attrs[name];
            }
        }
        else
        {
            if (oldAttr)
            {
                updateElmProp( this.ownDN as Element, name, info, oldAttr.val, val)
                oldAttr.val = val;
            }
            else
            {
                setElmProp( this.ownDN as Element, name, info, val);
                if (!this.attrs)
                    this.attrs = {};

                this.attrs[name] = { info, val }
            }
        }
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



    // Adds, updates or removes the given event handler of this Element. This method is invoked
    // when the properties of the element are updated as a result of requestPropsUpdate call; that
    // is when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateEventOnly( name: string, info: EventPropInfo, val: any ): void
	{
        let oldEvent = this.events && this.events[name];
        let newEvent = val != null && getPropAsEventRunTimeData( info, val);
        if (!newEvent)
        {
            if (oldEvent)
            {
                this.removeEvent( name, oldEvent);
                delete this.events[name];
            }
        }
        else
        {
            if (oldEvent)
            {
                this.updateEvent( name, oldEvent, newEvent)
                this.events[name] = newEvent;
            }
            else
            {
                this.addEvent( name, newEvent);
                if (!this.events)
                    this.events = {};

                this.events[name] = newEvent;
            }
        }
	}



	// Returns a wrapper function that will be used as an event listener. The wrapper is bound to
	// the instance of ElmVN and thus can intercept exceptions and process them using the standard
	// error service. Unless the original callback is already a bound function, it will be called
	// with "this" set to either the "event.that" object or, if the latter is undefined, to the
	// "creator" object, which is the class-based component that created the element i its render
	// method.
	private createEventWrapper( event: EventRunTimeData): EventFuncType
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
            if (!this.addCustomAttr( name, customAttr))
				delete this.customAttrs[name];
		}
	}



	// Creates custom attribute.
	private addCustomAttr( name: string, customAttr: CustomAttrRunTimeData): boolean
	{
        // create custom property handler. If we cannot create the handler, remove the property
        // from our object.
        try
        {
            customAttr.handler = new customAttr.info.handlerClass( this, customAttr.val, name);
            return true;
        }
        catch( err)
        {
            console.error( `Error creating handler for custom attribute '${name}': ${err.message}`);
            return false;
        }
	}



	// Destroys custom attributes of this element.
	private removeCustomAttrs(): void
	{
        for( let name in this.customAttrs)
            this.removeCustomAttr( name, this.customAttrs[name], true)
	}



	// Destroys custom attributes of this element.
	private removeCustomAttr( name: string, customAttr: CustomAttrRunTimeData, isRemoval: boolean): void
	{
        try
        {
            customAttr.handler.terminate( isRemoval);
        }
        catch( err)
        {
            console.error( `Error terminating handler for custom attribute '${name}': ${err.message}`);
        }
	}



	// Updates custom attributes of this node.
	private updateCustomAttrs( newCustomAttrs: { [name: string]: CustomAttrRunTimeData }): void
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
                    this.removeCustomAttr( name, oldCustomAttr, false);
				else
				{
                    // update the custom property and remember the new value
                    this.updateCustomAttr( name, oldCustomAttr, newCustomAttr);
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
                if (!this.addCustomAttr( name, newCustomAttr))
					delete newCustomAttrs[name];
			}
		}

		this.customAttrs = newCustomAttrs;
	}



	// Updates custom attributes of this node.
	private updateCustomAttr( name: string, oldCustomAttr: CustomAttrRunTimeData, newCustomAttr: CustomAttrRunTimeData): void
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
	}



    // Adds, updates or removes the given custom attribute of this Element. This method is invoked
    // when the properties of the element are updated as a result of requestPropsUpdate call; that
    // is when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateCustomAttrOnly( name: string, info: CustomAttrPropInfo, val: any ): void
	{
        let oldCustomAttr = this.customAttrs && this.customAttrs[name];
        let newCustomAttr = val != null && { info, val, handler: undefined};
        if (!newCustomAttr)
        {
            if (oldCustomAttr)
            {
                this.removeCustomAttr( name, oldCustomAttr, false)
                delete this.customAttrs[name];
            }
        }
        else
        {
            if (oldCustomAttr)
            {
                this.updateCustomAttr( name, oldCustomAttr, newCustomAttr)
                oldCustomAttr.val = val;
            }
            else
            {
                this.addCustomAttr( name, newCustomAttr);
                if (!this.customAttrs)
                    this.customAttrs = {};

                this.customAttrs[name] = newCustomAttr
            }
        }
	}



	// Properties that were passed to the element.
	private props: any;

	// Array of children objects.
	private children: any[];

	// If this virtual node was cloned from another node, points to the original node.
	public clonedFrom: ElmVN;

	// Reference to the element that is specified as a "ref" property.
	private ref: RefPropType;

	// Reference to the virtual node that is specified as a "vnref" property.
	private vnref: ElmVNRef;

	// Object that serves as a map between attribute names and their current values.
	private attrs: { [name: string]: AttrRunTimeData };

	// Object that serves as a map between names of event listeners and their respective
	// parameters.
	private events: { [name: string]: EventRunTimeData };

	// Object that serves as a map between names of custom element properties and their respective
	// handler objects and values.
    private customAttrs: { [name: string]: CustomAttrRunTimeData };

    // properties that were specified in the requestPropsUpdate call. This allows updating the
    // element's properties without re-rendering its children.
    private partialPropsToUpdate: any;
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
	orgFunc: EventFuncType;

	// Object that will be referenced by "this" within the invoked function
	that?: any;

	// Flag indicating whether this event should be used as Capturing (true) or Bubbling (false)
	useCapture?: boolean;

	// Wrapper function that we create and bind to our node and the original function. We need
	// this wrapper in order to catch exception in the callback and pass them on to an error
	// handling service. The wrapper is marked optional because it is created only if a new
	// event listener is added; that is, if during update, the event listener function is the
	// same, there is no need to create new wrapper because the old one will be used.
	wrapper?:  EventFuncType;
};



// Type defining the information we keep about each custom property.
interface CustomAttrRunTimeData
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
		return { info, orgFunc: propVal as EventFuncType };
	else if (Array.isArray(propVal))
	{
		if (propVal.length === 2)
		{
			if (typeof propVal[1] === "boolean")
				return { info, orgFunc: propVal[0] as EventFuncType, useCapture: propVal[1] as boolean };
			else
				return { info, orgFunc: propVal[0] as EventFuncType, that: propVal[1] };
		}
		else if (propVal.length === 3)
			return { info, orgFunc: propVal[0] as EventFuncType, that: propVal[1], useCapture: propVal[2] as boolean };
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
//		in JSX directly (e.g. because of hyphen like in "color-profile"). In this case the string
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




