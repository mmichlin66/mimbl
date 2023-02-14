import {ExtendedElement} from "./CompTypes";
import {
    ReferrerPolicyPropType, FormtargetPropType, CrossoriginPropType, IElementAttrs, IElementEvents
} from "./ElementTypes";
import {
    AlignmentBaselineKeyword, AngleUnits, BlendModeKeyword, ClipPath_StyleType, ClipRule_StyleType,
    ColorInterpolation_StyleType, CssColor, Cursor_StyleType, Direction, Display_StyleType,
    DominantBaseline_StyleType, FillRule, Filter_StyleType, FontSizeKeyword, FontStretchKeyword,
    HorizontalPositionKeyword, ImageRendering_StyleType, IPathBuilder, LengthUnits,
    Marker_StyleType, MediaStatement, OneOrMany, PercentUnits, PointerEvents_StyleType,
    ShapeRendering_StyleType, StrokeLinecap_StyleType, StrokeLinejoin_StyleType, TextAnchor_StyleType,
    TextRendering_StyleType, Transform_StyleType, UnicodeBidi_StyleType, VectorEffect_StyleType,
    VerticalPositionKeyword, Visibility_StyleType, WritingMode_StyleType
} from "mimcss";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Common SVG attribute types
//
///////////////////////////////////////////////////////////////////////////////////////////////////

export type PreserveAspectAlignKeyword = "none" | "xMinYMin" | "xMidYMin" | "xMaxYMin" |
    "xMinYMid" | "xMidYMid" | "xMaxYMid" | "xMinYMax" | "xMidYMax" | "xMaxYMax";

export type PreserveAspectRatioMeetOrSliceKeyword = "meet" | "slice";

export type PreserveAspectRatioPropType = "none" | PreserveAspectAlignKeyword |
    [PreserveAspectAlignKeyword, PreserveAspectRatioMeetOrSliceKeyword?];

export type	SvgInPropType = string | "SourceGraphic" | "SourceAlpha" | "BackgroundImage" |
    "BackgroundAlpha" | "FillPaint" | "StrokePaint";

export type SvgUnitsPropType = "userSpaceOnUse" | "objectBoundingBox";

export type LengthAdjustPropType = "spacing" | "spacingAndGlyphs";

/**
 * Defines units used in the SVG `<clock-value>' type
 */
export type SvgClockUnits = "h" | "min" | "s" | "ms";

export type SvgClock = number | `${number}${SvgClockUnits}` | `${number}:${number}` | `${number}:${number}:${number}`;

export type SvgViewBox = number | [number, number?, number?, number?];



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// SVG presentation attributes are similar to CSS style properties; however, the types that SVG
// presentation attributes can accept are subsets of CSS style properties. For example, while
// CSS <length> can accept such functions as calc() and min(), SVG presentation attributes
// cannot. Therefore, the following types define types that are used by the SVG presentation
// attributes
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Type for presentation attributes of the `<percentage>` SVG type. Values of this type can be specifed as:
 * - strings that have a number followed by the percent sign, like `"83%"`
 * - a number:
 *   - if the number is an integer, it is taken as is and a percent sign is appended to it
 *   - if the number is a floating point, it is multiplied by 100 and a percent sign is appended to it
 */
export type SvgPercent = number | `${number}${PercentUnits}`;

/**
 * Type for presentation attributes of the `<length>` SVG type. Values of this type can be specifed as:
 * - strings that have a number followed by one of the length units, like `"100vh"` or `"1em"`
 * - a number
 */
export type SvgLength = SvgPercent | `${number}${LengthUnits}`;

/**
 * Type for presentation attributes of the `<length>` SVG type. Values of this type can be specifed as:
 * - strings that have a number followed by one of the length units, like `"100deg"` or `"1rad"`
 * - a number
 */
export type SvgAngle = number | `${number}${AngleUnits}`;

/**
 * Type used for presentaion properties fill (fillColor) and stroke
 */
export type SvgPaint = "none" | CssColor | "context-fill" | "context-stroke";



/** The ISvgConditionalProcessingProps interface defines SVG Conditional Processing Attributes. */
export interface ISvgConditionalProcessingAttrs
{
	requiredExtensions?: string | string[];
	systemLanguage?: string | string[];
}



