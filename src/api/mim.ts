import {Styleset, IIDRule, ClassPropType} from "mimcss"
import {
    PropType, EventSlot, mountRoot, unmountRoot, FuncProxyVN, TextVN,
    s_wrapCallback, registerElmProp, symJsxToVNs, scheduleFuncCall, s_getCallbackArg
} from "../internal";


/**
 * Type used to define properties that can be passed to a manged component.
 *
 * @typeparam TProps Type defining properties that can be passed to the functional or class-based
 * component with these properties. Default type is an empty object (no properties).
 * @typeparam TChildren Type defining components, elements or other objects that can be used as
 * children for the component with these properties. Default is `any`.
 */
export type CompProps<TProps = {}, TChildren = any> = Readonly<TProps> &
	{
		readonly children?: TChildren;
	};



/**
 * Interface that defines constructor signature for components.
 *
 * @typeparam TProps Type defining properties that can be passed to the class-based component
 *		of this type. Default type is an empty object (no properties).
 * @typeparam TChildren Type defining components, elements or other objects that can be used
 *		as children for the class-based component of this type. Default is `any`.
 */
export interface IComponentClass<TProps = {}, TChildren = any>
{
	new( props?: TProps): Component<TProps,TChildren>;
	render(): any;
}



/**
 * Interface that must be implemented by all components.
 *
 * @typeparam TProps Type defining properties that can be passed to this class-based component.
 *		Default type is an empty object (no properties).
 * @typeparam TChildren Type defining components, elements or other objects that can be used
 *		as children for this class-based component. Default is `any`.
 */
export interface IComponent<TProps = {}, TChildren = any>
{
	/**
	 * Component properties passed to the constructor. For managed components, the properties
	 * are updated when the component's parent is updated.
	 */
	readonly props?: CompProps<TProps,TChildren>;

	/**
	 * Components can define display name for tracing purposes; if they don't the default name
	 * used is the component's class constructor name. Note that this method can be called before
	 * the virtual node is attached to the component.
	 */
	readonly displayName?: string;

	/**
	 * Sets, gets or clears the virtual node object of the component. This property is set twice:
	 *  1. Before the component is rendered for the first time: the component must remember the
	 *    passed object.
	 *  2. Before the component is destroyed: null is passed as a parameter and the component must
	 *    release the remembered object.
	 */
	vn?: IClassCompVN;

	/** Returns the component's content that will be ultimately placed into the DOM tree. */
	render(): any;

	/**
	 * Notifies that the component is about to render its content for the first time. This method
	 * is called when the virtual node has already been set so the component can request services
	 * from it.
	 */
	willMount?(): void;

    /**
     * Notifies the component that it was successfully mounted. This method is called after the
     * component is rendered for the first time and the content of all its sub-nodes is added to
     * the DOM tree.
     */
    didMount?(): void;

    /**
     * Notifies the component that it replaced the given old component. This allows the new
     * component to copy whatever internal state it needs from the old component.
     */
    didReplace?( oldComp: IComponent<TProps, TChildren>): void;

    /**
	 * Notifies that the component's content is going to be removed from the DOM tree. After
	 * this method returns the component is destroyed.
	 */
	willUnmount?(): void;

	/**
	 * Optional method that is called before any components that are scheduled to be updated in
	 * a Mimbl tick, are updated. If implemented, this method will be called every time the
	 * component is scheduled to be updated. This method can read DOM layout information (e.g.
	 * element measurements) without the risk of causing forced layouts.
	 */
	beforeUpdate?(): void;

	/**
	 * Optional method that is called after all components that are scheduled to be updated in
	 * a Mimbl tick, are updated. If implemented, this method will be called every time the
	 * component is scheduled to be updated. This method is called after all modifications to
	 * DOM resulting from updaing components have been already done.
	 */
	afterUpdate?(): void;

	/**
	 * This method is only used by managed components.
	 *
	 * Informs the component that new properties have been specified. At the time of the call
	 * this.props refers to the "old" properties. If the component returns true, then its render
	 * method will be called. At that time,the original props object that was passed into the
	 * component's constructor will have these new properties. If the component doesn't implement
	 * the shouldUpdate method it is as though true is returned. If the component returns
	 * false, the render method is not called and the DOM tree of the component remains unchanged.
	 * The properties of the component, however, still change.
	 * @param newProps The new properties that the parent component provides to this component.
	 * @returns True if the component should have its render method called and false otherwise.
	 */
	shouldUpdate?( newProps: CompProps<TProps,TChildren>): boolean;

	/**
	 * Handles an exception that occurred during the rendering of one of the component's children.
     * If this method is not implemented or if it throws an error, the error will be propagated up
     * the chain of components until it reaches a component that handles it. If none of the
     * components can handle the error, the entire tree will be unmounted.
	 * @param err An exception that was thrown during the component's own rendering or rendering
	 * of one of its descendants.
	 * @returns New content to be displayed for the component.
	 */
	handleError?( err: any): any;

	/**
	 * Retrieves update strategy object that determines different aspects of component behavior
	 * during updates.
	 */
	getUpdateStrategy?(): UpdateStrategy;
}



/**
 * The UpdateStrategy object specifies different aspects of update behavior of components and
 * elements.
 */
export type UpdateStrategy =
{
	/**
	 * Flag determining whether or not non-matching new keyed sub-nodes are allowed to recycle non-
	 * matching old keyed sub-nodes. Here "non-matching" means those new or old nodes with keys
     * for which no old or new sub-nodes with the same key were found. If this flag is true, then
     * non-matching old sub-nodes will be removed and non-matching new sub-nodes will be inserted.
     * If this flag is false, then non-matching old sub-nodes will be updated by the non-matching
     * new sub-nodes - provided that the types of sub-nodes are the same.
	 *
	 * If keyed sub-nodes recycling is enabled it can speed up an update process because
	 * less DOM nodes get removed and inserted, which is more expensive than updating. However,
	 * this can have some adverse effects under cirtain circumstances if certain data is bound
	 * to the particular instances of DOM nodes.
	 *
	 * The flag's default value is false, that is recycling is enabled.
	 */
    disableKeyedNodeRecycling?: boolean;
};



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Definitions of types used for wrapping callback functions so that they can be invoked in the
// Mimbl context.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/** Type defining the information that can be supplied for a callback to be wrapped */
export interface CallbackWrappingParams<T extends Function = Function>
{
	// Event handler function
	func: T;

	// Object that will be referenced by "this" within the event handler function
	funcThisArg?: any;

	// Argument that can be retrieved from within the callback using the getCallbackArg function.
	arg?: any;

	// Type of scheduling the Mimbl tick after the event handler function returns. The defaul
	schedulingType?: TickSchedulingType;

    // Object that will be set as "current creator" for JSX parsing during the event handler
    // function execution
	creator?: any;
};

/**
 * Wraps the given callback and returns a function with identical signature.
 * @param params
 */
