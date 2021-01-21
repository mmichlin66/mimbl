import {IIndependentCompVN, Component} from "../api/mim"
import {ClassCompVN} from "../internal"



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class IndependentCompVN is a node that holds an instance of an IComponent-implementing
// object. The component instance also serves as the node's key.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class IndependentCompVN extends ClassCompVN implements IIndependentCompVN
{
	constructor( comp: Component)
	{
		super();

        this.comp = this.key = comp;
	};



	// String representation of the virtual node. This is used mostly for tracing and error
	// reporting. The name can change during the lifetime of the virtual node; for example,
	// it can reflect an "id" property of an element (if any).
	public get name(): string
	{
		// components can define the displayName property; if they don't then the default name
		// is the component's constructor name
		return this.comp.displayName ? this.comp.displayName : this.comp.constructor.name;
	}



	// Determines whether the update of this node from the given node is possible. The newVN
	// parameter is guaranteed to point to a VN of the same type as this node.
	public isUpdatePossible( newVN: IndependentCompVN): boolean
	{
		// update is possible if the component class is the same
		return this.comp.constructor === newVN.comp.constructor;
	}



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
	public update( newVN: IndependentCompVN): boolean
	{
        // if it is the same component instance, we don't need to do anything
		if (this.comp === newVN.comp)
    		return false;

        // we are here if the component instances are different; we need to prepare the old
        // instance for unmounting and the new one for mounting.
        this.unmount();
        this.oldComp = this.comp;
        this.comp = this.key = newVN.comp;
        this.mount();

        return true;
	}



    // Notifies this node that it's children have been updated.
	public didUpdate(): void
	{
        if (this.oldComp)
        {
            let fn = this.comp.didReplace;
            fn && fn.call( this.comp, this.oldComp);
            this.oldComp = undefined;
        }
	}


    // if the node is recycled for a different component, this field keeps the old component
    // until the didUpdate method is called.
    private oldComp: Component;
}



// Define methods/properties that are invoked during mounting/unmounting/updating and which don't
// have or have trivial implementation so that lookup is faster.
IndependentCompVN.prototype.ignoreUnmount = false;



