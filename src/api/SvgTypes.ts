import {
    IElementProps, ReferrerPolicyPropType, FormtargetPropType, CrossoriginPropType, ExtendedElementAttr
} from "./mim";
import {MediaStatement} from "mimcss";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgElementProps interface defines standard properties (attributes and event listeners)
// that can be used on all SVG elements.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgElementProps extends IElementProps<SVGElement>
{
}



export type PreserveAspectRatioPropType = "none" | "xMinYMin" | "xMidYMin" | "xMaxYMin" |
				"xMinYMid" | "xMidYMid" | "xMaxYMid" | "xMinYMax" | "xMidYMax" | "xMaxYMax" |
				"meet" | "slice";

export type	SvgInPropType = string | "SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint";

export type UnitsPropType = "userSpaceOnUse" | "objectBoundingBox";

export type LengthAdjustPropType = "spacing" | "spacingAndGlyphs";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgConditionalProcessingProps interface defines SVG Conditional Processing Attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgConditionalProcessingProps extends ISvgElementProps
{
	externalResourcesRequired?: ExtendedElementAttr<boolean>;
	requiredExtensions?: ExtendedElementAttr<string>;
	requiredFeatures?: ExtendedElementAttr<string>;
	systemLanguage?: ExtendedElementAttr<string>;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgPresentationProps interface defines SVG Presentation Attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgPresentationProps extends ISvgElementProps
{
	"alignment-baseline"?: ExtendedElementAttr<"auto" | "baseline" | "before-edge" | "text-before-edge" | "middle" | "central" | "after-edge" | "text-after-edge" | "ideographic" | "alphabetic" | "hanging" | "mathematical" | "inherit">;
	"baseline-shift"?: ExtendedElementAttr<string | number | "auto" | "baseline" | "super" | "sub" | "<percentage>" | "<length>" | "inherit">;
	"clip"?: ExtendedElementAttr<string>;
	"clip-path"?: ExtendedElementAttr<string>;
	"clip-rule"?: ExtendedElementAttr<"nonzero" | "evenodd" | "inherit">;
	"color"?: ExtendedElementAttr<string>;
	"color-interpolation"?: ExtendedElementAttr<"auto" | "sRGB" | "linearRGB" | "inherit">;
	"color-interpolationFilters"?: ExtendedElementAttr<"auto" | "sRGB" | "linearRGB" | "inherit">;
	"color-profile"?: ExtendedElementAttr<string | "auto" | "sRGB" | "<name>" | "inherit">;
	"color-rendering"?: ExtendedElementAttr<"auto" | "optimizeSpeed" | "optimizeQuality" | "inherit">;
	"cursor"?: ExtendedElementAttr<"auto" | "crosshair" | "default" | "pointer" | "move" | "e-resize" | "ne-resize" | "nw-resize" | "n-resize" | "se-resize" | "sw-resize" | "s-resize" | "w-resize| text" | "wait" | "help" | "inherit">;
	"direction"?: ExtendedElementAttr<"ltr" | "rtl" | "inherit">;
	"display"?: ExtendedElementAttr<"inline" | "block" | "list-item" | "run-in" | "compact" | "marker" | "table" | "inline-table" | "table-row-group" | "table-header-group" | "table-footer-group" | "table-row" | "table-column-group" | "table-column" | "table-cell" | "table-caption" | "none" | "inherit" | "flex" | "grid">;
	"dominant-baseline"?: ExtendedElementAttr<"auto" | "use-script" | "no-change" | "reset-size" | "ideographic" | "alphabetic" | "hanging" | "mathematical" | "central" | "middle" | "text-after-edge" | "text-before-edge" | "inherit">;
	"enable-background"?: ExtendedElementAttr<string>;
	"fill"?: ExtendedElementAttr<string>;
	"fill-opacity"?: ExtendedElementAttr<string | number>;
	"fill-rule"?: ExtendedElementAttr<"nonzero" | "evenodd">;
	"filter"?: ExtendedElementAttr<string | "none" | "inherit">;
	"font-family"?: ExtendedElementAttr<string>;
	"font-size"?: ExtendedElementAttr<number | "none" | "inherit">;
	"font-sizeAdjust"?: ExtendedElementAttr<number | "none" | "inherit">;
	"font-stretch"?: ExtendedElementAttr<"normal" | "wider" | "narrower" | "ultra-condensed" | "extra-condensed" | "condensed" | "semi-condensed" | "semi-expanded" | "expanded" | "extra-expanded" | "ultra-expanded" | "inherit">;
	"font-style"?: ExtendedElementAttr<"normal" | "italic" | "oblique" | "inherit">;
	"font-variant"?: ExtendedElementAttr<"normal" | "small-caps" | "inherit">;
	"font-weight"?: ExtendedElementAttr<"normal" | "bold" | "bolder" | "lighter" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "inherit">;
	"glyph-orientationHorizontal"?: ExtendedElementAttr<string>;
	"glyph-orientationVertical"?: ExtendedElementAttr<string>;
	"image-rendering"?: ExtendedElementAttr<"auto" | "optimizeSpeed" | "optimizeQuality" | "inherit">;
	"kerning"?: ExtendedElementAttr<string | number | "auto" | "inherit">;
	"letter-spacing"?: ExtendedElementAttr<string | number | "normal" | "inherit">;
	"lighting-color"?: ExtendedElementAttr<string>;
	"marker-end"?: ExtendedElementAttr<string>;
	"marker-mid"?: ExtendedElementAttr<string>;
	"marker-start"?: ExtendedElementAttr<string>;
	"mask"?: ExtendedElementAttr<string>;
	"opacity"?: ExtendedElementAttr<string | number>;
	"overflow"?: ExtendedElementAttr<"visible" | "hidden" | "scroll" | "auto" | "inherit">;
	"pointer-events"?: ExtendedElementAttr<"bounding-box" | "visiblePainted" | "visibleFill" | "visibleStroke" | "visible" | "painted" | "fill" | "stroke" | "all" | "none">;
	"shape-rendering"?: ExtendedElementAttr<"auto" | "optimizeSpeed" | "crispEdges" | "geometricPrecision" | "inherit">;
	"stroke"?: ExtendedElementAttr<string>;
	"stroke-dasharray"?: ExtendedElementAttr<string>;
	"stroke-dashoffset"?: ExtendedElementAttr<string | number>;
	"stroke-linecap"?: ExtendedElementAttr<"butt" | "round" | "square">;
	"stroke-linejoin"?: ExtendedElementAttr<"arcs" | "bevel |miter" | "miter-clip" | "round">;
	"stroke-miterlimit"?: ExtendedElementAttr<number>;
	"stroke-opacity"?: ExtendedElementAttr<string | number>;
	"stroke-width"?: ExtendedElementAttr<string | number>;
	"text-anchor"?: ExtendedElementAttr<"start" | "middle" | "end" | "inherit">;
	"transform"?: ExtendedElementAttr<string>;
	"text-decoration"?: ExtendedElementAttr<"none" | "underline" | "overline" | "line-through" | "blink" | "inherit">;
	"text-rendering"?: ExtendedElementAttr<"auto" | "optimizeSpeed" | "optimizeLegibility" | "geometricPrecision" | "inherit">;
	"unicode-bidi"?: ExtendedElementAttr<string>;
	"vector-effect"?: ExtendedElementAttr<string>;
	"visibility"?: ExtendedElementAttr<"visible" | "hidden" | "collapse" | "inherit">;
	"word-spacing"?: ExtendedElementAttr<string | number>;
	"writing-mode"?: ExtendedElementAttr<"lr-tb" | "rl-tb" | "tb-rl" | "lr" | "rl" | "tb" | "inherit">;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgFilterPrimitiveProps interface defines SVG Filters Attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgFilterPrimitiveProps extends ISvgElementProps
{
	height?: ExtendedElementAttr<string | number>;
	result?: ExtendedElementAttr<string>;
	width?: ExtendedElementAttr<string | number>;
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgTransferFunctionProps interface defines SVG Tarnsfer Function Attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgTransferFunctionsProps extends ISvgElementProps
{
	type?: ExtendedElementAttr<"identity" | "table" | "discrete" | "linear" | "gamma">;
	tableValues?: ExtendedElementAttr<string>;
	slope?: ExtendedElementAttr<string>;
	intercept?: ExtendedElementAttr<string>;
	amplitude?: ExtendedElementAttr<string>;
	exponent?: ExtendedElementAttr<string>;
	offset?: ExtendedElementAttr<string>;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgAnimationProps interface defines SVG Animation Attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgAnimationProps extends ISvgElementProps
{
	attributeType?: ExtendedElementAttr<string>;
	attributeName?: ExtendedElementAttr<string>;
	begin?: ExtendedElementAttr<string>;
	dur?: ExtendedElementAttr<string>;
	end?: ExtendedElementAttr<string>;
	min?: ExtendedElementAttr<string>;
	max?: ExtendedElementAttr<string>;
	restart?: ExtendedElementAttr<"always" | "whenNotActive" | "never">;
	repeatCount?: ExtendedElementAttr<string | number>;
	repeatDur?: ExtendedElementAttr<string>;
	fill?: ExtendedElementAttr<"freeze" | "remove">;
	calcMode?: ExtendedElementAttr<"discrete" | "linear" | "paced" | "spline">;
	values?: ExtendedElementAttr<string>;
	keyTimes?: ExtendedElementAttr<string>;
	keySplines?: ExtendedElementAttr<string>;
	from?: ExtendedElementAttr<string | number>;
	to?: ExtendedElementAttr<string | number>;
	by?: ExtendedElementAttr<string>;
	autoReverse?: ExtendedElementAttr<string>;
	accelerate?: ExtendedElementAttr<string>;
	decelerate?: ExtendedElementAttr<string>;
	additive?: ExtendedElementAttr<"replace" | "sum">;
	accumulate?: ExtendedElementAttr<"none" | "sum">;
}



// <svg>
export interface ISvgSvgElementProps extends ISvgConditionalProcessingProps
{
	height?: ExtendedElementAttr<string | number>;
	preserveAspectRatio?: ExtendedElementAttr<PreserveAspectRatioPropType>;
	viewBox?: ExtendedElementAttr<string>;
	width?: ExtendedElementAttr<string | number>;
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
}



// <a> (<svgA>)
export interface ISvgAElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	download?: ExtendedElementAttr<boolean>;
	href?: ExtendedElementAttr<string>;
	hreflang?: ExtendedElementAttr<string>;
	ping?: ExtendedElementAttr<string>;
	referrerpolicy?: ExtendedElementAttr<ReferrerPolicyPropType>;
	rel?: ExtendedElementAttr<string>;
	target?: ExtendedElementAttr<FormtargetPropType>;
	type?: ExtendedElementAttr<string>;
}



// <animateMotion>
export interface ISvgAnimateMotionElementProps extends ISvgConditionalProcessingProps,ISvgAnimationProps
{
	calcMode?: ExtendedElementAttr<"discrete" | "linear" | "paced" | "spline">;
	path?: ExtendedElementAttr<string>;
	keyPoints?: ExtendedElementAttr<string>;
	rotate?: ExtendedElementAttr<string>;
	origin?: ExtendedElementAttr<string>;
}



// <circle>
export interface ISvgCircleElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	cx: ExtendedElementAttr<string | number>;
	cy: ExtendedElementAttr<string | number>;
	r: ExtendedElementAttr<string | number>;
	pathLength?: ExtendedElementAttr<number>;
}



// <clipPath>
export interface ISvgClipPathElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	clipPathUnits?: ExtendedElementAttr<UnitsPropType>;
}



// <color-profile>
export interface ISvgColorProfilePathElementProps extends ISvgElementProps
{
	local?: ExtendedElementAttr<string>;
	name?: ExtendedElementAttr<string>;
	"rendering-intent"?: ExtendedElementAttr<string>;
}



// <discard>
export interface ISvgDiscardElementProps extends ISvgConditionalProcessingProps
{
	begin?: ExtendedElementAttr<string>;
	href?: ExtendedElementAttr<string>;
}



// <ellipse>
export interface ISvgEllipseElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	cx: ExtendedElementAttr<string | number>;
	cy: ExtendedElementAttr<string | number>;
	rx: ExtendedElementAttr<string | number>;
	ry: ExtendedElementAttr<string | number>;
	pathLength?: ExtendedElementAttr<number>;
}



