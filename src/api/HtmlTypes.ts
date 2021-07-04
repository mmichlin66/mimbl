import {CssColor, MediaQuery} from "mimcss"
import {
    IElementProps, EventPropType, ReferrerPolicyPropType, FormtargetPropType, CrossoriginPropType,
    FormenctypePropType, FormmethodPropType
} from "./mim";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Definitions of property types used HTML elements.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

export type AutocapitalizePropType = "off" | "none" | "on" | "sentences" | "words" | "characters";
export type DirPropType = "ltr" | "rtl" | "auto";
export type InputmodePropType = "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
export type ImportancePropType = "auto" | "high" | "low";

export type InputTypePropType = "button" | "checkbox" | "color" | "date" | "datetime" | "datetime-local" |
		"email" | "file" | "hidden" | "image" | "month" | "number" | "password" | "radio" |
		"range" | "reset" | "search" | "submit" | "tel" | "text" | "time" | "url" | "week";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The IHtmlElementProps interface defines standard properties (attributes and event listeners)
// that can be used on all HTML elements. This interface is needed for JSX type checking.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface IHtmlElementProps<TRef extends HTMLElement = HTMLElement> extends IElementProps<TRef>
{
	// standard attributes
	accesskey?: string;
	autocapitalize?: AutocapitalizePropType;
	contenteditable?: boolean;
	//contextmenu?: string;		// obsolete
	dir?: DirPropType;
	hidden?: boolean;
	inputmode?: InputmodePropType;
	is?: string;
	itemid?: string;
	itemprop?: string;
	itemref?: string;
	itemscope?: boolean;
	itemtype?: string;
	slot?: string;
	title?: string;
	translate?: boolean | "yes" | "no";

	// events
	drag?: EventPropType<DragEvent>;
	dragend?: EventPropType<DragEvent>;
	dragenter?: EventPropType<DragEvent>;
	//dragexit?: EventPropType<Event>;
	dragleave?: EventPropType<DragEvent>;
	dragover?: EventPropType<DragEvent>;
	dragstart?: EventPropType<DragEvent>;
	drop?: EventPropType<DragEvent>;
}



// <a>
export interface IHtmlAElementProps extends IHtmlElementProps<HTMLAnchorElement>
{
	download?: string;
	href?: string;
	hreflang?: string;
	ping?: string;
	referrerpolicy?: ReferrerPolicyPropType;
	rel?: string;
	target?: FormtargetPropType;
	type?: string;
}



// <applet>
export interface IHtmlAppletElementProps extends IHtmlElementProps<HTMLElement>
{
}



// <area>
export interface IHtmlAreaElementProps extends IHtmlElementProps<HTMLAreaElement>
{
	alt?: string;
	coords?: string | number[];
	download?: string;
	href?: string;
	hreflang?: string;
	ping?: string;
	referrerpolicy?: ReferrerPolicyPropType;
	rel?: string;
	shape?: "rect" | "circle" | "poly" | "default";
	target?: FormtargetPropType;
}



// <audio>
export interface IHtmlAudioElementProps extends IHtmlElementProps<HTMLAudioElement>
{
	autoplay?: boolean;
	controls?: boolean;
	crossorigin?: CrossoriginPropType;
	loop?: boolean;
	muted?: boolean;
	preload?: "none" | "metadata" | "auto" | "";
	src?: string;
}



// <base>
export interface IHtmlBaseElementProps extends IHtmlElementProps<HTMLBaseElement>
{
	href?: string;
	target?: FormtargetPropType;
}



// <blockquote>
export interface IHtmlBlockquoteElementProps extends IHtmlElementProps<HTMLQuoteElement>
{
	cite?: string;
}



// <br>
export interface IHtmlBrElementProps extends IHtmlElementProps<HTMLBRElement>
{
}



