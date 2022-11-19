import {MediaStatement} from "mimcss";
import {
    ReferrerPolicyPropType, FormtargetPropType, CrossoriginPropType, IElementAttrs, ExtendedElement
} from "./CompTypes";



/**
 * The ISvgElementAttrs interface defines standard properties (attributes and event listeners)
 * that can be used on all SVG elements.
 */
export interface ISvgElementAttrs extends IElementAttrs
{
}



export type PreserveAspectRatioPropType = "none" | "xMinYMin" | "xMidYMin" | "xMaxYMin" |
    "xMinYMid" | "xMidYMid" | "xMaxYMid" | "xMinYMax" | "xMidYMax" | "xMaxYMax" | "meet" | "slice";

export type	SvgInPropType = string | "SourceGraphic" | "SourceAlpha" | "BackgroundImage" |
    "BackgroundAlpha" | "FillPaint" | "StrokePaint";

export type UnitsPropType = "userSpaceOnUse" | "objectBoundingBox";

export type LengthAdjustPropType = "spacing" | "spacingAndGlyphs";



/** The ISvgConditionalProcessingProps interface defines SVG Conditional Processing Attributes. */
export interface ISvgConditionalProcessingAttrs extends ISvgElementAttrs
{
	externalResourcesRequired?: boolean;
	requiredExtensions?: string;
	requiredFeatures?: string;
	systemLanguage?: string;
}



/** The ISvgPresentationProps interface defines SVG Presentation Attributes. */
export interface ISvgPresentationAttrs extends ISvgElementAttrs
{
	"alignment-baseline"?: "auto" | "baseline" | "before-edge" | "text-before-edge" | "middle" | "central" | "after-edge" | "text-after-edge" | "ideographic" | "alphabetic" | "hanging" | "mathematical" | "inherit";
	"baseline-shift"?: string | number | "auto" | "baseline" | "super" | "sub" | "<percentage>" | "<length>" | "inherit";
	"clip"?: string;
	"clip-path"?: string;
	"clip-rule"?: "nonzero" | "evenodd" | "inherit";
	"color"?: string;
	"color-interpolation"?: "auto" | "sRGB" | "linearRGB" | "inherit";
	"color-interpolationFilters"?: "auto" | "sRGB" | "linearRGB" | "inherit";
	"color-profile"?: string | "auto" | "sRGB" | "<name>" | "inherit";
	"color-rendering"?: "auto" | "optimizeSpeed" | "optimizeQuality" | "inherit";
	"cursor"?: "auto" | "crosshair" | "default" | "pointer" | "move" | "e-resize" | "ne-resize" | "nw-resize" | "n-resize" | "se-resize" | "sw-resize" | "s-resize" | "w-resize| text" | "wait" | "help" | "inherit";
	"direction"?: "ltr" | "rtl" | "inherit";
	"display"?: "inline" | "block" | "list-item" | "run-in" | "compact" | "marker" | "table" | "inline-table" | "table-row-group" | "table-header-group" | "table-footer-group" | "table-row" | "table-column-group" | "table-column" | "table-cell" | "table-caption" | "none" | "inherit" | "flex" | "grid";
	"dominant-baseline"?: "auto" | "use-script" | "no-change" | "reset-size" | "ideographic" | "alphabetic" | "hanging" | "mathematical" | "central" | "middle" | "text-after-edge" | "text-before-edge" | "inherit";
	"enable-background"?: string;
	"fill"?: string;
	"fill-opacity"?: string | number;
	"fill-rule"?: "nonzero" | "evenodd";
	"filter"?: string | "none" | "inherit";
	"font-family"?: string;
	"font-size"?: number | "none" | "inherit";
	"font-sizeAdjust"?: number | "none" | "inherit";
	"font-stretch"?: "normal" | "wider" | "narrower" | "ultra-condensed" | "extra-condensed" | "condensed" | "semi-condensed" | "semi-expanded" | "expanded" | "extra-expanded" | "ultra-expanded" | "inherit";
	"font-style"?: "normal" | "italic" | "oblique" | "inherit";
	"font-variant"?: "normal" | "small-caps" | "inherit";
	"font-weight"?: "normal" | "bold" | "bolder" | "lighter" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "inherit";
	"glyph-orientationHorizontal"?: string;
	"glyph-orientationVertical"?: string;
	"image-rendering"?: "auto" | "optimizeSpeed" | "optimizeQuality" | "inherit";
	"kerning"?: string | number | "auto" | "inherit";
	"letter-spacing"?: string | number | "normal" | "inherit";
	"lighting-color"?: string;
	"marker-end"?: string;
	"marker-mid"?: string;
	"marker-start"?: string;
	"mask"?: string;
	"opacity"?: string | number;
	"overflow"?: "visible" | "hidden" | "scroll" | "auto" | "inherit";
	"pointer-events"?: "bounding-box" | "visiblePainted" | "visibleFill" | "visibleStroke" | "visible" | "painted" | "fill" | "stroke" | "all" | "none";
	"shape-rendering"?: "auto" | "optimizeSpeed" | "crispEdges" | "geometricPrecision" | "inherit";
	"stroke"?: string;
	"stroke-dasharray"?: string;
	"stroke-dashoffset"?: string | number;
	"stroke-linecap"?: "butt" | "round" | "square";
	"stroke-linejoin"?: "arcs" | "bevel |miter" | "miter-clip" | "round";
	"stroke-miterlimit"?: number;
	"stroke-opacity"?: string | number;
	"stroke-width"?: string | number;
	"text-anchor"?: "start" | "middle" | "end" | "inherit";
	"transform"?: string;
	"text-decoration"?: "none" | "underline" | "overline" | "line-through" | "blink" | "inherit";
	"text-rendering"?: "auto" | "optimizeSpeed" | "optimizeLegibility" | "geometricPrecision" | "inherit";
	"unicode-bidi"?: string;
	"vector-effect"?: string;
	"visibility"?: "visible" | "hidden" | "collapse" | "inherit";
	"word-spacing"?: string | number;
	"writing-mode"?: "lr-tb" | "rl-tb" | "tb-rl" | "lr" | "rl" | "tb" | "inherit";
}



