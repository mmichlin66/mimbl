import {CssColor, MediaStatement, IIDRule} from "mimcss"
import {
    ReferrerPolicyPropType, FormtargetPropType, CrossoriginPropType, FormenctypePropType,
    FormmethodPropType, ICustomWebElements, IElementAttrs, IElementEvents, ExtendedElement
} from "./CompTypes"



/**
 * Defines attributes common to all HTML elements
 */
export interface IHtmlElementAttrs extends IElementAttrs
{
	accesskey?: string;
	autocapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
	autofocus?: boolean;
	contenteditable?: boolean;
	dir?: "ltr" | "rtl" | "auto";
    enterkeyhint?: string;
    exportparts?: string | string[];
	hidden?: boolean;
	inputmode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
	is?: keyof ICustomWebElements;
	itemid?: string;
	itemprop?: string;
	itemref?: string;
	itemscope?: boolean;
	itemtype?: string;
    nonce?: string;
    part?: string | string[];
	slot?: string;
	spellcheck?: boolean | "true" | "false";
	title?: string;
	translate?: boolean | "yes" | "no";
}



/**
 * Defines events common to all HTML elements
 */
export interface IHtmlElementEvents extends IElementEvents
{
}



/**
 * Represents elements that can be used as fields in a form; that is, they can be associated with
 * a form.
 */
export interface IHtmlFormFieldElementAttrs extends IHtmlElementAttrs
{
	form?: string | IIDRule;
}



// <a>
export interface IHtmlAElementAttrs extends IHtmlElementAttrs
{
	download?: string;
	href?: string;
	hreflang?: string;
	ping?: string | string[];
	referrerpolicy?: ReferrerPolicyPropType;
	rel?: string;
	target?: FormtargetPropType;
	type?: string;
}



// <area>
export interface IHtmlAreaElementAttrs extends IHtmlElementAttrs
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
export interface IHtmlAudioElementAttrs extends IHtmlElementAttrs
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
export interface IHtmlBaseElementAttrs extends IHtmlElementAttrs
{
	href?: string;
	target?: FormtargetPropType
}



// <blockquote>
export interface IHtmlBlockquoteElementAttrs extends IHtmlElementAttrs
{
	cite?: string;
}



// <br>
export interface IHtmlBrElementAttrs extends IHtmlElementAttrs
{
}



// <button>
export interface IHtmlButtonElementAttrs extends IHtmlFormFieldElementAttrs
{
	autofocus?: boolean;
	disabled?: boolean;
	formaction?: string;
	formenctype?:  FormenctypePropType;
	formmethod?: FormmethodPropType;
	formnovalidate?: boolean;
	formtarget?: FormtargetPropType;
	name?: string;
	type?: "submit" | "reset" | "button";
	value?: string;
}



// <canvas>
export interface IHtmlCanvasElementAttrs extends IHtmlElementAttrs
{
	height?: number;
	width?: number;
}



// <caption>
export interface IHtmlCaptionElementAttrs extends IHtmlElementAttrs
{
}



// <col>
export interface IHtmlColElementAttrs extends IHtmlElementAttrs
{
	span?: number;
}



// <colgroup>
export interface IHtmlColgroupElementAttrs extends IHtmlElementAttrs
{
}



// <data>
export interface IHtmlDataElementAttrs extends IHtmlElementAttrs
{
	value?: string | number | boolean;
}



// <datalist>
export interface IHtmlDataListElementAttrs extends IHtmlElementAttrs
{
}



// <dd>
export interface IHtmlDdElementAttrs extends IHtmlElementAttrs
{
	nowrap?: boolean;
}



// <del>
export interface IHtmlDelElementAttrs extends IHtmlElementAttrs
{
	cite?: string;
	datetime?: string | Date;
}



// <details>
export interface IHtmlDetailsElementAttrs extends IHtmlElementAttrs
{
	open?: boolean;
}



// <dialog>
export interface IHtmlDialogElementAttrs extends IHtmlElementAttrs
{
	open?: boolean;
}



// <div>
export interface IHtmlDivElementAttrs extends IHtmlElementAttrs
{
	noWrap?: boolean;
}



// <dl>
export interface IHtmlDlElementAttrs extends IHtmlElementAttrs
{
	compact?: boolean;
}



// <embed>
export interface IHtmlEmbedElementAttrs extends IHtmlElementAttrs
{
	height?: number;
	src?: string;
	type?: string;
	width?: number;
}