// <button>
export interface IHtmlButtonElementProps extends IHtmlElementProps<HTMLButtonElement>
{
	autofocus?: boolean;
	disabled?: boolean;
	form?: string;
	formaction?: string;
	formenctype?:  FormenctypePropType;
	formmethod?: FormmethodPropType;
	formnovalidate?: boolean;
	formtarget?: FormtargetPropType;
	name?: string;
	type?: InputTypePropType;
	value?: string;
}



// <canvas>
export interface IHtmlCanvasElementProps extends IHtmlElementProps<HTMLCanvasElement>
{
	height?: number;
	width?: number;
}



// <caption>
export interface IHtmlCaptionElementProps extends IHtmlElementProps<HTMLTableCaptionElement>
{
}



// <col>
export interface IHtmlColElementProps extends IHtmlElementProps<HTMLTableColElement>
{
	span?: number;
}



// <colgroup>
export interface IHtmlColgroupElementProps extends IHtmlElementProps<HTMLTableColElement>
{
}



// <data>
export interface IHtmlDataElementProps extends IHtmlElementProps<HTMLDataElement>
{
	value?: string | number | boolean;
}



// <datalist>
export interface IHtmlDataListElementProps extends IHtmlElementProps<HTMLDataListElement>
{
}



// <dd>
export interface IHtmlDdElementProps extends IHtmlElementProps
{
	nowrap?: boolean;
}



// <del>
export interface IHtmlDelElementProps extends IHtmlElementProps<HTMLModElement>
{
	cite?: string;
	datetime?: string | Date;
}



// <details>
export interface IHtmlDetailsElementProps extends IHtmlElementProps<HTMLDetailsElement>
{
	open?: boolean;
	toggle?: EventPropType<Event>;
}



// <dialog>
export interface IHtmlDialogElementProps extends IHtmlElementProps<HTMLDialogElement>
{
	open?: boolean;
}



// <div>
export interface IHtmlDivElementProps extends IHtmlElementProps<HTMLDivElement>
{
	noWrap?: boolean;
}



// <dir>
export interface IHtmlDirElementProps extends IHtmlElementProps<HTMLDirectoryElement>
{
}



// <dl>
export interface IHtmlDlElementProps extends IHtmlElementProps<HTMLDListElement>
{
	compact?: boolean;
}



// <embed>
export interface IHtmlEmbedElementProps extends IHtmlElementProps<HTMLEmbedElement>
{
	height?: number;
	src?: string;
	type?: string;
	width?: number;
}



// <fieldset>
export interface IHtmlFieldsetElementProps extends IHtmlElementProps<HTMLFieldSetElement>
{
	disabled?: boolean;
	form?: string;
	name?: string;
}



// <font>
export interface IHtmlFontElementProps extends IHtmlElementProps<HTMLFontElement>
{
}



// <frame>
export interface IHtmlFrameElementProps extends IHtmlElementProps<HTMLFrameElement>
{
}



// <frameset>
export interface IHtmlFramesetElementProps extends IHtmlElementProps<HTMLFrameSetElement>
{
}



// <form>
export interface IHtmlFormElementProps extends IHtmlElementProps<HTMLFormElement>
{
	acceptCharset?: string | "UNKNOWN";
	action?: string;
	autocapitalize?: AutocapitalizePropType;
	autocomplete?: boolean;
	enctype?: FormenctypePropType;
	method?: FormmethodPropType;
	name?: string;
	novalidate?: boolean;
	target?: string | FormtargetPropType;
}



// <h1>
export interface IHtmlH1ElementProps extends IHtmlElementProps<HTMLHeadingElement>
{
}



// <h2>
export interface IHtmlH2ElementProps extends IHtmlElementProps<HTMLHeadingElement>
{
}



// <h3>
export interface IHtmlH3ElementProps extends IHtmlElementProps<HTMLHeadingElement>
{
}



// <h4>
export interface IHtmlH4ElementProps extends IHtmlElementProps<HTMLHeadingElement>
{
}