/** The ISvgFilterPrimitiveProps interface defines SVG Filters Attributes. */
export interface ISvgFilterPrimitiveAttrs extends ISvgElementAttrs
{
	height?: string | number;
	result?: string;
	width?: string | number;
	x?: string | number;
	y?: string | number;
}



/** The ISvgTransferFunctionProps interface defines SVG Tarnsfer Function Attributes. */
export interface ISvgTransferFunctionsAttrs extends ISvgElementAttrs
{
	type?: "identity" | "table" | "discrete" | "linear" | "gamma";
	tableValues?: string;
	slope?: string;
	intercept?: string;
	amplitude?: string;
	exponent?: string;
	offset?: string;
}



/** The ISvgAnimationProps interface defines SVG Animation Attributes. */
export interface ISvgAnimationAttrs extends ISvgElementAttrs
{
	attributeType?: string;
	attributeName?: string;
	begin?: string;
	dur?: string;
	end?: string;
	min?: string;
	max?: string;
	restart?: "always" | "whenNotActive" | "never";
	repeatCount?: string | number;
	repeatDur?: string;
	fill?: "freeze" | "remove";
	calcMode?: "discrete" | "linear" | "paced" | "spline";
	values?: string;
	keyTimes?: string;
	keySplines?: string;
	from?: string | number;
	to?: string | number;
	by?: string;
	autoReverse?: string;
	accelerate?: string;
	decelerate?: string;
	additive?: "replace" | "sum";
	accumulate?: "none" | "sum";
}



// <svg>
export interface ISvgSvgElementProps extends ISvgConditionalProcessingAttrs
{
	height?: string | number;
	preserveAspectRatio?: PreserveAspectRatioPropType;
	viewBox?: string;
	width?: string | number;
	x?: string | number;
	y?: string | number;
}



// <a> (<svgA>)
export interface ISvgAElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	download?: boolean;
	href?: string;
	hreflang?: string;
	ping?: string;
	referrerpolicy?: ReferrerPolicyPropType;
	rel?: string;
	target?: FormtargetPropType;
	type?: string;
}



// <animateMotion>
export interface ISvgAnimateMotionElementProps extends ISvgConditionalProcessingAttrs, ISvgAnimationAttrs
{
	calcMode?: "discrete" | "linear" | "paced" | "spline";
	path?: string;
	keyPoints?: string;
	rotate?: string;
	origin?: string;
}



