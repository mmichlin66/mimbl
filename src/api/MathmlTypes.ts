import {CssColor, CssLength} from "mimcss"
import {ExtendedElement} from "./CompTypes"
import {IElementAttrs, IElementEvents, JsxElm} from "./ElementTypes"



/**
 * Defines attributes common to all MathML elements
 */
export interface IMathmlElementAttrs extends IElementAttrs
{
	dir?: "ltr" | "rtl";
    displaystyle?: "true" | "false";

    /** @deprecated */
    mathbackground?: CssColor;

    /** @deprecated */
    mathcolor?: CssColor;

    /** @deprecated */
    mathsize?: CssLength;

    mathvariant?: "normal" | "bold" | "italic" | "bold-italic" | "double-struck" | "bold-fraktur" |
        "script" | "bold-script" | "fraktur" | "sans-serif" | "bold-sans-serif" | "sans-serif-italic" |
        "sans-serif-bold-italic" | "monospace" | "initial" | "tailed" | "looped" | "stretched";
    scriptlevel?: number | `${number}` | `+${number}` | `-${number}`;
}



/**
 * Defines events common to all MathML elements
 */
export interface IMathmlElementEvents extends IElementEvents
{
}



// <math>
export interface IMathmlMathElementAttrs extends IMathmlElementAttrs
{
	display?: "block" | "inline";
}



// <merror>
export interface IMathmlMerrorElementAttrs extends IMathmlElementAttrs
{
}



// <mfrac>
export interface IMathmlMfracElementAttrs extends IMathmlElementAttrs
{
    linethickness?: CssLength
}



// <mi>
export interface IMathmlMiElementAttrs extends IMathmlElementAttrs
{
}



// <mmultiscripts>
export interface IMathmlMmultiscriptsElementAttrs extends IMathmlElementAttrs
{
}



// <mn>
export interface IMathmlMnElementAttrs extends IMathmlElementAttrs
{
}



// <mo>
export interface IMathmlMoElementAttrs extends IMathmlElementAttrs
{
	fence?: boolean;
	lspace?: CssLength;
	maxsize?: CssLength;
	minsize?: CssLength;
	movablelimits?: boolean;
	rspace?: CssLength;
	separator?: boolean;
	stretchy?: boolean;
	symmetric?: boolean;
}



// <mover>
export interface IMathmlMoverElementAttrs extends IMathmlElementAttrs
{
	accent?: boolean;
}



// <mpadded>
export interface IMathmlMpaddedElementAttrs extends IMathmlElementAttrs
{
	depth?: CssLength;
	height?: CssLength;
	lspace?: CssLength;
	voffset?: CssLength;
	width?: CssLength;
}



// <mphantom>
export interface IMathmlMphantomElementAttrs extends IMathmlElementAttrs
{
}



// <mprescripts>
export interface IMathmlMprescriptsElementAttrs extends IMathmlElementAttrs
{
}



// <mroot>
export interface IMathmlMrootElementAttrs extends IMathmlElementAttrs
{
	cite?: string;
}



// <mrow>
export interface IMathmlMrowElementAttrs extends IMathmlElementAttrs
{
}



// <ms>
export interface IMathmlMsElementAttrs extends IMathmlElementAttrs
{
}



// <mspace>
export interface IMathmlMspaceElementAttrs extends IMathmlElementAttrs
{
	depth?: CssLength;
	height?: CssLength;
	width?: CssLength;
}



// <msqrt>
export interface IMathmlMsqrtElementAttrs extends IMathmlElementAttrs
{
}



// <mstyle>
export interface IMathmlMstyleElementAttrs extends IMathmlElementAttrs
{
}



// <msub>
export interface IMathmlMsubElementAttrs extends IMathmlElementAttrs
{
}



// <msubsup>
export interface IMathmlMsubsupElementAttrs extends IMathmlElementAttrs
{
	span?: number | `${number}`;
}



// <msup>
export interface IMathmlMsupElementAttrs extends IMathmlElementAttrs
{
}



// <mtable>
export interface IMathmlMtableElementAttrs extends IMathmlElementAttrs
{
}



// <mtd>
export interface IMathmlMtdElementAttrs extends IMathmlElementAttrs
{
    columnspan?: number | `${number}`;
    rowspan?: number | `${number}`;
}



