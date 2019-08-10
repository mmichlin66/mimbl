import * as mim from "./mim"
import {VN} from "./VN"



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The VNChain class represents a doublly-linked list of virtual nodes. It references the first
// and last sub-nodes and provides some convenience methods.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class VNChain implements mim.IVNChain
{
	constructor( vn?: VN)
	{
		if (vn !== undefined && vn != null)
			this.appendVN( vn);
	}



	// IVNChain implementation
	public get First(): mim.IVNode { return this.first; }
	public get Last(): mim.IVNode { return this.last; }
	public get Count(): number { return this.count; }



	// Removes all nodes from the chain.
	public clear(): void
	{
		this.first = this.last = null;
		this.count = 0;
	}



	// Adds a new node to the end of the chain.
	public appendVN( vn: VN): void
	{
		if (vn === null)
			return;

		vn.prev = this.last;
		if (this.first === null)
			this.first = this.last = vn;
		else
		{
			this.last.next = vn;
			this.last = vn;
		}
		vn.next = null
		this.count++;
	}



	// Adds all nodes from the given chain to the end of our chain.
	public appendChain( chain: VNChain): void
	{
		if (chain === null || chain.first === null)
			return;

		chain.first.prev = this.last;
		if (this.first === null)
		{
			this.first = chain.first;
			this.last = chain.last;
		}
		else
		{
			this.last.next = chain.first;
			this.last = chain.last;
		}
		chain.last.next = null;
		this.count += chain.count;
	}



	// Adds a new node to the start of the chain.
	public insertVN( vn: VN): void
	{
		if (vn === null)
			return;

		vn.next = this.first;
		if (this.first === null)
			this.first = this.last = vn;
		else
		{
			this.first.prev = vn;
			this.first = vn;
		}
		vn.prev = null
		this.count++;
	}



	// Replaces the given node with the nodes from the given chain.
	public replaceVNWithChain( vn: VN, chain: VNChain): void
	{
		if (vn === null || chain === null)
			return;

		let prev: VN = vn.prev;
		let next: VN = vn.next;
		if (this.first === vn)
			this.first = chain.first;
		if (this.last === vn)
			this.last = chain.last;
		if (prev !== null)
			prev.next = chain.first;
		if (next != null)
			next.prev = chain.last;

		this.count += chain.count - 1;
}



	// Deletes the given node from the chain.
	public deleteVN( vn: VN): void
	{
		if (vn === null)
			return;

		let prev: VN = vn.prev;
		let next: VN = vn.next;
		if (this.first === vn)
			this.first = next;
		if (this.last === vn)
			this.last = prev;
		if (prev !== null)
			prev.next = next;
		if (next != null)
			next.prev = prev;

		this.count--;
	}



	// First node in the chain of sub-nodes. Null for empty chains.
	public first: VN = null;

	// Last node in the chain of sub-nodes. Null for empty chains.
	public last: VN = null;

	// Number of nodes in the chain.
	public count: number = 0;
}



