import {s_isSvg, s_isSvgSvg} from "../internal";


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



/**
 * Type that extends the Promise class with the resolve and reject methods so that the promise can
 * be created in one place and resolved or rejected in a different place.
 */
export type PromiseEx<T = any> = Promise<T> &
    {
        resolve: (value?: T | PromiseLike<T>) => void,
        reject: (reason?: any) => void
    };



/**
 * Creates Promise objects that can be resolved or rejected externally. The returned PromiseEx
 * object has resolve and reject methods.
 */
export function createPromiseEx<T = any>(): PromiseEx<T>
{
    let tempResolve, tempReject;
    let promise = new Promise<T>( function(resolve, reject) {
        tempResolve = resolve;
        tempReject = reject;
    }) as PromiseEx<T>;

    promise.resolve = tempResolve;
    promise.reject = tempReject;
    return promise;
}



/**
 * function to create Promise objects that can be resolved or rejected externally. The returned
 * Promise object has resolve and reject methods.
 */
export class Defer<T = any> extends Promise<T>
{
    constructor()
    {
        super( function(res, rej) {
            this.resolve = res;
            this.reject = rej;
        });
    }

    public resolve: (value?: T | PromiseLike<T>) => void;
    public reject: (reason?: any) => void;
}