// <feBlend>
export interface ISvgFeBlendElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
	in2?: ExtendedElementAttr<SvgInPropType>;
	mode?: ExtendedElementAttr<"normal" | "multiply" | "screen" | "darken" | "lighten">;
}



// <feColorMatrix>
export interface ISvgFeColorMatrixElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
	type?: ExtendedElementAttr<"matrix" | "saturate" | "hueRotate" | "luminanceToAlpha">;
	values?: ExtendedElementAttr<string | number>;
}



// <feComponentTransfer>
export interface ISvgFeComponentTransferElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
}



// <feComposite>
export interface ISvgFeCompositeElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
	in2?: ExtendedElementAttr<SvgInPropType>;
	mode?: ExtendedElementAttr<"normal" | "multiply" | "screen" | "darken" | "lighten">;
	opertor?: ExtendedElementAttr<"over" | "in" | "out" | "atop" | "xor" | "arithmetic">;
	k1?: ExtendedElementAttr<number>;
	k2?: ExtendedElementAttr<number>;
	k3?: ExtendedElementAttr<number>;
	k4?: ExtendedElementAttr<number>;
}



// <feConvolveMatrix>
export interface ISvgFeConvolveMatrixElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	bias?: ExtendedElementAttr<number>;
	divisor?: ExtendedElementAttr<number>;
	edgeMode?: ExtendedElementAttr<"duplicate" | "wrap" | "none">;
	in?: ExtendedElementAttr<string | "SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint">;
	kernelMatrix?: ExtendedElementAttr<string>;
	kernelUnitLength?: ExtendedElementAttr<string>;
	order?: ExtendedElementAttr<string>;
	preserveAlpha?: ExtendedElementAttr<boolean>;
	targetX?: ExtendedElementAttr<number>;
	targetY?: ExtendedElementAttr<number>;
}



