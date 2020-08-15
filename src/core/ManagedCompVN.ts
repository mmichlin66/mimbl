import {IManagedCompVN, IComponentClass, VNType, IComponent, setRef, RefPropType} from "../api/mim"
import {ClassCompVN, VNBase, VN, VNUpdateDisp} from "../internal"

/// #if USE_STATS
	import {DetailedStats, StatsCategory, StatsAction} from "../utils/Stats"
/// #endif



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Represents a component implementing the IComponent<> interface.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class ManagedCompVN extends ClassCompVN implements IManagedCompVN
{
	// Type of the class-based component.
	public compClass: IComponentClass;



	constructor( compClass: IComponentClass, props: any, children: any[])
	{
		super();

		this.type = VNType.ManagedComp;
		this.compClass = compClass;

		// copy properties to our own object excluding framework-handled key and ref
		this.props = {};
		if (props)
		{
			for( let propName in props)
			{
				let propVal: any = props[propName];
				if (propVal === undefined || propVal === null)
				{
					// ignore properties with values undefined and null
					continue;
				}
				else if (propName === "key")
				{
					// remember key property but don't copy it to this.props object
					this.key = propVal;
				}
				else if (propName === "ref")
				{
					// remember ref property but don't copy it to this.props object
					this.ref = propVal;
				}
				else
					this.props[propName] = propVal;
			}

			// if key property was not specified, use id; if id was not specified key will remain
			// undefined.
			if (this.key === undefined)
				this.key = props.id;
		}

		// remember children as part of props
		this.props.children = children;
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



	// Initializes the node by passing the parent node to it. After this, the node knows its
	// place in the hierarchy and gets access to the root of it - the RootVN object.
	public init( parent: VNBase, creator: IComponent): void
	{
		super.init( parent, creator);

		// create component instance
		this.comp = new this.compClass( this.props);
	}



	// Creates internal stuctures of the virtual node so that it is ready to produce children.
	// This method is called right after the node has been constructed.
	// This method is part of the Render phase.
	public willMount(): void
	{
        super.willMount();

        // set the reference value if specified
		if (this.ref !== undefined)
			setRef( this.ref, this.comp);
	}



	// This method is called before the content of node and all its sub-nodes is removed from the
	// DOM tree.
	// This method is part of the render phase.
	public willUnmount(): void
	{
		// unset the reference value if specified. We check whether the reference still points
		// to our component before setting it to undefined. If the same Ref object is used for
		// more than one components (and/or elements) it can happen that the reference is changed
		// before our component is unmounted.
		if (this.ref !== undefined)
			setRef( this.ref, undefined, this.comp);

        super.willUnmount();
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: VN): boolean
	{
		// update is possible if the component class name is the same
		return this.compClass === (newVN as ManagedCompVN).compClass;
	}



	// Updates this node from the given node. The newVN parameter is guaranteed to point to a
	// VN of the same type as this node. Returns true if updating sub-nodes is necessary and
	// false otherwise.
	public prepareUpdate( newVN: VN): VNUpdateDisp
	{
		let newClassVN = newVN as ManagedCompVN;

		// let the component know about the new properties (if it is interested in them)
		let shouldRender: boolean = true;
		if (this.comp.shouldUpdate !== undefined)
			shouldRender = this.comp.shouldUpdate( newClassVN.props);

		// if reference specification changed then set or unset it as necessary
		if (newClassVN.ref !== this.ref)
		{
			// remember the new reference object
			this.ref = newClassVN.ref;

			// if reference is now specified, set it now; note that we already determined that
			// the reference object is different.
			if (this.ref !== undefined)
				setRef( this.ref, this.comp);
		}
		else if (newClassVN.ref === undefined)
		{
			// we know that our reference is defined, so unset it
			setRef( this.ref, undefined, this.comp);
		}

		// remeber the new value of the key property (even if it is the same)
		this.key = newClassVN.key;

		// shallow copy the new properties from the other node to our object. This is needed
		// because the component got our props object in the constructor and will keep
		// working with it - especially if it doesn't implement the shouldUpdate method.
		Object.keys(this.props).forEach( key => delete this.props[key]);
		Object.assign( this.props, newClassVN.props);

		// since the rendering produced by a function may depend on factors beyond properties,
		// we always indicate that it is necessary to update the sub-nodes. The commitUpdate
		// method should NOT be called.
		return VNUpdateDisp.getStockValue( false, shouldRender);
	}



	// Node's key. The derived classes set it based on their respective content. A key
	// can be of any type.
	public key: any;

	// Properties that were passed to the component.
	private props: any;

	// Reference to the component that is specified as a "ref" property. Reference object is
	// set when analyzing properties in the constructor and during update. Reference value is
	// set during mount and unset during unmount.
	private ref: RefPropType<any>;
}



