﻿import {DN, IComponent, IComponentClass} from "../api/CompTypes"
import { ClassCompVN } from "./ClassCompVN";
import { moveNode } from "./Reconciler";
import { VNDisp } from "./VNTypes";
import { VN } from "./VN";



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class IndependentCompVN is a node that holds an instance of an IComponent-implementing
// object. The component instance also serves as the node's key.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class IndependentCompVN extends ClassCompVN
{
	/** Component instance, which is always defined for independent components. */
	public comp: IComponent;

	constructor( comp: IComponent)
	{
		super();

        this.compClass = comp.constructor as IComponentClass;
        this.comp = this.key = comp;
	};



	/** String representation of the virtual node. */
	public get name(): string
	{
		// components can define the displayName property; if they don't then the default name
		// is the component's constructor name
		return this.comp.displayName ?? this.comp.constructor.name;
	}



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount( parent: VN, index: number, anchorDN: DN, beforeDN: DN): void
    {
        // if the component is already connected to a node, we don't mount it again; instead, we
        // remember the new parameters and move it to a new location. This can happen when the
        // component is "moved" to a different place in the element hierarchy and the unmount
        // method will also be invoked in this Mimbl tick. In this case, we take note to not
        // unmount our node.
        if (this.comp!.vn)
        {
            this.ignoreUnmount = true;
            this.parent = parent;
            this.index = index;
            this.anchorDN = anchorDN;
            if (this.rootHost)
                anchorDN!.insertBefore( this.rootHost, beforeDN);
            else
                moveNode( this, anchorDN, beforeDN);
        }
        else
            super.mount( parent, index, anchorDN, beforeDN);
    }



    // Releases reference to the DOM node corresponding to this virtual node.
    public unmount( removeFromDOM: boolean): void
    {
        if (this.ignoreUnmount)
            this.ignoreUnmount = false;
        else
            super.unmount( removeFromDOM);
    }



	// Updated this node from the given node. This method is invoked only if update
	// happens as a result of rendering the parent nodes. The newVN parameter is guaranteed to
	// point to a VN of the same type as this node.
	public update( newVN: IndependentCompVN, disp: VNDisp): void
	{
        // if it is the same component instance, we don't need to do anything
		if (this.comp === newVN.comp)
    		return;

        // we are here if the component instances are different; we need to prepare the old
        // instance for unmounting and the new one for mounting.
        let oldComp = this.comp;
        this.prepareUnmount( oldComp);
        this.comp = this.key = newVN.comp;
        this.prepareMount( newVN.comp);

        super.update( this, disp);

        if (oldComp)
            this.comp.didReplace?.call( this.comp, oldComp);
	}



    /**
     * Flag indicating that the component's mount method was invoked while it was already mounted.
     * It can happen when the component is "moved" to a different place in the element hierarchy
     * and the unmount method will also be invoked in this Mimbl tick. In this case, we don't call
     * the component's willMount and willUnmount methods.
     */
    private ignoreUnmount?: boolean;
}



