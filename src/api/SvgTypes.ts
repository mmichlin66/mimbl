import {IElementProps, ReferrerPolicyPropType, FormtargetPropType, CrossoriginPropType} from "./mim";



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
	externalResourcesRequired?: boolean;
	requiredExtensions?: string;
	requiredFeatures?: string;
	systemLanguage?: string;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgPresentationProps interface defines SVG Presentation Attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgPresentationProps extends ISvgElementProps
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



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgFilterPrimitiveProps interface defines SVG Filters Attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgFilterPrimitiveProps extends ISvgElementProps
{
	height?: string | number;
	result?: string;
	width?: string | number;
	x?: string | number;
	y?: string | number;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgTransferFunctionProps interface defines SVG Tarnsfer Function Attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgTransferFunctionsProps extends ISvgElementProps
{
	type?: "identity" | "table" | "discrete" | "linear" | "gamma";
	tableValues?: string;
	slope?: string;
	intercept?: string;
	amplitude?: string;
	exponent?: string;
	offset?: string;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ISvgAnimationProps interface defines SVG Animation Attributes.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ISvgAnimationProps extends ISvgElementProps
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
export interface ISvgSvgElementProps extends ISvgConditionalProcessingProps
{
	height?: string | number;
	preserveAspectRatio?: PreserveAspectRatioPropType;
	viewBox?: string;
	width?: string | number;
	x?: string | number;
	y?: string | number;
}



// <a> (<svgA>)
export interface ISvgAElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
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
export interface ISvgAnimateMotionElementProps extends ISvgConditionalProcessingProps,ISvgAnimationProps
{
	calcMode?: "discrete" | "linear" | "paced" | "spline";
	path?: string;
	keyPoints?: string;
	rotate?: string;
	origin?: string;
}



// <circle>
export interface ISvgCircleElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	cx: string | number;
	cy: string | number;
	r: string | number;
	pathLength?: number;
}



// <clipPath>
export interface ISvgClipPathElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	clipPathUnits?: UnitsPropType;
}



// <color-profile>
export interface ISvgColorProfilePathElementProps extends ISvgElementProps
{
	local?: string;
	name?: string;
	"rendering-intent"?: string;
}



// <discard>
export interface ISvgDiscardElementProps extends ISvgConditionalProcessingProps
{
	begin?: string;
	href?: string;
}



// <ellipse>
export interface ISvgEllipseElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	cx: string | number;
	cy: string | number;
	rx: string | number;
	ry: string | number;
	pathLength?: number;
}



// <feBlend>
export interface ISvgFeBlendElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
	in2?: SvgInPropType;
	mode?: "normal" | "multiply" | "screen" | "darken" | "lighten";
}



// <feColorMatrix>
export interface ISvgFeColorMatrixElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
	type?: "matrix" | "saturate" | "hueRotate" | "luminanceToAlpha";
	values?: string | number;
}



// <feComponentTransfer>
export interface ISvgFeComponentTransferElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
}



// <feComposite>
export interface ISvgFeCompositeElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
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
export interface ISvgFeConvolveMatrixElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
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
export interface ISvgFeDiffuseLightingElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: string | "SourceGraphic" | "SourceAlpha" | "BackgroundImage" | "BackgroundAlpha" | "FillPaint" | "StrokePaint";
	surfaceScale?: number;
	diffuseConstant?: number;
	kernelUnitLength?: string;
}



// <feDisplacementMap>
export interface ISvgFeDisplacementMapElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
	in2?: SvgInPropType;
	scale?: number;
	xChannelSelector?: "R" | "G" | "B" | "A";
	yChannelSelector?: "R" | "G" | "B" | "A";
}



// <feDistantLight>
export interface ISvgFeDistantLightElementProps extends ISvgElementProps
{
	azimuth?: number;
	elevation?: number;
}



// <feDropShadow>
export interface ISvgFeDropShadowElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
	stdDeviation?: string;
	dx?: string | number;
	dy?: string | number;
}



// <feFlood>
export interface ISvgFeFloodElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	"flood-color"?: string;
	"flood-opacity"?: string | number;
}



// <feGaussianBlur>
export interface ISvgFeGaussianBlurElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
	stdDeviation?: string;
	edgeMode?: "duplicate" | "wrap" | "none";
}



// <feImage>
export interface ISvgFeImageElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	preserveAspectRatio?: PreserveAspectRatioPropType;
	stdDeviation?: string;
	edgeMode?: "duplicate" | "wrap" | "none";
}



// <feMergeNode>
export interface ISvgFeMergeNodeElementProps extends ISvgElementProps
{
	in?: SvgInPropType;
}



