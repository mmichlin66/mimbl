import * as mimurl from "mimurl"
import * as mim from "../core/mim"
import {IHtmlAElementProps} from "../core/HtmlTypes"



declare module "../core/mim"
{
    export interface IServiceDefinitions
	{
        Router: IRouterService;
    }
}



/**
 * The IRouterService is a service that is published by the Router component. It allows
 * subscribers to navigate to paths defined by Router's routes.
 */
export interface IRouterService
{
	// Navigates to a route matching the given URL.
	navigateByURL( url: string, makeHistoryEntry?: boolean): void;

	// Navigates to a route with the given ID.
	navigateByID( id: string, fields?: RouteFields, makeHistoryEntry?: boolean): void;
}



/**
 * Type of object containing field values that is passed when navigating to a route. When
 * navigating by route ID, the fields are passed explicitly. When navigating by URL, the fields
 * are extracted from the URL according to the URL pattern in the route.
 */
export type RouteFields = { [P: string]: mimurl.FieldValueType };



/**
 * Type of a function that provides content to display for a route. It can return a Promise in
 * which case the Router will display progress UI until the content becomes available.
 */
export type NavToRouteFuncType = (fields: RouteFields) => any;

/**
 * Type of a function that is invoked when navigating from the currently displayed route. If false
 * is returned, navigation doesn't happen. This allows the current component to prompt the user
 * about unsaved data. If Promise is returned, the Router will wait until the response is available.
 */
export type NavFromRouteFuncType = () => boolean | Promise<boolean>;



/**
 * The Route interface defines a navigation target. Routes can have sub-routes, which creates a
 * hierarchy of routes.
 */
export interface Route
{
	/**
	 * Unique (but optional) ID that allows navigating to the target using a simple ID instead of
	 * path. The path member will be displayed in the browser's address control.
	 */
	id?: string;

	/**
	 * URL pattern - can contain named parameters (as in /users/{uid}). This can be left empty
	 * if only id is used
	 */
	urlPattern?: string;

	/**
	 * Optional property that is passed to the history.pushState function.
	 */
	title?: string;

	/**
	 * Navigation function that provides content to display.
	 */
	navToFunc?: NavToRouteFuncType;

	/**
	 * Navigation function that allows the current component to prompt the user about unsaved data.
	 */
	navFromFunc?: NavFromRouteFuncType;

	/**
	 * Ordered list of Route objects, which are sub-routes of this route.
	 */
	subRoutes?: Route[];
}



/**
 * Internal class that is used as a state for History.pushState function. It remembers the
 * parameters of a route to navigate to when the user goes back or forward in the browser's
 * history.
 */
class RouteState
{
	routeID: string;
	routeURL: string;
	fields: RouteFields;
}



/**
 * Type of a function that is invoked by the Router to display the content of the current route.
 * This allows the router do have its own content - the same for all routes - and insert the
 * current router's content into it.
 */
export type RouterOuterContentRenderFuncType = (routeContent: any) => any;

/**
 * Type of a function that is invoked by the Router to display a progress UI while it is loading
 * route content.
 */
export type ProgressContentRenderFuncType = () => any;



/**
 * The IRouterProps interface
 */
export interface IRouterProps
{
	/**
	 * Flag indicating whether this router controls the browser; that is, uses History API to
	 * push new state and intercept back and forward commands. Default value is true.
	 */
	controlsBrowser?: boolean;

	/**
	 * Flag indicating that if this router cannot resolve a path, it will delegate to a router up
	 * the component chain (if there is one).
	 */
	chainsToHigherRouter?: boolean;

	/**
	 * Absolute or relative URL based on which all route paths will be resolved. Default value is
	 * true.
	 */
	baseURL?: string;
}



/**
 * The Router component provides client-side routing. It works with Route objects that define
 * available navigation targets.
 */
export class Router extends mim.Component<IRouterProps,Route[]> implements IRouterService, mim.IErrorHandlingService
{
	constructor( props: IRouterProps)
	{
		super();

		this.props = props;

		if (this.props.children)
		{
			for( let route of this.props.children)
				this.addRoute( route);
		}
	}