/** The ISvgPresentationProps interface defines SVG Presentation Attributes. */
export interface ISvgPresentationAttrs
{
	alignmentBaseline?: AlignmentBaselineKeyword | "inherit";
	baselineShift?: "sub" | "super" | SvgLength | "inherit";
	clipPath?: ClipPath_StyleType | "inherit";
	clipRule?: ClipRule_StyleType | "inherit";
	color?: CssColor | "inherit";
	colorInterpolation?: ColorInterpolation_StyleType | "inherit";
	colorInterpolationFilters?: ColorInterpolation_StyleType | "inherit";
	cursor?: Cursor_StyleType | "inherit";
    d?: string | IPathBuilder;
	direction?: Direction | "inherit";
	display?: Display_StyleType;
	dominantBaseline?: DominantBaseline_StyleType | "inherit";
	fill?: SvgPaint;
	fillOpacity?: SvgPercent;
	fillRule?: FillRule | "inherit";
	filter?: Filter_StyleType;
	floodColor?: CssColor;
	floodOpacity?: SvgPercent;
	fontFamily?: string;
	fontSize?: FontSizeKeyword | SvgLength | "inherit";
	fontSizeAdjust?: number | `${number}` | "none" | "inherit";
	fontStretch?: FontStretchKeyword | SvgPercent | "inherit";
	fontStyle?: "normal" | "italic" | "oblique";
	fontVariant?: string;
	fontWeight?: number | `${number}` | "normal" | "bold" | "bolder" | "lighter" | "inherit";
	imageRendering?: ImageRendering_StyleType | "inherit";
	letterSpacing?: "normal" | SvgLength | "inherit";
	lightingColor?: CssColor;
	markerEnd?: Marker_StyleType | "inherit";
	markerMid?: Marker_StyleType | "inherit";
	markerStart?: Marker_StyleType | "inherit";
	mask?: string;
	opacity?: number | `${number}`;
	overflow?: "visible" | "hidden" | "scroll" | "auto" | "inherit";
	pointerEvents?: PointerEvents_StyleType;
	shapeRendering?: ShapeRendering_StyleType | "inherit";
	stopColor?: CssColor;
	stopOpacity?: number | `${number}`;
	stroke?: SvgPaint;
	strokeDasharray?: "none" | OneOrMany<SvgLength>;
	strokeDashoffset?: SvgLength;
	strokeLinecap?: StrokeLinecap_StyleType;
	strokeLinejoin?: StrokeLinejoin_StyleType;
	strokeMiterlimit?: number | `${number}`;
	strokeOpacity?: SvgPercent;
	strokeWidth?: SvgLength;
	textAnchor?: TextAnchor_StyleType | "inherit";
	textDecoration?: "none" | "underline" | "overline" | "line-through" | "blink" | "inherit";
	textRendering?: TextRendering_StyleType | "inherit";
	transform?: Transform_StyleType;
	transformOrigin?: HorizontalPositionKeyword | VerticalPositionKeyword | SvgLength |
        [HorizontalPositionKeyword | SvgLength, VerticalPositionKeyword | SvgLength, SvgLength?];
	unicodeBidi?: UnicodeBidi_StyleType;
	vectorEffect?: VectorEffect_StyleType;
	visibility?: Visibility_StyleType | "inherit";
	wordSpacing?: SvgLength | "inherit";
	writingMode?: WritingMode_StyleType | "inherit";
}



/** The ISvgFilterPrimitiveProps interface defines SVG Filters Attributes. */
export interface ISvgFilterPrimitiveAttrs
{
	height?: string | number;
	result?: string;
	width?: string | number;
	x?: string | number;
	y?: string | number;
}



/** The ISvgTransferFunctionProps interface defines SVG Tarnsfer Function Attributes. */
export interface ISvgTransferFunctionAttrs
{
	type: "identity" | "table" | "discrete" | "linear" | "gamma";
	tableValues?: string;
	slope?: string;
	intercept?: string;
	amplitude?: string;
	exponent?: string;
	offset?: string;
}



/** Defines SVG animation target attributes. */
export interface ISvgAnimationTargetAttrs
{
    href?: string;
}



/** Defines SVG property that is a subject of animation. */
export interface ISvgAnimationTargetAttributeAttrs
{
	attributeName: string;
}



/** Defines SVG animation timing attributes. */
export interface ISvgAnimationTimingAttrs
{
	begin?: string | string[];
	dur?: SvgClock;
	end?: string[];
	min?: SvgClock;
	max?: SvgClock;
	restart?: "always" | "whenNotActive" | "never";
	repeatCount?: number | `${number}` | "indefinite";
	repeatDur?: SvgClock;
	fill?: "freeze" | "remove";
}