// <h5>
export interface IHtmlH5ElementProps extends IHtmlElementProps<HTMLHeadingElement>
{
}



// <h6>
export interface IHtmlH6ElementProps extends IHtmlElementProps<HTMLHeadingElement>
{
}



// <head>
export interface IHtmlHeadElementProps extends IHtmlElementProps<HTMLHeadElement>
{
}



// <hr>
export interface IHtmlHrElementProps extends IHtmlElementProps<HTMLHRElement>
{
	align?: string;
	color?:  CssColor;
	noshade?: boolean;
	size?: number;
	width?: number;
}



// <html>
export interface IHtmlHtmlElementProps extends IHtmlElementProps<HTMLHtmlElement>
{
}



// <iframe>
export interface IHtmlIframeElementProps extends IHtmlElementProps<HTMLIFrameElement>
{
	allow?: string;
	allowfullscreen?: boolean;
	csp?: string;
	height?: number;
	importance?: ImportancePropType;
	name?: string;
	referrerpolicy?: ReferrerPolicyPropType;
	sandbox?: string;
	src?: string | "about:blank";
	srcdoc?: string;
	width?: number;
}



// <img>
export interface IHtmlImgElementProps extends IHtmlElementProps<HTMLImageElement>
{
	alt?: string;
	crossorigin?: CrossoriginPropType;
	decoding?: "auto" | "sync" | "async";
	height?: number;
	importance?: ImportancePropType;
	intrinsicsize?: boolean;
	ismap?: boolean;
	referrerpolicy?: ReferrerPolicyPropType;
	sizes?: string;
	src?: string;
	srcset?: string;
	width?: number;
	usemap?: string;
}



// <input>
export interface IHtmlInputElementProps extends IHtmlElementProps<HTMLInputElement>
{
	autocomplete?: string | boolean;
	autofocus?: boolean;
	disabled?: boolean;
	form?: string;
	list?: string;
	name?: string;
	readonly?: boolean;
	required?: boolean;
	type?: InputTypePropType;
	value?: string;

	// checkbox and radio
	checked?: boolean;

    // special properties to set value only first time
    defaultValue?: string;
    defaultCheck?: boolean;

	// multiple types
	max?: string | number;
	min?: string | number;
	step?: number | "any";
	multiple?: boolean;
	placeholder?: string;
	maxlength?: number;
	minlength?: string;
	size?: number;
	pattern?: string;

	// file
	accept?: string;
	capture?: "user" | "environment";

	// submit and image
	formaction?: string;
	formenctype?: FormenctypePropType;
	formmethod?: FormmethodPropType;
	formnovalidate?: boolean;
	formtarget?: string | FormtargetPropType;

	// image
	alt?: string;
	height?: number;
	src?: string;
	width?: number;

	//// date and datetime-local
	//maxDate?: Date | string;
	//minDate?: Date | string;
	//valueDate?: Date | string;

	//// month
	//maxMonth?: Date | string;
	//minMonth?: Date | string;
	//valueMonth?: Date | string;

	//// week
	//maxWeek?: Date | string;
	//minWeek?: Date | string;
	//valueWeek?: Date | string;

	//// number and range
	//maxNumber?: number | string;
	//minNumber?: number | string;
	//valueNumber?: number | string;
}



// <ins>
export interface IHtmlInsElementProps extends IHtmlElementProps<HTMLModElement>
{
	cite?: string;
	datetime?: string | Date;
}



// <label>
export interface IHtmlLabelElementProps extends IHtmlElementProps<HTMLLabelElement>
{
	for?: string;
	form?: string;
}



// <legend>
export interface IHtmlLegendElementProps extends IHtmlElementProps<HTMLLegendElement>
{
}



// <li>
export interface IHtmlLiElementProps extends IHtmlElementProps<HTMLLIElement>
{
	value?: number;
	type?: "a" | "A" | "i" | "vsides" | "I" | "1";
}



