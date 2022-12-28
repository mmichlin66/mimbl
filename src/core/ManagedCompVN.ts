import {DN, EventPropType, IComponentClass, RefPropType} from "../api/CompTypes"
import { IVN, VNDisp } from "./VNTypes";
import { ClassCompVN } from "./ClassCompVN";
import { VN, setRef, updateRef } from "./VN";
import { EventsMixin } from "./Events";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Represents a managed component implementing the IComponent<> interface.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class ManagedCompVN extends ClassCompVN
{
	// Properties that were passed to the component. For managed components this is always defined.
    // Even if no properties were passed to the component, props would include an array of
    // children (which might be null or empty).
	public props: Record<string,any>;



    constructor( compClass: IComponentClass, props: Record<string,any> | undefined, children: IVN[] | null)
	{
		super();

		this.compClass = compClass;
        this.props = props as Record<string,any>;
        this.children = children;

        // get the key (if exists) because we will need it during update even before the
        // component is mounted
        this.key = props?.key;
	};


	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string
	{
		// components can define the displayName property; if they don't then the default name
		// is the component's constructor name plus key if defined. Note that component instance
		// might not be created yet when this method is called
		if (this.comp?.displayName)
			return this.comp.displayName;
		else
		{
			let name = this.compClass.name;
			if (this.key != null)
				name += "@" + this.key;

			return name;
		}
	}



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN: DN): void
    {
        // translate properties into attributes, events and custom attributes
        this.parseProps( this.props);

		// create component instance
        this.comp = new this.compClass( this.props);

        // add event listeners if any
        this.events?.mount(this.comp);

        if (this.ref)
            setRef( this.ref, this.ownDN);

        super.mount( parent, index, anchorDN, beforeDN);
    }



    // Releases reference to the DOM node corresponding to this virtual node.
    public unmount( removeFromDOM: boolean): void
    {
		// unset the reference value if specified. We check whether the reference still points
		// to our component before setting it to undefined. If the same Ref object is used for
		// more than one components (and/or elements) it can happen that the reference is changed
		// before our component is unmounted.
		if (this.ref)
			setRef( this.ref, undefined, this.comp);

        // remove event listeners if any
        this.events?.unmount();

        super.unmount( removeFromDOM);

        this.comp = undefined;
    }



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node.
	public update( newVN: ManagedCompVN, disp: VNDisp): void
	{
        // if the new VN was created by a different creator, remember it.
        let isNewCreator = this.creator !== newVN.creator;
        if (isNewCreator)
            this.creator = newVN.creator;

        newVN.parseProps( newVN.props);

		// remember the new value of the key property (even if it is the same)
		this.key = newVN.key;

        // just to save on lookups
        let comp = this.comp!;

		// if reference specification changed then set or unset it as necessary
		if (this.ref !== newVN.ref)
            this.ref = updateRef(this.ref, newVN.ref, comp);

        // update attributes and events
        this.updateEvents( newVN.events);

		// ask the component whether it requires re-rendering because of the new properties
		let shouldRender = !comp.shouldUpdate || comp.shouldUpdate( newVN.props!);

		// let the component know about the new properties and remember them in our node
        comp.props = this.props = newVN.props;

		if (shouldRender)
            super.update( newVN, disp);
	}



	/**
     * Goes over the original properties and parses them into build-in (ref), events and regular.
     * Replaces this.props with an object that contains children and regular props only.
     */
	private parseProps( props: Record<string,any> | undefined): void
	{
        let actualProps: Record<string,any> = {children: this.children};

        // loop over all properties
        if (props)
        {
            for( let [propName, propVal] of Object.entries(props))
            {
                if (propName === "ref")
                    this.ref = propVal as RefPropType<any>;
                else if (propName.startsWith("$on_"))
                {
                    this.events ??= new EventsMixin(this.creator);
                    this.events.add(propName.substring(4), propVal as EventPropType);
                    actualProps[propName] = propVal;
                }
                else if (propName !== "key")
                    actualProps[propName] = propVal;
            }
        }

        this.props = actualProps;
	}



	/** Updates event listeners by comparing the old and the new ones. */
	private updateEvents( newEvents: EventsMixin | undefined): void
	{
        if (this.events)
        {
            if (newEvents)
                this.events.update(newEvents);
            else
            {
                this.events.unmount();
                this.events = undefined;
            }
        }
        else if (newEvents)
        {
            newEvents.mount(this.comp!);
            this.events = newEvents;
        }
	}



    /**
     * Children that should be rendered under the component. We remember them here until they
     * become part of props.
     */
    private children: IVN[] | null;

	// Reference to the component that is specified as a "ref" property. Reference object is
	// set when analyzing properties in the constructor and during update. Reference value is
	// set during mount and unset during unmount.
	private ref: RefPropType<any>;

	// Object that serves as a container for event information.
	private events: EventsMixin | undefined;
}