	/**
	 * Inserts the given route at the given index in the list.
	 * @param route [[Route]] object to add
	 * @param index Index at which to add the route object. If the index is not defined, the
	 *		route is appended to the end of the list. If index is out of range an exception will
	 *		be thrown.
	 */
	public addRoute( route: Route, index?: number): void
	{
		if (!route)
			throw new Error( "Route object cannot be null");

		if (index !== undefined)
			this.routes.splice( index, 0, route);
		else
			this.routes.push( route);

		// recursively add the route and all its sub-routes (that have IDs) to the map
		this.addRouteToMap( route);
	}



	/**
	 * Removes a route at the given index in the list and returns the Route object. If index is
	 * out of range an exception will be thrown.
	 * 
	 * @param index
	 * @return Route [[Route]] object that was removed.
	 */
	public removeRoute( index: number): Route
	{
		let route: Route = this.routes.splice( index, 1)[0];

		// recursively remove the route and all its sub-routes (that have IDs) from the map
		this.removeRouteFromMap( route);

		return route;
	}



	// Adds the given route and its sub-routes recursively to the map of routes by IDs (only
	// the routes that have their id property defined and not empty).
	private addRouteToMap( route: Route): void
	{
		if (route.id)
			this.routesByID.set( route.id, route);

		if (route.subRoutes)
		{
			for( let subRoute of route.subRoutes)
				this.addRouteToMap( subRoute);
		}
	}



	// Removes the given route and its sub-routes recursively from the map of routs by IDs (only
	// the routes that have their id property defined and not empty).
	private removeRouteFromMap( route: Route): void
	{
		if (route.id)
			this.routesByID.delete( route.id);

		if (route.subRoutes)
		{
			for( let subRoute of route.subRoutes)
				this.removeRouteFromMap( subRoute);
		}
	}



	/**
	 * Navigates to a route matching the given URL.
	 * @param url Absolute or relative URL to navigate to
	 * @param makeHistoryEntry
	 */
	public navigateByURL( url: string, makeHistoryEntry: boolean = false): void
	{
		let [route, fields] = this.findRouteByURL( url);
		if (!route)
		{
			if (this.higherRouterService)
				this.higherRouterService.r.navigateByURL( url, makeHistoryEntry);

			return;
		}

		this.navigateToRoute( route, url, fields, makeHistoryEntry);
	}



	/**
	 * Navigates to a route with the given ID.
	 * 
	 * @param id ID of the route
	 * @param params Parameters to be passed to the route's function
	 * @param makeHistoryEntry Flag indicating whether the Router should create a new entry in the
	 *		browser's history.
	 */
	public navigateByID( id: string, fields?: RouteFields, makeHistoryEntry?: boolean): void
	{
		let route: Route = this.routesByID.get( id);
		if (!route)
		{
			if (this.higherRouterService)
				this.higherRouterService.r.navigateByID( id, fields);

			return;
		}

		// if we are controlling the browser we may need to substitute parameters in the
		// route's URL pattern
		let url: string;
		if (this.controlsBrowser)
		{
			url = route.urlPattern;
			if (url && fields)
			{
			}
		}

		this.navigateToRoute( route, url, fields, makeHistoryEntry);
	}



	/**
	 * Finds a route by going through the route hierarchy and trying to match the given URL.
	 * If the route is found, the URL is parsed and any parameters are extracted from it.
	 * @param url
	 */
	private findRouteByURL( url: string): [Route, RouteFields]
	{
		return Router.findRouteRecursiveByURL( url, this.routes);
	}



	/**
	 * Looks for a route matching the given URL among the given array of Route objects and
	 * recursively among their sub-routes.
	 * @param url URL to match
	 * @param routes Array of Route objects to match with the URL
	 */
	private static findRouteRecursiveByURL( url: string, routes: Route[]): [Route, RouteFields]
	{
		for( let route of routes)
		{
			let matchResult = mimurl.match( url, route.urlPattern);
			if (matchResult)
				return [route, matchResult.fields];
			else if (route.subRoutes)
			{
				let rootAndFields = Router.findRouteRecursiveByURL( url, route.subRoutes);
				if (rootAndFields[0])
					return rootAndFields;
			}
		}

		return [null, null];
	}



