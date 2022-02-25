import { isTrigger } from "..";
import {
    IElmVN, EventFuncType, ICustomAttributeHandler, IElementProps, EventPropType, setRef, RefType,
    ElmRefType, CallbackWrappingParams, TickSchedulingType, UpdateStrategy, ICustomAttributeHandlerClass
} from "../api/mim"
import {Styleset, SchedulerType, MediaStatement} from "mimcss"
import {
    VN, DN, VNDisp, s_deepCompare, s_wrapCallback, ChildrenUpdateOperation,
    mountSubNodes, reconcileSubNodes, unmountSubNodes, mimcss
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



	constructor( tagName: string, props: IElementProps<T>, subNodes: VN[])
	{
		super();

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



    // Requests update of the element properties without re-rendering of its children.
	public setProps( props: IElementProps<T>, schedulingType?: TickSchedulingType): void
    {
        if (!props)
            return;

        if (this.propsForPartialUpdate)
            Object.assign( this.propsForPartialUpdate, props)
        else
            this.propsForPartialUpdate = props;

        if (schedulingType === TickSchedulingType.Sync)
        {
            this.updatePropsOnly( this.propsForPartialUpdate)
            this.propsForPartialUpdate = null;
        }
        else
            this.requestPartialUpdate( schedulingType);
    }



    // Replaces the given range of sub-nodes with the new content
    public setChildren( content?: any, startIndex?: number, endIndex?: number, update?: boolean,
        updateStrategy?: UpdateStrategy, schedulingType?: TickSchedulingType): void
    {
        this.requestUpdate( {
            op: ChildrenUpdateOperation.Set, content, startIndex, endIndex,
            update, updateStrategy
        }, schedulingType);
    }

    // At the given index, removes a given number of sub-nodes and then inserts the new content.
    public spliceChildren( index: number, countToDelete?: number, contentToInsert?: any,
        schedulingType?: TickSchedulingType): void
    {
        this.requestUpdate( {op: ChildrenUpdateOperation.Splice, index, countToDelete, contentToInsert}, schedulingType);
    }

    // Moves a range of sub-nodes to a new location.
    public moveChildren( index: number, count: number, shift: number, schedulingType?: TickSchedulingType): void
    {
        this.requestUpdate( {op: ChildrenUpdateOperation.Move, index, count, shift}, schedulingType);
    }

    // Swaps two ranges of the element's sub-nodes. The ranges cannot intersect.
    public swapChildren( index1: number, count1: number, index2: number, count2: number, schedulingType?: TickSchedulingType): void
    {
        this.requestUpdate( {op: ChildrenUpdateOperation.Swap, index1, count1, index2, count2}, schedulingType);
    }

    // Retains the given range of the sub-nodes unmounting the sub-nodes outside the given range.
    public sliceChildren( startIndex: number, endIndex?: number, schedulingType?: TickSchedulingType): void
    {
        this.requestUpdate( {op: ChildrenUpdateOperation.Slice, startIndex, endIndex}, schedulingType);
    }

    // Removes the given number of nodes from the start and/or the end of the list of sub-nodes.
    public trimChildren( startCount: number, endCount: number, schedulingType?: TickSchedulingType): void
    {
        this.requestUpdate( {op: ChildrenUpdateOperation.Trim, startCount, endCount}, schedulingType);
    }

    // Adds the given content at the start and/or at the end of the existing children.
    public growChildren( startContent?: any, endContent?: any, schedulingType?: TickSchedulingType): void
    {
        this.requestUpdate( {op: ChildrenUpdateOperation.Grow, startContent, endContent}, schedulingType);
    }

    /**
     * Reverses sub-nodes within the given range.
     * @param startIndex Index of the first sub-node in the range. If undefined, the array of
     * sub-nodes starts at index 0.
     * @param endIndex Index of the sub-node after the last sub-node in the range. If
     * this parameter is zero or undefined or greater than the length of the sub-nodes array, the
     * range will include all sub-nodes from the startIndex to the end of the array.
     * @param schedulingType Type determining whether the operation is performed immediately or
     * is scheduled to a Mimbl tick.
     */
    public reverseChildren( startIndex?: number, endIndex?: number, schedulingType?: TickSchedulingType): void
    {
        this.requestUpdate( {op: ChildrenUpdateOperation.Reverse, startIndex, endIndex}, schedulingType);
    }

    // // Either performs immediately or schedules the execution of a children operation defined by
    // // the given request.
    // private doChildrenOp( req: ChildrenUpdateRequest, schedulingType: TickSchedulingType)
    // {
    //     if (schedulingType === TickSchedulingType.Sync)
    //         syncUpdate( this, req);
    //     else
    //         this.requestUpdate( req);
    // }



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN?: DN | null): void
	{
        super.mount( parent, index, anchorDN);

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
                this.ownDN = info === ElementNamespace.HTML
                    ? document.createElement( this.elmName) as any as T
                    : document.createElementNS( ElementNamespaceNames[info], this.elmName) as T;
            }
            else if (!info)
                this.ownDN = document.createElementNS( (this.anchorDN as Element).namespaceURI, this.elmName) as T;
            else
                this.ownDN = document.createElementNS( ElementNamespaceNames[info.ns], info.name) as any as T;
        }

        // translate properties into attributes, events and custom attributes
        if (this.props)
        {
            this.parseProps( this.props);

            if (this.attrs)
                this.mountAttrs( this.attrs);

            if (this.events)
                this.addEvents();

            if (this.customAttrs)
                this.addCustomAttrs();

            if (this.ref)
                setRef( this.ref, this.ownDN);

            if (this.vnref)
                setRef( this.vnref, this);
        }

        // add sub-nodes
        if (this.subNodes)
            mountSubNodes( this, this.subNodes, this.ownDN, null);

        // add element to DOM
        anchorDN.insertBefore( this.ownDN, beforeDN);

        /// #if USE_STATS
			DetailedStats.log( StatsCategory.Elm, StatsAction.Added);
		/// #endif
	}



	// Releases reference to the DOM node corresponding to this virtual node.
	public unmount( removeFromDOM: boolean): void
	{
        if (removeFromDOM)
        {
            this.ownDN.remove();

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Elm, StatsAction.Deleted);
            /// #endif
        }

        if (this.props)
        {
            // unset the reference value if specified. We check whether the reference still points
            // to our element before setting it to undefined. If the same ElmRef object is used for
            // more than one element (and/or components) it can happen that the reference is changed
            // before our element is unmounted.
            if (this.ref)
                setRef( this.ref, undefined, this.ownDN);

            if (this.vnref)
                setRef( this.vnref, undefined, this);

            // if any attributes have triggers, detach from them
            if (this.attrs)
                this.unmountAttrs( this.attrs);

            // terminate custom property handlers
            if (this.customAttrs)
                this.removeCustomAttrs();
        }

        if (this.subNodes)
            unmountSubNodes( this.subNodes, false);

        this.ownDN = null;

        super.unmount( removeFromDOM);
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
	public update( newVN: ElmVN<T>, disp: VNDisp): void
	{
        // need to update attributes and events if the new props are different from the current ones.
        if (!s_deepCompare( this.props, newVN.props, 3))
        {
            newVN.creator = this.creator;
            if (newVN.props)
                newVN.parseProps( newVN.props);

            // remember new props
            this.props = newVN.props;

            // if reference specifications changed then set or unset them as necessary
            this.updateRef( newVN.ref);
            this.updateVNref( newVN.vnref);

            // remember the new value of the key and updateStartegy properties (even if the
            // values are the same)
            this.key = newVN.key;
            this.updateStrategy = newVN.updateStrategy;

            // update attributes and events
            this.updateAttrs( newVN.attrs);
            this.updateEvents( newVN.events);
            this.updateCustomAttrs( newVN.customAttrs);
        }

        // update children if they exist either on our or on the new element
        if (this.subNodes || newVN.subNodes)
            reconcileSubNodes( this, disp, newVN.subNodes);
	}


    // This method is called if the node requested a "partial" update. Different types of virtual
    // nodes can keep different data for the partial updates; for example, ElmVN can keep new
    // element properties that can be updated without re-rendering its children.
    public performPartialUpdate(): void
    {
        if (this.propsForPartialUpdate)
        {
            this.updatePropsOnly( this.propsForPartialUpdate)
            this.propsForPartialUpdate = undefined;
        }

        if (this.attrsForPartialUpdate)
        {
            this.updateAttrsOnly( this.attrsForPartialUpdate)
            this.attrsForPartialUpdate = undefined;
        }
    }



    // Updates properties of this node from the given object containing new properties values. This
    // method is invoked if only properties should be updated without re-rendering the children.
	public updatePropsOnly( props: any): void
	{
        // loop over all properties
        for( let propName in props)
		{
            // get information about the property and determine its type.
            let propVal = props[propName];
            let propInfo = propInfos[propName];
            let propType = propInfo?.type ?? PropType.Attr;

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
                    this.updateRef( propVal)
                else if (propName === "vnref")
                    this.updateVNref( propVal)
                else if (propName === "updateStrategy")
                    this.updateStrategy = propVal;
            }
		}
	}



    // Updates attribute values of this element from the given object containing new values. This
    // method is invoked only when one or more attributes with triggers have their values changed.
	public updateAttrsOnly( newAttrValues: any): void
	{
        // loop over all properties
        for( let name in newAttrValues)
		{
            // get information about the attribute.
            let rtd = this.attrs?.[name]
            if (rtd)
            {
                let newVal = newAttrValues[name];

                // use setElmProp instead of updateElmProp because we don't have the old
                // attribute value
                setElmProp( this.ownDN, name, rtd.info, newVal);
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
				let propInfo = propInfos[propName];
                let propType = propInfo?.type ?? PropType.Attr;
				if (propType === PropType.Attr)
                {
                    if (!this.attrs)
                        this.attrs = {};

				    this.attrs[propName] = { info: propInfo, val: propVal };
                }
				else if (propType === PropType.Event)
				{
                    if (!this.events)
                        this.events = {};

                    this.events[propName] = this.getEventRTD( propInfo, propVal as EventPropType);
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



    /**
     * Updates reference to the DOM element.
     */
    private updateRef( newRef: RefType<T>): void
    {
        if (newRef !== this.ref)
        {
            if (this.ref)
                setRef( this.ref, undefined);
            this.ref = newRef;
            if (this.ref)
                setRef( this.ref, this.ownDN);
        }
    }

    /**
     * Updates reference to the virtual node.
     */
    private updateVNref( newVNref: ElmRefType<T>): void
    {
        if (newVNref !== this.vnref)
        {
            if (this.vnref)
                setRef( this.vnref, undefined);
            this.vnref = newVNref;
            if (this.vnref)
                setRef( this.vnref, this);
        }
    }



	// Adds DOM attributes to the Element.
	private mountAttrs( attrs: { [name: string]: AttrRunTimeData }): void
	{
		for( let name in attrs)
            this.mountAttr( name, attrs[name], false);
	}

	private mountAttr( name: string, rtd: AttrRunTimeData, isUpdate: boolean): void
	{
        let val = rtd.val;

        // the value can actually be a trigger and we need to listen to its changes then
        let actVal = val;
        if (isTrigger(val))
        {
            actVal = val.get();
            rtd.onChange = onAttrTriggerChanged.bind( this, name);
            val.attach( rtd.onChange);
        }

        if (actVal != null && actVal !== false)
            setElmProp( this.ownDN, name, rtd.info, actVal);

        if (isUpdate)
        {
            if (!this.attrs)
                this.attrs = {};

            this.attrs[name] = rtd;
        }
	}



	// Updates DOM attributes of this Element.
	private updateAttrs( newAttrs: { [name: string]: AttrRunTimeData }): void
	{
		let oldAttrs = this.attrs;

		// loop over existing attributes, remove those that are not found among the new ones and
		// update those whose value has changed
		if (oldAttrs)
		{
			for( let name in oldAttrs)
                this.updateAttr( name, oldAttrs[name], newAttrs?.[name]);
		}

		// loop over new attributes; add those that are not found among the old ones
		if (newAttrs)
		{
			for( let name in newAttrs)
			{
				if (!oldAttrs || !(name in oldAttrs))
                    this.mountAttr( name, newAttrs[name], true)
			}
		}
	}

    /**
     * Updates the attribute with the given name using old and new run-time data. If the new
     * value is null, remove the old property and remove the attribute from the element. If the
     * new value is different from the old one, set it to the attribute in the element.
     */
    private updateAttr( name: string, oldRTD: AttrRunTimeData, newRTD?: AttrRunTimeData): void
    {
        let oldVal = oldRTD.val;
        let newVal = newRTD?.val;
        if (newVal !== oldVal)
        {
            if (newVal == null || newVal === false)
                this.unmountAttr( name, oldRTD, true);
            else
            {
                let actOldVal = oldVal;
                let onChange = oldRTD.onChange;
                if (onChange)
                {
                    // if onChange is defined then oldVal is a trigger. We detach from it but
                    // don't clear the onChange callback - because it can be used if the new value
                    // is also a trigger.
                    actOldVal = oldVal.get();
                    oldVal.detach( onChange);
                }

                let actNewVal = newVal;
                if (isTrigger(newVal))
                {
                    actNewVal = newVal.get();
                    if (!onChange)
                        oldRTD.onChange = onAttrTriggerChanged.bind( this, name);
                    newVal.attach( oldRTD.onChange);
                }
                else
                    oldRTD.onChange = null;

                if (actNewVal !== actOldVal)
                {
                    if (actNewVal == null || actNewVal === false)
                        removeElmProp( this.ownDN, name, oldRTD.info);
                    else if (!s_deepCompare( actOldVal, actNewVal, 1))
                        updateElmProp( this.ownDN, name, oldRTD.info, actOldVal, actNewVal);
                }

                oldRTD.val = newVal;
            }
        }
    }



    private unmountAttrs( attrs: { [name: string]: AttrRunTimeData }): void
    {
        for( let name in attrs)
            this.unmountAttr( name, attrs[name], false);
    }

    private unmountAttr( name: string, rtd: AttrRunTimeData, isUpdate: boolean): void
    {
        if (rtd.onChange)
            rtd.val.detach( rtd.onChange);

        if (isUpdate)
        {
            removeElmProp( this.ownDN, name, rtd.info)
            delete this.attrs[name];
        }
    }



    // Adds, updates or removes the given DOM attribute of this Element. This method is invoked
    // when the properties of the element are updated as a result of setProps call; that
    // is when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateAttrOnly( name: string, info: AttrPropInfo, val: any ): void
	{
        let oldRTD = this.attrs?.[name];
        if (val == null || val === false)
        {
            if (oldRTD)
                this.unmountAttr( name, oldRTD, true);
        }
        else
        {
            if (oldRTD)
                this.updateAttr( name, oldRTD, {info, val});
            else
                this.mountAttr( name, {info, val}, true);
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
				let newRTD = newEvents?.[name];
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
    // when the properties of the element are updated as a result of setProps call; that
    // is when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateEventOnly( name: string, info: EventPropInfo, val: EventPropType): void
	{
        let oldRTD = this.events?.[name];
        let newRTD = val != null && this.getEventRTD( info, val);
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



    /**
     * Returns EventRunTimeData object for the given value of the even property. The value can be
     * either a function or a tuple or an object.
     */
    private getEventRTD( info: EventPropInfo, propVal: EventPropType): EventRunTimeData
    {
        if (typeof propVal === "function")
            return { func: propVal, thisArg: this.creator, schedulingType: info?.schedulingType }
        else if (Array.isArray(propVal))
        {
            return {
                func: propVal[0],
                arg: propVal[1],
                thisArg: propVal[2],
                schedulingType: info?.schedulingType,
            }
        }
        else
        {
            let rtd = Object.assign( {}, propVal);
            if (!rtd.schedulingType && info)
                rtd.schedulingType = info?.schedulingType;

            return rtd;
        }
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
            /// #if DEBUG
            console.error( `Error creating handler for custom attribute '${name}': ${err.message}`);
            /// #endif

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
            /// #if DEBUG
            console.error( `Error terminating handler for custom attribute '${name}': ${err.message}`);
            /// #endif
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
				const newCustomAttr = newCustomAttrs?.[name];
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
            /// #if DEBUG
            console.error( `Error updating handler for custom attribute '${name}': ${err.message}`);
            /// #endif
        }
	}



    // Adds, updates or removes the given custom attribute of this Element. This method is invoked
    // when the properties of the element are updated as a result of setProps call; that
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

    // Redefine the ownDN property from VN to be of the Element type
	public declare ownDN: T;

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

    // Attributes with trigger values that were changed. This allows updating the
    // element's properties without re-rendering its children. This is different from the
    // propsForPartialUpdate property because the latter allows changing trigger values to
    // non-trigger values and vice versa, while the attrsForPartialUpdate property only
    // indicates change in the triggers' values.
    public attrsForPartialUpdate: any;
}



/**
 * Function reacting on the value change in an attribute's trigger. This function gets bounded to
 * the instance of the ElmVN class and attribute RTD object; therefore, it can use "this".
 */
function onAttrTriggerChanged( this: ElmVN, name: string, val: any): void
{
    if (!this.attrsForPartialUpdate)
        this.attrsForPartialUpdate = { [name]: val };
    else
        this.attrsForPartialUpdate[name] = val;

    this.performPartialUpdate();
    this.attrsForPartialUpdate = null;
    // this.requestPartialUpdate();
}



// Type defining the information we keep about each regular attribute
interface AttrRunTimeData
{
	// Information about this attribute - can be undefined
	info: AttrPropInfo;

	// Current attribute value
	val: any;

    // Bound method reacting on the value change in the trigger. It is created only if the
    // attribute value is a trigger.
    onChange?: (s: string) => void;
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



// Numeric indicators of namespaces that can be mapped to element names for speeding up the
// decision on how to create elements
const enum ElementNamespace
{
    HTML = 1,
    SVG = 2,
    MATHML = 3,
}

const ElementNamespaceNames = {
    [ElementNamespace.HTML]: "http://www.w3.org/1999/xhtml",
    [ElementNamespace.SVG]: "http://www.w3.org/2000/svg",
    [ElementNamespace.MATHML]: "http://www.w3.org/1998/Math/MathML",
}

// The ElmInfo type defines information that helps creating an element. This information can be
// of the following types:
//  - number - numeric indicator of the element namespce
//  - object that contains namespace and optionally element's real name. Some non-HTML elements
//    have names that cannot be used in JSX directly (e.g. because of hyphen like in
//    "color-profile"). In this case, the string value will be the actual element name to put into
//    the HTML document, while JSX will be using a camel-formatted name (e.g. "colorProfile").
type ElmInfo = ElementNamespace | { ns: number, name: string};

// Object that maps element names to ElmInfo. Elements that are not in this map are created using
// the anchor's namespace URI with the document.createElementNS() call. Note that there are some
// elements that can be created under different namespaces, e.g <a> can be used under HTML and
// SVG. These elements SHOULD NOT be in this map.
const elmInfos: {[elmName:string]: ElmInfo} =
{
    a: ElementNamespace.HTML,
    button: ElementNamespace.HTML,
    div: ElementNamespace.HTML,
    label: ElementNamespace.HTML,
    li: ElementNamespace.HTML,
    span: ElementNamespace.HTML,
    tr: ElementNamespace.HTML,
    td: ElementNamespace.HTML,

    svg: ElementNamespace.SVG,
    colorProfile: { ns: ElementNamespace.SVG, name: "color-profile" },

    math: ElementNamespace.MATHML,
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Information about attributes and events and functions to set/update/remove them.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/** Type of properties that can be specified for an element. */
export const enum PropType
{
    /**
     * Built-in attribute that is used internally by the Mimbl infrastructure and is not set
     * to the element.
     */
	Framework = 0,

	/** Regular attributes set using Element.setAttribute */
	Attr = 1,

	/** Event listeners set using Element.addEventListener */
	Event = 2,

	/**  Custom attributes for which handler factories are registered*/
	CustomAttr = 3,
}



/**
 * Base interface describing information kept about property that can be specified for an element.
 */
interface PropInfoBase
{
	// Type of the property.
	type: PropType;
}



/**
 * Information about attributes that contains functions for setting, diffing, updating and removing
 * attribute(s) corresponding to the property.
 */
interface AttrPropInfo extends PropInfoBase
{
	/**
     * Function that sets the value of the attribute. If this function is not defined, then the DOM
     * elm.setAttribute is called with propName as attribute name and propVal converted to string.
     */
	set?: (elm: Element, name: string, propVal: any) => void;

	/**
     * Function that updates the value of the attribute based on the object that was returned from
     * the diff function. If this function is not defined, then the set function is used. If the
     * set function is not defined either, the DOM elm.setAttribute is called with propName as
     * attribute name and updateVal converted to string.
     */
	update?: (elm: Element, name: string, oldVal: any, newVal: any) => void;

	/**
     * Function that removes the attribute. If this function is not defined, then the DOM
     * elm.removeAttribute is called with propName as attribute name.
     */
	remove?: (elm: Element, name: string) => void;

	/**
     * The actual name of the attribute/property. This is sometimes needed if the attribute name
     * cannot be used as property name - for example, if attribute name contains characters not
     * allowed in TypeScript identifier (e.g. dash). It is also used if instead of using the
     * `setAttribute()` method we want to set the element's property directly and the property
     * name is different from the attribute name. For example, `class` -> `className` or
     * `for` -> `htmlFor`.
     */
	name?: string;
}



/** Information about events. */
interface EventPropInfo extends PropInfoBase
{
	// Type of scheduling the Mimbl tick after the event handler function returns
	schedulingType?: TickSchedulingType;

	// // Flag indicating whether the event bubbles. If the event doesn't bubble, the event handler
	// // must be set on the element itself; otherwise, the event handler can be set on the root
	// // anchor element, which allows having a single event handler registered for many elements,
	// // which is more performant.
	// isBubbling?: boolean;
}



/** Information about custom attributes. */
export interface CustomAttrPropInfo extends PropInfoBase
{
	// Class object that creates custom attribute handlers.
	handlerClass: ICustomAttributeHandlerClass<any>;
}



/** Type combining information about regular attributes or events or custom attributes. */
export type PropInfo = AttrPropInfo | EventPropInfo | CustomAttrPropInfo;



/**
 * Helper function that converts the given value to string.
 *   - strings are returned as is.
 *   - null and undefined are converted to an empty string.
 *   - arrays are converted by calling this function recursively on the elements and separating
 *     them with spaces.
 *   - everything else is converted by calling the toString method.
 */

const valToString = (val: any): string =>
	typeof val === "string"
        ? val
        : Array.isArray( val)
            ? val.map( item => valToString(item)).filter( item => !!item).join(" ")
            : val == null ? "" : val.toString();



/** Registers information about the given property. */
export function registerElmProp( propName: string, info: AttrPropInfo | EventPropInfo | CustomAttrPropInfo): void
{
    /// #if DEBUG
    if (propName in propInfos)
        console.error( `Element property ${propName} is already registered.`);
    /// #endif

    propInfos[propName] = info;
}



/**
 * Using the given property name and its value set the appropriate attribute(s) on the element.
 * This method handles special cases of properties with non-trivial values.
 */
function setElmProp( elm: Element, name: string, info: AttrPropInfo | null, val: any): void
{
    // get property info object
    if (!info)
        elm.setAttribute( name, valToString( val));
    else
    {
        // get actual attribute/property name to use
        if (info.name)
            name = info.name;

        if (info.set)
            info.set( elm, name, val);
        else
            elm.setAttribute( name, valToString( val));
    }

    /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Added);
    /// #endif
}



/**
 * Determines whether the old and the new values of the property are different and sets the updated
 * value to the element's attribute. Returns true if update has been performed and false if no
 * change in property value has been detected.
 */
function updateElmProp( elm: Element, name: string, info: AttrPropInfo | null,
    oldVal: any, newVal: any): void
{
    // get property info object; if this is not a special case (property is not in our list)
    // just set the new value to the attribute.
    if (!info)
        elm.setAttribute( name, valToString( newVal));
    else
    {
        // get actual attribute/property name to use
        if (info.name)
            name = info.name;

        // if update method is defined use it; otherwise, set the new value using setAttribute
        if (info.update)
            info.update( elm, name, oldVal, newVal);
        else if (info.set)
            info.set( elm, name, newVal);
        else
            elm.setAttribute( name, valToString( newVal));
    }

    /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Updated);
    /// #endif
}



/** Removes the attribute(s) corresponding to the given property. */
function removeElmProp( elm: Element, name: string, info: AttrPropInfo | null): void
{
    // get property info object
    if (!info)
        elm.removeAttribute( name);
    else
    {
        // get actual attribute/property name to use
        if (info.name)
            name = info.name;

        if (info.remove)
            info.remove( elm, name);
        else
            elm.removeAttribute( name);
    }

    /// #if USE_STATS
        DetailedStats.log( StatsCategory.Attr, StatsAction.Deleted);
    /// #endif
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of attributes that are set using properties.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
function setAttrAsProp( elm: Element, name: string, val: any): void
{
    elm[name] = val;
}

function setAttrAsStringProp( elm: Element, name: string, val: any): void
{
    elm[name] = valToString(val);
}

function removeAttrAsProp( elm: Element, name: string): void
{
    elm[name] = undefined;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of value and checked properties. Instead of setting these properties as attributes we
// set the value or checked property on the element.
//
// Handling of defaultValue and defaultChecked properties. These properties work when the
// element is first mounted and the new value is ignored upon updates and removals. This allows
// using defaultValue and defaultChecked to initialize the control value once.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
function setValueProp( elm: Element, name: string, val: any): void
{
	// we need to cast elm to any, because generic Element doesn't have value property.
	(elm as any).value = val;
}

function setCheckedProp( elm: Element, name: string, val: any): void
{
	// we need to cast elm to any, because generic Element doesn't have the "checked" property.
	(elm as any).checked = val;
}

function updatePropNoOp( elm: Element, name: string, newVal: any): void {}
function removePropNoOp( elm: Element, name: string): void {}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of style property. Style property can be specified either as a string or as the
// Styleset object from the Mimcss library. If the old and new style property values are of
// different types the diff function returns the new style value. If both are of the string type,
// then the new string value is returned. If both are of the CSSStyleDeclaration type, then an
// object is returned whose keys correspond to style items that should be changed. For updated
// items, the key value is from the new style value; for removed items, the key value is undefined.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
function setStyleProp( elm: Element, name: string, val: string | Styleset): void
{
    if (mimcss)
        mimcss.setElementStyle( elm as HTMLElement, val, SchedulerType.Sync);
    else if (typeof val === "string")
        elm.setAttribute( name, val);
}

function updateStyleProp( elm: Element, name: string, oldVal: string | Styleset,
    newVal: string | Styleset): void
{
    // if Mimcss library is not included, then style attributes can only be strings. If they are
    // not, this is an application bug and we canont handle it.
    if (!mimcss && (typeof oldVal !== "string" || typeof newVal !== "string"))
        return;

    let oldPropValAsString = typeof oldVal === "string" ? oldVal :  mimcss.stylesetToString( oldVal);
    let newPropValAsString = typeof newVal === "string" ? newVal :  mimcss.stylesetToString( newVal);

    if (oldPropValAsString !== newPropValAsString)
        elm.setAttribute( name, newPropValAsString);
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Handling of media property. Media property can be specified either as a string or as the
// MediaStatement object from the Mimcss library.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
const setMediaProp = (elm: Element, name: string, val: MediaStatement): void =>
   elm[name] = mimcss.mediaToString( val);

function updateMediaProp( elm: Element, attrName: string, oldVal: MediaStatement,
    newVal: MediaStatement): void
{
    // if Mimcss library is not included, then media attributes can only be strings. If they are
    // not, this is an application bug and we canont handle it.
    if (!mimcss && (typeof oldVal !== "string" || typeof newVal !== "string"))
        return;

    let oldString = mimcss.mediaToString( oldVal);
	let newString = mimcss.mediaToString( newVal);

	// we must return undefined because null is considered a valid update value
	if (newString !== oldString)
        elm[attrName] = newString;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Mapping of attributes including framework-specific attributes, element attributes and event
// attributes to objects defining their behavior.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

const StdFrameworkPropInfo = { type: PropType.Framework };
const StdEventPropInfo = { type: PropType.Event };
const AttrAsPropInfo = { type: PropType.Attr, set: setAttrAsProp, remove: removeAttrAsProp };

/**
 * Object that maps property names to PropInfo-derived objects. Information about custom
 * attributes is added to this object when the registerProperty method is called.
 */
const propInfos: {[P:string]: PropInfo} =
{
    // framework attributes.
    key: StdFrameworkPropInfo,
    ref: StdFrameworkPropInfo,
    vnref: StdFrameworkPropInfo,
    updateStrategy: StdFrameworkPropInfo,

    // attributes - only those attributes are listed that have non-trivial treatment or whose value
    // type is object or function.
    class: { type: PropType.Attr, set: setAttrAsStringProp, remove: removeAttrAsProp, name: "className" },
    for: { type: PropType.Attr, set: setAttrAsProp, remove: removeAttrAsProp, name: "htmlFor" },
    id: { type: PropType.Attr, set: setAttrAsProp, remove: removeAttrAsProp },
    value: { type: PropType.Attr, set: setValueProp, remove: removeAttrAsProp },
    defaultValue: { type: PropType.Attr, set: setValueProp, update: updatePropNoOp, remove: removePropNoOp },
    checked: { type: PropType.Attr, set: setCheckedProp, remove: removeAttrAsProp },
    defaultChecked: { type: PropType.Attr, set: setCheckedProp, update: updatePropNoOp, remove: removePropNoOp },
    style: { type: PropType.Attr, set: setStyleProp, update: updateStyleProp },
    media: { type: PropType.Attr, set: setMediaProp, update: updateMediaProp },
    disabled: AttrAsPropInfo,
    form: AttrAsPropInfo,
    name: AttrAsPropInfo,
    required: AttrAsPropInfo,
    selected: AttrAsPropInfo,
    size: AttrAsPropInfo,
    src: AttrAsPropInfo,
    tabindex: AttrAsPropInfo,
    target: AttrAsPropInfo,
    title: AttrAsPropInfo,
    type: AttrAsPropInfo,

    // events
    abort: StdEventPropInfo,
    animationcancel: StdEventPropInfo,
    animationend: StdEventPropInfo,
    animationiteration: StdEventPropInfo,
    animationstart: StdEventPropInfo,
    auxclick: StdEventPropInfo,
    beforeinput: StdEventPropInfo,
    blur: StdEventPropInfo,
    canplay: StdEventPropInfo,
    canplaythrough: StdEventPropInfo,
    change: StdEventPropInfo,
    click: { type: PropType.Event, schedulingType: TickSchedulingType.Sync },
    close: StdEventPropInfo,
    compositionend: StdEventPropInfo,
    compositionstart: StdEventPropInfo,
    compositionupdate: StdEventPropInfo,
    contextmenu: StdEventPropInfo,
    cuechange: StdEventPropInfo,
    dblclick: StdEventPropInfo,
    drag: StdEventPropInfo,
    dragend: StdEventPropInfo,
    dragenter: StdEventPropInfo,
    dragleave: StdEventPropInfo,
    dragover: StdEventPropInfo,
    dragstart: StdEventPropInfo,
    drop: StdEventPropInfo,
    durationchange: StdEventPropInfo,
    emptied: StdEventPropInfo,
    ended: StdEventPropInfo,
    error: StdEventPropInfo,
    focus: StdEventPropInfo,
    focusin: StdEventPropInfo,
    focusout: StdEventPropInfo,
    formdata: StdEventPropInfo,
    gotpointercapture: StdEventPropInfo,
    input: StdEventPropInfo,
    invalid: StdEventPropInfo,
    keydown: StdEventPropInfo,
    keypress: StdEventPropInfo,
    keyup: StdEventPropInfo,
    load: StdEventPropInfo,
    loadeddata: StdEventPropInfo,
    loadedmetadata: StdEventPropInfo,
    loadstart: StdEventPropInfo,
    lostpointercapture: StdEventPropInfo,
    mousedown: StdEventPropInfo,
    mouseenter: StdEventPropInfo,
    mouseleave: StdEventPropInfo,
    mousemove: StdEventPropInfo,
    mouseout: StdEventPropInfo,
    mouseover: StdEventPropInfo,
    mouseup: StdEventPropInfo,
    pause: StdEventPropInfo,
    play: StdEventPropInfo,
    playing: StdEventPropInfo,
    pointercancel: StdEventPropInfo,
    pointerdown: StdEventPropInfo,
    pointerenter: StdEventPropInfo,
    pointerleave: StdEventPropInfo,
    pointermove: StdEventPropInfo,
    pointerout: StdEventPropInfo,
    pointerover: StdEventPropInfo,
    pointerup: StdEventPropInfo,
    progress: StdEventPropInfo,
    ratechange: StdEventPropInfo,
    reset: StdEventPropInfo,
    resize: StdEventPropInfo,
    scroll: StdEventPropInfo,
    securitypolicyviolation: StdEventPropInfo,
    seeked: StdEventPropInfo,
    seeking: StdEventPropInfo,
    select: StdEventPropInfo,
    selectionchange: StdEventPropInfo,
    selectstart: StdEventPropInfo,
    stalled: StdEventPropInfo,
    submit: StdEventPropInfo,
    suspend: StdEventPropInfo,
    timeupdate: StdEventPropInfo,
    toggle: StdEventPropInfo,
    touchcancel: StdEventPropInfo,
    touchend: StdEventPropInfo,
    touchmove: StdEventPropInfo,
    touchstart: StdEventPropInfo,
    transitioncancel: StdEventPropInfo,
    transitionend: StdEventPropInfo,
    transitionrun: StdEventPropInfo,
    transitionstart: StdEventPropInfo,
    volumechange: StdEventPropInfo,
    waiting: StdEventPropInfo,
    wheel: StdEventPropInfo,
    copy: StdEventPropInfo,
    cut: StdEventPropInfo,
    paste: StdEventPropInfo,
};