// <feDiffuseLighting>
export interface ISvgFeDiffuseLightingElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<string | "SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint">;
	surfaceScale?: ExtendedElementAttr<number>;
	diffuseConstant?: ExtendedElementAttr<number>;
	kernelUnitLength?: ExtendedElementAttr<string>;
}



// <feDisplacementMap>
export interface ISvgFeDisplacementMapElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
	in2?: ExtendedElementAttr<SvgInPropType>;
	scale?: ExtendedElementAttr<number>;
	xChannelSelector?: ExtendedElementAttr<"R" | "G" | "B" | "A">;
	yChannelSelector?: ExtendedElementAttr<"R" | "G" | "B" | "A">;
}



// <feDistantLight>
export interface ISvgFeDistantLightElementProps extends ISvgElementProps
{
	azimuth?: ExtendedElementAttr<number>;
	elevation?: ExtendedElementAttr<number>;
}



// <feDropShadow>
export interface ISvgFeDropShadowElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
	stdDeviation?: ExtendedElementAttr<string>;
	dx?: ExtendedElementAttr<string | number>;
	dy?: ExtendedElementAttr<string | number>;
}



// <feFlood>
export interface ISvgFeFloodElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	"flood-color"?: ExtendedElementAttr<string>;
	"flood-opacity"?: ExtendedElementAttr<string | number>;
}



