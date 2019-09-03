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
		super( mim.VNType.Elm)

		// determine whether this is an SVG or HTML element
		let svgInfo = SvgElms.getSvgElmInfo( tagName);
		if (svgInfo !== undefined)
		{
			// the isSvg flag may remain undefined for the dual-purpose tags. In this case it will
			// be determined upon mounting.
			this.isSvg = SvgElms.isDualPurpose( svgInfo) ? undefined : true;
			this.elmName = SvgElms.getElmName( svgInfo, tagName);
		}
		else
		{
			this.isSvg = false;
			this.elmName = tagName;
		}

		// remember children
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

			// if key property was not specified, use id; if id was not specified key wil remain
			// undefined.
			if (this.key === undefined)
				this.key = props.id;
		}

		// node name is the element's name plus key (or id) if specified.
		this.name = this.elmName;
		if (this.key !== undefined && this.key !== null)
			this.name += "@" + this.key;
	}



	// IElmVN implementation
	public get ElmName(): string { return this.elmName; }
	public get Elm(): Element { return this.elm; }
	public get IsSvg(): boolean { return this.isSvg; }



/// #if USE_STATS
	public getStatsCategory(): StatsCategory { return StatsCategory.Elm; }
/// #endif



	// Generates list of sub-nodes according to the current state
	public render(): any
	{
		return this.children;
	}



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount(): boolean
	{
		// if we don't know yet whether this is an SVG element or not (whch can happen for
		// dual-purpose elements), determine it now by walking up the chain of parents and
		// checking whether thee is an <svg> element there
		if (this.isSvg === undefined)
		{
			for( let parent = this.parent; parent != null; parent = parent.parent)
			{
				if (parent.type === mim.VNType.Elm && (parent as ElmVN).elmName === "svg")
				{
					this.isSvg = true;
					break;
				}
			}

			// if the flag is still not determined after the parent loop, set it to false.
			if (this.isSvg === undefined)
				this.isSvg = false;
		}

		this.parseProps();
		return true;
	}



	// Inserts the virtual node's content into DOM.
	// This method is part of the Commit phase.
	public mount(): void
	{
		// create the element
		this.elm = this.isSvg
					? document.createElementNS( SvgElms.namespace, this.elmName)
					: document.createElement( this.elmName);

		this.addAttrs();
		this.addEvents();
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
			this.removeEventListeners();
		/// #endif

		// terminate custom property handlers
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
		const newElmNode: ElmVN = newVN as ElmVN;
		return this.elmName === newElmNode.elmName;

		// update is possible if this is the same type of element; that is, it has the same
		// name and the same isSvg flag
		// const newElmNode: ElmVN = newVN as ElmVN;
		// return this.isSvg === newElmNode.isSvg && this.elmName === newElmNode.elmName;
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
		if (!this.props)
			return;

		for( let propName in this.props)
		{
			let propVal: any = this.props[propName];

			// get information about the property and determine its type (regular attribute, event
			// or custom attribute). Note that getPropertyInfo may return null for most regular
			// attributes and events; in this case we will check the property value.
			let propInfo = ElmAttr.getPropertyInfo( propName);
			let propType = propInfo ? propInfo.type : PropType.Unknown;
			if (!propInfo)
				propType = this.IsEventValue( propVal) ? PropType.Event : PropType.Attr;

			if (propType === PropType.Attr)
				this.attrs[propName] = { info: propInfo, val: propVal };
			else if (propType === PropType.Event)
			{
				let eventInfo = this.GetPropAsEventRunTimeData( propInfo, propVal);
				if (eventInfo)
					this.events[propName] = eventInfo;
			}
			else // if (propType === PropType.CustomAttr)
			{
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
		let elm = this.elm;

		for( let name in this.attrs)
		{
			let rtd = this.attrs[name];
			ElmAttr.setAttr( elm, name, rtd.info, rtd.val);
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
		for( let name in oldAttrs)
		{
			let oldRTD = oldAttrs[name];
			let newRTD = newAttrs[name];
			if (newRTD === undefined || newRTD.val === undefined)
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

		// loop over new attributes; add those that are not found among the old ones
		for( let name in newAttrs)
		{
			if (name in oldAttrs)
				continue;

			let newRTD = newAttrs[name];
			ElmAttr.setAttr( elm, name, newRTD.info, newRTD.val);
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
	private addEvent( name: string, info: EventRunTimeData): void
	{
		info.wrapper = this.wrapCallback( info.orgFunc);
		this.elm.addEventListener( name, info.wrapper, info.useCapture);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Event, StatsAction.Added);
		/// #endif
	}



	// Removes event listeners from the Element.
	private removeEventListeners(): void
	{
		for( let name in this.events)
			this.removeEvent( name, this.events[name]);
	}



	// Removes the given event listener from the Element.
	private removeEvent( name: string, info: EventRunTimeData): void
	{
		this.elm.removeEventListener( name, info.wrapper, info.useCapture);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Event, StatsAction.Deleted);
		/// #endif
	}



	// Adds event listeners to the Element.
	private updateEvents( newInfos: { [name: string]: EventRunTimeData }): void
	{
		let oldInfos = this.events;

		// loop over existing event listeners, remove those that are not found among the new
		// ones and update those whose value has changed
		for( let name in oldInfos)
		{
			let oldInfo = oldInfos[name];
			let newInfo = newInfos[name];
			if (!newInfo)
				this.removeEvent( name, oldInfo);
			else
				this.updateEvent( name, oldInfo, newInfo);
		}

		// loop over new event listeners and add those that are not found among the old ones
		for( let name in newInfos)
		{
			if (name in oldInfos)
				continue;

			let newInfo = newInfos[name];
			this.addEvent( name, newInfo);
		}

		this.events = newInfos;
	}



	// Determines whether the old and the new values of the event listener are different and sets
	// the updated value. Returns true if update has been performed and false if no change has
	// been detected.
	private updateEvent( name: string, oldInfo: EventRunTimeData, newInfo: EventRunTimeData): boolean
	{
		if (oldInfo.orgFunc === newInfo.orgFunc && oldInfo.useCapture === newInfo.useCapture)
		{
			newInfo.wrapper = oldInfo.wrapper;
			return false;
		}

		this.elm.removeEventListener( name, oldInfo.wrapper, oldInfo.useCapture);

		newInfo.wrapper = this.wrapCallback( newInfo.orgFunc);
		this.elm.addEventListener( name, newInfo.wrapper, newInfo.useCapture);

		/// #if USE_STATS
			DetailedStats.stats.log( StatsCategory.Event, StatsAction.Updated);
		/// #endif

		// indicate that there was change in event listener value.
		return true;
	}



	// Creates custom attributes.
	private addCustomAttrs(): void
	{
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
		for( let name in this.customAttrs)
		{
			let info = this.customAttrs[name];
			info.handler.terminate();
		}
	}



	// Updates custom attributes of this node.
	private updateCustomAttrs( newCustomProps: { [name: string]: CystomAttrRunTimeData }): void
	{
		let oldCustomProps = this.customAttrs;

		// loop over existing custom properties, remove those that are not found among the new
		// ones and update those whose value has changed
		for( let name in oldCustomProps)
		{
			const oldInfo = oldCustomProps[name];
			const newInfo = newCustomProps[name];
			if (newInfo === undefined || newInfo === null)
			{
				// if there is no new property with the given name, remove the old property and
				// terminate its handler
				oldInfo.handler.terminate();
			}
			else
			{
				// update the custom property and remember the new value
				oldInfo.handler.update( oldInfo.val, newInfo.val);
				newInfo.handler = oldInfo.handler;
			}
		}

		// loop over new custom properties and add those that are not found among the old ones
		for( let name in newCustomProps)
		{
			if (name in oldCustomProps)
				continue;

			let newInfo = newCustomProps[name];

			// create custom property handler. If we cannot create the handler, remove the property
			// from our object.
			let handler = newInfo.info.factory.createHandler( name);
			if (!handler)
				continue;

			// initialize the handler and remember it in our object
			handler.initialize( this, name, newInfo.val);
			newInfo.handler = handler;
		}

		this.customAttrs = newCustomProps;
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
	// determine whether this is an SVG one we need to go up the element chain and see whether
	// there is an <svg> element as an ancestor. Since we only have access to the parent node
	// upon mounting, for such elements we cannot determine the flag's value in the constuctor.
	// In this case we will have this flag undefined and will determine it to be true or false
	// when the mount method is called.
	private isSvg: boolean | undefined;

	// Reference to the component that is specified as a "ref" property. Reference object is
	// set when analyzing properties in the constructor and during update. Reference value is
	// set during mount and unset during unmount. The ref property can be changed on update.
	private ref: mim.RefPropType<any>;

	// Object that serves as a map between attribute names and their current values.
	private attrs: { [name: string]: AttrRunTimeData } = {};

	// Object that serves as a map between names of event listeners and their respective
	// parameters.
	private events: { [name: string]: EventRunTimeData } = {};

	// Object that serves as a map between names of custom element properties and their respective
	// handler objects and values.
	private customAttrs: { [name: string]: CystomAttrRunTimeData } = {};
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



