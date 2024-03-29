﻿///////////////////////////////////////////////////////////////////////////////////////////////////
// Gathering update statistics
///////////////////////////////////////////////////////////////////////////////////////////////////

// Categories of changed entities to gather statistics about.
export enum StatsCategory
{
	Root,
	Comp,
	Elm,
	Text,
	Attr,
	Event,
}



// Actions on an entity to gather statistics about. Not all actions are relevant for all
// categories:
//	- Updated doesn't exist for components and for elements
//	- Moved doesn't exist for attributes
//	- Rendered only exists for components
export enum StatsAction
{
	Added= 1,
	Deleted = 2,
	Updated = 3,
	Moved = 4,
	Rendered = 5,
}



// Storage for a number of each action under a category.
class CategoryStats
{
	added: number = 0;
	deleted: number = 0;
	updated: number = 0;
	moved: number = 0;
	rendered: number = 0;

	public hasSomeData()
	{
		return this.added || this.deleted || this.updated || this.moved || this.rendered;
	}
}



export class DetailedStats
{
	public static start( name: string)
	{
        if (!DetailedStats.instance)
        {
            DetailedStats.instance = new DetailedStats( name);
            DetailedStats.instance.start();
        }
	}



	public static stop( printSummary: boolean = true)
	{
        if (DetailedStats.instance)
        {
            DetailedStats.instance.stop( printSummary);
            DetailedStats.instance = null;
        }
	}



	// increments the number of times the given action was performed on an entity of a given
	// category. If the entity is a DOM entity (as opposed to a component), then the DOM
	// total number is also incremented.
    public static log( category: StatsCategory, action: StatsAction, qty: number = 1): void
    {
        DetailedStats.instance?.log( category, action, qty);
    }



    private static instance: DetailedStats | null;


	private name: string;
	private startTime: number;
	private duration: number;
	private comp: CategoryStats = new CategoryStats();
	private elm: CategoryStats = new CategoryStats();
	private text: CategoryStats = new CategoryStats();
	private attr: CategoryStats = new CategoryStats();
	private event: CategoryStats = new CategoryStats();



	private constructor( name: string)
	{
		this.name = name;
	}



	private start()
	{
		this.duration = 0.0;
		this.startTime = performance.now();
	}



	private stop( printSummary: boolean = true)
	{
		this.duration = performance.now() - this.startTime;

		if (printSummary)
			console.log( this.toString());
	}



	// increments the number of times the given action was performed on an entity of a given
	// category. If the entity is a DOM entity (as opposed to a component), then the DOM
	// total number is also incremented.
	private log( category: StatsCategory, action: StatsAction, qty: number): void
	{
		let categoryStats: CategoryStats;
		switch( category)
		{
			case StatsCategory.Comp: categoryStats = this.comp; break;
			case StatsCategory.Elm: categoryStats = this.elm; break;
			case StatsCategory.Text: categoryStats = this.text; break;
			case StatsCategory.Attr: categoryStats = this.attr; break;
			case StatsCategory.Event: categoryStats = this.event; break;
			default: return;
		}

		switch( action)
		{
			case StatsAction.Added: categoryStats.added += qty; break;
			case StatsAction.Deleted: categoryStats.deleted += qty; break;
			case StatsAction.Updated: categoryStats.updated += qty; break;
			case StatsAction.Moved: categoryStats.moved += qty; break;
			case StatsAction.Rendered: categoryStats.rendered += qty; break;
		}
	}



	// Returns textual representation of the statistics.
	private toString(): string
	{
		return `${this.name} ${this.duration.toFixed(2)}ms ` +
				this.getCompString() + this.getElmString() + this.getTextString() +
				this.getAttrString() + this.getEventString();
	}



	// Returns textual representation of the component statistics.
	private getCompString(): string
	{
		if (!this.comp.hasSomeData())
			return "";

		let s = "";
		s += this.getValString( s, "+", this.comp.added);
		s += this.getValString( s, "-", this.comp.deleted);
		s += this.getValString( s, "\u270E", this.comp.rendered);
		s += this.getValString( s, "\u21FF", this.comp.moved);

		return `comp(${s}) `;
	}



	// Returns textual representation of the element statistics.
	private getElmString(): string
	{
		if (!this.elm.hasSomeData())
			return "";

		let s = "";
		s += this.getValString( s, "+", this.elm.added);
		s += this.getValString( s, "-", this.elm.deleted);
		s += this.getValString( s, "\u21FF", this.elm.moved);

		return `elm(${s}) `;
	}



	// Returns textual representation of the text node statistics.
	private getTextString(): string
	{
		if (!this.text.hasSomeData())
			return "";

		let s = "";
		s += this.getValString( s, "+", this.text.added);
		s += this.getValString( s, "-", this.text.deleted);
		s += this.getValString( s, "*", this.text.updated);
		s += this.getValString( s, "\u21FF", this.text.moved);

		return `text(${s}) `;
	}



	// Returns textual representation of the attribute statistics.
	private getAttrString(): string
	{
		if (!this.attr.hasSomeData())
			return "";

		let s = "";
		s += this.getValString( s, "+", this.attr.added);
		s += this.getValString( s, "-", this.attr.deleted);
		s += this.getValString( s, "*", this.attr.updated);

		return `attr(${s}) `;
	}



	// Returns textual representation of the attribute statistics.
	private getEventString(): string
	{
		if (!this.event.hasSomeData())
			return "";

		let s = "";
		s += this.getValString( s, "+", this.event.added);
		s += this.getValString( s, "-", this.event.deleted);
		s += this.getValString( s, "*", this.event.updated);

		return `event(${s}) `;
	}



	// Adds the given sign and value to the given string but only if the value is non-zero.
	private getValString( s: string, sign: string, val: number): string
	{
		if (val === 0)
			return "";
		else
			return (s.length > 0 ? " " : "") + sign + val;
	}



	public static stats: DetailedStats;
}



