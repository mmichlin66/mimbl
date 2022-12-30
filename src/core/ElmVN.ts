import {
    IElmVN, ICustomAttributeHandler, EventPropType, RefType, ExtendedElement,
    ElmRefType, TickSchedulingType, UpdateStrategy, PropType, DN
} from "../api/CompTypes"
import { ChildrenUpdateOperation, IVN, VNDisp } from "./VNTypes";

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif

import { mountSubNodes, reconcileSubNodes } from "./Reconciler";
import { isTrigger } from "../api/TriggerAPI"
import { VN, setRef, updateRef } from "./VN";
import { EventsMixin } from "./Events";
import {
    AttrPropInfo, cleanElmProps, CustomAttrPropInfo, EventPropInfo, getPropInfo, removeElmProp,
    setElmProp, updateElmProp
} from "./Props";



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
	public get elm(): T | null { return this.ownDN; }



	constructor( tagName: string, props: ExtendedElement<T> | undefined, subNodes: IVN[] | null)
	{
		super();

		this.elmName = tagName;
		this.props = props;
		this.subNodes = subNodes;

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
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN: DN): void
	{
        super.mount( parent, index, anchorDN);

        // create the element; if the element is in the list, use the provided namespace;
        let elm: T;
        let info = elmInfos[this.elmName];
        if (typeof info === "number")
        {
            elm = info === ElementNamespace.HTML
                ? document.createElement( this.elmName) as any as T
                : document.createElementNS( ElementNamespaceNames[info], this.elmName) as T;
        }
        else if (!info)
        {
            // if namespace is provided use it; otherwise, use the namespace of the anchor element.
            let ns = this.props?.xmlns;
            if (ns)
                elm = document.createElementNS( ns, this.elmName) as any as T;
            else
                elm = document.createElementNS( (this.anchorDN as Element).namespaceURI, this.elmName) as T;
        }
        else
            elm = document.createElementNS( ElementNamespaceNames[info.ns], info.name) as any as T;

        /// #if DEBUG
            elm.setAttribute("mim-debugID", "" + this.debugID);
        /// #endif

        this.ownDN = elm;

        // translate properties into attributes, events and custom attributes
        if (this.props)
        {
            this.parseProps( this.props);

            if (this.attrs)
                this.mountAttrs();

            this.events?.mount(elm);

            if (this.customAttrs)
                this.mountCustomAttrs();

            if (this.ref)
                setRef( this.ref, elm);

            if (this.vnref)
                setRef( this.vnref, this);
        }

        // add sub-nodes
        if (this.subNodes)
            mountSubNodes( this, this.subNodes, elm, null);

        // add element to DOM
        anchorDN!.insertBefore( elm, beforeDN);

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
        this.updateAttrs( newVN.attrs, isNewCreator);
        this.updateEvents( newVN.events);
        this.updateCustomAttrs( newVN.customAttrs);

        // remember new props
        this.props = newVN.props;

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
            this.updateAttrsFromTrigger( this.attrsForPartialUpdate)
            this.attrsForPartialUpdate = undefined;
        }
    }



	// Goes over the original properties and puts them into the buckets of attributes, event
	// listeners and custom attributes.
	private parseProps( props: Record<string,any>): void
	{
        // loop over all properties ignoring the built-ins
        for( let [propName, propVal] of Object.entries(props))
		{
            // get information about the property and determine its type.
            let propInfo = getPropInfo(propName);
            let propType = propInfo?.type ?? getPropTypeFromPropVal(propVal);
            if (propType === PropType.Attr)
                (this.attrs ??= {})[propName] = { info: propInfo, val: propVal, valS: null };
            else if (propType === PropType.Event)
                (this.events ??= new EventsMixin(this.creator)).add(propName,
                    propVal as EventPropType, (propInfo as EventPropInfo)?.schedulingType);
            else if (propType === PropType.Framework)
            {
                if (propName === "ref")
                    this.ref = propVal as RefType<T>;
                else if (propName === "vnref")
                    this.vnref = propVal as ElmRefType<T>;
                else if (propName === "updateStrategy")
                    this.updateStrategy = propVal as UpdateStrategy;
            }
            else // if (propType === PropType.CustomAttr)
            {
                // remember custom attributes value. Handler will be created later.
                (this.customAttrs ??= {})[propName] = { info: propInfo as CustomAttrPropInfo, val: propVal, handler: undefined};
            }
		}
	}



    // Updates properties of this node from the given object containing new properties values. This
    // method is invoked if only properties should be updated without re-rendering the children.
	private updatePropsOnly( props: any): void
	{
        // loop over all properties
        for( let [propName, propVal] of Object.entries(props))
		{
            // get information about the property and determine its type.
            let propInfo = getPropInfo(propName);
            let propType = propInfo?.type ?? getPropTypeFromPropVal(propVal);

            if (propType === PropType.Attr)
                this.updateAttrOnly( propName, propVal, propInfo as AttrPropInfo);
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
	private updateAttrsFromTrigger( newAttrValues: any): void
	{
        // loop over all properties
        for( let name in newAttrValues)
		{
            // get information about the attribute.
            let rtd = this.attrs?.[name]
            if (rtd)
            {
                let newVal = newAttrValues[name];

                if (newVal != null)
                    rtd.valS = updateElmProp( this.ownDN!, name, rtd.valS, newVal, rtd.info);
                else
                    removeElmProp( this.ownDN!, name, rtd.valS, rtd.info), rtd.valS = null;
            }
		}
	}



	// Adds DOM attributes to the Element.
	private mountAttrs(): void
	{
        for( let [name, rtd] of Object.entries(this.attrs))
            this.mountAttr( name, rtd, false);
	}

	private mountAttr( name: string, rtd: AttrRunTimeData, addToAttrs: boolean): void
	{
        let val = rtd.val;

        // the value can actually be a trigger and we need to listen to its changes then
        let actVal = val;
        if (actVal != null)
        {
            if (isTrigger(val))
            {
                actVal = val.get();
                rtd.onChange = onAttrTriggerChanged.bind( this, name);
                val.attach( rtd.onChange!);
                this.hasTriggers = true;
            }

            rtd.valS = setElmProp( this.ownDN!, name, actVal, rtd.info);
        }

        // `add` means that a new attribute is mounted as a result of updating already existing
        // element (as opposed to mounting it for the first time), and that we need to remember it
        // in our attrs object.
        if (addToAttrs)
            (this.attrs ??= {})[name] = rtd;
	}



	// Updates DOM attributes of this Element.
	private updateAttrs( newAttrs: { [name: string]: AttrRunTimeData }, isNewCreator: boolean): void
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
    private updateAttr( name: string, oldRTD: AttrRunTimeData, newRTD: AttrRunTimeData, isNewCreator?: boolean): void
    {
        let oldVal = oldRTD.val;
        let newVal = newRTD.val;

        // if both old and new values are null or undefined, we don't do anything
        if (newVal == null && oldVal == null)
            return;

        // we skip updating the attribute if the new value is equal to the old one and if it is a
        // primitive value (not object or array) and there is no new creator. We need to continue
        // update for objects and arrays because although the value can be the same, the members
        // could have changed
        if (newVal === oldVal && (newVal == null || typeof newVal !== "object") && !isNewCreator)
            return;

        // remember the new value. We will reuse newVal and oldVal with values from triggers (if any)
        oldRTD.val = newVal;

        let onChange = oldRTD.onChange;
        if (onChange)
        {
            // if onChange is defined then oldVal is a trigger. We detach from it but
            // don't clear the onChange callback - because it can be used if the new value
            // is also a trigger.
            oldVal.detach( onChange);
            oldVal = oldVal.get();
        }

        // check whether the new value is a trigger and get the actual value from it.
        if (isTrigger(newVal))
        {
            if (!onChange)
                oldRTD.onChange = onAttrTriggerChanged.bind( this, name);
            newVal.attach( oldRTD.onChange!);
            newVal = newVal.get();
            this.hasTriggers = true;
        }
        else
            oldRTD.onChange = undefined;

        // If the new value is null, remove the attribute; if creator has changed, use "set"
        // instead of "update" as some properties should be reset as new (e.g. defaultChecked).
        if (newVal == null)
            removeElmProp( this.ownDN!, name, oldRTD.valS, oldRTD.info), oldRTD.valS = null;
        else if (isNewCreator)
            oldRTD.valS = setElmProp(this.ownDN!, name, newVal, oldRTD.info);
        else
            oldRTD.valS = updateElmProp( this.ownDN!, name, oldRTD.valS, newVal, oldRTD.info);
    }



    private unmountAttrs(): void
    {
        for( let [name, rtd] of Object.entries(this.attrs))
            this.unmountAttr( name, rtd, false);
    }

    private unmountAttr( name: string, rtd: AttrRunTimeData, removeFromAttrs: boolean): void
    {
        if (rtd.onChange)
            rtd.val.detach( rtd.onChange);

        // removeFromAttrs means that a new attribute is unmounted as a result of updating the
        // element (as opposed to unmounting it), and that we need to remove it from our attrs
        // object and from the DOM element.
        if (removeFromAttrs)
        {
            removeElmProp( this.ownDN!, name, rtd.valS, rtd.info)
            delete this.attrs[name];
        }
    }



    // Adds, updates or removes the given DOM attribute of this Element. This method is invoked
    // when the properties of the element are updated as a result of setProps call; that
    // is, when only the properties that should be added, updated or removed were specified and
    // there is no need to re-render the element's children
	private updateAttrOnly( name: string, val: any, info?: AttrPropInfo): void
	{
        let oldRTD = this.attrs?.[name];
        if (val == null)
        {
            if (oldRTD)
                this.unmountAttr( name, oldRTD, true);
        }
        else
        {
            let newRTD: AttrRunTimeData = {info, val, valS: null};
            if (oldRTD)
                this.updateAttr( name, oldRTD, newRTD);
            else
                this.mountAttr( name, newRTD, true);
        }
	}



	/** Updates event listeners by comparing the old and the new ones. */
	private updateEvents( newEvents: EventsMixin | undefined): void
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
	private updateEventOnly( name: string, val: EventPropType, info?: EventPropInfo): void
	{
        (this.events ??= new EventsMixin(this.creator)).updateSingleEvent(name, val, info?.schedulingType);
	}



	// Creates custom attributes.
	private mountCustomAttrs(): void
	{
		// create and initialize custom property handlers
		for( let name in this.customAttrs)
		{
            // if the custom attribute handler failed to initialize, we remove it from our list
            if (!this.mountCustomAttr( name, this.customAttrs[name]))
				delete this.customAttrs[name];
		}
	}



	// Creates custom attribute.
	private mountCustomAttr( name: string, customAttr: CustomAttrRunTimeData): boolean
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
	private updateCustomAttr( name: string, oldCustomAttr: CustomAttrRunTimeData, newCustomAttr: CustomAttrRunTimeData): void
	{
        // update the custom property and remember the new value
        try
        {
            oldCustomAttr.handler!.update( newCustomAttr.val);
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
	private updateCustomAttrOnly( name: string, val: any, info: CustomAttrPropInfo): void
	{
        let oldCustomAttr = this.customAttrs && this.customAttrs[name];
        let newCustomAttr = val != null && { info, val, handler: undefined};
        if (!newCustomAttr)
        {
            if (oldCustomAttr)
            {
                this.unmountCustomAttr( name, oldCustomAttr, false)
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
                this.mountCustomAttr( name, newCustomAttr);
                (this.customAttrs ??= {})[name] = newCustomAttr
            }
        }
	}



     // Properties that were passed to the element.
	private props: ExtendedElement<T> | undefined;

    // Redefine the ownDN property from VN to be of the Element type
	public ownDN: T | null;

    // Reference to the element that is specified as a "ref" property.
	private ref?: RefType<T>;

    // Reference to this virtual node that is specified as a "vnref" property.
	private vnref?: ElmRefType<T>;

	// Object that serves as a map between attribute names and their current values.
	private attrs: { [name: string]: AttrRunTimeData };

	// Flag indicating whether at least one of the attributes has triggers. If not then
    // we can avoid calling unmountAttrs upon element unmounting.
	private hasTriggers?: boolean;

	// Object that serves as a container for event information.
	private events: EventsMixin | undefined;

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
    public attrsForPartialUpdate: Record<string,any> | undefined;
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
function onAttrTriggerChanged( this: ElmVN, name: string, val: any): void
{
    if (!this.attrsForPartialUpdate)
        this.attrsForPartialUpdate = { [name]: val };
    else
        this.attrsForPartialUpdate[name] = val;

    // this.performPartialUpdate();
    // this.attrsForPartialUpdate = null;
    this.requestPartialUpdate();
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
     * Current attribute value converted to string and set in HTML. This can only be null if val
     * is a trigger because we don't remove attribute with a trigger as its value from our attrs
     * object even if the trigger's value is null.
     */
	valS: string | null;

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



/**
 * Numeric indicators of namespaces that can be mapped to element names for speeding up the
 *  decision on how to create elements
 */
const enum ElementNamespace
{
    HTML = 1,
    SVG = 2,
    MATHML = 3,
}

/** Object containing namespace URIs of known namespaces */
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

/** Object that maps element names to ElmInfo. Elements that are not in this map are created using
 * the anchor's namespace URI with the document.createElementNS() call.
 */
const elmInfos: {[elmName:string]: ElmInfo} =
{
    a: ElementNamespace.HTML,
    button: ElementNamespace.HTML,
    dd: ElementNamespace.HTML,
    div: ElementNamespace.HTML,
    dt: ElementNamespace.HTML,
    i: ElementNamespace.HTML,
    img: ElementNamespace.HTML,
    label: ElementNamespace.HTML,
    li: ElementNamespace.HTML,
    p: ElementNamespace.HTML,
    span: ElementNamespace.HTML,
    tr: ElementNamespace.HTML,
    td: ElementNamespace.HTML,

    svg: ElementNamespace.SVG,
    svgA: { ns: ElementNamespace.SVG, name: "a" },
    svgTitle: { ns: ElementNamespace.SVG, name: "title" },
    svgScript: { ns: ElementNamespace.SVG, name: "script" },
    svgStyle: { ns: ElementNamespace.SVG, name: "style" },

    math: ElementNamespace.MATHML,
}