// <fieldset>
export interface IHtmlFieldsetElementAttrs extends IHtmlFormFieldElementAttrs
{
	disabled?: boolean;
	name?: string;
}



// <form>
export interface IHtmlFormElementAttrs extends IHtmlElementAttrs
{
	acceptCharset?: string | "UNKNOWN";
	action?: string;
	autocomplete?: boolean;
	enctype?: FormenctypePropType;
	method?: FormmethodPropType;
	name?: string;
	novalidate?: boolean;
	target?: string | FormtargetPropType;
}



// <h1>
export interface IHtmlH1ElementAttrs extends IHtmlElementAttrs
{
}



// <h2>
export interface IHtmlH2ElementAttrs extends IHtmlElementAttrs
{
}



// <h3>
export interface IHtmlH3ElementAttrs extends IHtmlElementAttrs
{
}



// <h4>
export interface IHtmlH4ElementAttrs extends IHtmlElementAttrs
{
}



// <h5>
export interface IHtmlH5ElementAttrs extends IHtmlElementAttrs
{
}



// <h6>
export interface IHtmlH6ElementAttrs extends IHtmlElementAttrs
{
}



// <head>
export interface IHtmlHeadElementAttrs extends IHtmlElementAttrs
{
}



// <hr>
export interface IHtmlHrElementAttrs extends IHtmlElementAttrs
{
	align?: string;
	color?: CssColor;
	noshade?: boolean;
	size?: number;
	width?: number;
}



// <html>
export interface IHtmlHtmlElementAttrs extends IHtmlElementAttrs
{
}



// <iframe>
export interface IHtmlIframeElementAttrs extends IHtmlElementAttrs
{
	allow?: string;
	allowfullscreen?: boolean;
	allowpaymentrequest?: boolean;
	csp?: string;
	height?: number;
	loading?: "eager" | "lazy";
	name?: string;
	referrerpolicy?: ReferrerPolicyPropType;
	sandbox?: string;
	src?: string | "about:blank";
	srcdoc?: string;
	width?: number;
}



// <img>
export interface IHtmlImgElementAttrs extends IHtmlElementAttrs
{
	alt?: string;
	crossorigin?: CrossoriginPropType;
	decoding?: "auto" | "sync" | "async";
	height?: number;
	intrinsicsize?: boolean;
	ismap?: boolean;
	loading?: "eager" | "lazy";
	referrerpolicy?: ReferrerPolicyPropType;
	sizes?: string;
	src?: string;
	srcset?: string;
	width?: number;
	usemap?: string;
}



// <input>
export interface IHtmlInputElementAttrs extends IHtmlFormFieldElementAttrs
{
	autocomplete?: string | boolean;
	disabled?: boolean;
	list?: string;
	name?: string;
	readonly?: boolean;
	required?: boolean;
	type?: "button" | "checkbox" | "color" | "date" | "datetime" | "datetime-local" |
        "email" | "file" | "hidden" | "image" | "month" | "number" | "password" | "radio" |
        "range" | "reset" | "search" | "submit" | "tel" | "text" | "time" | "url" | "week";
	value?: string;

	// checkbox and radio
	checked?: boolean;

    // special properties to set value only first time
    defaultValue?: string;
    defaultChecked?: boolean;

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
}



// <ins>
export interface IHtmlInsElementAttrs extends IHtmlElementAttrs
{
	cite?: string;
	datetime?: string | Date;
}



// <label>
export interface IHtmlLabelElementAttrs extends IHtmlFormFieldElementAttrs
{
	for?: string | IIDRule;
	htmlFor?: string | IIDRule;
}



// <legend>
export interface IHtmlLegendElementAttrs extends IHtmlElementAttrs
{
}



// <li>
export interface IHtmlLiElementAttrs extends IHtmlElementAttrs
{
	value?: number;
	type?: "a" | "A" | "i" | "vsides" | "I" | "1";
}