/** Defines SVG animation value attributes. */
export interface ISvgAnimationValueAttrs
{
	calcMode?: "discrete" | "linear" | "paced" | "spline";
	values?: string[];
	keyTimes?: (number | `${number}`)[];
	keySplines?: [number | `${number}`, number | `${number}`, number | `${number}`, number | `${number}`][];
	from?: string | number;
	to?: string | number;
	by?: string | number;
	autoReverse?: string;
	accelerate?: string;
	decelerate?: string;
}



/** Defines SVG animation addition attributes. */
export interface ISvgAnimationAdditionAttrs
{
	additive?: "replace" | "sum";
	accumulate?: "none" | "sum";
}



/**
 * The ISvgElementAttrs interface defines standard properties (attributes and event listeners)
 * that can be used on all SVG elements.
 */
export interface ISvgElementAttrs extends IElementAttrs,
    Pick<ISvgPresentationAttrs, "color" | "display" | "transform" | "transformOrigin">
{
}



/**
 * Defines events common to all SVG elements
 */
export interface ISvgElementEvents extends IElementEvents
{
}



/**
 * Represents SVG elements of the Animation category
 */
export interface ISvgAnimationCategoryAttrs extends ISvgElementAttrs, ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipRule">
{
}



/**
 * Represents SVG elements of the Container category
 */
export interface ISvgContainerCategoryAttrs extends ISvgElementAttrs,
    Pick<ISvgPresentationAttrs, "colorInterpolation" | "cursor" | "filter" | "mask" | "pointerEvents">
{
}



/**
 * Represents SVG elements of the Descriptive category
 */
export interface ISvgDescriptiveCategoryAttrs extends ISvgElementAttrs,
    Pick<ISvgPresentationAttrs, "clipRule">
{
}



/**
 * Represents SVG elements of the Filter Primitive category
 */
export interface ISvgFilterPrimitiveCategoryAttrs extends ISvgElementAttrs, ISvgFilterPrimitiveAttrs,
    Pick<ISvgPresentationAttrs, "colorInterpolationFilters">
{
}



/**
 * Represents SVG elements of the Transfer Function category
 */
export interface ISvgTransferFunctionCategoryAttrs extends ISvgElementAttrs, ISvgTransferFunctionAttrs
{
}



/**
 * Represents SVG elements of the Graphics category
 */
export interface ISvgGraphicsCategoryAttrs extends ISvgElementAttrs, ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipPath" | "cursor" | "filter" | "mask" | "opacity" | "pointerEvents">
{
}



/**
 * Represents SVG elements of the Light Source category
 */
export interface ISvgLightSourceCategoryAttrs extends ISvgElementAttrs
{
}



/**
 * Represents SVG elements of the Gradient category
 */
export interface ISvgGradientCategoryAttrs extends ISvgElementAttrs, ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "colorInterpolation">
{
}



/**
 * Represents SVG elements of the Paint Server category
 */
export interface ISvgPaintServerCategoryAttrs extends ISvgElementAttrs
{
}



/**
 * Represents SVG elements of the Renderable category
 */
export interface ISvgRenderableCategoryAttrs extends ISvgElementAttrs,
    Pick<ISvgPresentationAttrs, "colorInterpolation" | "opacity" | "pointerEvents">
{
}



/**
 * Represents SVG elements of the Shape category
 */
export interface ISvgShapeCategoryAttrs extends ISvgElementAttrs, ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipRule" | "fill" | "fillOpacity" | "markerEnd" |
        "markerMid" | "markerStart" | "mask" | "opacity" | "pointerEvents" | "shapeRendering" |
        "stroke" | "strokeDasharray" | "strokeDashoffset" | "strokeLinecap" | "strokeLinejoin" |
        "strokeMiterlimit" | "strokeOpacity" | "strokeWidth" | "vectorEffect" | "visibility">
{
}



/**
 * Represents SVG elements of the Structural category
 */
export interface ISvgStructuralCategoryAttrs extends ISvgElementAttrs,
    Pick<ISvgPresentationAttrs, "colorInterpolation" | "pointerEvents">
{
}



/**
 * Represents SVG elements of the TextContent category
 */
