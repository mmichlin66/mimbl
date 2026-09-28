import {
    IElmVN, ICustomAttributeHandler, EventPropType, RefType, ExtendedElement,
    ElmRefType, TickSchedulingType, UpdateStrategy, PropType, DN
} from "../api/CompTypes"
import { ChildrenUpdateOperation, IVN, VNDisp } from "./VNTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { mountSubNodes, reconcileSubNodes } from "./Reconciler";
import { VN, setRef, updateRef } from "./VN";
import { EventsMixin } from "./Events";
import {
    AttrPropInfo, cleanElmProps, CustomAttrPropInfo, EventPropInfo, getPropInfo, removeElmProp,
    setElmProp, updateElmProp
} from "./Props";
import { getElmNS, getElmRealName, HtmlNamespaceCode, MathmlNamespaceCode, SvgNamespaceCode } from "../utils/UtilFunc";
import { Trigger } from "../api/TriggerAPI";



/** For SVG elements' properties property assignment doesn't work - must go via setAttribute */
const SvgDefaultPropInfo: AttrPropInfo = { attrOnly: true };

/**
 * All JSX attributes of Custom HTML Elements (Web Components) use standard set/update/remove
 * functionality and they always use the JSX attrbute value as is without any type conversion.
 */
const CustomElementPropInfo: AttrPropInfo = { v2rv: val => val };



/** Represents a DOM element created using JSX. */
export class ElmVN<T extends Element = Element> extends VN implements IElmVN<T>
{
	// Tag name of an Element.
	public elmName: string;

	// Element's namespace code.
	public nscode: number;

	// Instance of an Element. The instance is created when the node is mounted.
	public get elm(): T | null { return this.ownDN; }

    // Properties that were passed to the element.
	private props: ExtendedElement<T> | undefined = undefined;

    // Redefine the ownDN property from VN to be of the Element type
	public ownDN: T | null = null;

    // Reference to the element that is specified as a "ref" property.
	private ref: RefType<T> | undefined = undefined;

    // Reference to this virtual node that is specified as a "vnref" property.
	private vnref: ElmRefType<T> | undefined = undefined;

	// Object that serves as a map between attribute names and their current values.
	private attrs: { [name: string]: AttrRunTimeData } | undefined = undefined;

	// Flag indicating whether at least one of the attributes has triggers. If not then
    // we can avoid calling unmountAttrs upon element unmounting.
	private hasTriggers: boolean = false;

	// Object that serves as a container for event information.
	private events: EventsMixin | undefined = undefined;

	// Object that serves as a map between names of custom element properties and their respective
	// handler objects and values.
    private customAttrs: { [name: string]: CustomAttrRunTimeData } | undefined = undefined;

    // Properties that were specified in the setProps call. This allows updating the
    // element's properties without re-rendering its children.
    private propsForPartialUpdate: any;