// <circle>
export interface ISvgCircleElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	cx: string | number;
	cy: string | number;
	r: string | number;
	pathLength?: number;
}



// <clipPath>
export interface ISvgClipPathElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	clipPathUnits?: UnitsPropType;
}



// <color-profile>
export interface ISvgColorProfilePathElementProps extends ISvgElementAttrs
{
	local?: string;
	name?: string;
	"rendering-intent"?: string;
}



// <discard>
export interface ISvgDiscardElementProps extends ISvgConditionalProcessingAttrs
{
	begin?: string;
	href?: string;
}



// <ellipse>
export interface ISvgEllipseElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	cx: string | number;
	cy: string | number;
	rx: string | number;
	ry: string | number;
	pathLength?: number;
}



// <feBlend>
export interface ISvgFeBlendElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
	in2?: SvgInPropType;
	mode?: "normal" | "multiply" | "screen" | "darken" | "lighten";
}



// <feColorMatrix>
export interface ISvgFeColorMatrixElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
	type?: "matrix" | "saturate" | "hueRotate" | "luminanceToAlpha";
	values?: string | number;
}



// <feComponentTransfer>
export interface ISvgFeComponentTransferElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
}



// <feComposite>
export interface ISvgFeCompositeElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
	in2?: SvgInPropType;
	mode?: "normal" | "multiply" | "screen" | "darken" | "lighten";
	opertor?: "over" | "in" | "out" | "atop" | "xor" | "arithmetic";
	k1?: number;
	k2?: number;
	k3?: number;
	k4?: number;
}



// <feConvolveMatrix>
export interface ISvgFeConvolveMatrixElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	bias?: number;
	divisor?: number;
	edgeMode?: "duplicate" | "wrap" | "none";
	in?: string | "SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint";
	kernelMatrix?: string;
	kernelUnitLength?: string;
	order?: string;
	preserveAlpha?: boolean;
	targetX?: number;
	targetY?: number;
}



// <feDiffuseLighting>
export interface ISvgFeDiffuseLightingElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: string | "SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint";
	surfaceScale?: number;
	diffuseConstant?: number;
	kernelUnitLength?: string;
}



// <feDisplacementMap>
export interface ISvgFeDisplacementMapElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
	in2?: SvgInPropType;
	scale?: number;
	xChannelSelector?: "R" | "G" | "B" | "A";
	yChannelSelector?: "R" | "G" | "B" | "A";
}



// <feDistantLight>
export interface ISvgFeDistantLightElementProps extends ISvgElementAttrs
{
	azimuth?: number;
	elevation?: number;
}



// <feDropShadow>
export interface ISvgFeDropShadowElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
	stdDeviation?: string;
	dx?: string | number;
	dy?: string | number;
}



// <feFlood>
export interface ISvgFeFloodElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	"flood-color"?: string;
	"flood-opacity"?: string | number;
}



// <feGaussianBlur>
export interface ISvgFeGaussianBlurElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
	stdDeviation?: string;
	edgeMode?: "duplicate" | "wrap" | "none";
}



// <feImage>
export interface ISvgFeImageElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	preserveAspectRatio?: PreserveAspectRatioPropType;
	stdDeviation?: string;
	edgeMode?: "duplicate" | "wrap" | "none";
}



// <feMergeNode>
export interface ISvgFeMergeNodeElementProps extends ISvgElementAttrs
{
	in?: SvgInPropType;
}



// <feMorphology>
export interface ISvgFeMorphologyElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
	operator?: "over" | "in" | "out" | "atop" | "xor" | "arithmetic?: string";
	radius?: string;
}



// <feOffset>
export interface ISvgFeOffsetElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
	dx?: string | number;
	dy?: string | number;
}



// <fePointLight>
export interface ISvgFePointLightElementProps extends ISvgElementAttrs
{
	x?: number;
	y?: number;
	z?: number;
}



// <feSpecularLighting>
export interface ISvgFeSpecularLightingElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
	surfaceScale?: number;
	specularConstant?: number;
	specularExponent?: number;
	kernelUnitLength?: string;
}



// <feSpotLight>
export interface ISvgFeSpotLightElementProps extends ISvgElementAttrs
{
	x?: number;
	y?: number;
	z?: number;
	pointsAtX?: number;
	pointsAtY?: number;
	pointsAtZ?: number;
	specularExponent?: number;
	limitingConeAngle?: number;
}