export interface ISvgTextContentCategoryAttrs extends ISvgElementAttrs,
    Pick<ISvgPresentationAttrs, "colorInterpolation" | "direction" | "dominantBaseline" |
        "fill" | "fillOpacity" | "fillRule" | "fontFamily" | "fontSize" |
        "fontSizeAdjust" | "fontStretch" | "fontStyle" | "fontVariant" | "fontWeight" |
        "letterSpacing" | "pointerEvents" | "stroke" | "strokeDasharray" | "strokeDashoffset" |
        "strokeLinecap" | "strokeLinejoin" | "strokeMiterlimit" | "strokeOpacity" |
        "strokeWidth" | "textAnchor" | "textDecoration" | "unicodeBidi" | "vectorEffect" |
        "visibility" | "wordSpacing" | "writingMode">
{
}



// <a> (<svgA>)
export interface ISvgAElementProps extends
    ISvgContainerCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipPath" | "visibility">
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



// <animate>
export interface ISvgAnimateElementProps extends
    ISvgAnimationCategoryAttrs,
    ISvgAnimationTargetAttrs,
    ISvgAnimationTargetAttributeAttrs,
    ISvgAnimationTimingAttrs,
    ISvgAnimationValueAttrs,
    ISvgAnimationAdditionAttrs,
    Pick<ISvgPresentationAttrs, "colorInterpolation">
{
}



// <animateMotion>
export interface ISvgAnimateMotionElementProps extends
    ISvgAnimationCategoryAttrs,
    ISvgAnimationTargetAttrs,
    ISvgAnimationTimingAttrs,
    ISvgAnimationValueAttrs,
    ISvgAnimationAdditionAttrs
{
	path?: string | IPathBuilder;
	keyPoints?: (number | `${number}`)[];
	rotate?: number | `${number}` | "auto" | "auto-reverse";
}



// <animateTransform>
export interface ISvgAnimateTransformElementProps extends
    ISvgAnimationCategoryAttrs,
    ISvgAnimationTargetAttrs,
    ISvgAnimationTargetAttributeAttrs,
    ISvgAnimationTimingAttrs,
    ISvgAnimationValueAttrs,
    ISvgAnimationAdditionAttrs
{
	type: "translate" | "scale" | "rotate" | "skewX" | "skewY";
}



// <circle>
export interface ISvgCircleElementProps extends
    ISvgShapeCategoryAttrs,
    ISvgGraphicsCategoryAttrs,
    ISvgRenderableCategoryAttrs
{
	cx?: SvgLength;
	cy?: SvgLength;
	r?: SvgLength;
	pathLength?: number | `${number}`;
}



// <clipPath>
export interface ISvgClipPathElementProps extends
    ISvgAElementProps,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipPath" | "colorInterpolation">
{
	clipPathUnits?: SvgUnitsPropType;
}



// <defs>
export interface ISvgDefsElementProps extends
    ISvgContainerCategoryAttrs,
    ISvgStructuralCategoryAttrs,
    Pick<ISvgPresentationAttrs, "clipPath">
{
	begin?: string;
	href?: string;
}



// <desc>
export interface ISvgDeskElementProps extends
    ISvgDescriptiveCategoryAttrs
{
}



// <discard>
export interface ISvgDiscardElementProps extends
    ISvgAnimationCategoryAttrs
{
	begin?: string | string[];
	href?: string;
}



// <ellipse>
export interface ISvgEllipseElementProps extends
    ISvgShapeCategoryAttrs,
    ISvgGraphicsCategoryAttrs,
    ISvgRenderableCategoryAttrs
{
	cx?: SvgLength;
	cy?: SvgLength;
	rx?: SvgLength | "auto";
	ry?: SvgLength | "auto";
	pathLength?: number | `${number}`;
}



// <feBlend>
export interface ISvgFeBlendElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
	in2?: SvgInPropType;
	mode?: BlendModeKeyword;
}



// <feColorMatrix>
export interface ISvgFeColorMatrixElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
	type: "matrix" | "saturate" | "hueRotate" | "luminanceToAlpha";
	values?: number | `${number}` |
        [
            number | `${number}`, number | `${number}`, number | `${number}`, number | `${number}`, number | `${number}`,
            number | `${number}`, number | `${number}`, number | `${number}`, number | `${number}`, number | `${number}`,
            number | `${number}`, number | `${number}`, number | `${number}`, number | `${number}`, number | `${number}`,
            number | `${number}`, number | `${number}`, number | `${number}`, number | `${number}`, number | `${number}`,
        ];
}



// <feComponentTransfer>
export interface ISvgFeComponentTransferElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
}