// <feGaussianBlur>
export interface ISvgFeGaussianBlurElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
	stdDeviation?: ExtendedElementAttr<string>;
	edgeMode?: ExtendedElementAttr<"duplicate" | "wrap" | "none">;
}



// <feImage>
export interface ISvgFeImageElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	preserveAspectRatio?: ExtendedElementAttr<PreserveAspectRatioPropType>;
	stdDeviation?: ExtendedElementAttr<string>;
	edgeMode?: ExtendedElementAttr<"duplicate" | "wrap" | "none">;
}



// <feMergeNode>
export interface ISvgFeMergeNodeElementProps extends ISvgElementProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
}



// <feMorphology>
export interface ISvgFeMorphologyElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
	operator?: ExtendedElementAttr<"over" | "in" | "out" | "atop" | "xor" | "arithmetic?: string">;
	radius?: ExtendedElementAttr<string>;
}



// <feOffset>
export interface ISvgFeOffsetElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
	dx?: ExtendedElementAttr<string | number>;
	dy?: ExtendedElementAttr<string | number>;
}



// <fePointLight>
export interface ISvgFePointLightElementProps extends ISvgElementProps
{
	x?: ExtendedElementAttr<number>;
	y?: ExtendedElementAttr<number>;
	z?: ExtendedElementAttr<number>;
}



