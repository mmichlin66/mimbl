import * as mim from "mimbl";


// Define component
class MyComponent extends mim.Component
{
	public render()
	{
		return <div/>
	}
}

// Mount our component under the body element.
mim.mount( new MyComponent());


