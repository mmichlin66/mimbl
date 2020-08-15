import {s_isSvg, s_isSvgSvg}from "../internal";


///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Utility functions for determining whether an element is an SVG.
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Determines whether the given element is one of the elements from the SVG spec; that is, <svg>
 * or any other from SVG.
 * @param elm Element to test
 */
export function isSvg( elm: Element): boolean
{
	return s_isSvg( elm);
}



/**
 * Determines whether the given element is the <svg> element.
 * @param elm  Element to test
 */
export function isSvgSvg( elm: Element): boolean
{
	return s_isSvgSvg( elm);
}