// <link>
export interface IHtmlLinkElementAttrs extends IHtmlElementAttrs
{
	as?: string;
	crossorigin?: CrossoriginPropType;
	href?: string;
	hrefLang?: string;
	integrity?: string;
	media?: MediaStatement;
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
export interface IHtmlListingElementAttrs extends IHtmlElementAttrs
{
}



// <map>
export interface IHtmlMapElementAttrs extends IHtmlElementAttrs
{
	name?: string;
}



// <menu>
export interface IHtmlMenuElementAttrs extends IHtmlElementAttrs
{
}



// <meta>
export interface IHtmlMetaElementAttrs extends IHtmlElementAttrs
{
	charset?: string;
	content?: string;
	httpEquiv?: string;
	name?: string;
}



// <meter>
export interface IHtmlMeterElementAttrs extends IHtmlFormFieldElementAttrs
{
	high?: number;
	low?: number;
	min?: number;
	max?: number;
	optimum?: number;
	value?: number;
}



// <object>
export interface IHtmlObjectElementAttrs extends IHtmlElementAttrs
{
	charset?: string;
	content?: string;
	httpEquiv?: string;
	name?: string;
}



// <ol>
export interface IHtmlOlElementAttrs extends IHtmlElementAttrs
{
	reversed?: boolean;
	start?: number;
	type?: "a" | "A" | "i" | "I" | "1";
	name?: string;
}



// <optgroup>
export interface IHtmlOptgroupElementAttrs extends IHtmlElementAttrs
{
	disabled?: boolean;
	label: string;	// mandatory
}



// <option>
export interface IHtmlOptionElementAttrs extends IHtmlElementAttrs
{
	disabled?: boolean;
	label?: string;
	selected?: boolean;
	value?: string;
}



// <output>
export interface IHtmlOutputElementAttrs extends IHtmlFormFieldElementAttrs
{
	for?: string | IIDRule | (string | IIDRule)[];
	htmlFor?: string | IIDRule | (string | IIDRule)[];
	name?: string;
}



// <p>
export interface IHtmlPElementAttrs extends IHtmlElementAttrs
{
}



// <param>
export interface IHtmlParamElementAttrs extends IHtmlElementAttrs
{
	name?: string;
	value?: string;
}



// <picture>
export interface IHtmlPictureElementAttrs extends IHtmlElementAttrs
{
}



// <pre>
export interface IHtmlPreElementAttrs extends IHtmlElementAttrs
{
}



// <progress>
export interface IHtmlProgressElementAttrs extends IHtmlElementAttrs
{
	max?: number;
	value?: number;
}



// <q>
export interface IHtmlQElementAttrs extends IHtmlElementAttrs
{
	cite?: string;
}



// <script>
export interface IHtmlScriptElementAttrs extends IHtmlElementAttrs
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
export interface IHtmlSelectElementAttrs extends IHtmlFormFieldElementAttrs
{
	autocomplete?: string;
	disabled?: boolean;
	multiple?: boolean;
	name?: string;
	required?: boolean;
	size?: number;
}



// <slot>
export interface IHtmlSlotElementAttrs extends IHtmlElementAttrs
{
}



// <source>
export interface IHtmlSourceElementAttrs extends IHtmlElementAttrs
{
	media?: MediaStatement;
	sizes?: string;
	src?: string;
	srcset?: string;
	type?: string;
}



// <span>
export interface IHtmlSpanElementAttrs extends IHtmlElementAttrs
{
}



// <style>
export interface IHtmlStyleElementAttrs extends IHtmlElementAttrs
{
	media?: MediaStatement;
	nonce?: string;
	title?: string;
	type?: string;
}



// <table>
export interface IHtmlTableElementAttrs extends IHtmlElementAttrs
{
}



// <tbody>
export interface IHtmlTbodyElementAttrs extends IHtmlElementAttrs
{
}



// <td>
export interface IHtmlTdElementAttrs extends IHtmlElementAttrs
{
	colspan?: number;
	headers?: string;
	rowspan?: number;
	width?: number;
}



// <template>
export interface IHtmlTemplateElementAttrs extends IHtmlElementAttrs
{
}



// <textarea>
export interface IHtmlTextareaElementAttrs extends IHtmlFormFieldElementAttrs
{
	autocomplete?: string;
	cols?: number;
	disabled?: boolean;
	maxlength?: number;
	minlength?: number;
	name?: string;
	placeholder?: string;
	readonly?: boolean;
	required?: boolean;
	rows?: number;
	wrap?: "hard" | "soft" | "off";
}



// <tfoot>
export interface IHtmlTfootElementAttrs extends IHtmlElementAttrs
{
}



// <thead>
export interface IHtmlTHeadElementAttrs extends IHtmlElementAttrs
{
}



// <th>
export interface IHtmlThElementAttrs extends IHtmlElementAttrs
{
	abbr?: string;
	colspan?: number;
	headers?: string;
	rowspan?: number;
	scope?: "row" | "col" | "rowgroup" | "colgroup" | "auto";
	wrap?: "hard" | "soft" | "off";
}



// <time>
export interface IHtmlTimeElementAttrs extends IHtmlElementAttrs
{
	datetime?: string | Date;
}



// <title>
export interface IHtmlTitleElementAttrs extends IHtmlElementAttrs
{
}



// <tr>
export interface IHtmlTrElementAttrs extends IHtmlElementAttrs
{
}



// <track>
export interface IHtmlTrackElementAttrs extends IHtmlElementAttrs
{
	default?: boolean;
	kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
	label?: string;
	src?: string;
	srclang?: string;
}



// <video>
export interface IHtmlVideoElementAttrs extends IHtmlElementAttrs
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
export interface IHtmlUlElementAttrs extends IHtmlElementAttrs
{
}



export interface IHtmlIntrinsicElements
{
    a: ExtendedElement<HTMLAnchorElement, IHtmlAElementAttrs>;
    abbr: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    address: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    area: ExtendedElement<HTMLAreaElement, IHtmlAreaElementAttrs>;
    article: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    aside: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    audio: ExtendedElement<HTMLAudioElement, IHtmlAudioElementAttrs>;
    b: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    base: ExtendedElement<HTMLBaseElement, IHtmlBaseElementAttrs>;
    bdi: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    bdo: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    blockquote: ExtendedElement<HTMLQuoteElement, IHtmlBlockquoteElementAttrs>;
    body: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    br: ExtendedElement<HTMLBRElement, IHtmlBrElementAttrs>;
    button: ExtendedElement<HTMLButtonElement, IHtmlButtonElementAttrs>;
    canvas: ExtendedElement<HTMLCanvasElement, IHtmlCanvasElementAttrs>;
    caption: ExtendedElement<HTMLTableCaptionElement, IHtmlCaptionElementAttrs>;
    cite: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    code: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    col: ExtendedElement<HTMLTableColElement, IHtmlColElementAttrs>;
    colgroup: ExtendedElement<HTMLTableColElement, IHtmlColgroupElementAttrs>;
    data: ExtendedElement<HTMLDataElement, IHtmlDataElementAttrs>;
    datalist: ExtendedElement<HTMLDataListElement, IHtmlDataListElementAttrs>;
    dd: ExtendedElement<HTMLElement, IHtmlDdElementAttrs>;
    del: ExtendedElement<HTMLModElement, IHtmlDelElementAttrs>;
    details: ExtendedElement<HTMLDetailsElement, IHtmlDetailsElementAttrs>;
    dfn: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    dialog: ExtendedElement<HTMLDialogElement, IHtmlDialogElementAttrs>;
    div: ExtendedElement<HTMLDivElement, IHtmlDivElementAttrs>;
    dl: ExtendedElement<HTMLDListElement, IHtmlDlElementAttrs>;
    dt: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    em: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    embed: ExtendedElement<HTMLEmbedElement, IHtmlEmbedElementAttrs>;
    fieldset: ExtendedElement<HTMLFieldSetElement, IHtmlFieldsetElementAttrs>;
    figcaption: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    figure: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    footer: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    form: ExtendedElement<HTMLFormElement, IHtmlFormElementAttrs>;
    h1: ExtendedElement<HTMLHeadingElement, IHtmlH1ElementAttrs>;
    h2: ExtendedElement<HTMLHeadingElement, IHtmlH2ElementAttrs>;
    h3: ExtendedElement<HTMLHeadingElement, IHtmlH3ElementAttrs>;
    h4: ExtendedElement<HTMLHeadingElement, IHtmlH4ElementAttrs>;
    h5: ExtendedElement<HTMLHeadingElement, IHtmlH5ElementAttrs>;
    h6: ExtendedElement<HTMLHeadingElement, IHtmlH6ElementAttrs>;
    head: ExtendedElement<HTMLHeadElement, IHtmlHeadElementAttrs>;
    header: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    hgroup: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    hr: ExtendedElement<HTMLHRElement, IHtmlHrElementAttrs>;
    html: ExtendedElement<HTMLHtmlElement, IHtmlHtmlElementAttrs>;
    i: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    iframe: ExtendedElement<HTMLIFrameElement, IHtmlIframeElementAttrs>;
    img: ExtendedElement<HTMLImageElement, IHtmlImgElementAttrs>;
    input: ExtendedElement<HTMLInputElement, IHtmlInputElementAttrs>;
    ins: ExtendedElement<HTMLModElement, IHtmlInsElementAttrs>;
    kbd: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    keygen: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    label: ExtendedElement<HTMLLabelElement, IHtmlLabelElementAttrs>;
    legend: ExtendedElement<HTMLLegendElement, IHtmlLegendElementAttrs>;
    li: ExtendedElement<HTMLLIElement, IHtmlLiElementAttrs>;
    link: ExtendedElement<HTMLLinkElement, IHtmlLinkElementAttrs>;
    listing: ExtendedElement<HTMLPreElement, IHtmlListingElementAttrs>;
    main: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    map: ExtendedElement<HTMLMapElement, IHtmlMapElementAttrs>;
    mark: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    menu: ExtendedElement<HTMLMenuElement, IHtmlMenuElementAttrs>;
    menuitem: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    meta: ExtendedElement<HTMLMetaElement, IHtmlMetaElementAttrs>;
    meter: ExtendedElement<HTMLMeterElement, IHtmlMeterElementAttrs>;
    nav: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    noscript: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    object: ExtendedElement<HTMLObjectElement, IHtmlObjectElementAttrs>;
    ol: ExtendedElement<HTMLOListElement, IHtmlOlElementAttrs>;
    optgroup: ExtendedElement<HTMLOptGroupElement, IHtmlOptgroupElementAttrs>;
    option: ExtendedElement<HTMLOptionElement, IHtmlOptionElementAttrs>;
    output: ExtendedElement<HTMLOutputElement, IHtmlOutputElementAttrs>;
    p: ExtendedElement<HTMLParagraphElement, IHtmlPElementAttrs>;
    param: ExtendedElement<HTMLElement, IHtmlParamElementAttrs>;
    picture: ExtendedElement<HTMLPictureElement, IHtmlPictureElementAttrs>;
    pre: ExtendedElement<HTMLPreElement, IHtmlPreElementAttrs>;
    progress: ExtendedElement<HTMLProgressElement, IHtmlProgressElementAttrs>;
    q: ExtendedElement<HTMLQuoteElement, IHtmlQElementAttrs>;
    rp: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    rt: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    rtc: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    ruby: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    s: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    samp: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    script: ExtendedElement<HTMLScriptElement, IHtmlScriptElementAttrs>;
    section: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    select: ExtendedElement<HTMLSelectElement, IHtmlSelectElementAttrs>;
    slot: ExtendedElement<HTMLSlotElement, IHtmlSlotElementAttrs>;
    small: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    source: ExtendedElement<HTMLSourceElement, IHtmlSourceElementAttrs>;
    span: ExtendedElement<HTMLSpanElement, IHtmlSpanElementAttrs>;
    strong: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    style: ExtendedElement<HTMLStyleElement, IHtmlStyleElementAttrs>;
    sub: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    summary: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    sup: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    table: ExtendedElement<HTMLTableElement, IHtmlTableElementAttrs>;
    tbody: ExtendedElement<HTMLTableSectionElement, IHtmlTbodyElementAttrs>;
    td: ExtendedElement<HTMLTableCellElement, IHtmlTdElementAttrs>;
    template: ExtendedElement<HTMLTemplateElement, IHtmlTemplateElementAttrs>;
    textarea: ExtendedElement<HTMLTextAreaElement, IHtmlTextareaElementAttrs>;
    tfoot: ExtendedElement<HTMLTableSectionElement, IHtmlTfootElementAttrs>;
    th: ExtendedElement<HTMLTableCellElement, IHtmlThElementAttrs>;
    thead: ExtendedElement<HTMLTableSectionElement, IHtmlTHeadElementAttrs>;
    time: ExtendedElement<HTMLTimeElement, IHtmlTimeElementAttrs>;
    title: ExtendedElement<HTMLTitleElement, IHtmlTitleElementAttrs>;
    tr: ExtendedElement<HTMLTableRowElement, IHtmlTrElementAttrs>;
    track: ExtendedElement<HTMLTrackElement, IHtmlTrackElementAttrs>;
    u: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    ul: ExtendedElement<HTMLUListElement, IHtmlUlElementAttrs>;
    var: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
    video: ExtendedElement<HTMLVideoElement, IHtmlVideoElementAttrs, HTMLVideoElementEventMap>;
    wbr: ExtendedElement<HTMLElement, IHtmlElementAttrs>;
}