export function wrapCallback<T extends Function>( params?: CallbackWrappingParams<T>): T
{
    return s_wrapCallback<T>( params);
}

/**
 * Retrieves the argumnet that was passed when a callback was wrapped. This function can only be
 * called from the callback itself while it is executing.
 */
export function getCallbackArg(): any
{
    return s_getCallbackArg();
}




///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Definitions of property types used by HTML and SVG elements.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Type of event handler function for DOM events of type T.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export type EventFuncType<T extends Event = Event> = (e: T) => void;

/** Type defining the information that can be supplied for an event listener */
export interface EventObjectType<T extends Event> extends CallbackWrappingParams<EventFuncType<T>>
{
	// Flag indicating whether this event should be used as Capturing (true) or Bubbling (false)
	useCapture?: boolean;
};

/**
 * Union type that can be passed to an Element's event.
 * @typeparam T DOM event type, e.g. MouseEvent
 */
export type EventPropType<T extends Event = Event> = EventFuncType<T> | EventObjectType<T>;

/**
 * Type for defining the id property of HTML elements
 */
export type IDPropType = string | number | IIDRule;



/**
 * The ICommonProps interface defines standard properties that can be used on all JSX elements -
 * intrinsic (HTML and SVG) as well as functional and class-based components.
 */
export interface ICommonProps
{
	/** Unique key that distinguishes this JSX element from its siblings. The key can be of any type. */
	key?: any;
}



/**
 * The IManagedCompProps interface adds to the ICommonProps the ability to obtain reference to
 * the managed components via the ref property.
 */
export interface IManagedCompProps<T = any> extends ICommonProps
{
    // Reference that will be set to the instance of the component after it is mounted. The
    // reference will be set to undefined after the component is unmounted.
    readonly ref?: RefPropType<T>;
}



// Types for some common HTML and SVG properties
export type CrossoriginPropType = "anonymous" | "use-credentials";
export type FormenctypePropType = "application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain";
export type FormmethodPropType = "get" | "post" | "dialog";
export type FormtargetPropType = string | "_self" | "_blank" | "_parent"| "_top";
export type ReferrerPolicyPropType = "no-referrer" | "no-referrer-when-downgrade" | "origin" |
		"origin-when-cross-origin" | "unsafe-url";
export type DropzonePropType = "copy" | "move" | "link";



/**
 * The IElementProps interface defines standard properties (attributes and event listeners)
 * that can be used on all HTML and SVG elements.
 */
export interface IElementProps<TRef extends Element = Element, TChildren = any> extends ICommonProps
{
	/**
	 * Reference that will be set to the instance of the element after it is created (mounted). The
	 * reference will be set to undefined after the element is unmounted.
	 */
	ref?: RefPropType<TRef>;

	/**
	 * Reference that will be set to the element's virtual node after it is created (mounted). The
	 * reference will be set to undefined after the element is unmounted.
	 */
	vnref?: ElmRefPropType<TRef>;

	/**
	 * Update strategy object that determines different aspects of element behavior during updates.
	 */
	updateStrategy?: UpdateStrategy;

	/** Children that can be supplied to the element */
	children?: TChildren;

    // standard HTML and SVG element properties
    xmlns?: string;
	class?: ClassPropType;
	draggable?: boolean;
	dropzone ?: DropzonePropType;
	id?: IDPropType;
	lang?: string;
	role?: string;
	style?: Styleset;
	tabindex?: number;

	// global events
	abort?: EventPropType<UIEvent>;
	animationcancel?: EventPropType<AnimationEvent>;
	animationend?: EventPropType<AnimationEvent>;
	animationiteration?: EventPropType<AnimationEvent>;
	animationstart?: EventPropType<AnimationEvent>;
	auxclick?: EventPropType<Event>;
	blur?: EventPropType<FocusEvent>;
	cancel?: EventPropType<Event>;
	canplay?: EventPropType<Event>;
	canplaythrough?: EventPropType<Event>;
	change?: EventPropType<Event>;
	click?: EventPropType<MouseEvent>;
	close?: EventPropType<Event>;
	contextmenu?: EventPropType<MouseEvent>;
	cuechange?: EventPropType<Event>;
	dblclick?: EventPropType<MouseEvent>;
	durationchange?: EventPropType<Event>;
	emptied?: EventPropType<Event>;
	ended?: EventPropType<Event>;
	error?: EventPropType<ErrorEvent>;
	focus?: EventPropType<FocusEvent>;
	gotpointercapture?: EventPropType<PointerEvent>;
	input?: EventPropType<Event>;
	invalid?: EventPropType<Event>;
	keydown?: EventPropType<KeyboardEvent>;
	keypress?: EventPropType<KeyboardEvent>;
	keyup?: EventPropType<KeyboardEvent>;
	load?: EventPropType<Event>;
	loadeddata?: EventPropType<Event>;
	loadedmetadata?: EventPropType<Event>;
	loadend?: EventPropType<ProgressEvent>;
	loadstart?: EventPropType<Event>;
	lostpointercapture?: EventPropType<PointerEvent>;
	mousedown?: EventPropType<MouseEvent>;
	mouseenter?: EventPropType<MouseEvent>;
	mouseleave?: EventPropType<MouseEvent>;
	mousemove?: EventPropType<MouseEvent>;
	mouseout?: EventPropType<MouseEvent>;
	mouseover?: EventPropType<MouseEvent>;
	mouseup?: EventPropType<MouseEvent>;
	pause?: EventPropType<Event>;
	play?: EventPropType<Event>;
	playing?: EventPropType<Event>;
	pointercancel?: EventPropType<PointerEvent>;
	pointerdown?: EventPropType<PointerEvent>;
	pointerenter?: EventPropType<PointerEvent>;
	pointerleave?: EventPropType<PointerEvent>;
	pointermove?: EventPropType<PointerEvent>;
	pointerout?: EventPropType<PointerEvent>;
	pointerover?: EventPropType<PointerEvent>;
	pointerup?: EventPropType<PointerEvent>;
	progress?: EventPropType<ProgressEvent>;
	ratechange?: EventPropType<Event>;
	reset?: EventPropType<Event>;
	resize?: EventPropType<UIEvent>;
	scroll?: EventPropType<UIEvent>;
	//securitypolicyviolation?: EventPropType<SecurityPolicyViolationEvent>;
	seeked?: EventPropType<Event>;
	seeking?: EventPropType<Event>;
	select?: EventPropType<UIEvent>;
	stalled?: EventPropType<Event>;
	submit?: EventPropType<Event>;
	suspend?: EventPropType<Event>;
	timeupdate?: EventPropType<Event>;
	toggle?: EventPropType<Event>;
	touchcancel?: EventPropType<TouchEvent>;
	touchend?: EventPropType<TouchEvent>;
	touchenter?: EventPropType<TouchEvent>;
	touchleave?: EventPropType<TouchEvent>;
	touchmove?: EventPropType<TouchEvent>;
	touchstart?: EventPropType<TouchEvent>;
	transitioncancel?: EventPropType<TransitionEvent>;
	transitionend?: EventPropType<TransitionEvent>;
	transitionrun?: EventPropType<TransitionEvent>;
	transitionstart?: EventPropType<TransitionEvent>;
	volumechange?: EventPropType<Event>;
	waiting?: EventPropType<Event>;
	wheel?: EventPropType<WheelEvent>;