// <link>
export interface IHtmlLinkElementProps extends IHtmlElementProps<HTMLLinkElement>
{
	as?: string;
	crossorigin?: CrossoriginPropType;
	href?: string;
	hrefLang?: string;
	importance?: ImportancePropType;
	integrity?: string;
	media?: MediaQuery;
	referrerpolicy?: ReferrerPolicyPropType;
	rel?: string;
	sizes?: string;
	type?: string;
	disabled?: boolean;
	methods?: string;
	prefetch?: string;
	target?: string;
}



// <listing>
export interface IHtmlListingElementProps extends IHtmlElementProps<HTMLPreElement>
{
}



// <map>
export interface IHtmlMapElementProps extends IHtmlElementProps<HTMLMapElement>
{
	name?: string;
}



// <menu>
export interface IHtmlMenuElementProps extends IHtmlElementProps<HTMLMenuElement>
{
}



// <meta>
export interface IHtmlMetaElementProps extends IHtmlElementProps<HTMLMetaElement>
{
	charset?: string;
	content?: string;
	httpEquiv?: string;
	name?: string;
}



// <meter>
export interface IHtmlMeterElementProps extends IHtmlElementProps<HTMLMeterElement>
{
	form?: string;
	high?: number;
	low?: number;
	min?: number;
	max?: number;
	optimum?: number;
	value?: number;
}



// <object>
export interface IHtmlObjectElementProps extends IHtmlElementProps<HTMLObjectElement>
{
	charset?: string;
	content?: string;
	httpEquiv?: string;
	name?: string;
}



// <ol>
export interface IHtmlOlElementProps extends IHtmlElementProps<HTMLOListElement>
{
	reversed?: boolean;
	start?: number;
	type?: "a" | "A" | "i" | "I" | "1";
	name?: string;
}



// <optgroup>
export interface IHtmlOptgroupElementProps extends IHtmlElementProps<HTMLOptGroupElement>
{
	disabled?: boolean;
	label: string;	// mandatory
}



// <option>
export interface IHtmlOptionElementProps extends IHtmlElementProps<HTMLOptionElement>
{
	disabled?: boolean;
	label?: string;
	selected?: boolean;
	value?: string;
}



// <output>
export interface IHtmlOutputElementProps extends IHtmlElementProps<HTMLOutputElement>
{
	forInputs?: string; // attrName is "for" but is in conflict with label's "for"
	form?: string;
	name?: string;
}



// <p>
export interface IHtmlPElementProps extends IHtmlElementProps<HTMLParagraphElement>
{
}



// <param>
export interface IHtmlParamElementProps extends IHtmlElementProps<HTMLParamElement>
{
	name?: string;
	value?: string;
}



// <picture>
export interface IHtmlPictureElementProps extends IHtmlElementProps<HTMLPictureElement>
{
}



// <pre>
export interface IHtmlPreElementProps extends IHtmlElementProps<HTMLPreElement>
{
}



// <progress>
export interface IHtmlProgressElementProps extends IHtmlElementProps<HTMLProgressElement>
{
	max?: number;
	value?: number;
}



// <q>
export interface IHtmlQElementProps extends IHtmlElementProps<HTMLQuoteElement>
{
	cite?: string;
}



// <script>
export interface IHtmlScriptElementProps extends IHtmlElementProps<HTMLScriptElement>
{
	async?: boolean;
	crossorigin?: CrossoriginPropType;
	defer?: boolean;
	integrity?: string;
	nomodule?: boolean;
	nonce?: string;
	src?: string;
	text?: string;
	type?: string;
}



// <select>
export interface IHtmlSelectElementProps extends IHtmlElementProps<HTMLSelectElement>
{
	autocomplete?: string;
	autofocus?: boolean;
	disabled?: boolean;
	form?: string;
	multiple?: boolean;
	name?: string;
	required?: boolean;
	size?: number;
}