	/**
	 * Navigates to the given route passing the given parameters.
	 * 
	 * @param id ID of the route
	 * @param params Parameters to be passed to the route's function
	 * @param makeHistoryEntry Flag indicating whether the Router should create a new entry in the
	 *		browser's history.
	 */
	private async navigateToRoute( route: Route, url: string, fields: RouteFields,
					makeHistoryEntry: boolean): Promise<any>
	{
		//// check if the new route is the same as the current route and don't do anything
		//if (route === this.currRoute)
		//	return;

		// if we have current route, ask it if we can leave it
		if (this.currRoute && this.currRoute.navFromFunc)
		{
			let ret: boolean | Promise<boolean> = this.currRoute.navFromFunc();
			if (ret instanceof Promise)
				ret = await (ret as Promise<boolean>);

			if (!ret)
				return;
		}

		// if we are controlling the browser use History API to change state
		if (this.controlsBrowser && makeHistoryEntry)
		{
			let state: RouteState = { routeID: route.id, routeURL: url, fields };
			history.pushState( state, "", url);
		}

		// remember the new route and get its content
		this.currRoute = route;
		let content: any = route.navToFunc ? route.navToFunc( fields) : null;
		if (content instanceof Promise)
			this.currRouteContent = await (content as Promise<any>);
		else
			this.currRouteContent = content;

		// request to be updated so that our render method will be called
		this.updateMe();
	}



	// Informs that the given error was raised by one of the descendant coponents.
	public reportError( err: any, path: string[]): void
	{
		this.handleError( err, path);
		this.updateMe();
	}



	public componentWillMount()
	{
		this.site.publishService( "StdErrorHandling", this);

		// publish ourselves as a router service
		this.site.publishService( "Router", this);

		// if instructed so, subscribe to a router service implemented by any of components
		// up the chain
		if (this.chainsToHigherRouter)
		{
			this.higherRouterService = new mim.Ref<IRouterService>();
			this.site.subscribeService( "Router", this.higherRouterService, undefined, false);
		}

		// find the first route to display
		let firstRoute: Route = this.routes.length > 0 ? this.routes[0] : null;
		if (!firstRoute)
			return;

		this.currRoute = firstRoute;
		let content: any = firstRoute.navToFunc ? firstRoute.navToFunc( {}) : null;
		if (content instanceof Promise)
		{
			this.currRouteContent = "Please wait while content is loading...";
			(content as Promise<any>).then( ( delayedContent: any) =>
			{
				this.currRouteContent = delayedContent;
				this.updateMe;
			});
		}
		else
			this.currRouteContent = content;

		if (this.controlsBrowser)
		{
			// establish base URL relative to which all paths will be considered
			if (!this.baseURL)
			{
			}

			// subscribe to the popstate event for monitoring back and forward commands
			window.addEventListener( "popstate", this.onPopstate);

			let state: RouteState = { routeID: firstRoute.id, routeURL: firstRoute.urlPattern, fields: null };
			history.replaceState( state, "", firstRoute.urlPattern);
		}
	}



	public componentWillUnmount()
	{
		if (this.controlsBrowser)
		{
			window.removeEventListener( "popstate", this.onPopstate);
		}
		if (this.chainsToHigherRouter)
		{
			this.site.unsubscribeService( "Router");
			this.higherRouterService = undefined;
		}

		this.site.unpublishService( "Router");
		this.site.unpublishService( "StdErrorHandling");
	}



	public render(): any
	{
		return this.virtRender( this.currRouteContent);
	}
	


	public handleError( err: any, nodePath: string[]): void
	{
		//this.error = err;
		//this.errorPath = nodePath;
		this.currRouteContent = 
			<div id="rootError" style={{backgroundColor:"pink", display:"flex",
										flexDirection:"column", alignItems: "start"}}>
				{err}
				{nodePath && nodePath.map( (name) => <span>{name}</span>)}
			</div>;
	}


	/**
	 * "Virtual" function that can be overridden by derived classes. Responsible for returning
	 * content to be displayed by the Router component. The default implementation either calls
	 * the outerContentFunc if defined or just returns the content passed as a parameter.
	 * 
	 * @param currRouteContent
	 * @return Content to be displayed by the Router component.
	 */
	protected virtRender( currRouteContent: any): any
	{
		//return this.outerContentFunc ? this.outerContentFunc( currRouteContent) : currRouteContent;
		return currRouteContent;
	}