	// Element's events
	fullscreenchange?: EventPropType<Event>;
	fullscreenerror?: EventPropType<Event>;

	// Document's and Element's events
	copy?: EventPropType<ClipboardEvent>;
	cut?: EventPropType<ClipboardEvent>;
	paste?: EventPropType<ClipboardEvent>;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// JSX namespace defining how TypeScript performs type checks on JSX elements,components
// properties and children.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

import * as html from "./HtmlTypes";
import * as svg from "./SvgTypes";

/**
 * Namespace defining interfaces used by TypeScript to type-check JSX expressions.
 */
export namespace JSX
{
	// tslint:disable-next-line:no-empty-interface
	export type Element = any;

	// tslint:disable-next-line:no-empty-interface
	export interface ElementClass extends Component {}

	export interface ElementAttributesProperty { props: {} }

	export interface ElementChildrenAttribute { children: any }

	export interface IntrinsicElements
	{
		// HTML elements
		a: html.IHtmlAElementProps;
		abbr: html.IHtmlElementProps;
		acronym: html.IHtmlElementProps;
		address: html.IHtmlElementProps;
		applet: html.IHtmlAppletElementProps;
		area: html.IHtmlAreaElementProps;
		article: html.IHtmlElementProps;
		aside: html.IHtmlElementProps;
		audio: html.IHtmlAudioElementProps;

		b: html.IHtmlElementProps;
		base: html.IHtmlBaseElementProps;
		basefont: html.IHtmlBasefontElementProps;
		bdi: html.IHtmlElementProps;
		bdo: html.IHtmlElementProps;
		big: html.IHtmlElementProps;
		blockquote: html.IHtmlBlockquoteElementProps;
		body: html.IHtmlElementProps;
		br: html.IHtmlBrElementProps;
		button: html.IHtmlButtonElementProps;

		canvas: html.IHtmlCanvasElementProps;
		caption: html.IHtmlCaptionElementProps;
		center: html.IHtmlElementProps;
		cite: html.IHtmlElementProps;
		code: html.IHtmlElementProps;
		col: html.IHtmlColElementProps;
		colgroup: html.IHtmlColgroupElementProps;

		data: html.IHtmlDataElementProps;
		datalist: html.IHtmlDataListElementProps;
		dd: html.IHtmlDdElementProps;
		del: html.IHtmlDelElementProps;
		details: html.IHtmlDetailsElementProps;
		dfn: html.IHtmlElementProps;
		dialog: html.IHtmlDialogElementProps;
		dir: html.IHtmlDirElementProps;
		div: html.IHtmlDivElementProps;
		dl: html.IHtmlDlElementProps;
		dt: html.IHtmlElementProps;

		em: html.IHtmlElementProps;
		embed: html.IHtmlEmbedElementProps;

		fieldset: html.IHtmlFieldsetElementProps;
		figcaption: html.IHtmlElementProps;
		figure: html.IHtmlElementProps;
		font: html.IHtmlFontElementProps;
		footer: html.IHtmlElementProps;
		form: html.IHtmlFormElementProps;
		frame: html.IHtmlFrameElementProps;
		frameset: html.IHtmlFramesetElementProps;

		h1: html.IHtmlH1ElementProps;
		h2: html.IHtmlH2ElementProps;
		h3: html.IHtmlH3ElementProps;
		h4: html.IHtmlH4ElementProps;
		h5: html.IHtmlH5ElementProps;
		h6: html.IHtmlH6ElementProps;
		head: html.IHtmlHeadElementProps;
		header: html.IHtmlElementProps;
		hgroup: html.IHtmlElementProps;
		hr: html.IHtmlHrElementProps;
		html: html.IHtmlHtmlElementProps;

		i: html.IHtmlElementProps;
		iframe: html.IHtmlIframeElementProps;
		img: html.IHtmlImgElementProps;
		input: html.IHtmlInputElementProps;
		ins: html.IHtmlInsElementProps;

		kbd: html.IHtmlElementProps;
		keygen: html.IHtmlElementProps;

		label: html.IHtmlLabelElementProps;
		legend: html.IHtmlLegendElementProps;
		li: html.IHtmlLiElementProps;
		link: html.IHtmlLinkElementProps;
		listing: html.IHtmlListingElementProps;

		main: html.IHtmlElementProps;
		map: html.IHtmlMapElementProps;
		mark: html.IHtmlElementProps;
		menu: html.IHtmlMenuElementProps;
		menuitem: html.IHtmlElementProps;
		meta: html.IHtmlMetaElementProps;
		meter: html.IHtmlMeterElementProps;

		nav: html.IHtmlElementProps;
		nobr: html.IHtmlElementProps;
		noframes: html.IHtmlElementProps;
		noscript: html.IHtmlElementProps;

		object: html.IHtmlObjectElementProps;
		ol: html.IHtmlOlElementProps;
		optgroup: html.IHtmlOptgroupElementProps;
		option: html.IHtmlOptionElementProps;
		output: html.IHtmlOutputElementProps;

		p: html.IHtmlPElementProps;
		param: html.IHtmlParamElementProps;
		picture: html.IHtmlPictureElementProps;
		pre: html.IHtmlPreElementProps;
		progress: html.IHtmlProgressElementProps;

		q: html.IHtmlQElementProps;

		rb: html.IHtmlElementProps;
		rp: html.IHtmlElementProps;
		rt: html.IHtmlElementProps;
		rtc: html.IHtmlElementProps;
		ruby: html.IHtmlElementProps;

		s: html.IHtmlElementProps;
		samp: html.IHtmlElementProps;
		script: html.IHtmlScriptElementProps;
		section: html.IHtmlElementProps;
		select: html.IHtmlSelectElementProps;
		slot: html.IHtmlSlotElementProps;
		small: html.IHtmlElementProps;
		source: html.IHtmlSourceElementProps;
		span: html.IHtmlSpanElementProps;
		strike: html.IHtmlElementProps;
		strong: html.IHtmlElementProps;
		style: html.IHtmlStyleElementProps;
		sub: html.IHtmlElementProps;
		summary: html.IHtmlElementProps;
		sup: html.IHtmlElementProps;

		table: html.IHtmlTableElementProps;
		tbody: html.IHtmlTbodyElementProps;
		td: html.IHtmlTdElementProps;
		template: html.IHtmlTemplateElementProps;
		textarea: html.IHtmlTextareaElementProps;
		tfoot: html.IHtmlTfootElementProps;
		th: html.IHtmlThElementProps;
		thead: html.IHtmlTHeadElementProps;
		time: html.IHtmlTimeElementProps;
		title: html.IHtmlTitleElementProps;
		tr: html.IHtmlTrElementProps;
		track: html.IHtmlTrackElementProps;
		tt: html.IHtmlElementProps;

