// This example demonstrates using triggers and computed properties

import * as mim from "mimbl";



// Define our component
class ArrayOfNumbers extends mim.Component
{
    // Component will be rerendered when items are addet to or removed from the array
    @mim.trigger arr: number[] = [];

    // Computed property calculating the count of odd numbers in the array
    @mim.computed get oddCount(): number
    {
        return this.arr.reduce((prev, curr) => prev += curr % 2 === 1 ? 1 : 0, 0);
    }

    // Computed property can use other computed properties
    @mim.computed get evenCount(): number
    {
        return this.arr.length - this.oddCount;
    }

    render()
    {
        return <div style={{display: "flex", flexDirection: "column", gap: 8}}>
            <div style={{display: "flex", gap: 8}}>
                <span><button click={this.onAddItem}>Add Item</button></span>
                <span><button click={this.onRemoveItem} disabled={this.arr.length === 0}>Remove Item</button></span>
                <span><button click={this.onReplaceValues} disabled={this.arr.length === 0}>Replace Values</button></span>
                <span><button click={this.onSort} disabled={this.arr.length <= 1}>Sort</button></span>
                <span><button click={this.onClear} disabled={this.arr.length === 0}>Clear</button></span>
            </div>
            <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                {this.arr.map( item => <span>{item}</span>)}
            </div>
            <div>Count of all numbers in the array: {this.arr.length}</div>
            <div>Count of odd numbers: {this.oddCount}</div>
            <div>Count of even numbers: {this.evenCount}</div>
        </div>
    }

    private getRandomNumber()
    {
        return Math.floor(Math.random() * 100) + 1;
    }

    private onAddItem()
    {
        this.arr.push( this.getRandomNumber());
    }

    private onRemoveItem()
    {
        if (this.arr.length == 0)
            return;

        this.arr.pop();
    }

    private onReplaceValues()
    {
        for( let i = 0, count = this.arr.length; i < count; i++)
             this.arr[i] = this.getRandomNumber();
    }

    private onSort()
    {
        this.arr = this.arr.sort((a,b) => a - b);
    }

    private onClear()
    {
        this.arr = [];
    }
}



// Mount our component under the body element.
mim.mount(<ArrayOfNumbers/>);