	constructor( tagName: string, props: ExtendedElement<T> | undefined, subNodes: IVN[] | null)
	{
		super();

		this.elmName = tagName;
		this.props = props;
		this.subNodes = subNodes;

        // set element's namespace code to HTML - the real namespace will be obtained on mounting -
        // we just don't need to spend time on this during the constructions.
        this.nscode = HtmlNamespaceCode;

        // get the key property. If key property was not specified, use id; if id was not
        // specified key will remain undefined.
        this.key = props?.key ?? props?.id;
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
	public setProps( props: ExtendedElement<T>, schedulingType?: TickSchedulingType): void
    {
        if (!props)
            return;

        if (this.propsForPartialUpdate)
            Object.assign( this.propsForPartialUpdate, props)
        else
            this.propsForPartialUpdate = props;

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



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount(parent: VN, index: number, anchorDN: DN, beforeDN: DN): void
	{
        super.mount(parent, index, anchorDN);

        // create the element using proper namespace for SVG and MathML elements.
        let props = this.props as Record<string,any>;
        let [nscode, ns] = getElmNS(this.elmName);
        this.nscode = nscode;
        let elm = nscode === SvgNamespaceCode || nscode === MathmlNamespaceCode
            ? document.createElementNS(ns, getElmRealName(this.elmName)) as T
            : document.createElement(this.elmName, props?.is != null ? {is: props.is} : undefined) as unknown as T;

        /// #if DEBUG
            elm.setAttribute("mim-debug-id", "" + this.debugID);
        /// #endif

        this.ownDN = elm;

        // translate properties into attributes, events and custom attributes
        if (props)
        {
            this.parseProps(props);
            this.mountAttrs();
            this.events?.mount(elm);
            this.mountCustomAttrs();

            if (this.ref)
                setRef(this.ref, elm);

            if (this.vnref)
                setRef(this.vnref, this);
        }

        // add sub-nodes
        if (this.subNodes)
            mountSubNodes(this, this.subNodes, elm, null);

        // add element to DOM
        anchorDN!.insertBefore(elm, beforeDN);

        /// #if USE_STATS
			DetailedStats.log( StatsCategory.Elm, StatsAction.Added);
		/// #endif
	}



	// Releases reference to the DOM node corresponding to this virtual node.
	public unmount( removeFromDOM: boolean): void
	{
        if (removeFromDOM)
        {
            this.ownDN!.remove();

            /// #if USE_STATS
                DetailedStats.log( StatsCategory.Elm, StatsAction.Deleted);
            /// #endif
        }

        // sub-nodes will not have to remove themselves from DOM, because either this or one
        // of the ancestor nodes have already been removed.
        this.unmountSubNodes(false);

        // unset the reference value if specified. We check whether the reference still points
        // to our element before setting it to undefined. If the same ElmRef object is used for
        // more than one element (and/or components) it can happen that the reference is changed
        // before our element is unmounted.
        if (this.ref)
            setRef( this.ref, undefined, this.ownDN);

        if (this.vnref)
            setRef( this.vnref, undefined, this);

        // if any attributes have triggers, detach from them
        if (this.hasTriggers)
            this.unmountAttrs();

        // note that we don't need to unmount events, because event listeners are removed when
        // the element is destroyed

        // terminate custom property handlers
        if (this.customAttrs)
            this.unmountCustomAttrs();

        super.unmount( removeFromDOM);

        this.ownDN = null;
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: ElmVN<T>): boolean
	{
		// update is possible if this is the same type of element; that is, it has the same
		// name. Also, if we currently have events, the creator must be the same.
		return this.elmName === newVN.elmName;
	}



	// Updates this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node.
	public update( newVN: ElmVN<T>, disp: VNDisp): void
	{
        // if the new VN was created by a different creator, we will need to update all
        // attributes and events (even if they are the same). We also need to "clean" some
        // special properties for some special elements.
        let isNewCreator = this.creator !== newVN.creator;
        if (isNewCreator)
        {
            this.creator = newVN.creator;
            cleanElmProps(this.elmName, this.ownDN!)
        }

        if (this.props || newVN.props)
        {
            if (newVN.props)
                newVN.parseProps( newVN.props);

            // if reference specifications changed then set or unset them as necessary
            if (this.ref != newVN.ref)
                this.ref = updateRef(this.ref, newVN.ref, this.ownDN!);
            if (this.vnref != newVN.vnref)
                updateRef(this.vnref, newVN.vnref, this);

            // remember the new value of the key and updateStartegy properties (even if the
            // values are the same)
            this.key = newVN.key;
            this.updateStrategy = newVN.updateStrategy;

            // update attributes and events
            this.updateAttrs(newVN.attrs, isNewCreator);
            this.updateEvents(newVN.events);
            this.updateCustomAttrs(newVN.customAttrs);

            // remember new props
            this.props = newVN.props;
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
        this.updatePropsOnly(this.propsForPartialUpdate)
        this.propsForPartialUpdate = undefined;
    }



	// Goes over the original properties and puts them into the buckets of attributes, event
	// listeners and custom attributes.
	private parseProps( props: Record<string,any>): void
	{
        // loop over all properties ignoring the built-ins
        let nscode = this.nscode;
        for( let [propName, propVal] of Object.entries(props))
		{
            // get information about the property and determine its type.
            let propInfo = getPropInfo(this.nscode, this.elmName, propName);
            let propType = !propInfo ? getPropTypeFromPropVal(propVal) : propInfo.type;
            if (!propType || propType === PropType.Attr)
            {
                // all SVG attributes except style must be set via attributes and not properties
                if (nscode === SvgNamespaceCode && propName !== "style")
                {
                    if (!propInfo)
                        propInfo = SvgDefaultPropInfo;
                    else
                        propInfo = Object.assign({}, propInfo, SvgDefaultPropInfo);
                }

                (this.attrs ??= {})[propName] = { info: propInfo as AttrPropInfo | undefined, val: propVal, rval: null };
            }
            else if (propType === PropType.Event)
                (this.events ??= new EventsMixin(this.creator)).add(propName,
                    propVal as EventPropType, (propInfo as EventPropInfo)?.schedulingType);
            else if (propType === PropType.Framework)
            {
                if (propName === "ref")
                    this.ref = propVal;
                else if (propName === "vnref")
                    this.vnref = propVal;
                // else if (propName === "children" && !this.subNodes)
                //     this.subNodes = [propVal];
                else if (propName === "updateStrategy")
                    this.updateStrategy = propVal;
            }
            else // if (propType === PropType.CustomAttr)
            {
                // remember custom attributes value. Handler will be created later.
                (this.customAttrs ??= {})[propName] = { info: propInfo as CustomAttrPropInfo, val: propVal};
            }
		}
	}



    // Updates properties of this node from the given object containing new properties values. This
    // method is invoked if only properties should be updated without re-rendering the children.
	private updatePropsOnly( props: any): void
	{
        // loop over all properties
        let nscode = this.nscode;
        for( let [propName, propVal] of Object.entries(props))
		{
            // get information about the property and determine its type.
            let propInfo = getPropInfo(this.nscode, this.elmName, propName);
            let propType = !propInfo ? getPropTypeFromPropVal(propVal) : propInfo.type;
            if (propType === PropType.Attr)
            {
                // all SVG attributes except style must be set via attributes and not properties
                if (nscode === SvgNamespaceCode && propName !== "style")
                {
                    if (!propInfo)
                        propInfo = SvgDefaultPropInfo;
                    else
                        propInfo = Object.assign({}, propInfo, SvgDefaultPropInfo);
                }

                this.updateAttrOnly( propName, propVal, propInfo as AttrPropInfo);
            }
            else if (propType === PropType.Event)
                this.updateEventOnly( propName, propVal as EventPropType, propInfo as EventPropInfo);
            else if (propType === PropType.CustomAttr)
                this.updateCustomAttrOnly( propName, propVal, propInfo as CustomAttrPropInfo);
            else // if (propType === PropType.Framework)
            {
                if (propName === "key")
                    this.key = propVal;
                else if (propName === "ref")
                {
                    if (this.ref !== propVal)
                        this.ref = updateRef(this.ref, propVal as RefType<T>, this.ownDN!);
                }
                else if (propName === "vnref")
                {
                    if (this.vnref !== propVal)
                        this.vnref = updateRef(this.vnref, propVal as ElmRefType<T>, this);
                }
                else if (propName === "updateStrategy")
                    this.updateStrategy = propVal as UpdateStrategy;
            }
		}
	}



    // Updates attribute values of this element from the given object containing new values. This
    // method is invoked only when one or more attributes with triggers have their values changed.
	public updateAttrValue(name: string, newVal: any): void
	{
        // get information about the attribute.
        let rtd = this.attrs?.[name]
        if (rtd)
        {
            if (newVal != null)
                rtd.rval = updateElmProp( this.ownDN!, name, rtd.rval, newVal, rtd.info);
            else
                removeElmProp( this.ownDN!, name, rtd.rval, rtd.info), rtd.rval = null;
        }
	}



	// Adds DOM attributes to the Element.
	private mountAttrs(): void
	{
        if (this.attrs)
        {
            for( let [name, rtd] of Object.entries(this.attrs))
                this.mountAttr( name, rtd, false);
        }
	}

	private mountAttr(name: string, rtd: AttrRunTimeData, addToAttrs: boolean): void
	{
        let val = rtd.val;

        // the value can actually be a trigger and we need to listen to its changes then
        if (val != null)
        {
            if (val instanceof Trigger)
            {
                val.attach(rtd.onChange = onAttrTriggerChanged.bind( this, name));
                this.hasTriggers = true;
                val = val.get();
            }

            if (val != null)
                rtd.rval = setElmProp( this.ownDN!, name, val, rtd.info);
        }

        // `add` means that a new attribute is mounted as a result of updating already existing
        // element (as opposed to mounting it for the first time), and that we need to remember it
        // in our attrs object.
        if (addToAttrs)
            (this.attrs ??= {})[name] = rtd;
	}



	// Updates DOM attributes of this Element.
	private updateAttrs(newAttrs: { [name: string]: AttrRunTimeData } | undefined, isNewCreator: boolean): void
	{
		let oldAttrs = this.attrs;

		// loop over existing attributes, remove those that are not found among the new ones and
		// update those whose value has changed
		if (oldAttrs)
		{
            for( let [name, oldRTD] of Object.entries(oldAttrs))
            {
                let newRTD = newAttrs?.[name];
                if (newRTD)
                    this.updateAttr(name, oldRTD, newRTD, isNewCreator);
                else
                    this.unmountAttr(name, oldRTD, true);
            }
		}

		// loop over new attributes and mount those that are not found among the old ones
		if (newAttrs)
		{
            for( let [name, newRTD] of Object.entries(newAttrs))
			{
				if (!oldAttrs?.[name])
                    this.mountAttr( name, newRTD, true)
			}
		}
	}

    /**
     * Updates the attribute with the given name using old and new run-time data. If the new
     * value is null, remove the old property and remove the attribute from the element. If the
     * new value is different from the old one, set it to the attribute in the element.
     */
    private updateAttr(name: string, oldRTD: AttrRunTimeData, newRTD: AttrRunTimeData, isNewCreator?: boolean): void
    {
        let oldVal = oldRTD.val;
        let newVal = newRTD.val;

        // we skip updating the attribute if the new value is equal to the old one and if it is a
        // primitive value (not object or array) and there is no new creator. We need to continue
        // update for objects and arrays because although the value can be the same, the members
        // could have changed
        if (newVal === oldVal && (newVal == null || typeof newVal !== "object") && !isNewCreator)
            return;

        // remember the new value. We will reuse newVal and oldVal with values from triggers (if any)
        oldRTD.val = newVal;

        // if the old value was a trigger get the actual value from it for comparison. We also
        // detach the old value from the onChange callback but still keep the callback itself as
        // it might be needed if the new value is also a trigger.
        let onChange = oldRTD.onChange;
        if (onChange)
        {
            oldVal.detach(onChange);
            oldVal = oldVal.get();
        }

        // check whether the new value is a trigger and get the actual value from it for comparison.
        // If it is a trigger either reuse the onChange callback or create and remember a new one.
        // If it is not a trigger, "forget" the onChange callback.
        if (newVal instanceof Trigger)
        {
            newVal.attach(oldRTD.onChange ??= onAttrTriggerChanged.bind(this, name));
            this.hasTriggers = true;
            newVal = newVal.get();
        }
        else if (onChange)
            oldRTD.onChange = undefined;

        // check again as we could have taken the values from the triggers
        if (oldVal === newVal && (newVal == null || typeof newVal !== "object") && !isNewCreator)
            return;

        // if the new value is null but the old string value is not, remove the attribute;
        // if creator has changed, use "set" instead of "update" as some properties should be
        // reset as new (e.g. defaultChecked).
        if (newVal == null)
            removeElmProp(this.ownDN!, name, oldRTD.rval, oldRTD.info), oldRTD.rval = null;
        else if (isNewCreator)
            oldRTD.rval = setElmProp(this.ownDN!, name, newVal, oldRTD.info);
        else
            oldRTD.rval = updateElmProp(this.ownDN!, name, oldRTD.rval, newVal, oldRTD.info);
    }



    private unmountAttrs(): void
    {
        if (this.attrs)
        {
            for( let [name, rtd] of Object.entries(this.attrs))
                this.unmountAttr( name, rtd, false);
        }
    }

    private unmountAttr(name: string, rtd: AttrRunTimeData, removeFromAttrs: boolean): void
    {
        // if the attribute value is a trigger, detach from it
        if (rtd.onChange)
            rtd.val.detach(rtd.onChange);

        // removeFromAttrs means that a new attribute is unmounted as a result of updating the
        // element (as opposed to unmounting it), and that we need to remove it from our attrs
        // object and from the DOM element.
        if (removeFromAttrs)
        {
            removeElmProp(this.ownDN!, name, rtd.rval, rtd.info)
            delete this.attrs![name];
        }
    }



    // Adds, updates or removes the given DOM attribute of this Element. This method is invoked
    // when the properties of the element are updated as a result of setProps call; that
    // is, when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateAttrOnly(name: string, val: any, info?: AttrPropInfo): void
	{
        let oldRTD = this.attrs?.[name];
        if (val == null)
        {
            if (oldRTD)
                this.unmountAttr( name, oldRTD, true);
        }
        else
        {
            let newRTD: AttrRunTimeData = {info, val, rval: null};
            if (oldRTD)
                this.updateAttr( name, oldRTD, newRTD);
            else
                this.mountAttr( name, newRTD, true);
        }
	}



	/** Updates event listeners by comparing the old and the new ones. */
	private updateEvents(newEvents: EventsMixin | undefined): void
	{
        if (this.events)
        {
            if (newEvents)
                this.events.update(newEvents);
            else
            {
                this.events.unmount();
                this.events = undefined;
            }
        }
        else if (newEvents)
        {
            newEvents.mount(this.ownDN!);
            this.events = newEvents;
        }
	}

    // Adds, updates or removes the given event handler of this Element. This method is invoked
    // when the properties of the element are updated as a result of setProps call; that
    // is when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateEventOnly(name: string, val: EventPropType, info?: EventPropInfo): void
	{
        (this.events ??= new EventsMixin(this.creator)).updateSingleEvent(name, val, info?.schedulingType);
	}



	// Creates custom attributes.
	private mountCustomAttrs(): void
	{
		// create and initialize custom property handlers
		for (let name in this.customAttrs)
		{
            // if the custom attribute handler failed to initialize, we remove it from our list
            if (!this.mountCustomAttr( name, this.customAttrs[name]))
				delete this.customAttrs[name];
		}
	}



	// Creates custom attribute.
	private mountCustomAttr(name: string, customAttr: CustomAttrRunTimeData): boolean
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
            console.error( `Error creating handler for custom attribute '${name}': ${(err as Error).message}`);
            /// #endif

            return false;
        }
	}



	// Destroys custom attributes of this element.
	private unmountCustomAttrs(): void
	{
        for( let name in this.customAttrs)
            this.unmountCustomAttr( name, this.customAttrs[name], true)
	}



	// Destroys custom attributes of this element.
	private unmountCustomAttr( name: string, customAttr: CustomAttrRunTimeData, isRemoval: boolean): void
	{
        try
        {
            customAttr.handler!.terminate?.( isRemoval);
        }
        catch( err)
        {
            /// #if DEBUG
            console.error( `Error terminating handler for custom attribute '${name}': ${(err as Error).message}`);
            /// #endif
        }
	}



	// Updates custom attributes of this node.
	private updateCustomAttrs(newCustomAttrs: { [name: string]: CustomAttrRunTimeData } | undefined): void
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
                    this.unmountCustomAttr( name, oldCustomAttr, false);
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
                if (!this.mountCustomAttr( name, newCustomAttr))
					delete newCustomAttrs[name];
			}
		}

		this.customAttrs = newCustomAttrs;
	}



	// Updates custom attributes of this node.
	private updateCustomAttr(name: string, oldCustomAttr: CustomAttrRunTimeData, newCustomAttr: CustomAttrRunTimeData): void
	{
        // update the custom property and remember the new value
        try
        {
            oldCustomAttr.handler!.update(newCustomAttr.val);
        }
        catch( err)
        {
            /// #if DEBUG
            console.error( `Error updating handler for custom attribute '${name}': ${(err as Error).message}`);
            /// #endif
        }
	}



    // Adds, updates or removes the given custom attribute of this Element. This method is invoked
    // when the properties of the element are updated as a result of setProps call; that
    // is when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateCustomAttrOnly(name: string, val: any, info: CustomAttrPropInfo): void
	{
        let oldCustomAttr = this.customAttrs && this.customAttrs[name];
        let newCustomAttr = val != null && { info, val, handler: undefined};
        if (!newCustomAttr)
        {
            if (oldCustomAttr)
            {
                this.unmountCustomAttr(name, oldCustomAttr, false)
                delete this.customAttrs![name];
            }
        }
        else
        {
            if (oldCustomAttr)
            {
                this.updateCustomAttr(name, oldCustomAttr, newCustomAttr)
                oldCustomAttr.val = val;
            }
            else
            {
                this.mountCustomAttr(name, newCustomAttr);
                (this.customAttrs ??= {})[name] = newCustomAttr
            }
        }
	}
}



