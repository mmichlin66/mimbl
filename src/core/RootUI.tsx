import * as mim from "./mim"
import {RootVN} from "./RootVN"


export class RootErrorUI extends mim.Component
{
	private rootVN: RootVN;
	private err: any;
	private pathString: string;

	constructor( rootVN: RootVN, err: any, path: string[])
	{
		super();

		this.rootVN = rootVN;
		this.err = err;
		this.pathString = path ? path.join( " \u2192 ") : "";
	}

	public render(): any
	{
		return <div id="rootError" style={{display:"flex", flexDirection:"column", alignItems: "start"}}>
			<div>{this.err.message}</div>
			<div>{this.pathString}</div>
			<hr style={{width:"100%"}}/>
			<button click={this.onRestart}>Restart</button>
		</div>
	}

	private onRestart = (): void =>
	{
		this.rootVN.restart();
	};

}



export class RootWaitingUI extends mim.Component
{
	public render(): any
	{
		return "Loading ...";
	}
}