// <feSpecularLighting>
export interface ISvgFeSpecularLightingElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
	surfaceScale?: ExtendedElementAttr<number>;
	specularConstant?: ExtendedElementAttr<number>;
	specularExponent?: ExtendedElementAttr<number>;
	kernelUnitLength?: ExtendedElementAttr<string>;
}



// <feSpotLight>
export interface ISvgFeSpotLightElementProps extends ISvgElementProps
{
	x?: ExtendedElementAttr<number>;
	y?: ExtendedElementAttr<number>;
	z?: ExtendedElementAttr<number>;
	pointsAtX?: ExtendedElementAttr<number>;
	pointsAtY?: ExtendedElementAttr<number>;
	pointsAtZ?: ExtendedElementAttr<number>;
	specularExponent?: ExtendedElementAttr<number>;
	limitingConeAngle?: ExtendedElementAttr<number>;
}



// <feTile>
export interface ISvgFeTileElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: ExtendedElementAttr<SvgInPropType>;
}



// <feTurbulence>
export interface ISvgFeTurbulenceElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	baseFrequency?: ExtendedElementAttr<string>;
	numOctaves?: ExtendedElementAttr<number>;
	seed?: ExtendedElementAttr<number>;
	stitchTiles?: ExtendedElementAttr<"noStitch" | "stitch">;
	type?: ExtendedElementAttr<"fractalNoise" | "turbulence">;
}



// <filter>
export interface ISvgFilterElementProps extends ISvgPresentationProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	width?: ExtendedElementAttr<string | number>;
	height?: ExtendedElementAttr<string | number>;
	filterRes?: ExtendedElementAttr<string>;
	filterUnits?: ExtendedElementAttr<UnitsPropType>;
	primitiveUnits?: ExtendedElementAttr<UnitsPropType>;
}



// <foreignObject>
export interface ISvgForeignObjectElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	width?: ExtendedElementAttr<string | number>;
	height?: ExtendedElementAttr<string | number>;
}



// <hatch>
export interface ISvgHatchElementProps extends ISvgPresentationProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	pitch?: ExtendedElementAttr<string>;
	rotate?: ExtendedElementAttr<string>;
	hatchUnits?: ExtendedElementAttr<string>;
	hatchContentUnits?: ExtendedElementAttr<string>;
	href?: ExtendedElementAttr<string>;
}



// <hatchPath>
export interface ISvgHatchpathElementProps extends ISvgPresentationProps
{
	d?: ExtendedElementAttr<string>;
	offset?: ExtendedElementAttr<string>;
}