/**
 * Determines property type (Attribute or Event) based on the property value
 */
function getPropTypeFromPropVal(propVal: any): PropType
{
    if (!propVal)
        return PropType.Attr;
    else
    {
        let t = typeof propVal;
        return t === "string" || t === "number" || t === "boolean"
            ? PropType.Attr
            : t === "function" || typeof propVal[0] === "function" || typeof propVal?.func === "function"
                ? PropType.Event : PropType.Attr;
    }
}



/**
 * Function reacting on the value change in an attribute's trigger. This function gets bounded to
 * the instance of the ElmVN class and attribute RTD object; therefore, it can use "this".
 */
function onAttrTriggerChanged( this: ElmVN<any>, name: string, val: any): void
{
    this.updateAttrValue(name, val);
}



/** Type defining the information we keep about each regular attribute */
interface AttrRunTimeData
{
	/** Information about this attribute - can be undefined */
	info?: AttrPropInfo;

	/**
     * Current attribute value as passed in the JSX properties. This can be of any type including
     * a trigger object.
     */
	val: any;

	/**
     * "Real value" - this is the value returned from either setElmProp() or updateElmProp(). This
     * value is retained in order to supply it to the next calls to updateElmProp() or
     * removeElmProp() so that the real element's attributes/properties can be changed/removed.
     * This can only be null if val is a trigger because we don't remove attribute with a trigger as its
     * value from our attrs object even if the trigger's value is null.
     */
	rval: any;

    /**
     * Bound method reacting on the value change in the trigger. It is created only if the attribute value is a trigger.
     */
    onChange?: (s: string) => void;
};



/** Type defining the information we keep about each custom property. */
interface CustomAttrRunTimeData
{
	// Information about this custom attribute - cannot be null
	info: CustomAttrPropInfo;

	// Current value of the property
	val: any;

	// Handler object that knows to deal with the property values
	handler?: ICustomAttributeHandler;
};