// <feComposite>
export interface ISvgFeCompositeElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
	in2?: SvgInPropType;
	opertor?: "over" | "in" | "out" | "atop" | "xor" | "lighter" | "arithmetic";
	k1?: number | `${number}`;
	k2?: number | `${number}`;
	k3?: number | `${number}`;
	k4?: number | `${number}`;
}



// <feConvolveMatrix>
export interface ISvgFeConvolveMatrixElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	bias?: number | `${number}`;
	divisor?: number | `${number}`;
	edgeMode?: "duplicate" | "wrap" | "none";
	in?: SvgInPropType;
	kernelMatrix?: (number | `${number}`)[];
	order?: number | `${number}` | [number | `${number}`, (number | `${number}`)?];
	preserveAlpha?: "true" | "false";
	targetX?: number | `${number}`;
	targetY?: number | `${number}`;
}



// <feDiffuseLighting>
export interface ISvgFeDiffuseLightingElementProps extends
    ISvgFilterPrimitiveCategoryAttrs,
    Pick<ISvgPresentationAttrs, "lightingColor">
{
	in?: SvgInPropType;
	surfaceScale?: number | `${number}`;
	diffuseConstant?: number | `${number}`;
}



// <feDisplacementMap>
export interface ISvgFeDisplacementMapElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
	in2?: SvgInPropType;
	scale?: number | `${number}`;
	xChannelSelector?: "R" | "G" | "B" | "A";
	yChannelSelector?: "R" | "G" | "B" | "A";
}



// <feDistantLight>
export interface ISvgFeDistantLightElementProps extends
    ISvgLightSourceCategoryAttrs
{
	azimuth?: number | `${number}`;
	elevation?: number | `${number}`;
}



// <feDropShadow>
export interface ISvgFeDropShadowElementProps extends
    ISvgFilterPrimitiveCategoryAttrs,
    Pick<ISvgPresentationAttrs, "floodColor" | "floodOpacity">
{
	in?: SvgInPropType;
	stdDeviation?: number | `${number}`;
	dx?: number | `${number}`;
	dy?: number | `${number}`;
}



// <feFlood>
export interface ISvgFeFloodElementProps extends
    ISvgFilterPrimitiveCategoryAttrs,
    Pick<ISvgPresentationAttrs, "floodColor" | "floodOpacity">
{
}



// <feFuncA>
export interface ISvgFeFuncAElementProps extends
    ISvgTransferFunctionCategoryAttrs
{
}



// <feFuncB>
export interface ISvgFeFuncBElementProps extends
    ISvgTransferFunctionCategoryAttrs
{
}



// <feFuncA>
export interface ISvgFeFuncGElementProps extends
    ISvgTransferFunctionCategoryAttrs
{
}



// <feFuncR>
export interface ISvgFeFuncRElementProps extends
    ISvgTransferFunctionCategoryAttrs
{
}



// <feGaussianBlur>
export interface ISvgFeGaussianBlurElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
	stdDeviation?: number | `${number}` | [number | `${number}`, (number | `${number}`)?];
	edgeMode?: "duplicate" | "wrap" | "none";
}



// <feImage>
export interface ISvgFeImageElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
    href: string;
	preserveAspectRatio?: PreserveAspectRatioPropType;
}



// <feMerge>
export interface ISvgFeMergeElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
}



// <feMergeNode>
export interface ISvgFeMergeNodeElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
}



// <feMorphology>
export interface ISvgFeMorphologyElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
	operator?: "erode" | "dilate";
	radius?: number | `${number}` | [number | `${number}`, (number | `${number}`)?];
}



// <feOffset>
export interface ISvgFeOffsetElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
	dx?: number | `${number}`;
	dy?: number | `${number}`;
}



// <fePointLight>
export interface ISvgFePointLightElementProps extends
    ISvgLightSourceCategoryAttrs
{
	x?: number | `${number}`;
	y?: number | `${number}`;
	z?: number | `${number}`;
}



// <feSpecularLighting>
export interface ISvgFeSpecularLightingElementProps extends
    ISvgFilterPrimitiveCategoryAttrs,
    Pick<ISvgPresentationAttrs, "lightingColor">
{
	in?: SvgInPropType;
	surfaceScale?: number | `${number}`;
	specularConstant?: number | `${number}`;
	specularExponent?: number | `${number}`;
}