// <image>
export interface ISvgImageElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	width?: ExtendedElementAttr<string | number>;
	height?: ExtendedElementAttr<string | number>;
	preserveAspectRatio?: ExtendedElementAttr<PreserveAspectRatioPropType>;
	href?: ExtendedElementAttr<string>;
}



// <line>
export interface ISvgLineElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x1?: ExtendedElementAttr<string | number>;
	x2?: ExtendedElementAttr<string | number>;
	y1?: ExtendedElementAttr<string | number>;
	y2?: ExtendedElementAttr<string | number>;
	pathLength?: ExtendedElementAttr<number>;
}



// <linearGradient>
export interface ISvgLinearGradientElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x1?: ExtendedElementAttr<string | number>;
	x2?: ExtendedElementAttr<string | number>;
	y1?: ExtendedElementAttr<string | number>;
	y2?: ExtendedElementAttr<string | number>;
	gradientUnits?: ExtendedElementAttr<UnitsPropType>;
	gradientTransform?: ExtendedElementAttr<string>;
	spreadMethod?: ExtendedElementAttr<"pad" | "reflect" | "repeat">;
	href?: ExtendedElementAttr<string>;
}



// <marker>
export interface ISvgMarkerElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	markerHeight?: ExtendedElementAttr<string | number>;
	markerUnits?: ExtendedElementAttr<UnitsPropType>;
	markerWidth?: ExtendedElementAttr<string | number>;
	gradientTransform?: ExtendedElementAttr<string>;
	orient?: ExtendedElementAttr<number | string | "auto" | "auto-start-reverse">;
	preserveAspectRatio?: ExtendedElementAttr<PreserveAspectRatioPropType>;
	refX?: ExtendedElementAttr<string | number>;
	refY?: ExtendedElementAttr<string | number>;
	viewBox?: ExtendedElementAttr<string>;
}



// <mask>
export interface ISvgMaskElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	height?: ExtendedElementAttr<string | number>;
	width?: ExtendedElementAttr<string | number>;
	maskUnits?: ExtendedElementAttr<UnitsPropType>;
	maskContentUnits?: ExtendedElementAttr<UnitsPropType>;
}



// <mpath>
export interface ISvgMPathElementProps extends ISvgConditionalProcessingProps
{
	href?: ExtendedElementAttr<string>;
}



// <path>
export interface ISvgPathElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	d?: ExtendedElementAttr<string>;
	pathLength?: ExtendedElementAttr<number>;
}



// <pattern>
export interface ISvgPatternElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	width?: ExtendedElementAttr<string | number>;
	height?: ExtendedElementAttr<string | number>;
	patternUnits?: ExtendedElementAttr<UnitsPropType>;
	patternContentUnits?: ExtendedElementAttr<UnitsPropType>;
	href?: ExtendedElementAttr<string>;
	viewBox?: ExtendedElementAttr<string>;
}



// <polygon>
export interface ISvgPolygonElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	points: ExtendedElementAttr<string>;
	pathLength?: ExtendedElementAttr<number>;
}



// <polyline>
export interface ISvgPolylineElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	points?: ExtendedElementAttr<string>;
	pathLength?: ExtendedElementAttr<number>;
}



// <radialGradient>
export interface ISvgRadialGradientElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	cx?: ExtendedElementAttr<string | number>;
	cy?: ExtendedElementAttr<string | number>;
	r?: ExtendedElementAttr<string | number>;
	fx?: ExtendedElementAttr<string | number>;
	fy?: ExtendedElementAttr<string | number>;
	fr?: ExtendedElementAttr<string | number>;
	gradientUnits?: ExtendedElementAttr<UnitsPropType>;
	gradientTransform?: ExtendedElementAttr<string>;
	spreadMethod?: ExtendedElementAttr<"pad" | "reflect" | "repeat">;
	href?: ExtendedElementAttr<string>;
}