// <slot>
export interface IHtmlSlotElementProps extends IHtmlElementProps<HTMLSlotElement>
{
}



// <source>
export interface IHtmlSourceElementProps extends IHtmlElementProps<HTMLSourceElement>
{
	media?: MediaQuery;
	sizes?: string;
	src?: string;
	srcset?: string;
	type?: string;
}



// <span>
export interface IHtmlSpanElementProps extends IHtmlElementProps<HTMLSpanElement>
{
}



// <style>
export interface IHtmlStyleElementProps extends IHtmlElementProps<HTMLStyleElement>
{
	media?: MediaQuery;
	nonce?: string;
	title?: string;
	type?: string;
}



// <table>
export interface IHtmlTableElementProps extends IHtmlElementProps<HTMLTableElement>
{
	data?: string;
	form?: string;
	hight?: number;
	name?: string;
	type?: string;
	typemustmatch?: boolean;
	usemap?: string;
	width?: number;
}



export interface IHtmlTbodyElementProps extends IHtmlElementProps<HTMLTableSectionElement>
{
}



// <td>
export interface IHtmlTdElementProps extends IHtmlElementProps<HTMLTableDataCellElement>
{
	colspan?: number;
	headers?: string;
	rowspan?: number;
	width?: number;
}



export interface IHtmlTemplateElementProps extends IHtmlElementProps<HTMLTemplateElement>
{
}



// <textarea>
export interface IHtmlTextareaElementProps extends IHtmlElementProps<HTMLTextAreaElement>
{
	autocapitalize?: AutocapitalizePropType;
	autocomplete?: string;
	autofocus?: boolean;
	cols?: number;
	disabled?: boolean;
	form?: string;
	maxlength?: number;
	minlength?: number;
	name?: string;
	placeholder?: string;
	readonly?: boolean;
	required?: boolean;
	rows?: number;
	spellcheck?: "true" | "default" | "false";
	wrap?: "hard" | "soft" | "off";
}



// <tfoot>
export interface IHtmlTfootElementProps extends IHtmlElementProps<HTMLTableSectionElement>
{
}



// <thead>
export interface IHtmlTHeadElementProps extends IHtmlElementProps<HTMLTableSectionElement>
{
}



// <th>
export interface IHtmlThElementProps extends IHtmlElementProps<HTMLTableHeaderCellElement>
{
	abbr?: string;
	colspan?: number;
	headers?: string;
	rowspan?: number;
	scope?: "row" | "col" | "rowgroup" | "colgroup" | "auto";
	wrap?: "hard" | "soft" | "off";
}



// <time>
export interface IHtmlTimeElementProps extends IHtmlElementProps<HTMLTimeElement>
{
	datetime?: string | Date;
}



// <title>
export interface IHtmlTitleElementProps extends IHtmlElementProps<HTMLTitleElement>
{
}



// <tr>
export interface IHtmlTrElementProps extends IHtmlElementProps<HTMLTableRowElement>
{
}



// <track>
export interface IHtmlTrackElementProps extends IHtmlElementProps<HTMLTrackElement>
{
	default?: boolean;
	kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
	label?: string;
	src?: string;
	srclang?: string;
}



// <video>
export interface IHtmlVideoElementProps extends IHtmlElementProps<HTMLVideoElement>
{
	autoplay?: boolean;
	buffered?: boolean;
	controls?: boolean;
	crossorigin?: CrossoriginPropType;
	height?: number;
	loop?: boolean;
	muted?: boolean;
	playsinline?: boolean;
	preload?: "none" | "metadata" | "auto" | "";
	intrinsicsize?: boolean;
	poster?: string;
	src?: string;
}



// <ul>
export interface IHtmlUlElementProps extends IHtmlElementProps<HTMLUListElement>
{
}



// <xmp>
export interface IHtmlXmpElementProps extends IHtmlElementProps<HTMLPreElement>
{
}



