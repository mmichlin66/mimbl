import {CssColor, MediaStatement} from "mimcss"
import {ICustomWebElements, ExtendedElement} from "./CompTypes"
import {
    ReferrerPolicyPropType, FormtargetPropType, CrossoriginPropType, FormenctypePropType,
    FormmethodPropType, IElementAttrs, IElementEvents, FetchpriorityPropType, IDPropType
} from "./ElementTypes"



/** Type for `sandbox` attribute used for `<iframe>` elements */
export type SandboxPropType = "allow-downloads-without-user-activation" | "allow-downloads" |
    "allow-forms" | "allow-modals" | "allow-orientation-lock" | "allow-pointer-lock" |
    "allow-popups" | "allow-popups-to-escape-sandbox" | "allow-presentation" | "allow-same-origin" |
    "allow-scripts" | "allow-storage-access-by-user-activation" | "allow-top-navigation" |
    "allow-top-navigation-by-user-activation";



/**
 * Defines attributes common to all HTML elements
 */
export interface IHtmlElementAttrs extends IElementAttrs
{
	accesskey?: string | string[];
	autocapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
	autofocus?: boolean;
	contenteditable?: boolean | "true" | "false";
	dir?: "ltr" | "rtl" | "auto";
    enterkeyhint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
    exportparts?: string | string[];
	hidden?: boolean | "" | "hidden" | "until-found";
    inert?: boolean;
	inputmode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
	is?: keyof ICustomWebElements;
	itemid?: string;
	itemprop?: string;
	itemref?: string | string[];
	itemscope?: boolean;
	itemtype?: string;
    nonce?: string;
    part?: string | string[];
	slot?: string;
	spellcheck?: "true" | "false" | "default";
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
	disabled?: boolean;
	form?: IDPropType;
	name?: string;
}



/**
 * Represents elements that are used to link to resources.
 */
export interface IHtmlLinkLikeElementAttrs extends IHtmlElementAttrs
{
	download?: string;
	href?: string;
	hreflang?: string;
	ping?: string | string[];
	referrerpolicy?: ReferrerPolicyPropType;
	rel?: string;
	target?: FormtargetPropType;
}



// <a>
export interface IHtmlAElementAttrs extends IHtmlLinkLikeElementAttrs
{
	type?: string;
}



// <abbr>
export interface IHtmlAbbrElementAttrs extends IHtmlElementAttrs
{
}



// <address>
export interface IHtmlAddressElementAttrs extends IHtmlElementAttrs
{
}



// <area>
export interface IHtmlAreaElementAttrs extends IHtmlLinkLikeElementAttrs
{
	alt?: string;
	coords?: string | number[];
	shape?: "rect" | "circle" | "poly" | "default";
}



// <article>
export interface IHtmlArticleElementAttrs extends IHtmlElementAttrs
{
}