// <rect>
export interface ISvgRectElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	width?: ExtendedElementAttr<string | number>;
	height?: ExtendedElementAttr<string | number>;
	rx?: ExtendedElementAttr<string | number>;
	ry?: ExtendedElementAttr<string | number>;
	pathLength?: ExtendedElementAttr<number>;
}



// <script> (<svgScript>)
export interface ISvgScriptElementProps extends ISvgElementProps
{
	async?: ExtendedElementAttr<boolean>;
	crossorigin?: ExtendedElementAttr<CrossoriginPropType>;
	defer?: ExtendedElementAttr<boolean>;
	integrity?: ExtendedElementAttr<string>;
	nomodule?: ExtendedElementAttr<boolean>;
	nonce?: ExtendedElementAttr<string>;
	src?: ExtendedElementAttr<string>;
	text?: ExtendedElementAttr<string>;
	type?: ExtendedElementAttr<string>;
}



// <set>
export interface ISvgSetElementProps extends ISvgConditionalProcessingProps,ISvgAnimationProps
{
	to: ExtendedElementAttr<string>;
}



// <stop>
export interface ISvgStopElementProps extends ISvgPresentationProps
{
	offset?: ExtendedElementAttr<string>;
	"stop-color"?: ExtendedElementAttr<string>;
	"stop-opacity"?: ExtendedElementAttr<string | number>;
}



// <style>
export interface ISvgStyleElementProps extends ISvgElementProps
{
	media?: ExtendedElementAttr<MediaStatement>;
	nonce?: ExtendedElementAttr<string>;
	title?: ExtendedElementAttr<string>;
	type?: ExtendedElementAttr<string>;
}



// <symbol>
export interface ISvgSymbolElementProps extends ISvgPresentationProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	width?: ExtendedElementAttr<string | number>;
	height?: ExtendedElementAttr<string | number>;
	preserveAspectRatio?: ExtendedElementAttr<PreserveAspectRatioPropType>;
	refX?: ExtendedElementAttr<string | number>;
	refY?: ExtendedElementAttr<string | number>;
	viewBox?: ExtendedElementAttr<string>;
}



// <text>
export interface ISvgTextElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	dx?: ExtendedElementAttr<string | number>;
	dy?: ExtendedElementAttr<string | number>;
	rotate?: ExtendedElementAttr<string>;
	lengthAdjust?: ExtendedElementAttr<LengthAdjustPropType>;
	textLength?: ExtendedElementAttr<string | number>;
}



// <textPath>
export interface ISvgTextPathElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	href?: ExtendedElementAttr<string>;
	lengthAdjust?: ExtendedElementAttr<LengthAdjustPropType>;
	method?: ExtendedElementAttr<"align" | "stretch">;
	path?: ExtendedElementAttr<string>;
	side?: ExtendedElementAttr<"left" | "right">;
	spacing?: ExtendedElementAttr<"auto" | "exact">;
	startOffset?: ExtendedElementAttr<string | number>;
	textLength?: ExtendedElementAttr<string | number>;
}



// <textSpan>
export interface ISvgTspanElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	dx?: ExtendedElementAttr<string | number>;
	dy?: ExtendedElementAttr<string | number>;
	rotate?: ExtendedElementAttr<string>;
	lengthAdjust?: ExtendedElementAttr<LengthAdjustPropType>;
	textLength?: ExtendedElementAttr<string | number>;
}



// <use>
export interface ISvgUseElementProps extends ISvgPresentationProps
{
	href: ExtendedElementAttr<string>;
	x?: ExtendedElementAttr<string | number>;
	y?: ExtendedElementAttr<string | number>;
	width?: ExtendedElementAttr<string | number>;
	height?: ExtendedElementAttr<string | number>;
}