// <feTile>
export interface ISvgFeTileElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	in?: SvgInPropType;
}



// <feTurbulence>
export interface ISvgFeTurbulenceElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	baseFrequency?: string;
	numOctaves?: number;
	seed?: number;
	stitchTiles?: "noStitch" | "stitch";
	type?: "fractalNoise" | "turbulence";
}



// <filter>
export interface ISvgFilterElementProps extends ISvgPresentationAttrs
{
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
	filterRes?: string;
	filterUnits?: UnitsPropType;
	primitiveUnits?: UnitsPropType;
}



// <foreignObject>
export interface ISvgForeignObjectElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
}



// <hatch>
export interface ISvgHatchElementProps extends ISvgPresentationAttrs
{
	x?: string | number;
	y?: string | number;
	pitch?: string;
	rotate?: string;
	hatchUnits?: string;
	hatchContentUnits?: string;
	href?: string;
}



// <hatchPath>
export interface ISvgHatchpathElementProps extends ISvgPresentationAttrs
{
	d?: string;
	offset?: string;
}



// <image>
export interface ISvgImageElementProps extends ISvgPresentationAttrs, ISvgFilterPrimitiveAttrs
{
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
	preserveAspectRatio?: PreserveAspectRatioPropType;
	href?: string;
}



// <line>
export interface ISvgLineElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	x1?: string | number;
	x2?: string | number;
	y1?: string | number;
	y2?: string | number;
	pathLength?: number;
}



// <linearGradient>
export interface ISvgLinearGradientElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	x1?: string | number;
	x2?: string | number;
	y1?: string | number;
	y2?: string | number;
	gradientUnits?: UnitsPropType;
	gradientTransform?: string;
	spreadMethod?: "pad" | "reflect" | "repeat";
	href?: string;
}



// <marker>
export interface ISvgMarkerElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	markerHeight?: string | number;
	markerUnits?: UnitsPropType;
	markerWidth?: string | number;
	gradientTransform?: string;
	orient?: number | string | "auto" | "auto-start-reverse";
	preserveAspectRatio?: PreserveAspectRatioPropType;
	refX?: string | number;
	refY?: string | number;
	viewBox?: string;
}



// <mask>
export interface ISvgMaskElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	x?: string | number;
	y?: string | number;
	height?: string | number;
	width?: string | number;
	maskUnits?: UnitsPropType;
	maskContentUnits?: UnitsPropType;
}



// <mpath>
export interface ISvgMPathElementProps extends ISvgConditionalProcessingAttrs
{
	href?: string;
}



// <path>
export interface ISvgPathElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	d?: string;
	pathLength?: number;
}



// <pattern>
export interface ISvgPatternElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
	patternUnits?: UnitsPropType;
	patternContentUnits?: UnitsPropType;
	href?: string;
	viewBox?: string;
}



// <polygon>
export interface ISvgPolygonElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	points: string;
	pathLength?: number;
}



// <polyline>
export interface ISvgPolylineElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	points?: string;
	pathLength?: number;
}



// <radialGradient>
export interface ISvgRadialGradientElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	cx?: string | number;
	cy?: string | number;
	r?: string | number;
	fx?: string | number;
	fy?: string | number;
	fr?: string | number;
	gradientUnits?: UnitsPropType;
	gradientTransform?: string;
	spreadMethod?: "pad" | "reflect" | "repeat";
	href?: string;
}



// <rect>
export interface ISvgRectElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
	rx?: string | number;
	ry?: string | number;
	pathLength?: number;
}



// <script> (<svgScript>)
export interface ISvgScriptElementProps extends ISvgElementAttrs
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



// <set>
export interface ISvgSetElementProps extends ISvgConditionalProcessingAttrs, ISvgAnimationAttrs
{
	to: string;
}



// <stop>
export interface ISvgStopElementProps extends ISvgPresentationAttrs
{
	offset?: string;
	"stop-color"?: string;
	"stop-opacity"?: string | number;
}



// <style>
export interface ISvgStyleElementProps extends ISvgElementAttrs
{
	media?: MediaStatement;
	nonce?: string;
	title?: string;
	type?: string;
}