// <mtext>
export interface IMathmlMtextElementAttrs extends IMathmlElementAttrs
{
	nowrap?: "yes" | "no";
}



// <mtr>
export interface IMathmlMtrElementAttrs extends IMathmlElementAttrs
{
}



// <munder>
export interface IMathmlMunderElementAttrs extends IMathmlElementAttrs
{
	accentunder?: boolean;
}



// <munderover>
export interface IMathmlMunderoverElementAttrs extends IMathmlElementAttrs
{
	accent?: boolean;
	accentunder?: boolean;
}



// <semantics>
export interface IMathmlSemanticsElementAttrs extends IMathmlElementAttrs
{
}



// <semantics>
export interface IMathmlAnnotationElementAttrs extends IMathmlElementAttrs
{
	encoding?: string;
}



// <semantics>
export interface IMathmlAnnotationXmlElementAttrs extends IMathmlElementAttrs
{
	encoding?: string;
}



export interface IMathmlIntrinsicElements
{
    math: ExtendedElement<MathMLElement, IMathmlMathElementAttrs>;
    merror: ExtendedElement<MathMLElement, IMathmlMerrorElementAttrs>;
    mfrac: ExtendedElement<MathMLElement, IMathmlMfracElementAttrs, IElementEvents, [JsxElm, JsxElm]>;
    mi: ExtendedElement<MathMLElement, IMathmlMiElementAttrs>;
    mmultiscripts: ExtendedElement<MathMLElement, IMathmlMmultiscriptsElementAttrs>;
    mn: ExtendedElement<MathMLElement, IMathmlMnElementAttrs>;
    mo: ExtendedElement<MathMLElement, IMathmlMoElementAttrs>;
    mover: ExtendedElement<MathMLElement, IMathmlMoverElementAttrs, IElementEvents, [JsxElm, JsxElm]>;
    mpadded: ExtendedElement<MathMLElement, IMathmlMpaddedElementAttrs>;
    mphantom: ExtendedElement<MathMLElement, IMathmlMphantomElementAttrs>;
    mprescripts: ExtendedElement<MathMLElement, IMathmlMprescriptsElementAttrs>;
    mroot: ExtendedElement<MathMLElement, IMathmlMrootElementAttrs, IElementEvents, [JsxElm, JsxElm]>;
    mrow: ExtendedElement<MathMLElement, IMathmlMrowElementAttrs>;
    ms: ExtendedElement<MathMLElement, IMathmlMsElementAttrs>;
    mspace: ExtendedElement<MathMLElement, IMathmlMspaceElementAttrs>;
    msqrt: ExtendedElement<MathMLElement, IMathmlMsqrtElementAttrs, IElementEvents, JsxElm>;
    mstyle: ExtendedElement<MathMLElement, IMathmlMstyleElementAttrs>;
    msub: ExtendedElement<MathMLElement, IMathmlMsubElementAttrs, IElementEvents, [JsxElm, JsxElm]>;
    msubsup: ExtendedElement<MathMLElement, IMathmlMsubsupElementAttrs, IElementEvents, [JsxElm, JsxElm, JsxElm]>;
    msup: ExtendedElement<MathMLElement, IMathmlMsupElementAttrs, IElementEvents, [JsxElm, JsxElm]>;
    mtable: ExtendedElement<MathMLElement, IMathmlMtableElementAttrs>;
    mtd: ExtendedElement<MathMLElement, IMathmlMtdElementAttrs>;
    mtext: ExtendedElement<MathMLElement, IMathmlMtextElementAttrs>;
    mtr: ExtendedElement<MathMLElement, IMathmlMtrElementAttrs>;
    munder: ExtendedElement<MathMLElement, IMathmlMunderElementAttrs, IElementEvents, [JsxElm, JsxElm]>;
    munderover: ExtendedElement<MathMLElement, IMathmlMunderoverElementAttrs, IElementEvents, [JsxElm, JsxElm, JsxElm]>;
    semantics: ExtendedElement<MathMLElement, IMathmlSemanticsElementAttrs>;
    annotation: ExtendedElement<MathMLElement, IMathmlAnnotationElementAttrs>;
    "annotation-xml": ExtendedElement<MathMLElement, IMathmlAnnotationXmlElementAttrs>;
}