	// Reacts on user using back and forward buttons.
	private onPopstate = ( e: PopStateEvent): void =>
	{
		let state: RouteState = e.state as RouteState;
		if (!state)
			return;

		if (state.routeID)
			this.navigateByID( state.routeID, state.fields);
		else if (state.routeURL)
			this.navigateByURL( state.routeURL);
		else
			console.log( "Route state in popstate event has neither route ID nor path.");
	};



	// Returns the flag indicating whether this router controls the browser; that is, uses History
	// API to push new state and intercept back and forward commands.
	private get controlsBrowser(): boolean
	{
		return this.props.controlsBrowser === undefined ? true : this.props.controlsBrowser;
	}

	// Returns the flag indicating that if this router cannot resolve a path, it will delegate to
	// a router up the component chain (if there is one).
	private get chainsToHigherRouter(): boolean
	{
		return this.props.chainsToHigherRouter === undefined ? true : this.props.chainsToHigherRouter;
	}

	// Returns the absolute or relative URL based on which all route paths will be resolved.
	private get baseURL(): string
	{
		return this.props.baseURL === undefined ? "" : this.props.baseURL;
	}

	/**
	 * Sets the function that renders the content of the current route inside the router's own content. If
	 * this member is undefined, only the current route's content will be displayed.
	 */
	public set OuterContentFunc( val: RouterOuterContentRenderFuncType) { this.outerContentFunc = val; }
	private outerContentFunc: RouterOuterContentRenderFuncType;

	/** Sets the function that renders a progress UI while the router is loading route content. */
	public set ProgressContentFunc( val: ProgressContentRenderFuncType) { this.progressContentFunc = val; }
	private progressContentFunc: ProgressContentRenderFuncType;

	// A router service this router will delegate to when it cannot resolve a path.
	private higherRouterService: mim.Ref<IRouterService>;

	// Ordered list of Route objects - used to find routes by matching paths. Note that this
	// list is actually a hierarchy because routes can contain sub-routes.
	private routes: Route[] = [];

	// Map of route IDs to Route objects. All routes that define an ID are added to this map -
	// no matter how deep in the hierarchy.
	private routesByID = new Map<string,Route>();

	// Currently displayed route.
	private currRoute: Route;

	// Content povided by the current route.
	private currRouteContent: any;

	// Error and component path in case an error has been caught.
	private error: any = null;
	private errorPath: string[] = null;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The LinkProps interface defines properties for the Link component because. The properties in
// this interface define the route; the properties inherited from the IHtmlAElementProps interface
// correspond to the relevant attributes of the <a> DOM element.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export interface LinkProps extends IHtmlAElementProps
{
	// Path that will be mapped to a route by the Router.
	routeURL?: string;

	// ID of the route that will be mapped to a route by the Router.
	routeID?: string;

	// Optional parameters that will be passed to the route when using routeID.
	fields?: RouteFields;

	// Flag indicating whether the target should be made a new entry in the browser's history;
	// that is to be subject to back and forward browser commands.
	makeHistoryEntry?: boolean;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The Link class is a JSX component that allows creating links handled by a Router object. It is
// implemented as a JSX component because its intended use is very similar to the <a> DOM
// element.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export class Link extends mim.Component<LinkProps>
{
	constructor( props: LinkProps)
	{
		super( props);
	}

	public render(): any
	{
		// extract our custom parameters and leave only those that are <a> attributes
		let {routeURL, routeID, fields, makeHistoryEntry, ...rest} = this.props;
		return <a href="#" click={this.onClick} {...rest}>
			{this.props.children}
		</a>;
	}



	private onClick = ( e: MouseEvent): void =>
	{
		e.preventDefault();

		let service: IRouterService = this.site.getService( "Router");
		if (!service)
			return;

		if (this.props.routeID)
			service.navigateByID( this.props.routeID, this.props.fields, this.props.makeHistoryEntry);
		else
			service.navigateByURL( this.props.routeURL, this.props.makeHistoryEntry);
	};



	private routerService = new mim.Ref<IRouterService>();
}