// <feSpotLight>
export interface ISvgFeSpotLightElementProps extends
    ISvgLightSourceCategoryAttrs
{
	x?: number | `${number}`;
	y?: number | `${number}`;
	z?: number | `${number}`;
	pointsAtX?: number | `${number}`;
	pointsAtY?: number | `${number}`;
	pointsAtZ?: number | `${number}`;
	specularExponent?: number | `${number}`;
	limitingConeAngle?: number | `${number}`;
}



// <feTile>
export interface ISvgFeTileElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	in?: SvgInPropType;
}



// <feTurbulence>
export interface ISvgFeTurbulenceElementProps extends
    ISvgFilterPrimitiveCategoryAttrs
{
	baseFrequency?: number | `${number}` | [number | `${number}`, (number | `${number}`)?];
	numOctaves?: number | `${number}`;
	seed?: number | `${number}`;
	stitchTiles?: "noStitch" | "stitch";
	type: "fractalNoise" | "turbulence";
}



// <filter>
export interface ISvgFilterElementProps extends
    ISvgElementAttrs
{
	x?: SvgLength;
	y?: SvgLength;
	width?: SvgLength;
	height?: SvgLength;
	filterUnits?: SvgUnitsPropType;
	primitiveUnits?: SvgUnitsPropType;
    href?: string;
}



// <foreignObject>
export interface ISvgForeignObjectElementProps extends
    ISvgRenderableCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "overflow" | "vectorEffect" | "visibility">
{
	x?: SvgLength;
	y?: SvgLength;
	width?: SvgLength;
	height?: SvgLength;
}



// <g>
export interface ISvgGElementProps extends
    ISvgContainerCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    ISvgStructuralCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipPath">
{
}



// <hatch>
export interface ISvgHatchElementProps extends
    ISvgPaintServerCategoryAttrs
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
export interface ISvgHatchpathElementProps extends
    ISvgElementAttrs
{
	offset?: string;
}



// <image>
export interface ISvgImageElementProps extends
    ISvgGraphicsCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    Pick<ISvgPresentationAttrs, "imageRendering" | "overflow" | "vectorEffect" | "visibility">
{
	x?: SvgLength;
	y?: SvgLength;
	width?: SvgLength;
	height?: SvgLength;
	preserveAspectRatio?: PreserveAspectRatioPropType;
	href?: string;
    crossorigin?: CrossoriginPropType;
}



// <line>
export interface ISvgLineElementProps extends
    ISvgShapeCategoryAttrs,
    ISvgGraphicsCategoryAttrs,
    ISvgRenderableCategoryAttrs
{
	x1?: CrossoriginPropType;
	x2?: CrossoriginPropType;
	y1?: CrossoriginPropType;
	y2?: CrossoriginPropType;
	pathLength?: number | `${number}`;
}



// <linearGradient>
export interface ISvgLinearGradientElementProps extends
    ISvgGradientCategoryAttrs,
    ISvgPaintServerCategoryAttrs,
    Pick<ISvgPresentationAttrs, "clipPath">
{
	x1?: SvgLength;
	x2?: SvgLength;
	y1?: SvgLength;
	y2?: SvgLength;
	gradientUnits?: SvgUnitsPropType;
	gradientTransform?: Transform_StyleType;
	spreadMethod?: "pad" | "reflect" | "repeat";
}



// <marker>
export interface ISvgMarkerElementProps extends
    ISvgContainerCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipPath" | "opacity" | "overflow">
{
	markerHeight?: SvgLength;
	markerUnits?: SvgUnitsPropType;
	markerWidth?: SvgLength;
	gradientTransform?: Transform_StyleType;
	orient?: SvgAngle | "auto" | "auto-start-reverse";
	preserveAspectRatio?: PreserveAspectRatioPropType;
	refX?: "left" | "center" | "right" | SvgLength;
	refY?: "top" | "center" | "bottom" | SvgLength;
	viewBox?: SvgViewBox;
}



// <mask>
export interface ISvgMaskElementProps extends
    ISvgContainerCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipPath">
{
	x?: SvgLength;
	y?: SvgLength;
	height?: SvgLength;
	width?: SvgLength;
	maskUnits?: SvgUnitsPropType;
	maskContentUnits?: SvgUnitsPropType;
}



// <metadata>
export interface ISvgMetadataElementProps extends
    ISvgDescriptiveCategoryAttrs
{
}



// <mpath>
export interface ISvgMPathElementProps extends ISvgElementAttrs
{
	href?: string;
}



