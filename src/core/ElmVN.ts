import {
    IElmVN, EventFuncType, ICustomAttributeHandler, IElementProps, Component,
    EventPropType, setRef, RefType, ElmRefType, CallbackWrappingParams, TickSchedulingType
} from "../api/mim"
import {
    VN, s_deepCompare, PropType, CustomAttrPropInfo, AttrPropInfo, EventPropInfo,
    getElmPropInfo, setElmProp, removeElmProp, updateElmProp, s_wrapCallback,
    ChildrenUpdateOperation, syncUpdate
} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif




///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Represents a DOM element created using JSX.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class ElmVN<T extends Element = Element> extends VN implements IElmVN<T>
{
	// Tag name of an Element.
	public elmName: string;

	// Instance of an Element. The instance is created when the node is rendered for the first
	// time.
	public get elm(): T { return this.ownDN; }



	constructor( creator: Component, tagName: string, props: IElementProps<T>, subNodes: VN[])
	{
		super();

		this.creator = creator;
		this.elmName = tagName;
		this.props = props;
		this.subNodes = subNodes;

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
     * @param props
     */
	public setProps( props: IElementProps<T>, schedulingType?: TickSchedulingType): void
    {
        if (!props)
            return;

        if (this.propsForPartialUpdate)
            Object.assign( this.propsForPartialUpdate, props)
        else
            this.propsForPartialUpdate = props;

        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            this.updatePropsOnly( this.propsForPartialUpdate)
        else
            this.requestPartialUpdate();
    }

    /**
     * Updates the element's sub-nodes with the given content.
     * @param children
     */
    public updateChildren( content: any, schedulingType?: TickSchedulingType): void
    {
        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            syncUpdate( this, {op: ChildrenUpdateOperation.Update, content});
        else
            this.requestUpdate( {op: ChildrenUpdateOperation.Update, content});
    }

    /**
     * Completely replaces the element's sub-nodes with the given content.
     * @param children
     */
    public setChildren( content?: any, schedulingType?: TickSchedulingType): void
    {
        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            syncUpdate( this, {op: ChildrenUpdateOperation.Set, content});
        else
            this.requestUpdate( {op: ChildrenUpdateOperation.Set, content});
    }

    /**
     * Retains the given range of the sub-nodes unmounting the sub-nodes outside the given range.
     * @param startIndex Index of the first sub-node in the range
     * @param endIndex (optional) Index of the sub-node after the last sub-node in the range. If
     * this parameter is zero or undefined or greater than the length of the sub-nodes array, the
     * range will include all sub-nodes from the startIndex to the end of the array.
     */
    public sliceChildren( startIndex: number, endIndex?: number, schedulingType?: TickSchedulingType): void
    {
        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            syncUpdate( this, {op: ChildrenUpdateOperation.Slice, startIndex, endIndex});
        else
            this.requestUpdate( {op: ChildrenUpdateOperation.Slice, startIndex, endIndex});
    }

    /**
     * At the given index, removes a given number of sub-nodes and then inserts the new content.
     * @param index
     * @param countToDelete
     * @param contentToInsert
     */
    public spliceChildren( index: number, countToDelete?: number, contentToInsert?: any, update?: boolean, schedulingType?: TickSchedulingType): void
    {
        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            syncUpdate( this, {op: ChildrenUpdateOperation.Splice, index, countToDelete, contentToInsert, update});
        else
            this.requestUpdate( {op: ChildrenUpdateOperation.Splice, index, countToDelete, contentToInsert, update});
    }

    /**
     * Moves a range of sub-nodes to a new location.
     * @param index
     * @param count
     * @param shift
     */
    public moveChildren( index: number, count: number, shift: number, schedulingType?: TickSchedulingType): void
    {
        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            syncUpdate( this, {op: ChildrenUpdateOperation.Move, index, count, shift});
        else
            this.requestUpdate( {op: ChildrenUpdateOperation.Move, index, count, shift});
    }

    /**
     * Swapw two ranges of the element's sub-nodes. The ranges cannot intersect.
     * @param index1
     * @param count1
     * @param index2
     * @param count2
     */
    public swapChildren( index1: number, count1: number, index2: number, count2: number, schedulingType?: TickSchedulingType): void
    {
        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            syncUpdate( this, {op: ChildrenUpdateOperation.Swap, index1, count1, index2, count2});
        else
            this.requestUpdate( {op: ChildrenUpdateOperation.Swap, index1, count1, index2, count2});
    }

    /**
     * Removes the given number of nodes from the start and/or the end of the list of sub-nodes.
     * @param startCount
     * @param endCount
     */
    public trimChildren( startCount: number, endCount: number, schedulingType?: TickSchedulingType): void
    {
        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            syncUpdate( this, {op: ChildrenUpdateOperation.Trim, startCount, endCount});
        else
            this.requestUpdate( {op: ChildrenUpdateOperation.Trim, startCount, endCount});
    }

    /**
     * Adds the given content at the start and/or at the end of the existing children.
     * @param startContent
     * @param endContent
     */
    public growChildren( startContent?: any, endContent?: any, schedulingType?: TickSchedulingType): void
    {
        if (!schedulingType || schedulingType === TickSchedulingType.Sync)
            syncUpdate( this, {op: ChildrenUpdateOperation.Grow, startContent, endContent});
        else
            this.requestUpdate( {op: ChildrenUpdateOperation.Grow, startContent, endContent});
    }



    // Creates a virtual node as a "clone" of this one. This method is invoked when an already
    // mounted node is returned during rendering. The method can either create a new virtual
    // node or it can mark the node in a special way and return the same instance. If this method
    // is not implemented, the same instance will be used.
    public clone(): VN
    {
        let newElmVN = new ElmVN( this.creator, this.elmName, this.props, this.subNodes);
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
        let clonedFrom = this.clonedFrom;
        if (clonedFrom && clonedFrom.ownDN)
        {
            // we don't clone the children (if any) because they will be cloned by our sub-nodes
            this.ownDN = clonedFrom.ownDN.cloneNode( false) as T;

            // copy information about attributes and events
            this.attrs = clonedFrom.attrs;
            this.events = clonedFrom.events;
            this.customAttrs = clonedFrom.customAttrs;

            // forget the fact that we were cloned
            this.clonedFrom = null;
        }
        else
        {
            // create the element. If namespace is provided use it
            let ns = this.props?.xmlns;
            if (ns)
                this.ownDN = document.createElementNS( ns, this.elmName) as any as T;
            else
            {
                // if the element is in the list use the provided namespace; otherwise, use the
                // namespace of the anchor element.
                let info = elmInfos[this.elmName];
                if (typeof info === "number")
                {
                    switch( info)
                    {
                        case ENamespace.HTML:
                            this.ownDN = document.createElement( this.elmName) as any as T;
                            break;
                        case ENamespace.SVG:
                            this.ownDN = document.createElementNS( SvgNamespace, this.elmName) as T
                            break;
                        case ENamespace.MATHML:
                            this.ownDN = document.createElementNS( MathNamespace, this.elmName) as T
                            break;
                    }
                }
                else if (!info)
                    this.ownDN = document.createElementNS( (this.anchorDN as Element).namespaceURI, this.elmName) as T;
                else
                    this.ownDN = document.createElementNS( info.ns, info.name || this.elmName) as T;

                // // if the element is in the list use the provided namespace; otherwise, use the
                // // namespace of the anchor element.
                // let info = elmInfos[this.elmName];
                // this.ownDN = info
                //     ? info.ns
                //         ? document.createElementNS( info.ns, info.name || this.elmName) as T
                //         : document.createElement( this.elmName) as any as T
                //     : document.createElementNS( (this.anchorDN as Element).namespaceURI, this.elmName) as T;
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
            setRef( this.vnref, this);

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Elm, StatsAction.Added);
		/// #endif
	}



	// Releases reference to the DOM node corresponding to this virtual node.
	public unmount(): void
	{
		// unset the reference value if specified. We check whether the reference still points
		// to our element before setting it to undefined. If the same ElmRef object is used for
		// more than one element (and/or components) it can happen that the reference is changed
		// before our element is unmounted.
        if (this.ref)
            setRef( this.ref, undefined, this.ownDN);

        if (this.vnref)
            setRef( this.vnref, undefined, this);

		// terminate custom property handlers
		if (this.customAttrs)
			this.removeCustomAttrs();

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Elm, StatsAction.Deleted);
		/// #endif
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: ElmVN<T>): boolean
	{
		// update is possible if this is the same type of element; that is, it has the same
		// name.
		return this.elmName === newVN.elmName;
	}



	// Updates this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: ElmVN<T>): boolean
	{
        // we need to update attributes and events only if the new props are different from the
        // current ones
        if (this.creator !== newVN.creator || !s_deepCompare( this.props, newVN.props, 3))
        {
            if (newVN.props)
                newVN.parseProps( newVN.props);

            // if reference specification changed then set or unset it as necessary
            if (newVN.ref !== this.ref)
            {
                // remember the new reference specification
                this.ref = newVN.ref;
                this.vnref = newVN.vnref;

                // if reference is now specified, set it now; note that we already determined that
                // the reference object is different.
                if (this.ref)
                    setRef( this.ref, this.ownDN);

                if (this.vnref)
                    setRef( this.vnref, this);
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
		let shouldRender = this.subNodes != null || newVN.subNodes != null;

		return shouldRender;
	}



    // This method is called if the node requested a "partial" update. Different types of virtual
    // nodes can keep different data for the partial updates; for example, ElmVN can keep new
    // element properties that can be updated without re-rendering its children.
    public performPartialUpdate(): void
    {
        this.updatePropsOnly( this.propsForPartialUpdate)
        this.propsForPartialUpdate = undefined;
    }



    // Updates properties of this node from the given object containing new properties values. This
    // method is invoked if only properties should be updated without re-rendering the children.
	private updatePropsOnly( props: any): void
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
                        // if reference is now specified, set it now
                        this.ref = propVal;
                        if (propVal)
                            setRef( this.ref, this.ownDN);
                    }
                }
                else if (propName === "vnref")
                {
                    if (propVal !== this.vnref)
                    {
                        // if reference is now specified, set it now
                        this.vnref = propVal;
                        if (propVal)
                            setRef( this.vnref, this);
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
                // get information about the property and determine its type. If the property is
                // not explicitly registered (in ElmAttr) and the type of the property is either
                // function or object (including array), then it is considered to be an event.
                // Therefore, all regular attributes that can accept objects or arrays or functions
                // must be explicitly registered.
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
					let rtd = this.getEventRTD( propInfo, propVal as EventPropType);
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
                    if (propName === "vnref")
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
			setElmProp( this.ownDN, name, rtd.info, rtd.val);
		}
	}



	// Updates DOM attributes of this Element.
	private updateAttrs( newAttrs: { [name: string]: AttrRunTimeData }): void
	{
		// "cache" several members for faster access
		let elm = this.ownDN;
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
                removeElmProp( this.ownDN, name, info)
                delete this.attrs[name];
            }
        }
        else
        {
            if (oldAttr)
            {
                updateElmProp( this.ownDN, name, info, oldAttr.val, val)
                oldAttr.val = val;
            }
            else
            {
                setElmProp( this.ownDN, name, info, val);
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
	private addEvent( name: string, rtd: EventRunTimeData): void
	{
		rtd.wrapper = s_wrapCallback( rtd);
		this.ownDN.addEventListener( name, rtd.wrapper, rtd.useCapture);

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Event, StatsAction.Added);
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
	private removeEvent( name: string, rtd: EventRunTimeData): void
	{
		this.ownDN.removeEventListener( name, rtd.wrapper, rtd.useCapture);

		/// #if USE_STATS
			DetailedStats.log( StatsCategory.Event, StatsAction.Deleted);
		/// #endif
	}



	// Updates event listeners by comparing the old and the new ones.
	private updateEvents( newEvents: { [name: string]: EventRunTimeData }): void
	{
		let oldEvents = this.events;

		// loop over existing event listeners, remove those that are not found among the new
		// ones and update those whose value has changed
		if (oldEvents)
		{
			for( let name in oldEvents)
			{
				let oldRTD = oldEvents[name];
				let newRTD = newEvents ? newEvents[name] : undefined;
				if (!newRTD)
					this.removeEvent( name, oldRTD);
				else
					this.updateEvent( name, oldRTD, newRTD);
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

        // remember the new listeners in our object
		this.events = newEvents;
	}



	// Determines whether the old and the new values of the event listener are different and sets
	// the updated value. Returns true if update has been performed and false if no change has
	// been detected.
	private updateEvent( name: string, oldRTD: EventRunTimeData, newRTD: EventRunTimeData): void
	{
		// double-equal-sign for useCapture is on purpose, because useCapture can be undefined or boolean
		if (oldRTD.func === newRTD.func &&
			oldRTD.funcThisArg === newRTD.funcThisArg &&
			oldRTD.arg === newRTD.arg &&
			oldRTD.useCapture == newRTD.useCapture)
		{
			newRTD.wrapper = oldRTD.wrapper;
		}
		else
		{
			// remove old event listener
			this.ownDN.removeEventListener( name, oldRTD.wrapper, oldRTD.useCapture);

			// create new wrapper and add it as event listener
            newRTD.wrapper = s_wrapCallback( newRTD);
			this.ownDN.addEventListener( name, newRTD.wrapper, newRTD.useCapture);

			/// #if USE_STATS
				DetailedStats.log( StatsCategory.Event, StatsAction.Updated);
			/// #endif
		}
	}



    // Adds, updates or removes the given event handler of this Element. This method is invoked
    // when the properties of the element are updated as a result of requestPropsUpdate call; that
    // is when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateEventOnly( name: string, info: EventPropInfo, val: any ): void
	{
        let oldRTD = this.events && this.events[name];
        let newRTD = val != null && this.getEventRTD( info, val as EventPropType);
        if (!newRTD)
        {
            if (oldRTD)
            {
                this.removeEvent( name, oldRTD);
                delete this.events[name];
            }
        }
        else
        {
            if (oldRTD)
            {
                this.updateEvent( name, oldRTD, newRTD)
                this.events[name] = newRTD;
            }
            else
            {
                this.addEvent( name, newRTD);
                if (!this.events)
                    this.events = {};

                this.events[name] = newRTD;
            }
        }
	}



    // Determines whether the given property value is of the type that is used for event handlers.
    // If yes, then returns EventRunTimeData object; otherwise, returns undefined.
    private getEventRTD( info: EventPropInfo, propVal: EventPropType): EventRunTimeData
    {
        if (typeof propVal === "function")
            return { func: propVal, funcThisArg: this.creator, schedulingType: info ? info.schedulingType : undefined, creator: this.creator };
        else
            return {
                func: propVal.func,
                funcThisArg: propVal.funcThisArg ? propVal.funcThisArg : this.creator,
                arg: propVal.arg,
                schedulingType: propVal.schedulingType ? propVal.schedulingType : info ? info.schedulingType : undefined,
                creator: propVal.creator ? propVal.creator : this.creator,
                useCapture: propVal.useCapture
            };
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
	private props: IElementProps<T>;

	// If this virtual node was cloned from another node, points to the original node.
	public clonedFrom: ElmVN<T>;

    // Redefine the ownDN property from VN to be of the Element type
	public ownDN: T;

    // Reference to the element that is specified as a "ref" property.
	private ref: RefType<T>;

    // Reference to this virtual node that is specified as a "vnref" property.
	private vnref: ElmRefType<T>;

	// Object that serves as a map between attribute names and their current values.
	private attrs: { [name: string]: AttrRunTimeData };

	// Object that serves as a map between names of event listeners and their respective
	// parameters.
	private events: { [name: string]: EventRunTimeData };

	// Object that serves as a map between names of custom element properties and their respective
	// handler objects and values.
    private customAttrs: { [name: string]: CustomAttrRunTimeData };

    // Properties that were specified in the setProps call. This allows updating the
    // element's properties without re-rendering its children.
    private propsForPartialUpdate: any;
}



// Define methods/properties that are invoked during mounting/unmounting/updating and which don't
// have or have trivial implementation so that lookup is faster.
ElmVN.prototype.render = undefined;
ElmVN.prototype.didUpdate = undefined;
ElmVN.prototype.supportsErrorHandling = false;
ElmVN.prototype.ignoreUnmount = false;



// Type defining the information we keep about each regular attribute
interface AttrRunTimeData
{
	// Information about this attribute - can be null
	info: AttrPropInfo;

	// Current attribute value
	val: any;
};



// Type defining the information we keep about each event listener
interface EventRunTimeData extends CallbackWrappingParams<EventFuncType>
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



// Namespaces used to create elements.
let HtmlNamespace: string = "http://www.w3.org/1999/xhtml";
let SvgNamespace: string = "http://www.w3.org/2000/svg";
let MathNamespace: string = "http://www.w3.org/1998/Math/MathML";

// Numeric indicators of namespaces that can be mapped to element names for speeding up the
// decision on how to create elements
const enum ENamespace
{
    HTML = 1,
    SVG = 2,
    MATHML = 3,
}

// The ElmInfo type defines information that helps creating an element. This information can be
// of the following types:
//  - number - numeric indicator of the element namespce
//  - object that contains namespace and optionally element's real name. Some non-HTML elements
//    have names that cannot be used in JSX directly (e.g. because of hyphen like in
//    "color-profile"). In this case, the string value will be the actual element name to put into
//    the HTML document, while JSX will be using a camel-formatted name (e.g. "colorProfile").
type ElmInfo = ENamespace | { ns: string, name?: string};

// Object that maps element names to ElmInfo. Elements that are not in this map are created using
// the anchor's namespace URI with the document.createElementNS() call. Note that there are some
// elements that can be created under different namespaces, e.g <a> can be used under HTML and
// SVG. These elements SHOULD NOT be in this map.
let elmInfos: {[elmName:string]: ElmInfo} =
{
    div: ENamespace.HTML,
    span: ENamespace.HTML,
    tr: ENamespace.HTML,
    td: ENamespace.HTML,

    svg: ENamespace.SVG,
    colorProfile: { ns: SvgNamespace, name: "color-profile" },

    math: ENamespace.MATHML,
}