		u: html.IHtmlElementProps;
		ul: html.IHtmlUlElementProps;

		var: html.IHtmlElementProps;
		video: html.IHtmlVideoElementProps;

		wbr: html.IHtmlElementProps;

		xmp: html.IHtmlXmpElementProps;

		// SVG elements
		svg: svg.ISvgSvgElementProps;

		svgA: svg.ISvgAElementProps;
		animate: svg.ISvgConditionalProcessingProps | svg.ISvgAnimationProps;
		animateMotion: svg.ISvgAnimateMotionElementProps;
		animateTarnsform: svg.ISvgConditionalProcessingProps | svg.ISvgAnimationProps;

		circle: svg.ISvgCircleElementProps;
		clipPath: svg.ISvgClipPathElementProps;
		colorProfile: svg.ISvgColorProfilePathElementProps;

		defs: svg.ISvgElementProps;
		desc: svg.ISvgElementProps;
		discard: svg.ISvgDiscardElementProps;

		ellipse: svg.ISvgEllipseElementProps;

		feBlend: svg.ISvgFeBlendElementProps;
		feColorMatrix: svg.ISvgFeColorMatrixElementProps;
		feComponentTransfer: svg.ISvgFeComponentTransferElementProps;
		feComposite: svg.ISvgFeCompositeElementProps;
		feConvolveMatrix: svg.ISvgFeConvolveMatrixElementProps;
		feDiffuseLighting: svg.ISvgFeDiffuseLightingElementProps;
		feDisplacementMap: svg.ISvgFeDisplacementMapElementProps;
		feDistantLight: svg.ISvgFeDistantLightElementProps;
		feDropShadow: svg.ISvgFeDropShadowElementProps;
		feFlood: svg.ISvgFeFloodElementProps;
		feFuncA: svg.ISvgTransferFunctionsProps;
		feFuncB: svg.ISvgTransferFunctionsProps;
		feFuncG: svg.ISvgTransferFunctionsProps;
		feFuncR: svg.ISvgTransferFunctionsProps;
		feGaussianBlur: svg.ISvgFeGaussianBlurElementProps;
		feImage: svg.ISvgFeImageElementProps;
		feMerge: svg.ISvgPresentationProps | svg.ISvgFilterPrimitiveProps;
		feMergeNode: svg.ISvgFeMergeNodeElementProps;
		feMorphology: svg.ISvgFeMorphologyElementProps;
		feOffset: svg.ISvgFeOffsetElementProps;
		fePointLight: svg.ISvgFePointLightElementProps;
		feSpecularLighting: svg.ISvgFeSpecularLightingElementProps;
		feSpotLight: svg.ISvgFeSpotLightElementProps;
		feTile: svg.ISvgFeTileElementProps;
		feTurbulence: svg.ISvgFeTurbulenceElementProps;
		filter: svg.ISvgFilterElementProps;
		foreignObject: svg.ISvgForeignObjectElementProps;

		g: svg.ISvgConditionalProcessingProps | svg.ISvgPresentationProps;

		hatch: svg.ISvgHatchElementProps;
		hatchpath: svg.ISvgHatchpathElementProps;

		image: svg.ISvgImageElementProps;

		line: svg.ISvgLineElementProps;
		linearGradient: svg.ISvgLinearGradientElementProps;

		marker: svg.ISvgMarkerElementProps;
		mask: svg.ISvgMaskElementProps;
		metadata: svg.ISvgElementProps;
		mpath: svg.ISvgMPathElementProps;

		path: svg.ISvgPathElementProps;
		pattern: svg.ISvgPatternElementProps;
		polygon: svg.ISvgPolygonElementProps;
		polyline: svg.ISvgPolylineElementProps;

		radialGradient: svg.ISvgRadialGradientElementProps;
		rect: svg.ISvgRectElementProps;

		svgScript: svg.ISvgScriptElementProps;
		set: svg.ISvgSetElementProps;
		solidcolor: svg.ISvgElementProps;
		stop: svg.ISvgStopElementProps;
		svgStyle: svg.ISvgStyleElementProps;
		switch: svg.ISvgConditionalProcessingProps | svg.ISvgPresentationProps;
		symbol: svg.ISvgSymbolElementProps;

		text: svg.ISvgTextElementProps;
		textPath: svg.ISvgTextPathElementProps;
		svgTitle: svg.ISvgElementProps;
		textSpan: svg.ISvgTextSpanElementProps;

		use: svg.ISvgUseElementProps;

		view: svg.ISvgViewElementProps;

		//[elemName: string]: any
	}

	// tslint:disable-next-line:no-empty-interface
	// Properties in this interface apply to intrinsic elements and to functional components.
	export interface IntrinsicAttributes extends ICommonProps {}

	// tslint:disable-next-line:no-empty-interface
	// Properties in this interface apply to class-based components.
	export interface IntrinsicClassAttributes<T> extends IManagedCompProps<T> {}
}



/**
 * JSX Factory function. In order for this function to be invoked by the TypeScript compiler, the
 * tsconfig.json must have the following option:
 *
 * ```json
 * "compilerOptions":
 * {
 *     "jsx": "react",
 *     "jsxFactory": "jsx"
 * }
 * ```
 *
 * The .tsx files must import the mimbl module as mim: import * as mim from "mimbl"
 * @param tag
 * @param props
 * @param children
 */
export function jsx( tag: any, props: any, ...children: any[]): any
{
    return tag[symJsxToVNs]( props, children);
}



/**
 * The IServiceDefinitions interface serves as a mapping between service names and service types.
 * This interface is intended to be augmented by modules that define and/or use specific services.
 * This allows performing service publishing and subscribing in type-safe manner.
 */
export interface IServiceDefinitions
{
	/** Built-in error handling service. */
	"StdErrorHandling": IErrorHandlingService;

	/**
	 * Built-in service for lazy people - can be used for quick prototypes without the need to
	 * augment the interface.
	 */
	"any": any;
}



/**
 * The IErrorHandlingService interface represents a service that can be invoked when an error -
 * usually an exception - is encountered but cannot be handled locally. A component that implements
 * this service would normally remember the error and request to update itself, so that in its
 * render method it will present the error to the user.
 *
 * The IErrorHandlingService is implemented by the Root Virtual Node as a last resort for error
 * handling. The Root VN will display a simple UI showing the error and will allow the user to
 * restart - in the hope that the error will not repeat itself.
 */
export interface IErrorHandlingService
{
	reportError( err: any): void;
}



/**
 * Type of functions scheduled to be called either before or after the update cycle.
 */
export type ScheduledFuncType = () => void;



/**
 * Defines event handler that is invoked when reference value changes.
 */
export type RefFunc<T = any> = (newRef: T) => void;



// Symbol used to keep the referenced object inside the Ref class instance.
let symRef = Symbol("symRef");

/**
 * Reference class to use whenever a reference to an object is needed - for example, with JSX `ref`
 * attributes and services.
 */
export class Ref<T = any>
{
	/** Event that is fired when the referenced value changes */
	private changedEvent: EventSlot<RefFunc<T>>;