// <symbol>
export interface ISvgSymbolElementProps extends ISvgPresentationAttrs
{
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
	preserveAspectRatio?: PreserveAspectRatioPropType;
	refX?: string | number;
	refY?: string | number;
	viewBox?: string;
}



// <text>
export interface ISvgTextElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	x?: string | number;
	y?: string | number;
	dx?: string | number;
	dy?: string | number;
	rotate?: string;
	lengthAdjust?: LengthAdjustPropType;
	textLength?: string | number;
}



// <textPath>
export interface ISvgTextPathElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	href?: string;
	lengthAdjust?: LengthAdjustPropType;
	method?: "align" | "stretch";
	path?: string;
	side?: "left" | "right";
	spacing?: "auto" | "exact";
	startOffset?: string | number;
	textLength?: string | number;
}



// <textSpan>
export interface ISvgTspanElementProps extends ISvgConditionalProcessingAttrs, ISvgPresentationAttrs
{
	x?: string | number;
	y?: string | number;
	dx?: string | number;
	dy?: string | number;
	rotate?: string;
	lengthAdjust?: LengthAdjustPropType;
	textLength?: string | number;
}



// <use>
export interface ISvgUseElementProps extends ISvgPresentationAttrs
{
	href: string;
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
}



// <view>
export interface ISvgViewElementProps extends ISvgConditionalProcessingAttrs
{
	preserveAspectRatio?: PreserveAspectRatioPropType;
	viewBox?: string;
	zoomAndPan?: string;
	viewTarget?: string;
}