// <feMorphology>
export interface ISvgFeMorphologyElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
	operator?: "over" | "in" | "out" | "atop" | "xor" | "arithmetic?: string";
	radius?: string;
}



// <feOffset>
export interface ISvgFeOffsetElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
	dx?: string | number;
	dy?: string | number;
}



// <fePointLight>
export interface ISvgFePointLightElementProps extends ISvgElementProps
{
	x?:number;
	y?:number;
	z?:number;
}



// <feSpecularLighting>
export interface ISvgFeSpecularLightingElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
	surfaceScale?: number;
	specularConstant?: number;
	specularExponent?: number;
	kernelUnitLength?: string;
}



// <feSpotLight>
export interface ISvgFeSpotLightElementProps extends ISvgElementProps
{
	x?:number;
	y?:number;
	z?:number;
	pointsAtX?:number;
	pointsAtY?:number;
	pointsAtZ?:number;
	specularExponent: number;
	limitingConeAngle: number;
}



// <feTile>
export interface ISvgFeTileElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	in?: SvgInPropType;
}



// <feTurbulence>
export interface ISvgFeTurbulenceElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	baseFrequency?: string;
	numOctaves?: number;
	seed?: number;
	stitchTiles?: "noStitch" | "stitch";
	type?: "fractalNoise" | "turbulence";
}



// <filter>
export interface ISvgFilterElementProps extends ISvgPresentationProps
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
export interface ISvgForeignObjectElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
}



// <hatch>
export interface ISvgHatchElementProps extends ISvgPresentationProps
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
export interface ISvgHatchpathElementProps extends ISvgPresentationProps
{
	d?: string;
	offset?: string;
}



// <image>
export interface ISvgImageElementProps extends ISvgPresentationProps,ISvgFilterPrimitiveProps
{
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
	preserveAspectRatio?: PreserveAspectRatioPropType;
	href?: string;
}



// <line>
export interface ISvgLineElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x1: string | number;
	x2: string | number;
	y1: string | number;
	y2: string | number;
	pathLength?: number;
}



// <linearGradient>
export interface ISvgLinearGradientElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x1: string | number;
	x2: string | number;
	y1: string | number;
	y2: string | number;
	gradientUnits?: UnitsPropType;
	gradientTransform?: string;
	spreadMethod?: "pad" | "reflect" | "repeat";
	href?: string;
}



// <marker>
export interface ISvgMarkerElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
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
export interface ISvgMaskElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x?: string | number;
	y?: string | number;
	height?: string | number;
	width?: string | number;
	maskUnits?: UnitsPropType;
	maskContentUnits?: UnitsPropType;
}



// <mpath>
export interface ISvgMPathElementProps extends ISvgConditionalProcessingProps
{
	href?: string;
}



// <path>
export interface ISvgPathElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	d: string;
	pathLength?: number;
}



// <pattern>
export interface ISvgPatternElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
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
export interface ISvgPolygonElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	points: string;
	pathLength?: number;
}



// <polyline>
export interface ISvgPolylineElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	points: string;
	pathLength?: number;
}



// <radialGradient>
export interface ISvgRadialGradientElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
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
export interface ISvgRectElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
{
	x: string | number;
	y: string | number;
	width: string | number;
	height: string | number;
	rx?: string | number;
	ry?: string | number;
	pathLength?: number;
}



// <script> (<svgScript>)
export interface ISvgScriptElementProps extends ISvgElementProps
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
export interface ISvgSetElementProps extends ISvgConditionalProcessingProps,ISvgAnimationProps
{
	to: string;
}



// <stop>
export interface ISvgStopElementProps extends ISvgPresentationProps
{
	offset?: string;
	"stop-color"?: string;
	"stop-opacity"?: string | number;
}



// <style>
export interface ISvgStyleElementProps extends ISvgElementProps
{
	media?: string;
	nonce?: string;
	title?: string;
	type?: string;
}



// <symbol>
export interface ISvgSymbolElementProps extends ISvgPresentationProps
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
export interface ISvgTextElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
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
export interface ISvgTextPathElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
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
export interface ISvgTextSpanElementProps extends ISvgConditionalProcessingProps,ISvgPresentationProps
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
export interface ISvgUseElementProps extends ISvgPresentationProps
{
	href: string;
	x?: string | number;
	y?: string | number;
	width?: string | number;
	height?: string | number;
}



// <view>
export interface ISvgViewElementProps extends ISvgConditionalProcessingProps
{
	preserveAspectRatio?: PreserveAspectRatioPropType;
	viewBox?: string;
	zoomAndPan?: string;
	viewTarget?: string;
}