	constructor( listener?: RefFunc<T>, initialReferene?: T)
	{
        if (listener !== undefined)
        {
            this.changedEvent = new EventSlot<RefFunc<T>>();
            this.changedEvent.attach( listener);
        }

		this[symRef] = initialReferene;
	}

	/** Adds a callback that will be invoked when the value of the reference changes. */
	public addListener( listener: RefFunc<T>)
	{
        if (!this.changedEvent)
            this.changedEvent = new EventSlot<RefFunc<T>>();

        this.changedEvent.attach( listener);
	}

	/** Removes a callback that was added with addListener. */
	public removeListener( listener: RefFunc<T>)
	{
        if (this.changedEvent)
		    this.changedEvent.detach( listener);
	}

	/** Get accessor for the reference value */
	public get r(): T { return this[symRef]; }

	/** Set accessor for the reference value */
	public set r( v: T)
	{
		if (this[symRef] !== v)
		{
			this[symRef] = v;
			if (this.changedEvent)
		        this.changedEvent.fire( v);
		}
	}
}



/**
 * The ElmRef class represents a reference to the element virtual node. Such objects
 * can be created and passed to the `ref` property of an element. After the element is rendered
 * the object can be used to schedule updates to the element directly - that is, without updating
 * the component that rendered the element. This, for example, can be used to update properties
 * of the element without causing re-rendering of its children.
 */
export class ElmRef<T extends Element = Element> extends Ref<IElmVN<T>> {}

/**
 * Defines event handler that is invoked when reference value changes.
 */
export type ElmRefFunc<T extends Element = Element> = RefFunc<IElmVN<T>>;



/**
 * Type of ref property that can be passed to JSX elements and components. This can be either the
 * [[Ref]] class or [[RefFunc]] function.
 */
export type RefType<T = any> = Ref<T> | RefFunc<T>;

/**
 * Type of ref property value. This can be either the [[Ref]] class or [[RefFunc]] function or the
 * type itself.
 */
export type RefPropType<T = any> = T | RefType<T>;

/**
 * Type of the vnref property value.
 */
export type ElmRefType<T extends Element = Element> = RefType<IElmVN<T>>;

/**
 * Type of vnref property that can be passed to JSX elements.
 */
export type ElmRefPropType<T extends Element = Element> = RefPropType<IElmVN<T>>;



/**
 * Decorator function for creating reference properties without the need to manually create Ref<>
 * instances. This allows for the following code pattern:
 *
 * ```typescript
 * class A extends Component
 * {
 *     @ref myDiv: HTMLDivElement;
 *     render() { return <div ref={this.myDiv}>Hello</div>; }
 * }
 * ```
 *
 * In the above example, the myDiv property will be set to point to the HTML div element.
 */
export function ref( target: any, name: string)
{
    let sym = Symbol( name + "_ref");
    function ensureHandler( obj: any): RefProxyHandler
    {
        let handler = obj[sym];
        if (!handler)
        {
            obj[sym] = handler = new RefProxyHandler();
            handler.proxy = new Proxy( {}, handler);
        }

        return handler;
    }

	Object.defineProperty( target, name,
		{
            set( v: any) { ensureHandler(this).obj = v; },
            get() { return ensureHandler(this).proxy; }
		}
	);
}

/**
 * The RefProxyHandler is a proxy handler for the objects created when reference is defined using
 * the @ref decorator. Only the "r" property has special handling (because it is used by the
 * setRef function); everything else is reflected from the remembered referenced object.
 */
class RefProxyHandler implements ProxyHandler<any>
{
    // Keeps the proxy object for which this is the handler
    public proxy: any;

    // Keeps the referenced object or undefined
    public obj: any;

    public get( target: any, prop: PropertyKey, receiver: any): any
    {
        if (prop === "r")
            return this.obj;

        let propVal = this.obj[prop];
        return typeof propVal === "function" ? propVal.bind( this.obj) : propVal;
    }

    public set( target: any, prop: PropertyKey, value: any, receiver: any): boolean
    {
        if (prop === "r")
            this.obj = value;
        else
            this.obj[prop] = value;

        return true;
        // Reflect.set doesn't work but regular property set does
        // return Reflect.set( this.obj, prop, value, receiver);
    }

    public deleteProperty( target: any, prop: PropertyKey): boolean
        { return Reflect.deleteProperty( this.obj, prop); }

    public defineProperty( target: any, prop: PropertyKey, attrs: PropertyDescriptor): boolean
        { return Reflect.defineProperty( this.obj, prop, attrs); }

    public has( target: any, prop: PropertyKey): boolean
        { return Reflect.has( this.obj, prop); }

    public getPrototypeOf( target: any): object | null
        { return Reflect.getPrototypeOf( this.obj); }

    public isExtensible( target: any): boolean
        { return Reflect.isExtensible( this.obj); }

    public getOwnPropertyDescriptor( target: any, prop: PropertyKey): PropertyDescriptor | undefined
        { return Reflect.getOwnPropertyDescriptor( this.obj, prop); }

    public ownKeys( target: any): PropertyKey[]
        { return Reflect.ownKeys( this.obj); }

}



/**
 * Helper function to set the value of the reference that takes care of the different types of
 * references. The optional `onlyIf` parameter may specify a value so that only if the reference
 * currently has the same value it will be replaced. This might be needed to not clear a
 * reference if it already points to a different object.
 * @param ref [[Ref]] object to which the new value will be set
 * @param val Reference value to set to the Ref object
 * @param onlyIf An optional value to which to compare the current (old) value of the reference.
 * The new value will be set only if the old value equals the `onlyIf` value.
 */
export function setRef<T>( ref: RefType<T>, val: T, onlyIf?: T): void
{
	if (typeof ref === "function")
		ref(val);
	else if (!onlyIf || ref.r === onlyIf)
        ref.r = val;
}



/**
 * The IVNode interface represents a virtual node. Through this interface, callers can perform
 * most common actions that are available on every type of virtual node. Each type of virtual node
 * also implements a more specific interface through which the specific capabilities of the node
 * type are available.
 */
export interface IVNode
{
	/** Gets node's parent. This is undefined for the top-level (root) nodes. */
	readonly parent?: IVNode;

	/** Level of nesting at which the node resides relative to the root node. */
	readonly depth?: number;

	/** Component that created this node in its render method (or undefined). */
	readonly creator?: IComponent;

	/**
     * Zero-based index of this node in the parent's list of sub-nodes. This is zero for the
     * root nodes that don't have parents.
     */
	readonly index?: number;

	/** List of sub-nodes. */
	readonly subNodes?: IVNode[];

