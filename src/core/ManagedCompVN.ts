﻿import {IManagedCompVN, IComponentClass, setRef, RefPropType, Component, IComponent} from "../api/mim"
import {ClassCompVN, DN, VN, VNDisp} from "../internal"



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Represents a managed component implementing the IComponent<> interface.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class ManagedCompVN extends ClassCompVN implements IManagedCompVN
{
	constructor( compClass: IComponentClass, props: any, children: any[])
	{
		super();

		this.compClass = compClass;

		// remember the props and remember the children as part of the props
		if (!props)
            this.props = {children};
        else
		{
            props.children = children;
            this.props = props;

            // get the key (if exists) because we will need id during update even before the
            // component is mounted
            this.key = props.key;
		}
	};



	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string
	{
		// components can define the displayName property; if they don't then the default name
		// is the component's constructor name plus key if defined. Note that component instance
		// might not be created yet when this method is called
		if (this.comp && this.comp.displayName)
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
	public mount( creator: IComponent, parent: VN, index: number, anchorDN: DN, beforeDN?: DN | null): void
    {
		// create component instance
        this.comp = new this.compClass( this.props);

        // set the reference value if specified
        if (this.ref)
        {
            setRef( this.ref, this.comp);

            // we delete the ref property from the props because it should not be available to
            // the component
            delete this.props.ref;
        }

        // we delete the key property from the props because it should not be available to
        // the component
        if (this.key != null)
            delete this.props.key;

        super.mount( creator, parent, index, anchorDN, beforeDN);
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

        super.unmount( removeFromDOM);

        this.comp = null;
    }



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: ManagedCompVN, disp: VNDisp): void
	{
        let comp = this.comp;

		// let the component know about the new properties (if it is interested in them)
		let shouldRender = comp.shouldUpdate && comp.shouldUpdate( newVN.props);

		// if reference specification changed then set or unset it as necessary
		if (newVN.ref !== this.ref)
		{
			// remember the new reference object
			this.ref = newVN.ref;

			// if reference is now specified, set it now; note that we already determined that
			// the reference object is different.
			if (this.ref)
				setRef( this.ref, comp);
		}
		else if (this.ref)
			setRef( this.ref, undefined, comp);

		// remember the new value of the key property (even if it is the same)
		this.key = newVN.key;

		// remember the new properties
        (comp as Component).props = this.props = newVN.props;

		if (shouldRender)
            super.update( newVN, disp);
	}



	// Properties that were passed to the component.
	private props: any;

	// Reference to the component that is specified as a "ref" property. Reference object is
	// set when analyzing properties in the constructor and during update. Reference value is
	// set during mount and unset during unmount.
	private ref: RefPropType<any>;
}