// <path>
export interface ISvgPathElementProps extends
    ISvgShapeCategoryAttrs,
    ISvgGraphicsCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    Pick<ISvgPresentationAttrs, "d" | "fillRule">
{
	pathLength?: number | `${number}`;
}



// <pattern>
export interface ISvgPatternElementProps extends
    ISvgContainerCategoryAttrs,
    ISvgPaintServerCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipPath" | "overflow">
{
	x?: SvgLength;
	y?: SvgLength;
	width?: SvgLength;
	height?: SvgLength;
	patternUnits?: SvgUnitsPropType;
	patternContentUnits?: SvgUnitsPropType;
    patternTransform?: Transform_StyleType;
	preserveAspectRatio?: PreserveAspectRatioPropType;
	href?: string;
	viewBox?: SvgViewBox;
}



// <polygon>
export interface ISvgPolygonElementProps extends
    ISvgShapeCategoryAttrs,
    ISvgGraphicsCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    Pick<ISvgPresentationAttrs, "fillRule">
{
	points: (number | `${number}`)[];
	pathLength?: number | `${number}`;
}



// <polyline>
export interface ISvgPolylineElementProps extends
    ISvgShapeCategoryAttrs,
    ISvgGraphicsCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    Pick<ISvgPresentationAttrs, "fillRule">
{
	points?: (number | `${number}`)[];
	pathLength?: number | `${number}`;
}



// <radialGradient>
export interface ISvgRadialGradientElementProps extends
    ISvgGradientCategoryAttrs,
    ISvgPaintServerCategoryAttrs
{
	cx?: SvgLength;
	cy?: SvgLength;
	r?: SvgLength;
	fx?: SvgLength;
	fy?: SvgLength;
	fr?: SvgLength;
	gradientUnits?: SvgUnitsPropType;
	gradientTransform?: Transform_StyleType;
	spreadMethod?: "pad" | "reflect" | "repeat";
}



// <rect>
export interface ISvgRectElementProps extends
    ISvgShapeCategoryAttrs,
    ISvgGraphicsCategoryAttrs,
    ISvgRenderableCategoryAttrs
{
	x?: SvgLength;
	y?: SvgLength;
	width?: SvgLength | "auto";
	height?: SvgLength | "auto";
	rx?: SvgLength | "auto";
	ry?: SvgLength | "auto";
	pathLength?: number | `${number}`;
}



// <script> (<svgScript>)
export interface ISvgScriptElementProps extends ISvgElementAttrs
{
	type?: string;
    href?: string;
	crossorigin?: CrossoriginPropType;
}



// <set>
export interface ISvgSetElementProps extends
    ISvgAnimationCategoryAttrs,
    ISvgAnimationTargetAttrs,
    ISvgAnimationTargetAttributeAttrs,
    ISvgAnimationTimingAttrs
{
	to: string | number;
}



// <stop>
export interface ISvgStopElementProps extends
    ISvgElementAttrs,
    Pick<ISvgPresentationAttrs, "stopColor" | "stopOpacity">
{
	offset?: SvgPercent;
}



// <style>
export interface ISvgStyleElementProps extends ISvgElementAttrs
{
	media?: MediaStatement;
	nonce?: string;
	title?: string;
	type?: string;
}



// <svg>
export interface ISvgSvgElementProps extends
    ISvgContainerCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    ISvgStructuralCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipPath" | "overflow">
{
	height?: SvgLength;
	preserveAspectRatio?: PreserveAspectRatioPropType;
	viewBox?: SvgViewBox;
	width?: SvgLength;
	x?: SvgLength;
	y?: SvgLength;
}



// <switch>
export interface ISvgSwitchElementProps extends
    ISvgContainerCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "clipPath">
{
}



// <symbol>
export interface ISvgSymbolElementProps extends
    ISvgContainerCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    ISvgStructuralCategoryAttrs,
    Pick<ISvgPresentationAttrs, "clipPath" | "overflow">
{
	x?: SvgLength;
	y?: SvgLength;
	width?: SvgLength;
	height?: SvgLength;
	preserveAspectRatio?: PreserveAspectRatioPropType;
	refX?: SvgLength | "left" | "center" | "right";
	refY?: SvgLength | "top" | "center" | "bottom";
	viewBox?: SvgViewBox;
}