// <aside>
export interface IHtmlAsideElementAttrs extends IHtmlElementAttrs
{
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



// <b>
export interface IHtmlBElementAttrs extends IHtmlElementAttrs
{
	href?: string;
	target?: FormtargetPropType
}



// <base>
export interface IHtmlBaseElementAttrs extends IHtmlElementAttrs
{
	href?: string;
	target?: FormtargetPropType
}



// <bdi>
export interface IHtmlBdiElementAttrs extends IHtmlElementAttrs
{
}



// <bdo>
export interface IHtmlBdoElementAttrs extends IHtmlElementAttrs
{
}



// <blockquote>
export interface IHtmlBlockquoteElementAttrs extends IHtmlElementAttrs
{
	cite?: string;
}



// <body>
export interface IHtmlBodyElementAttrs extends IHtmlElementAttrs
{
}



// <br>
export interface IHtmlBrElementAttrs extends IHtmlElementAttrs
{
}



// <button>
export interface IHtmlButtonElementAttrs extends IHtmlFormFieldElementAttrs
{
	autofocus?: boolean;
	formaction?: string;
	formenctype?:  FormenctypePropType;
	formmethod?: FormmethodPropType;
	formnovalidate?: boolean;
	formtarget?: FormtargetPropType;
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



// <cite>
export interface IHtmlCiteElementAttrs extends IHtmlElementAttrs
{
}



// <code>
export interface IHtmlCodeElementAttrs extends IHtmlElementAttrs
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
	value?: string | number;
}



// <datalist>
export interface IHtmlDataListElementAttrs extends IHtmlElementAttrs
{
}



// <dd>
export interface IHtmlDdElementAttrs extends IHtmlElementAttrs
{
	nowrap?: "yes" | "no";
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



// <dfn>
export interface IHtmlDfnElementAttrs extends IHtmlElementAttrs
{
}



// <dialog>
export interface IHtmlDialogElementAttrs extends IHtmlElementAttrs
{
	open?: boolean;
}



// <div>
export interface IHtmlDivElementAttrs extends IHtmlElementAttrs
{
}



// <dl>
export interface IHtmlDlElementAttrs extends IHtmlElementAttrs
{
}



// <dt>
export interface IHtmlDtElementAttrs extends IHtmlElementAttrs
{
}



// <em>
export interface IHtmlEmElementAttrs extends IHtmlElementAttrs
{
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
}



// <figcaption>
export interface IHtmlFigCaptionElementAttrs extends IHtmlElementAttrs
{
}



// <figure>
export interface IHtmlFigureElementAttrs extends IHtmlElementAttrs
{
}



// <footer>
export interface IHtmlFooterElementAttrs extends IHtmlElementAttrs
{
}



// <form>
export interface IHtmlFormElementAttrs extends IHtmlElementAttrs
{
	acceptCharset?: string;
	action?: string;
	autocomplete?: "on" | "off";
	enctype?: FormenctypePropType;
	method?: FormmethodPropType;
	name?: string;
	novalidate?: boolean;
    rel?: string;
	target?: string | FormtargetPropType;
}



// Represents a base interface for all <h1> to <h6> elements
export interface IHtmlHnElementAttrs extends IHtmlElementAttrs
{
}



// <h1>
export interface IHtmlH1ElementAttrs extends IHtmlHnElementAttrs
{
}



// <h2>
export interface IHtmlH2ElementAttrs extends IHtmlHnElementAttrs
{
}



// <h3>
export interface IHtmlH3ElementAttrs extends IHtmlHnElementAttrs
{
}



// <h4>
export interface IHtmlH4ElementAttrs extends IHtmlHnElementAttrs
{
}



// <h5>
export interface IHtmlH5ElementAttrs extends IHtmlHnElementAttrs
{
}



// <h6>
export interface IHtmlH6ElementAttrs extends IHtmlHnElementAttrs
{
}



// <head>
export interface IHtmlHeadElementAttrs extends IHtmlElementAttrs
{
}



// <header>
export interface IHtmlHeaderElementAttrs extends IHtmlElementAttrs
{
}



// <hgroup>
export interface IHtmlHgroupElementAttrs extends IHtmlElementAttrs
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



// <i>
export interface IHtmlIElementAttrs extends IHtmlElementAttrs
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
	sandbox?: SandboxPropType | SandboxPropType[];
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
    fetchpriority?: FetchpriorityPropType;
	height?: number;
	intrinsicsize?: boolean;
	ismap?: boolean;
	loading?: "eager" | "lazy";
	referrerpolicy?: ReferrerPolicyPropType;
	sizes?: string | string[];
	src?: string;
	srcset?: string | string[];
	width?: number;
	usemap?: string;
}



// <input>
export interface IHtmlInputElementAttrs extends IHtmlFormFieldElementAttrs
{
	// multiple types
	autocomplete?: string;
	max?: string | number | Date;
	list?: IDPropType;
	maxlength?: number;
	min?: string | number | Date;
	minlength?: number;
	multiple?: boolean;
	pattern?: string | RegExp;
	placeholder?: string;
	readonly?: boolean;
	required?: boolean;
	step?: number | "any";
	size?: number;
	type?: "button" | "checkbox" | "color" | "date" | "datetime" | "datetime-local" |
        "email" | "file" | "hidden" | "image" | "month" | "number" | "password" | "radio" |
        "range" | "reset" | "search" | "submit" | "tel" | "text" | "time" | "url" | "week";
	value?: string | number | Date;