	/**
	 * Gets node's display name. This is used mostly for tracing and error reporting. The name
	 * can change during the lifetime of the virtual node; for example, it can reflect an "id"
	 * property of an element.
	 */
	readonly name?: string;



	/** This method is called by the component when it needs to be updated. */
	requestUpdate(): void;



	/**
	 * Registers an object of any type as a service with the given ID that will be available for
	 * consumption by descendant components.
	 */
	publishService<K extends keyof IServiceDefinitions>( id: K, service: IServiceDefinitions[K]): void;

	/** Unregisters a service with the given ID. */
	unpublishService<K extends keyof IServiceDefinitions>( id: K): void;

	/**
	 * Subscribes to a service with the given ID. If the service with the given ID is registered
	 * by this or one of the ancestor components, the passed Ref object will reference it;
	 * otherwise, the Ref object will be set to the defaultValue (if specified) or will remain
	 * undefined. Whenever the value of the service that is registered by this or a closest
	 * ancestor component is changed,the Ref object will receive the new value.
	 * The useSelf optional parameter determines whether the component can subscribe to the
	 * service published by itself. The default is false.
	 * @param id
	 * @param ref
	 * @param defaultService
	 * @param useSelf
	 */
	subscribeService<K extends keyof IServiceDefinitions>( id: K, ref: RefPropType<IServiceDefinitions[K]>,
					defaultService?: IServiceDefinitions[K], useSelf?: boolean): void;

	/**
	 * Unsubscribes from a service with the given ID. The Ref object that was used to subscribe
	 * will be set to undefined.
	 * @param id
	 */
	unsubscribeService<K extends keyof IServiceDefinitions>( id: K): void;

	/**
	 * Retrieves the value for a service with the given ID registered by a closest ancestor
	 * component or the default value if none of the ancestor components registered a service with
	 * this ID. This method doesn't establish a subscription and only reflects the current state.
	 * @param id
	 * @param defaultService
	 * @param useSelf
	 */
	getService<K extends keyof IServiceDefinitions>( id: K, defaultService?: IServiceDefinitions[K],
					useSelf?: boolean): IServiceDefinitions[K];
}



/**
 * The IClassCompVN interface represents a virtual node for a JSX-based component.
 */
export interface IClassCompVN extends IVNode
{
	/** Gets the component instance. */
	readonly comp: IComponent;
}



/**
 * The IManagedCompVN interface represents a virtual node for a JSX-based component.
 */
export interface IManagedCompVN extends IClassCompVN
{
	/** Gets the component class. */
	readonly compClass: IComponentClass;
}



/**
 * The IIndependentCompVN interface represents a virtual node for an independent component.
 */
export interface IIndependentCompVN extends IClassCompVN
{
}



/**
 *  The IElmVN interface represents a virtual node for a DOM element.
 */
export interface IElmVN<T extends Element = Element> extends IVNode
{
	/** Gets the DOM element name. */
	readonly elmName: string;

	/** Gets the DOM element object. */
	readonly elm: Element;

    /**
     * Requests update of the element properties without re-rendering of its children.
     * @param props
     */
	setProps( props: IElementProps<T>, schedulingType?: TickSchedulingType): void;

    /**
     * Updates the element's sub-nodes with the given content. This method engages the regular
     * reconciliation mechanism, which tries to update the existing sub-nodes by the new sub-nodes
     * and unmounting only those that cannot be updated.
     * @param children
     */
    updateChildren( content: any, schedulingType?: TickSchedulingType): void;

    /**
     * Completely replaces the element's sub-nodes with the given content. This method unmounts all
     * existing sub-nodes without trying to see whether they can be updated by the new sub-nodes.
     * @param children
     */
    setChildren( content?: any, schedulingType?: TickSchedulingType): void;

    /**
     * Retains the given range of the sub-nodes unmounting the sub-nodes outside this range. This
     * method operates similar to the Array.prototype.slice method.
     * @param startIndex Index of the first sub-node in the range
     * @param endIndex (optional) Index of the sub-node after the last sub-node in the range. If
     * this parameter is zero or undefined or greater than the length of the sub-nodes array, the
     * range will include all sub-nodes from the startIndex to the end of the array.
     */
    sliceChildren( startIndex: number, endIndex?: number, schedulingType?: TickSchedulingType): void;

    /**
     * At the given index, removes a given number of sub-nodes and then inserts the new content.
     * @param index
     * @param countToDelete
     * @param contentToInsert
     * @param update Optional flag determining whether to reconcile or completely replace the
     * sub-nodes being removed with the new content. The default is to replace.
     */
    spliceChildren( index: number, countToDelete?: number, contentToInsert?: any, update?: boolean, schedulingType?: TickSchedulingType): void;

    /**
     * Moves a range of sub-nodes to a new location.
     * @param index Starting index of the range.
     * @param count Number of sub-nodes in the range.
     * @param shift Positive or negative number of positions the range will be moved.
     */
    moveChildren( index: number, count: number, shift: number, schedulingType?: TickSchedulingType): void;

    /**
     * Swaps two ranges of the element's sub-nodes. The ranges cannot intersect.
     * @param index1
     * @param count1
     * @param index2
     * @param count2
     */
    swapChildren( index1: number, count1: number, index2: number, count2: number, schedulingType?: TickSchedulingType): void;

    /**
     * Removes the given number of nodes from the start and/or the end of the list of sub-nodes.
     * @param startCount
     * @param endCount
     */
    trimChildren( startCount: number, endCount: number, schedulingType?: TickSchedulingType): void;

    /**
     * Adds the given content at the start and/or at the end of the existing children.
     * @param startContent
     * @param endContent
     */
    growChildren( startContent?: any, endContent?: any, schedulingType?: TickSchedulingType): void;
}



/**
 * The ITextVN interface represents a virtual node for a text DOM node.
 */
export interface ITextVN extends IVNode
{
	/** Text of the node. */
	readonly text: string;

	/** Text DOM node. */
	readonly textNode: Text;