// <text>
export interface ISvgTextElementProps extends
    ISvgGraphicsCategoryAttrs,
    ISvgRenderableCategoryAttrs,
    ISvgTextContentCategoryAttrs,
    Pick<ISvgPresentationAttrs, "clipRule" | "overflow" | "textRendering">
{
	x?: SvgLength;
	y?: SvgLength;
	dx?: SvgLength;
	dy?: SvgLength;
	rotate?: number | `${number}` | (number | `${number}`)[];
	lengthAdjust?: LengthAdjustPropType;
	textLength?: SvgLength;
}



// <textPath>
export interface ISvgTextPathElementProps extends
    ISvgRenderableCategoryAttrs,
    ISvgTextContentCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "alignmentBaseline" | "baselineShift">
{
	href?: string;
	lengthAdjust?: LengthAdjustPropType;
	method?: "align" | "stretch";
	path?: string | IPathBuilder;
	side?: "left" | "right";
	spacing?: "auto" | "exact";
	startOffset?: SvgLength;
	textLength?: SvgLength;
}



// <title>
export interface ISvgTitleElementProps extends
    ISvgDescriptiveCategoryAttrs
{
}



// <tSpan>
export interface ISvgTspanElementProps extends
    ISvgRenderableCategoryAttrs,
    ISvgTextContentCategoryAttrs,
    ISvgConditionalProcessingAttrs,
    Pick<ISvgPresentationAttrs, "alignmentBaseline" | "baselineShift">
{
	x?: SvgLength;
	y?: SvgLength;
	dx?: SvgLength;
	dy?: SvgLength;
	rotate?: number | `${number}` | (number | `${number}`)[];
	lengthAdjust?: LengthAdjustPropType;
	textLength?: SvgLength;
}



// <use>
export interface ISvgUseElementProps extends
    ISvgRenderableCategoryAttrs,
    ISvgStructuralCategoryAttrs,
    Pick<ISvgPresentationAttrs, "clipPath" | "clipRule" | "filter" | "vectorEffect">
{
	href: string;
	x?: SvgLength;
	y?: SvgLength;
	width?: SvgLength;
	height?: SvgLength;
}



// <view>
export interface ISvgViewElementProps extends
    ISvgElementAttrs
{
	preserveAspectRatio?: PreserveAspectRatioPropType;
	viewBox?: SvgViewBox;
}



export interface ISvgIntrinsicElements
{
    svgA: ExtendedElement<SVGAElement, ISvgAElementProps>;
    animate: ExtendedElement<SVGAnimateElement, ISvgAnimateElementProps>;
    animateMotion: ExtendedElement<SVGAnimateMotionElement, ISvgAnimateMotionElementProps>;
    animateTarnsform: ExtendedElement<SVGAnimateTransformElement, ISvgAnimateMotionElementProps>;
    circle: ExtendedElement<SVGCircleElement, ISvgCircleElementProps>;
    clipPath: ExtendedElement<SVGClipPathElement, ISvgClipPathElementProps>;
    defs: ExtendedElement<SVGDefsElement, ISvgDefsElementProps>;
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
    feFuncA: ExtendedElement<SVGFEFuncAElement, ISvgFeFuncAElementProps>;
    feFuncB: ExtendedElement<SVGFEFuncBElement, ISvgFeFuncBElementProps>;
    feFuncG: ExtendedElement<SVGFEFuncGElement, ISvgFeFuncGElementProps>;
    feFuncR: ExtendedElement<SVGFEFuncRElement, ISvgFeFuncRElementProps>;
    feGaussianBlur: ExtendedElement<SVGFEGaussianBlurElement, ISvgFeGaussianBlurElementProps>;
    feImage: ExtendedElement<SVGFEImageElement, ISvgFeImageElementProps>;
    feMerge: ExtendedElement<SVGFEMergeElement, ISvgFeMergeElementProps>;
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
    g: ExtendedElement<SVGGElement, ISvgGElementProps>;
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
    switch: ExtendedElement<SVGSwitchElement, ISvgSwitchElementProps>;
    symbol: ExtendedElement<SVGSymbolElement, ISvgSymbolElementProps>;
    text: ExtendedElement<SVGTextElement, ISvgTextElementProps>;
    textPath: ExtendedElement<SVGTextPathElement, ISvgTextPathElementProps>;
    svgTitle: ExtendedElement<SVGTitleElement, ISvgElementAttrs>;
    tspan: ExtendedElement<SVGTSpanElement, ISvgTspanElementProps>;
    use: ExtendedElement<SVGUseElement, ISvgUseElementProps>;
    view: ExtendedElement<SVGViewElement, ISvgViewElementProps>;
}