    // text and search
    dirname?: string;
    defaultValue?: string;

	// checkbox and radio
	checked?: boolean;
    defaultChecked?: boolean;

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



// <kbd>
export interface IHtmlKbdElementAttrs extends IHtmlElementAttrs
{
}



// <label>
export interface IHtmlLabelElementAttrs extends IHtmlElementAttrs
{
	for?: IDPropType;
	htmlFor?: IDPropType;
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
export interface IHtmlLinkElementAttrs extends IHtmlLinkLikeElementAttrs
{
	as?: string;
	blocking?: "render";
	crossorigin?: CrossoriginPropType;
    fetchpriority?: FetchpriorityPropType;
	href?: string;
	hreflang?: string;
	integrity?: string;
	media?: MediaStatement;
	prefetch?: string;
	sizes?: string;
	type?: string;
}



// <main>
export interface IHtmlMainElementAttrs extends IHtmlElementAttrs
{
}



// <map>
export interface IHtmlMapElementAttrs extends IHtmlElementAttrs
{
	name?: string;
}



// <mark>
export interface IHtmlMarkElementAttrs extends IHtmlElementAttrs
{
}



// <menu>
export interface IHtmlMenuElementAttrs extends IHtmlElementAttrs
{
}



// <menuitem>
export interface IHtmlMenuitemElementAttrs extends IHtmlElementAttrs
{
}



// <meta>
export interface IHtmlMetaElementAttrs extends IHtmlElementAttrs
{
	charset?: string;
	content?: string | number | Date;
	"http-equiv"?: string;
	name?: string;
}



// <meter>
export interface IHtmlMeterElementAttrs extends IHtmlElementAttrs
{
	high?: number;
	low?: number;
	min?: number;
	max?: number;
	optimum?: number;
	value?: number;
}



// <nav>
export interface IHtmlNavElementAttrs extends IHtmlElementAttrs
{
}



// <noscript>
export interface IHtmlNoscriptElementAttrs extends IHtmlElementAttrs
{
}



// <object>
export interface IHtmlObjectElementAttrs extends IHtmlElementAttrs
{
	data?: string;
	form?: IDPropType;
    height?: number;
	name?: string;
	type?: string;
    usemap?: string;
    width?: number;
}



// <ol>
export interface IHtmlOlElementAttrs extends IHtmlElementAttrs
{
	reversed?: boolean;
	start?: number;
	type?: "a" | "A" | "i" | "I" | "1";
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
	for?: IDPropType | IDPropType[];
	htmlFor?: IDPropType | IDPropType[];
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



// <rp>
export interface IHtmlRpElementAttrs extends IHtmlElementAttrs
{
}



// <rt>
export interface IHtmlRtElementAttrs extends IHtmlElementAttrs
{
}



// <ruby>
export interface IHtmlRubyElementAttrs extends IHtmlElementAttrs
{
}



// <s>
export interface IHtmlSElementAttrs extends IHtmlElementAttrs
{
}



// <samp>
export interface IHtmlSampElementAttrs extends IHtmlElementAttrs
{
}



// <script>
export interface IHtmlScriptElementAttrs extends IHtmlElementAttrs
{
	async?: boolean;
	crossorigin?: CrossoriginPropType;
	defer?: boolean;
    fetchpriority?: FetchpriorityPropType;
	integrity?: string;
	nomodule?: boolean;
	nonce?: string;
    referrerpolicy?: ReferrerPolicyPropType;
	src?: string;
	type?: string;
    blocking?: "render";
}



// <section>
export interface IHtmlSectionElementAttrs extends IHtmlElementAttrs
{
}



// <select>
export interface IHtmlSelectElementAttrs extends IHtmlFormFieldElementAttrs
{
	autocomplete?: string;
	multiple?: boolean;
	required?: boolean;
	size?: number;
}



// <slot>
export interface IHtmlSlotElementAttrs extends IHtmlElementAttrs
{
    name?: string
}



// <small>
export interface IHtmlSmallElementAttrs extends IHtmlElementAttrs
{
}



// <source>
export interface IHtmlSourceElementAttrs extends IHtmlElementAttrs
{
    height?: number;
	media?: MediaStatement;
	sizes?: string;
	src?: string;
	srcset?: string | string[];
	type?: string;
    width?: number;
}



// <span>
export interface IHtmlSpanElementAttrs extends IHtmlElementAttrs
{
}



// <strong>
export interface IHtmlStrongElementAttrs extends IHtmlElementAttrs
{
}



// <style>
export interface IHtmlStyleElementAttrs extends IHtmlElementAttrs
{
	media?: MediaStatement;
	nonce?: string;
	title?: string;
    blocking?: "render";
}



// <sub>
export interface IHtmlSubElementAttrs extends IHtmlElementAttrs
{
}



// <summary>
export interface IHtmlSummaryElementAttrs extends IHtmlElementAttrs
{
}



// <sup>
export interface IHtmlSupElementAttrs extends IHtmlElementAttrs
{
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
	headers?: IDPropType | IDPropType[];
	rowspan?: number;
}



// <template>
export interface IHtmlTemplateElementAttrs extends IHtmlElementAttrs
{
    shadowroot?: "open" | "closed";
}



// <textarea>
export interface IHtmlTextareaElementAttrs extends IHtmlFormFieldElementAttrs
{
	autocomplete?: string;
    autocorrect?: "on" | "off";
	cols?: number;
	maxlength?: number;
	minlength?: number;
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



// <th>
export interface IHtmlThElementAttrs extends IHtmlElementAttrs
{
	abbr?: string;
	colspan?: number;
	headers?: IDPropType | IDPropType[];
	rowspan?: number;
	scope?: "row" | "col" | "rowgroup" | "colgroup";
	wrap?: "hard" | "soft" | "off";
}



// <thead>
export interface IHtmlTHeadElementAttrs extends IHtmlElementAttrs
{
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



// <u>
export interface IHtmlUElementAttrs extends IHtmlElementAttrs
{
}



// <ul>
export interface IHtmlUlElementAttrs extends IHtmlElementAttrs
{
}



// <var>
export interface IHtmlVarElementAttrs extends IHtmlElementAttrs
{
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
    poster?: string;
	preload?: "none" | "metadata" | "auto" | "";
	src?: string;
	width?: number;
}



// <wbr>
export interface IHtmlWbrElementAttrs extends IHtmlElementAttrs
{
}



export interface IHtmlIntrinsicElements
{
    a: ExtendedElement<HTMLAnchorElement, IHtmlAElementAttrs>;
    abbr: ExtendedElement<HTMLElement, IHtmlAbbrElementAttrs>;
    address: ExtendedElement<HTMLElement, IHtmlAddressElementAttrs>;
    area: ExtendedElement<HTMLAreaElement, IHtmlAreaElementAttrs>;
    article: ExtendedElement<HTMLElement, IHtmlArticleElementAttrs>;
    aside: ExtendedElement<HTMLElement, IHtmlAsideElementAttrs>;
    audio: ExtendedElement<HTMLAudioElement, IHtmlAudioElementAttrs>;
    b: ExtendedElement<HTMLElement, IHtmlBElementAttrs>;
    base: ExtendedElement<HTMLBaseElement, IHtmlBaseElementAttrs>;
    bdi: ExtendedElement<HTMLElement, IHtmlBdiElementAttrs>;
    bdo: ExtendedElement<HTMLElement, IHtmlBdoElementAttrs>;
    blockquote: ExtendedElement<HTMLQuoteElement, IHtmlBlockquoteElementAttrs>;
    body: ExtendedElement<HTMLElement, IHtmlBodyElementAttrs>;
    br: ExtendedElement<HTMLBRElement, IHtmlBrElementAttrs>;
    button: ExtendedElement<HTMLButtonElement, IHtmlButtonElementAttrs>;
    canvas: ExtendedElement<HTMLCanvasElement, IHtmlCanvasElementAttrs>;
    caption: ExtendedElement<HTMLTableCaptionElement, IHtmlCaptionElementAttrs>;
    cite: ExtendedElement<HTMLElement, IHtmlCiteElementAttrs>;
    code: ExtendedElement<HTMLElement, IHtmlCodeElementAttrs>;
    col: ExtendedElement<HTMLTableColElement, IHtmlColElementAttrs>;
    colgroup: ExtendedElement<HTMLTableColElement, IHtmlColgroupElementAttrs>;
    data: ExtendedElement<HTMLDataElement, IHtmlDataElementAttrs>;
    datalist: ExtendedElement<HTMLDataListElement, IHtmlDataListElementAttrs>;
    dd: ExtendedElement<HTMLElement, IHtmlDdElementAttrs>;
    del: ExtendedElement<HTMLModElement, IHtmlDelElementAttrs>;
    details: ExtendedElement<HTMLDetailsElement, IHtmlDetailsElementAttrs>;
    dfn: ExtendedElement<HTMLElement, IHtmlDfnElementAttrs>;
    dialog: ExtendedElement<HTMLDialogElement, IHtmlDialogElementAttrs>;
    div: ExtendedElement<HTMLDivElement, IHtmlDivElementAttrs>;
    dl: ExtendedElement<HTMLDListElement, IHtmlDlElementAttrs>;
    dt: ExtendedElement<HTMLElement, IHtmlDtElementAttrs>;
    em: ExtendedElement<HTMLElement, IHtmlEmElementAttrs>;
    embed: ExtendedElement<HTMLEmbedElement, IHtmlEmbedElementAttrs>;
    fieldset: ExtendedElement<HTMLFieldSetElement, IHtmlFieldsetElementAttrs>;
    figcaption: ExtendedElement<HTMLElement, IHtmlFigCaptionElementAttrs>;
    figure: ExtendedElement<HTMLElement, IHtmlFigureElementAttrs>;
    footer: ExtendedElement<HTMLElement, IHtmlFooterElementAttrs>;
    form: ExtendedElement<HTMLFormElement, IHtmlFormElementAttrs>;
    h1: ExtendedElement<HTMLHeadingElement, IHtmlH1ElementAttrs>;
    h2: ExtendedElement<HTMLHeadingElement, IHtmlH2ElementAttrs>;
    h3: ExtendedElement<HTMLHeadingElement, IHtmlH3ElementAttrs>;
    h4: ExtendedElement<HTMLHeadingElement, IHtmlH4ElementAttrs>;
    h5: ExtendedElement<HTMLHeadingElement, IHtmlH5ElementAttrs>;
    h6: ExtendedElement<HTMLHeadingElement, IHtmlH6ElementAttrs>;
    head: ExtendedElement<HTMLHeadElement, IHtmlHeadElementAttrs>;
    header: ExtendedElement<HTMLElement, IHtmlHeaderElementAttrs>;
    hgroup: ExtendedElement<HTMLElement, IHtmlHgroupElementAttrs>;
    hr: ExtendedElement<HTMLHRElement, IHtmlHrElementAttrs>;
    html: ExtendedElement<HTMLHtmlElement, IHtmlHtmlElementAttrs>;
    i: ExtendedElement<HTMLElement, IHtmlIElementAttrs>;
    iframe: ExtendedElement<HTMLIFrameElement, IHtmlIframeElementAttrs>;
    img: ExtendedElement<HTMLImageElement, IHtmlImgElementAttrs>;
    input: ExtendedElement<HTMLInputElement, IHtmlInputElementAttrs>;
    ins: ExtendedElement<HTMLModElement, IHtmlInsElementAttrs>;
    kbd: ExtendedElement<HTMLElement, IHtmlKbdElementAttrs>;
    label: ExtendedElement<HTMLLabelElement, IHtmlLabelElementAttrs>;
    legend: ExtendedElement<HTMLLegendElement, IHtmlLegendElementAttrs>;
    li: ExtendedElement<HTMLLIElement, IHtmlLiElementAttrs>;
    link: ExtendedElement<HTMLLinkElement, IHtmlLinkElementAttrs>;
    main: ExtendedElement<HTMLElement, IHtmlMainElementAttrs>;
    map: ExtendedElement<HTMLMapElement, IHtmlMapElementAttrs>;
    mark: ExtendedElement<HTMLElement, IHtmlMarkElementAttrs>;
    menu: ExtendedElement<HTMLMenuElement, IHtmlMenuElementAttrs>;
    menuitem: ExtendedElement<HTMLElement, IHtmlMenuitemElementAttrs>;
    meta: ExtendedElement<HTMLMetaElement, IHtmlMetaElementAttrs>;
    meter: ExtendedElement<HTMLMeterElement, IHtmlMeterElementAttrs>;
    nav: ExtendedElement<HTMLElement, IHtmlNavElementAttrs>;
    noscript: ExtendedElement<HTMLElement, IHtmlNoscriptElementAttrs>;
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
    rp: ExtendedElement<HTMLElement, IHtmlRpElementAttrs>;
    rt: ExtendedElement<HTMLElement, IHtmlRtElementAttrs>;
    ruby: ExtendedElement<HTMLElement, IHtmlRubyElementAttrs>;
    s: ExtendedElement<HTMLElement, IHtmlSElementAttrs>;
    samp: ExtendedElement<HTMLElement, IHtmlSampElementAttrs>;
    script: ExtendedElement<HTMLScriptElement, IHtmlScriptElementAttrs>;
    section: ExtendedElement<HTMLElement, IHtmlSectionElementAttrs>;
    select: ExtendedElement<HTMLSelectElement, IHtmlSelectElementAttrs>;
    slot: ExtendedElement<HTMLSlotElement, IHtmlSlotElementAttrs>;
    small: ExtendedElement<HTMLElement, IHtmlSmallElementAttrs>;
    source: ExtendedElement<HTMLSourceElement, IHtmlSourceElementAttrs>;
    span: ExtendedElement<HTMLSpanElement, IHtmlSpanElementAttrs>;
    strong: ExtendedElement<HTMLElement, IHtmlStrongElementAttrs>;
    style: ExtendedElement<HTMLStyleElement, IHtmlStyleElementAttrs>;
    sub: ExtendedElement<HTMLElement, IHtmlSubElementAttrs>;
    summary: ExtendedElement<HTMLElement, IHtmlSummaryElementAttrs>;
    sup: ExtendedElement<HTMLElement, IHtmlSupElementAttrs>;
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
    u: ExtendedElement<HTMLElement, IHtmlUElementAttrs>;
    ul: ExtendedElement<HTMLUListElement, IHtmlUlElementAttrs>;
    var: ExtendedElement<HTMLElement, IHtmlVarElementAttrs>;
    video: ExtendedElement<HTMLVideoElement, IHtmlVideoElementAttrs, HTMLVideoElementEventMap>;
    wbr: ExtendedElement<HTMLElement, IHtmlWbrElementAttrs>;
}



