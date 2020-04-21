import * as mim from "../api/mim"
import {Styleset, getStylePropValue, IStyleset} from "mimcss"



declare module "../api/mim"
{
    export interface IServiceDefinitions
	{
        LocalStyles: ILocalStyleService;
    }
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ILocalStyleService interface represents a service that is published by components that
// define their local CSS styles; that is, components deriving from the ComponentWithLocalStyles
// class. The interface allows retrieving CSS class and variable names decorated with the unique
// ID, which avoids duplication of names between components of the same or different types.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface ILocalStyleService
{
	// Returns the unique ID used to decorate CSS class and variable names to make them unique.
	readonly uniqueID: string;

	// Retrurns CSS class or variable name decorated with a unique ID.
	decorateName( name: string): string;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The ComponentWithLocalStyles class is a base class for components that define local CSS styles.
// When this component is mounted it creates a new <style> element (within the <head> element).
// All class names and variable names defined within this style will have a unique ID added to
// them in order to avoid duplication of names among other components (of the same or of different
// type. This class also publishes a service implementing the ILocalStyleService
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export abstract class ComponentWithLocalStyles<TProps = {}, TChildren = any>
				extends mim.Component<TProps,TChildren>
				implements ILocalStyleService
{
	constructor( props: TProps = null)
	{
		super( props);

		this.m_uniqueID = (Math.floor( Math.random() * 1000000000)).toString();
		this.rules = new Map<string,RuleInfo>();
		this.ruleNames = [];

		// create <style> element in the <head>
		this.styleElm = document.createElement( "style");
		this.styleElm.id = this.m_uniqueID;
		document.head.appendChild( this.styleElm);

		//// WebKit hack :(
		//this.styleElm.appendChild(document.createTextNode(""));
	}



	///////////////////////////////////////////////////////////////////////////////////////////////////
	// ILocalStyleService implementation.
	///////////////////////////////////////////////////////////////////////////////////////////////////

	// Returns the unique ID used to decorate CSS class and variable names to make them unique.
	public get uniqueID(): string { return this.m_uniqueID; }

	// Retrurns CSS class or variable name decorated with a unique ID.
	public decorateName( name: string): string
	{
		return name + this.m_uniqueID;
	}



	///////////////////////////////////////////////////////////////////////////////////////////////////
	// Public interface.
	///////////////////////////////////////////////////////////////////////////////////////////////////

	// Creates style rule.
	public createStyleRule( name: string, selector?: string, props?: Styleset): IMCssStyleRule
	{
		// create dummy style rule
		let info: RuleInfo = this.createDummyRule( name, "dummy {}");
		let cssomRule: CSSStyleRule = info.cssomRule as CSSStyleRule;

		// create style rule object
		let mcssStyleRule: MCssStyleRule = new MCssStyleRule( this.uniqueID, cssomRule);
		if (selector)
			mcssStyleRule.setSelector( selector);
		if (props)
			mcssStyleRule.setProperties( props);

		info.mcssRule = mcssStyleRule;
		return mcssStyleRule;
	}



	// Returns a rule with the given name.
	public getRule( name: string): IMCssRule
	{
		let info: RuleInfo = this.rules.get( name);
		return info === undefined ? undefined : info.mcssRule;
	}



	// Removes a rule with the given name.
	public removeRule( name: string): void
	{
	}



	public willMount()
	{
		this.vn.publishService( "LocalStyles", this);
	}	



	public willUnmount()
	{
		this.vn.unpublishService( "LocalStyles");

		this.styleElm.remove();
	}



	// Creates style rule.
	private createDummyRule( name: string, ruleText: string): RuleInfo
	{
		// check if we already have a rule with this name
		let info: RuleInfo = this.rules.get( name);
		if (info !== undefined)
			this.removeRule( name);

		// the new rule will becomes the last in the array of rules
		let index = this.ruleNames.length;

		// create dummy style rule
		let sheet: CSSStyleSheet = this.styleElm.sheet as CSSStyleSheet;
		sheet.insertRule( ruleText, index);
		let cssomRule: CSSRule = sheet.rules[index];

		// add the rule to our internal structures
		this.ruleNames.push( name);
		info = { mcssRule: null, cssomRule, index };
		this.rules.set( name, info);

		return info;
	}



	// Unique ID that is used to decorate CSS class and variable names defined by the component.
	private m_uniqueID: string;

	// Style element DOM object. Is defined only when the component is mounted.
	private styleElm: HTMLStyleElement;

	// Map of rules by their names.
	private rules: Map<string,RuleInfo>;

	// Array of rule names. This is needed to adjust indexes of rules after a rule is removed.
	private ruleNames: string[];

}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Helper type that keeps information about a CSS rule added to ComponentWithLocalStyles.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
type RuleInfo = { mcssRule: IMCssRule, cssomRule: CSSRule, index: number };



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The IMCssRule interface represents a CSS rule.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface IMCssRule
{
	// Unique ID used in class and variable names
	readonly uniqueID: string;

	// CSSOM rule
	readonly cssomRule: CSSRule;

	// Appends unique ID to the given name.
	decorate( name: string): string;

	// Replaces the marker "(*)" in the given name with the unique ID
	replace( name: string): string;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The MCssRule class is a base class for objects represented different types of CSS rules that
// are created by the ComponentWithLocalStyles component. This object simply keeps the unique
// ID that should be used by derived classes when creating class and variable names so that they
// are globally unique.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class MCssRuleBase<T extends CSSRule> implements IMCssRule
{
	constructor( uniqueID: string, cssomRule: T)
	{
		this.uniqueID = uniqueID;
		this.cssomRule = cssomRule;
	}



	// Appends unique ID to the given name.
	public decorate( name: string): string
	{
		return name + this.uniqueID;
	}



	// Replaces the marker "(*)" in the given name with the unique ID
	public replace( name: string): string
	{
		return name.replace( "(*)", this.uniqueID);
	}



	// Unique ID used in class and variable names
	public uniqueID: string;

	// CSSOM rule
	public cssomRule: T;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The IMCssStyleRule interface represents a style rule.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface IMCssStyleRule
{
	// Sets the rule selector. The string can contain the (*) marker, which will be substituted
	// with the unique ID.
	setSelector( selector: string);

	// Sets value for a style property. Both property name and property value can use the
	// (*) marker, which will be substituted with the unique ID.
	setProperty( propName: string, propVal: string, important?: boolean): void;

	// Sets several style properties. Both property names and property values can use the
	// (*) marker, which will be substituted with the unique ID.
	setProperties( props: Styleset): void;

	// Sets value for a style property. Property name can use the (*) marker, which will be
	// substituted with the unique ID.
	removeProperty( propName: string): void;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The MCssStyleRule interface represents a style rule that contains a selector and a set of
// style property name-value pairs.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class MCssStyleRule extends MCssRuleBase<CSSStyleRule> implements IMCssStyleRule
{
	constructor( uniqueID: string, cssomRule: CSSStyleRule)
	{
		super( uniqueID, cssomRule);
	}



	// Sets the rule selector. The string can contain the (*) marker, which will be substituted
	// with the unique ID.
	public setSelector( selector: string)
	{
		this.cssomRule.selectorText = this.replace( selector);
	}



	// Sets value for a style property. Both property name and property value can use the
	// (*) marker, which will be substituted with the unique ID.
	public setProperty( propName: string, propVal: string, important?: boolean): void
	{
		this.cssomRule.style.setProperty( this.replace( propName), this.replace( propVal),
						important? "important" : undefined);
	}



	// Sets several style properties. Both property names and property values can use the
	// (*) marker, which will be substituted with the unique ID.
	public setProperties( props: Styleset): void
	{
		if (!props)
			return;

		for( let propName in props)
		{
			let propVal = getStylePropValue( propName as keyof IStyleset, props[propName]);
			this.cssomRule.style[this.replace( propName)] = this.replace( propVal);
		}
	}



	// Sets value for a style property. Property name can use the (*) marker, which will be
	// substituted with the unique ID.
	public removeProperty( propName: string): void
	{
		this.cssomRule.style.removeProperty( this.replace( propName));
	}
}