	/**
     * Requests update of the text.
     */
	setText( text: string, schedulingType?: TickSchedulingType): void;
}



/**
 * Creates text virtual node, which can be used to update the text without re-rendering parent
 * element.
 * @param text Text to initialize the text node
 */
export function createTextVN( text: string): ITextVN
{
    return new TextVN( text);
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Custom attributes
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The ICustomAttributeHandlerClass interface represents a class of handlers of custom attributes
 * that can be applied to intrinsic (HTML or SVG) elements. The requirements on such classes are:
 * 1. Implement a constructor accepting IElmVN, attribute value and attribute name (this allows
 *   the same handler to serve different attributes).
 * 2. Implement the ICustomAttributeHandler interface
 */
export interface ICustomAttributeHandlerClass<T>
{
	/**
	 * Constructs a new custom attribute handler that will act on the given element and provides
	 * the initial value of the attribute. Attribute name is also provided in case the handler
	 * supports different attributes. By the time this constructor is called, the DOM element had
	 * already been created and standard attributes and event listeners had been applied.
	 * @param elmVN Virtual node for this element. The handler can retrieve the DOM element from
	 *   this interface and also use other methods (e.g. subscribe to services).
	 * @param attrVal Initial value of the custom attribute
	 * @param attrName Name of the custom attribute
	 */
	new( elmVN: IElmVN, attrVal: T, attrName?: string): ICustomAttributeHandler<T>;
}



/**
 * The ICustomAttributeHandler interface represents an ability to handle custom properties that can
 * be applied to intrinsic (HTML or SVG) elements.
 */
export interface ICustomAttributeHandler<T = any>
{
	/**
	 * Updates an existing custom attribute with the new value.
	 * @param newPropVal New value of the custom attribute.
	 * @returns True if changes were made and false otherwise.
	 */
	update( newPropVal: T): boolean;

	/**
	 * Terminates the functioning of the custom attribute handler. This method is invoked either
	 * when a new rendering of the element doesn't have the attribute anymore or if the element
	 * is removed. Although this method is optional, most handlers will need to implement it to
	 * properly cleanup any resources (e.g. event handlers) to avoid leaks.
	 * @param isRemoval True if the element is being removed and false if the element is being
	 *   updated and the attribute is no longer provided. If the handler adds any event
	 *   listeners to the element, then it has to remove them on update but doen't have to do it
	 *   on element removal.
	 */
	terminate?( isRemoval: boolean): void;
}



/**
 * Registers custom attribute handler class for the given property name.
 * @param propName name of the custom attribute
 * @param factory custom attribute class
 */
export function registerCustomAttribute<T>( attrName: string, handlerClass: ICustomAttributeHandlerClass<T>): void
{
	registerElmProp( attrName, { type: PropType.CustomAttr, handlerClass });
}

/**
 * Registers custom event for the given property name.
 * @param propName name of the custom event
 */
export function registerCustomEvent( eventName: string): void
{
	registerElmProp( eventName, { type: PropType.Event });
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The TickSchedulingType type defines possible ways of scheduling a Mimbl tick.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

export const enum TickSchedulingType
{
    /** No tick is scheduled */
    None = 1,

    /** The tick is executed right away in a synchronous manner */
    Sync,

    /** A microtask is scheduled for executing the tick */
    Microtask,

    /** An animation frame is scheduled for executing the tick */
    AnimationFrame,
}


///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Base component class.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Base class for components. Components that derive from this class must implement the render
 * method.
 */
export abstract class Component<TProps = {}, TChildren = any>
{
	/**
	 * Component properties passed to the constructor. This is normally used only by managed
	 * components and is usually undefined for independent coponents.
	 */
	public props: CompProps<TProps,TChildren>;

	/**
	 * Remembered virtual node object through which the component can request services. This
	 * is undefined in the component's costructor but will be defined before the call to the
	 * (optional) willMount method.
	 */
	public vn: IClassCompVN;

	constructor( props?: CompProps<TProps,TChildren>)
	{
		if (props)
			this.props = props;
	}

	/**
     * Returns the component's content that will be ultimately placed into the DOM tree. This
     * method is abstract because it must be implemented by every component.
     */
	public abstract render(): any;

    // Declare the methods that are invoked during component lifecicle.
	displayName?: string;
    willMount?(): void;
    didMount?(): void;
    didReplace?( oldComp: IComponent<TProps, TChildren>): void;
	willUnmount?(): void;
	beforeUpdate?(): void;
	afterUpdate?(): void;
	shouldUpdate?( newProps: CompProps<TProps,TChildren>): boolean;
	handleError?( err: any): any;
	getUpdateStrategy?(): UpdateStrategy;

    /**
     * Determines whether the component is currently mounted. If a component has asynchronous
     * functionality (e.g. fetching data from a server), component's code may be executed after
     * it was alrady unmounted. This property allows the component to handle this situation.
     */
	public get isMounted(): boolean { return this.vn != null; };

	/**
	 * This method is called by the component to request to be updated. If no arguments are
	 * provided, the entire component is requested to be updated. If arguments are provided, they
	 * indicate what rendering functions should be updated.
     * @param func Optional rendering function to invoke
     * @param funcThisArg Optional value to use as "this" when invoking the rendering function. If
     * undefined, the component's "this" will be used.
     * @param key Optional key which distinguishes between multiple uses of the same function. This
     * can be either the "arg" or the "key" property originally passed to the FunProxy component.
     */
	protected updateMe( func?: RenderMethodType, funcThisArg?: any, key?: any): void
	{
		if (!this.vn)
			return;

        // if no arguments are provided we request to update the entire component.
		if (!func)
			this.vn.requestUpdate();
		else
            FuncProxyVN.update( func, funcThisArg || this, key);
	}

	/**
	 * Schedules the given function to be called before any components scheduled to be updated in
	 * the Mimbl tick are updated.
	 * @param func Function to be called
	 * @param funcThisArg Object that will be used as "this" value when the function is called. If this
	 *   parameter is undefined, the component instance will be used (which allows scheduling
	 *   regular unbound components' methods). This parameter will be ignored if the function
	 *   is already bound or is an arrow function.
	 */
	protected callMeBeforeUpdate( func: ScheduledFuncType, funcThisArg?: any): void
	{
		scheduleFuncCall( func, true, funcThisArg ? funcThisArg : this, this);
	}

	/**
	 * Schedules the given function to be called after all components scheduled to be updated in
	 * the Mimbl tick have already been updated.
	 * @param func Function to be called
	 * @param funcThisArg Object that will be used as "this" value when the function is called. If this
	 *   parameter is undefined, the component instance will be used (which allows scheduling
	 *   regular unbound components' methods). This parameter will be ignored if the the function
	 *   is already bound or is an arrow function.
	 */
	protected callMeAfterUpdate( func: ScheduledFuncType, funcThisArg?: any): void
	{
		scheduleFuncCall( func, false, funcThisArg ? funcThisArg : this, this);
	}

	/**
	 * Creates a wrapper function with the same signature as the given callback so that if the original
	 * callback throws an exception, it is processed by the Mimbl error handling mechanism so that the
	 * exception bubbles from this component up the hierarchy until a component that knows to
	 * handle errors is found.
	 *
	 * Use this method before passing callbacks to document and window event handlers as well as
	 * non-DOM objects that use callbacks, e.g. fetch, Promise, setTimeout, etc. For example:
	 *
	 * ```typescript
	 *	class ResizeMonitor extends mim.Component
	 *	{
	 *		private onWindowResize(e: Event): void {};
	 *
	 * 		wrapper: (e: Event): void;
	 *
	 * 		public startResizeMonitoring()
	 *		{
	 *			this.wrapper = this.wrapCallback( this.onWindowResize);
	 *			window.addEventListener( "resize", this.wrapper);
	 *		}
	 *
	 * 		public stopResizeMonitoring()
	 *		{
	 *			window.removeEventListener( "resize", this.wrapper);
	 *			this.wrapper = undefined;
	 *		}
	 *	}
	 * ```
	 *
	 * @param func Method/function to be wrapped
     * @param funcThisArg Optional value of "this" to bind the callback to. If this parameter is
     * undefined, the component instance will be used. This parameter will be ignored if the the
     * function is already bound or is an arrow function.
	 * @param schedulingType Type determining whether and how a Mimbl tick should be scheduled
     * after callback invocation.
	 * @returns Function that has the same signature as the given callback and that should be used
	 *     instead of the original callback
	 */
    protected wrapCallback<T extends Function>( func: T, funcThisArg?: any,
        schedulingType?: TickSchedulingType): T
	{
		return s_wrapCallback( {func, funcThisArg: funcThisArg ? funcThisArg : this, creator: this, schedulingType});
	}
}

// Make the methods that are invoked during component lifecicle undefined so that lookup is faster.
Component.prototype.displayName = undefined;
Component.prototype.willMount = undefined;
Component.prototype.didMount = undefined;
Component.prototype.didReplace = undefined;
Component.prototype.willUnmount = undefined;
Component.prototype.beforeUpdate = undefined;
Component.prototype.afterUpdate = undefined;
Component.prototype.shouldUpdate = undefined;
Component.prototype.handleError = undefined;
Component.prototype.getUpdateStrategy = undefined;



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Built-in components
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * An artificial "Fragment" component that is only used as a temporary collection of other items
 * in places where JSX only allows a single item. Our JSX factory function creates a virtual node
 * for each of its children and the function is never actually called. This function is only needed
 * because currently TypeScript doesn't allow the `<>` fragment notation if a custom JSX factory
 * function is used.
 *
 * Use it as follows:
 * ```tsx
 *	import * as mim from "mimbl"
 *	.....
 *	render()
 *	{
 *		return <Fragment>
 *			<div1/>
 *			<div2/>
 *			<div3/>
 *		</Fragment>
 *	}
  ```

 * @param props
 */
export function Fragment( props: CompProps<{}>): any {}



/**
 * Definition of type of  method that renders content.
 */
export type RenderMethodType = (arg: any) => any;



/**
 * Properties to be used with the FuncProxy component. FuncProxy component cannot have children.
 * A key property can be used to distinguish between multiple uses of the same function. If the
 * function is used only once within a component, the key is not necessary; however, if the
 * function is used multiple times, key is mandatory - otherwise, the behavior is undetermined.
 */
export interface FuncProxyProps extends ICommonProps
{
	/** Function that renders content. */
	func: RenderMethodType;

	/**
	 * Value to be used as "this" when invoking the function. If this value is undefined, the
	 * class based component that rendered the FuncProxy component will be used (which is the
	 * most common case).
	 */
	funcThisArg?: any;

	/**
	 * Arguments to be passed to the function. Whenever the FuncProxy component is rendered, this
	 * parameter is used when calling the wrapped function.
	 */
	arg?: any;
}



/**
 * The FuncProxy component wraps a function that produces content. Proxies can wrap instance
 * methods of classes that have access to "this" thus allowing a single class to "host" multiple
 * components that can be updated separately. The FuncProxy component is not intended to be
 * created by developers; instead it is only used in its JSX form as the following:
 *
 * ```tsx
 * <FuncProxy func={this.renderSomething} key={...} args={...} thisArg={...} />
 * ```
 *
 * There is a simpler method of specifying a rendering function in JSX, e.g.:
 *
 * ```tsx
 * <div>{this.renderSomething}</div>
 * ```
 *
 * The FuncProxy component is needed in the case where one (or more) of the following is true:
 * - There is a need to pass arguments to the function
 * - The same function is used multiple times and keys must be used to distinguish between the
 * invocations.
 * - The value of "this" inside the function is not the component that does the rendering. That
 * is, the function is not a method of this component.
 *
 * FuncProxy has a public static Update method that can be called to cause the rendering mechanism
 * to invoke the function wrapped by the FuncProxy.
 */
export class FuncProxy extends Component<FuncProxyProps,void>
{
	/**
	 * Instances of the FuncProxy component are never actually created; istead, the parameters
	 * passed to it via JSX are used by an internal virtual node that handles function
	 * invocation.
	 */
	private constructor( props: FuncProxyProps) { super(props) }

	/** The render method of the FuncProxy component is never actually called */
	public render(): any {}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Support for promises returned as content.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Properties to be used with the PromiseProxy component.
 */
export interface PromiseProxyProps extends ICommonProps
{
	/** Promise that will be watch by the waiting node. */
	promise: Promise<any>;

	/** Function that is called if the promise is rejected. */
	errorContentFunc?: (err: any) => any;
}



/**
 * The PromiseProxy component wraps a Promise and replaces its content when the promise is settled.
 * Before the promise is settled, the component displays an optional "in-progress" content
 * specified as children of the component. If the promise is rejected, the component will either
 * display the "error" content obtained by calling a functions specified in the properties or, if
 * such function is not specified, display nothing.
 */
export class PromiseProxy extends Component<PromiseProxyProps>
{
	/**
	 * Instances of the FuncProxy component are never actually created; istead, the parameters
	 * passed to it via JSX are used by an internal virtual node that handles function
	 * invocation.
	 */
	private constructor( props: PromiseProxyProps) { super( props); }

	/** The render method of the PromiseProxy component is never actually called */
	public render(): any {}
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Definitions of mount/unmount functions
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Renders the given content (usually result of JSX expression) under the given HTML element
// asynchronously.
 * @param content Content to render.
 * @param anchorDN DOM element under which to render the content. If null or undefined,then
 *				render under the document.body tag.
 */
export function mount( content: any, anchorDN: Node = null): void
{
	mountRoot( content, anchorDN);
}

/**
 * Removes the content that was originally generated by the mount function.
 * @param anchorDN DOM element under which the content was previously rendered.
 */
export function unmount( anchorDN: Node = null): void
{
	unmountRoot( anchorDN);
}



/**
 * Symbol that is attached to a render function to indicate that it should not be wrapped in a
 * watcher.
 */
export let symRenderNoWatcher = Symbol();

/**
 * Decorator function for tagging a component's render function so that it will not be wrapped in
 * a watcher.
 */
export function noWatcher( target: any, name: string, propDescr: PropertyDescriptor)
{
    // propDesc.value is undefined for accessors and defined for functions
    if (!propDescr.value)
        throw new Error("@noWatcher decorator can only be applied to methods.");

    propDescr.value[symRenderNoWatcher] = true;
}



/**
 * @deprecated - use `@trigger`
 */
export function updatable( target, name: string)
{
	let attrName = "_m_" + name;
	Object.defineProperty( target, name, {
        set( val)
        {
            if (this[attrName] !== val)
            {
                this[attrName] = val;
                let vn: IVNode = this.vn;
                if (vn)
                    this.vn.requestUpdate();
            }
        },
        get() { return this[attrName]; }
    });
}



