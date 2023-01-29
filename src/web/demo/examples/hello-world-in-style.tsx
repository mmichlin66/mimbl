// This example demonstrates using Mimcss for styling Mimbl components. More information
// about Mimcss is available at https://mimcss.com.

import * as mim from "mimbl";
import * as css from "mimcss"



// Define styles for our component
class MyStyles extends css.StyleDefinition
{
    hello = this.$class({
        fontSize: 40,
        fontWeight: "bold",
        padding: "0.5em",
        color: css.Colors.dodgerblue,
        border: [2, "inset", "darkblue"],
        borderRadius: 16,
        textAlign: "center"
    })
}



// Define component that displays "Hello World!"
class HelloWorld extends mim.Component
{
    styles: MyStyles;

    // Activate styles when the component mounts
    willMount()
    {
        this.styles = css.activate(MyStyles);
    }

    // Deactivate styles when the component unmounts
    willUnmount()
    {
        css.deactivate(this.styles);
    }

    // Render our component's HTML content
	public render()
	{
        // specify class by using the property of our style definition class
		return <div class={this.styles.hello}>
            Hello World in Style!
        </div>
	}
}



// Mount our component under the body element.
mim.mount(<HelloWorld/>);


