import {IIndependentCompVN, IComponent, IComponentClass} from "../api/mim"
import {ClassCompVN, DN, moveNode, VN, VNDisp} from "../internal"



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The class IndependentCompVN is a node that holds an instance of an IComponent-implementing
// object. The component instance also serves as the node's key.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class IndependentCompVN extends ClassCompVN implements IIndependentCompVN
{
	constructor( comp: IComponent)
	{
		super();

        this.compClass = comp.constructor as IComponentClass;
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



	// Initializes internal stuctures of the virtual node. This method is called right after the
    // node has been constructed. For nodes that have their own DOM nodes, creates the DOM node
    // corresponding to this virtual node.
	public mount( creator: IComponent, parent: VN, index: number, anchorDN: DN, beforeDN?: DN | null): void
    {
        // if the component is already connected to a node, we don't mount it again; instead, we
        // remember the new parameters and move it to a new location. This can happen when the
        // component is "moved" to a different place in the element hierarchy and the unmount
        // method will also be invoked in this Mimbl tick. In this case, we take note to not
        // unmount our node.
        if (this.comp.vn)
        {
            this.ignoreUnmount = true;
            this.creator = creator;
            this.parent = parent;
            this.index = index;
            this.anchorDN = anchorDN;
            if (this.rootHost)
                anchorDN.insertBefore( this.rootHost, beforeDN);
            else
                moveNode( this, anchorDN, beforeDN);
        }
        else
            super.mount( creator, parent, index, anchorDN, beforeDN);
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
	// point to a VN of the same type as this node. The returned value indicates whether children
	// should be updated (that is, this node's render method should be called).
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
        {
            let fn = this.comp.didReplace;
            fn && fn.call( this.comp, oldComp);
        }
	}



    /**
     * Flag indicating that the component's mount method was invoked while it was already mounted.
     * It can happen when the component is "moved" to a different place in the element hierarchy
     * and the unmount method will also be invoked in this Mimbl tick. In this case, we don't call
     * the component's willMount and willUnmount methods.
     */
    private ignoreUnmount?: boolean;
}