// <view>
export interface ISvgViewElementProps extends ISvgConditionalProcessingProps
{
	preserveAspectRatio?: ExtendedElementAttr<PreserveAspectRatioPropType>;
	viewBox?: ExtendedElementAttr<string>;
	zoomAndPan?: ExtendedElementAttr<string>;
	viewTarget?: ExtendedElementAttr<string>;
}



export interface ISvgIntrinsicElements
{
    svgA: ISvgAElementProps;
    animate: ISvgConditionalProcessingProps | ISvgAnimationProps;
    animateMotion: ISvgAnimateMotionElementProps;
    animateTarnsform: ISvgConditionalProcessingProps | ISvgAnimationProps;
    circle: ISvgCircleElementProps;
    clipPath: ISvgClipPathElementProps;
    colorProfile: ISvgColorProfilePathElementProps;
    defs: ISvgElementProps;
    desc: ISvgElementProps;
    discard: ISvgDiscardElementProps;
    ellipse: ISvgEllipseElementProps;
    feBlend: ISvgFeBlendElementProps;
    feColorMatrix: ISvgFeColorMatrixElementProps;
    feComponentTransfer: ISvgFeComponentTransferElementProps;
    feComposite: ISvgFeCompositeElementProps;
    feConvolveMatrix: ISvgFeConvolveMatrixElementProps;
    feDiffuseLighting: ISvgFeDiffuseLightingElementProps;
    feDisplacementMap: ISvgFeDisplacementMapElementProps;
    feDistantLight: ISvgFeDistantLightElementProps;
    feDropShadow: ISvgFeDropShadowElementProps;
    feFlood: ISvgFeFloodElementProps;
    feFuncA: ISvgTransferFunctionsProps;
    feFuncB: ISvgTransferFunctionsProps;
    feFuncG: ISvgTransferFunctionsProps;
    feFuncR: ISvgTransferFunctionsProps;
    feGaussianBlur: ISvgFeGaussianBlurElementProps;
    feImage: ISvgFeImageElementProps;
    feMerge: ISvgPresentationProps | ISvgFilterPrimitiveProps;
    feMergeNode: ISvgFeMergeNodeElementProps;
    feMorphology: ISvgFeMorphologyElementProps;
    feOffset: ISvgFeOffsetElementProps;
    fePointLight: ISvgFePointLightElementProps;
    feSpecularLighting: ISvgFeSpecularLightingElementProps;
    feSpotLight: ISvgFeSpotLightElementProps;
    feTile: ISvgFeTileElementProps;
    feTurbulence: ISvgFeTurbulenceElementProps;
    filter: ISvgFilterElementProps;
    foreignObject: ISvgForeignObjectElementProps;
    g: ISvgConditionalProcessingProps | ISvgPresentationProps;
    hatch: ISvgHatchElementProps;
    hatchpath: ISvgHatchpathElementProps;
    image: ISvgImageElementProps;
    line: ISvgLineElementProps;
    linearGradient: ISvgLinearGradientElementProps;
    marker: ISvgMarkerElementProps;
    mask: ISvgMaskElementProps;
    metadata: ISvgElementProps;
    mpath: ISvgMPathElementProps;
    path: ISvgPathElementProps;
    pattern: ISvgPatternElementProps;
    polygon: ISvgPolygonElementProps;
    polyline: ISvgPolylineElementProps;
    radialGradient: ISvgRadialGradientElementProps;
    rect: ISvgRectElementProps;
    svgScript: ISvgScriptElementProps;
    set: ISvgSetElementProps;
    solidcolor: ISvgElementProps;
    stop: ISvgStopElementProps;
    svgStyle: ISvgStyleElementProps;
    svg: ISvgSvgElementProps;
    switch: ISvgConditionalProcessingProps | ISvgPresentationProps;
    symbol: ISvgSymbolElementProps;
    text: ISvgTextElementProps;
    textPath: ISvgTextPathElementProps;
    svgTitle: ISvgElementProps;
    tspan: ISvgTspanElementProps;
    use: ISvgUseElementProps;
    view: ISvgViewElementProps;
}