export interface ISvgIntrinsicElements
{
    svgA: ExtendedElement<SVGAElement, ISvgAElementProps>;
    animate: ExtendedElement<SVGAnimateElement, ISvgConditionalProcessingAttrs | ISvgAnimationAttrs>;
    animateMotion: ExtendedElement<SVGAnimateMotionElement, ISvgAnimateMotionElementProps>;
    animateTarnsform: ExtendedElement<SVGAnimateTransformElement, ISvgConditionalProcessingAttrs | ISvgAnimationAttrs>;
    circle: ExtendedElement<SVGCircleElement, ISvgCircleElementProps>;
    clipPath: ExtendedElement<SVGClipPathElement, ISvgClipPathElementProps>;
    colorProfile: ExtendedElement<SVGAElement, ISvgColorProfilePathElementProps>;
    defs: ExtendedElement<SVGDefsElement, ISvgElementAttrs>;
    desc: ExtendedElement<SVGDescElement, ISvgElementAttrs>;
    discard: ExtendedElement<SVGElement, ISvgDiscardElementProps>;
    ellipse: ExtendedElement<SVGEllipseElement, ISvgEllipseElementProps>;
    feBlend: ExtendedElement<SVGFEBlendElement, ISvgFeBlendElementProps>;
    feColorMatrix: ExtendedElement<SVGFEColorMatrixElement, ISvgFeColorMatrixElementProps>;
    feComponentTransfer: ExtendedElement<SVGFEComponentTransferElement, ISvgFeComponentTransferElementProps>;
    feComposite: ExtendedElement<SVGFECompositeElement, ISvgFeCompositeElementProps>;
    feConvolveMatrix: ExtendedElement<SVGFEConvolveMatrixElement, ISvgFeConvolveMatrixElementProps>;
    feDiffuseLighting: ExtendedElement<SVGFEDiffuseLightingElement, ISvgFeDiffuseLightingElementProps>;
    feDisplacementMap: ExtendedElement<SVGFEDisplacementMapElement, ISvgFeDisplacementMapElementProps>;
    feDistantLight: ExtendedElement<SVGFEDistantLightElement, ISvgFeDistantLightElementProps>;
    feDropShadow: ExtendedElement<SVGFEDropShadowElement, ISvgFeDropShadowElementProps>;
    feFlood: ExtendedElement<SVGFEFloodElement, ISvgFeFloodElementProps>;
    feFuncA: ExtendedElement<SVGFEFuncAElement, ISvgTransferFunctionsAttrs>;
    feFuncB: ExtendedElement<SVGFEFuncBElement, ISvgTransferFunctionsAttrs>;
    feFuncG: ExtendedElement<SVGFEFuncGElement, ISvgTransferFunctionsAttrs>;
    feFuncR: ExtendedElement<SVGFEFuncRElement, ISvgTransferFunctionsAttrs>;
    feGaussianBlur: ExtendedElement<SVGFEGaussianBlurElement, ISvgFeGaussianBlurElementProps>;
    feImage: ExtendedElement<SVGFEImageElement, ISvgFeImageElementProps>;
    feMerge: ExtendedElement<SVGFEMergeElement, ISvgPresentationAttrs | ISvgFilterPrimitiveAttrs>;
    feMergeNode: ExtendedElement<SVGFEMergeNodeElement, ISvgFeMergeNodeElementProps>;
    feMorphology: ExtendedElement<SVGFEMorphologyElement, ISvgFeMorphologyElementProps>;
    feOffset: ExtendedElement<SVGFEOffsetElement, ISvgFeOffsetElementProps>;
    fePointLight: ExtendedElement<SVGFEPointLightElement, ISvgFePointLightElementProps>;
    feSpecularLighting: ExtendedElement<SVGFESpecularLightingElement, ISvgFeSpecularLightingElementProps>;
    feSpotLight: ExtendedElement<SVGFESpotLightElement, ISvgFeSpotLightElementProps>;
    feTile: ExtendedElement<SVGFETileElement, ISvgFeTileElementProps>;
    feTurbulence: ExtendedElement<SVGFETurbulenceElement, ISvgFeTurbulenceElementProps>;
    filter: ExtendedElement<SVGFilterElement, ISvgFilterElementProps>;
    foreignObject: ExtendedElement<SVGForeignObjectElement, ISvgForeignObjectElementProps>;
    g: ExtendedElement<SVGGElement, ISvgConditionalProcessingAttrs | ISvgPresentationAttrs>;
    hatch: ExtendedElement<SVGElement, ISvgHatchElementProps>;
    hatchpath: ExtendedElement<SVGElement, ISvgHatchpathElementProps>;
    image: ExtendedElement<SVGImageElement, ISvgImageElementProps>;
    line: ExtendedElement<SVGLineElement, ISvgLineElementProps>;
    linearGradient: ExtendedElement<SVGLinearGradientElement, ISvgLinearGradientElementProps>;
    marker: ExtendedElement<SVGMarkerElement, ISvgMarkerElementProps>;
    mask: ExtendedElement<SVGMaskElement, ISvgMaskElementProps>;
    metadata: ExtendedElement<SVGMetadataElement, ISvgElementAttrs>;
    mpath: ExtendedElement<SVGMPathElement, ISvgMPathElementProps>;
    path: ExtendedElement<SVGPathElement, ISvgPathElementProps>;
    pattern: ExtendedElement<SVGPatternElement, ISvgPatternElementProps>;
    polygon: ExtendedElement<SVGPolygonElement, ISvgPolygonElementProps>;
    polyline: ExtendedElement<SVGPolylineElement, ISvgPolylineElementProps>;
    radialGradient: ExtendedElement<SVGRadialGradientElement, ISvgRadialGradientElementProps>;
    rect: ExtendedElement<SVGRectElement, ISvgRectElementProps>;
    svgScript: ExtendedElement<SVGScriptElement, ISvgScriptElementProps>;
    set: ExtendedElement<SVGSetElement, ISvgSetElementProps>;
    solidcolor: ExtendedElement<SVGElement, ISvgElementAttrs>;
    stop: ExtendedElement<SVGStopElement, ISvgStopElementProps>;
    svgStyle: ExtendedElement<SVGStyleElement, ISvgStyleElementProps>;
    svg: ExtendedElement<SVGSVGElement, ISvgSvgElementProps>;
    switch: ExtendedElement<SVGSwitchElement, ISvgConditionalProcessingAttrs | ISvgPresentationAttrs>;
    symbol: ExtendedElement<SVGSymbolElement, ISvgSymbolElementProps>;
    text: ExtendedElement<SVGTextElement, ISvgTextElementProps>;
    textPath: ExtendedElement<SVGTextPathElement, ISvgTextPathElementProps>;
    svgTitle: ExtendedElement<SVGTitleElement, ISvgElementAttrs>;
    tspan: ExtendedElement<SVGTSpanElement, ISvgTspanElementProps>;
    use: ExtendedElement<SVGUseElement, ISvgUseElementProps>;
    view: ExtendedElement<SVGViewElement, ISvgViewElementProps>;
}

