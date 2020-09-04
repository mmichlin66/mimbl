/**
 * This module contains definitions of [[Popup]], [[Dialog]] and [[MsgBox]] components.
 *
 * The [[Popup]] component is a base component that displays a popup usig the `<dialog>` HTML
 * element. The [[Dialog]] component derives from [[Popup]] and divides the popup area into
 * secontions for caption, body and button bar. Dialogs support moving around by clicking on the
 * caption area. The [[MsgBox]] component derives from [[Dialog]] and displays a message
 * optionally accompannied with an icon and a pre-defined set of buttons.
 */

import * as mim from "../api/mim"
import * as css from "mimcss"
import {PromiseEx, createPromiseEx} from "../api/UtilAPI";
import {trigger} from "../internal";
import { MultiEventSlot, createMultiEventSlot } from "../utils/EventSlot";
import { computed } from "../utils/TriggerWatcher";



/** Using module augmentation technique to extend the IServiceDefinition interface */
declare module "../api/mim"
{
    /**
     * Extending the IServiceDefinition interface with services used by the [[Popup]] and
     * [[Dialog]] components.
     */
    interface IServiceDefinitions
    {
        /**
         * The "popup" service gives components used in the content of the [[Popup]] component
         * access to the [[IPopup]] interface, through which they can close the popup.
         */
        popup: IPopup;

        /**
         * The "dialog" service gives components used in the caption or the body of the [[Dialog]]
         * component access to the [[IDialog]] interface, through which they can add buttons
         * and otherwise manipulate the dialog.
         */
        dialog: IDialog;
    }
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Popup
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The IPopup interface represents a popup from the point of view of the content. This interface
 * is published as a service and can be used by the content components to close the popup.
 */
export interface IPopup
{
    /**
     * Closes the popup and passes a value to be used as a return value. For the modal popups,
     * this value will be the resolved value of the promise returned by the showModal() method.
     * For modeless popups, this value will be available as the returnValue property.
     * @param returnValue
     */
    close( returnValue?: any): void;
}



/**
 * The IPopupStyles interface defines styles used by the Popup class to create the `<dialog>`
 * element. The implementations should provide the class rule for the dialog property and can
 * also define the ::backdrop pseudo element styles, which is used when the popup is shown as a
 * modal dialog.
 */
export interface IPopupStyles extends css.StyleDefinition
{
    /**
     * Defines what CSS class to use for the `<dialog>` element.
     */
    readonly dialog?: css.ClassPropType;
}



/**
 * Default styles that will be used by the Popup if styles are not specified using options.
 */
export class DefaultPopupStyles extends css.StyleDefinition implements IPopupStyles
{
    /** Styles for the `<dialog>` element. */
    dialog = css.$class({
        border: [1, "solid", "grey"],
        boxShadow: { x: 4, y: 4, blur: 4, color: "lightgrey" },
        padding: 0,
        maxWidth: "100%",
        maxHeight: "100%",
        // transform: css.scale(0.1),
        // transition: { property: "transform", duration: 200 },
        "::backdrop": { backgroundColor: "grey", opacity: 0.3 }
    })
}



/**
 * The IPopupOptions interface represents the options that cofigure the behavior of the Popup
 * object. They are passed in the constructor to the [[Popup]] class
 * @typeParam TStyles Type for the styles property. Options for derived components will have to
 * derive from the IPopupOptions interface and to implement the [[IPopupStyles]] interface for
 * the styles property.
 */
export interface IPopupOptions<TStyles extends IPopupStyles = IPopupStyles>
{
    /**
     * Defines what styles to use for the `<dialog>` element and optionally for the ::backdrop
     * pseudo element. The value can be either a style definition class implementing the
     * [[IPopupStyles]] interface or an instance of such class. The popup activates the styles
     * when it opens and deactivates them when it closes. If this property is not defined, the
     * popup will use the default styles. The default value is undefined.
     */
    readonly styles?: TStyles | css.IStyleDefinitionClass<TStyles>;

    /**
     * Defines what CSS class to use for the `<dialog>` element. If this property is defined,
     * the [[style]] property is ignored
     */
    readonly dialogStyleClass?: css.ClassPropType;

    /**
     * Value that is returned when the user closes the popup by pressing the Escape key. If this
     * property is undefined, the popup cannot be closed with the Escape key. Note that null is
     * valid value that can be used to close a popup. The default value is undefined.
     *
     * For modal popups, this property also controls whether the user can dismiss the popup by
     * clicking on the backdrop - that is, the area outside of the popup itslef.
     */
    readonly escapeReturnValue?: any;

    /**
     * HTML element under which the `<dialog>` element is created. If this property is undefined,
     * the `<dialog>` element is created under the `<body>` element. The default value is undefined.
     */
    readonly anchorElement?: HTMLElement;

    /**
     * X-coordinate of the top-left corner of the dialog from the anchor element. If undefined,
     * the dialog will be centered horizontally.
     */
    readonly initialX?: css.CssLength;

    /**
     * Y-coordinate of the top-left corner of the dialog from the anchor element. If undefined,
     * the dialog will be centered vertically.
     */
    readonly initialY?: css.CssLength;
}



/**
 * The IPopupEvents interface represents events that the Popup component can fire
 */
export interface IPopupEvents
{
    /**
     * The open event is fired when the popup opens.
     * @param isModal Flag indicating whether the popup opens as modal or modeless
     */
	open( isModal: boolean): void;

    /**
     * The close event is fired when the popup closes.
     * @param retVal Value passed to the close() method.
     */
    close( retVal: any): void;
}



/**
 * The Popup class allows displaying modal and modeless popups. This is the base class for
 * dialogs and message boxes. After the Popup instance is created it can be shown either as modal
 * or modeless popup. Both types of the popup can be closed using the close() method. In order for
 * the popup to be closed "from inside" - that is, by the component, which is used as the popup
 * content - the popup object should be passed to this component.
 *
 * The Popup class itself doesn't provide any means for the user to start moving it around;
 * however, it allows initiating the move action using the startMove() method. Once this method
 * is called, the Popup will start monitoring mouse (pointer) activity and move the dialog
 * accordingly.
 *
 * The content of the popup can be replaced while it is being displayed using the setContent()
 * method.
 *
 * @typeParam TStyles Type of the style definition class used to specify CSS styles for the
 * component. Must implement the IPopupStyles interface.
 * @typeParam TOptions Type of the object used to specify options for the component. Must
 * implement the IPopupOptions interface.
 */
export class Popup<TStyles extends IPopupStyles = IPopupStyles,
            TOptions extends IPopupOptions<TStyles> = IPopupOptions<TStyles>>
            extends mim.Component implements IPopup
{
    /**
     * Popup is constructed by specifying the initial content it should display and the options
     * @param content
     * @param options
     */
    public constructor( content?: any, options?: TOptions)
    {
        super();
        this.content = content;
        this.options = options;
    }

    /**
     * Displays the popup as a modeless dialog. The method will throw an exception if the popup
     * is already open as a modal popup.
     */
    public open(): boolean
    {
        if (this.isOpen)
            return false;

        this._returnValue = undefined;

        this.create();
        this.dlg.show();

        this.onOpen( false);
    }

    /**
     * Displays the popup as a modeless dialog and returns a promise that is resolved when the
     * popup is closed. The resolved value of the promise is the value passed to the close()
     * method. The method will return a rejected promise if the popup is already open.
     */
    public showModal(): Promise<any>
    {
        if (this.isOpen)
            return Promise.reject( new Error( "Popup already open"));

        this._returnValue = undefined;

        this.create();
        this.dlg.showModal();

        // must establish listener on window because otherwise, the Escape key is processed by
        // the system (closing the popup) never arriving at the dialog
        window.addEventListener( "keydown", this.onKeyDown);

        // if the escapeReturnValue is defined in the options, start listening to the keyboard and
        // click events to detect clicks outside the popup because they will act as Escape too.
        let escapeRetVal = this.options?.escapeReturnValue;
        if (escapeRetVal !== undefined)
            this.dlg.addEventListener( "click", this.onDetectClickOutside);

        this.modalPromise = createPromiseEx();

        return this.modalPromise;
    }

    /**
     * Closes the popup and passes a value to be used as a return value. For the modal popups,
     * this value will be the resolved value of the promise returned by the showModal() method.
     * For modeless popups, this value will be available as the returnValue property.
     * @param retVal
     */
    public close( returnValue?: any): void
    {
        if (!this.isOpen)
            return;

		if (this.modalPromise)
		{
            // if escapeReturnValue was defined in options, we need to remove the click handler
            // that we created in showModal
            let escapeRetVal = this.options?.escapeReturnValue;
            if (escapeRetVal !== undefined)
                this.dlg.removeEventListener( "click", this.onDetectClickOutside);

            window.removeEventListener( "keydown", this.onKeyDown);

			this.modalPromise.resolve( returnValue);
			this.modalPromise = undefined;
		}

        this.dlg.close();
        this.destroy();

        this._returnValue = returnValue;

        this.onClose( returnValue);
    }

    /** Events that can be fired by the Popup component */
    public get events(): MultiEventSlot<IPopupEvents> { return this._events; }

    /**
     * Determines whether the popup is currently open.
     */
    public get isOpen(): boolean { return this.dlg != null; }

	/**
     * Determines whether the dialog is currently open as modeless.
     */
	public isModeless(): boolean { return this.isOpen && !this.modalPromise; }

	/**
     * Determines whether the dialog is currently open as modal.
     */
	public isModal(): boolean { return this.isOpen && this.modalPromise != null; }

    /**
     * Returns the value set by the close() method. If the popup is open, the value is undefined.
     */
    public get returnValue(): any { return this._returnValue; }

    /**
     * Gets or sets the flag determining whether the popup is currently visible or hidden.
     */
    public get isVisible(): boolean { return this._isVisible; }

    public set isVisible( v: boolean) { this._isVisible = v; }

    /**
     * Replaces the current content of the popup with the given one.
     * @param content
     */
    public setContent( content: any): void
    {
        this.content = content;
    }

	/**
     * Starts monitoring mouse movements and moves the popup with the mouse. This method is
     * intented to be called from a mousedown event handled either by a derived class or by
     * the popup caller.
     */
    public startMove( clientX: number, clientY: number): void
    {
        if (!this.dlg)
            return;

        // // we prevent default action and propagation so that mouse movements don't cause
		// // test in the popup and on the page to be selected.
		// e.preventDefault();
		// e.stopPropagation();

		let rect = this.dlg.getBoundingClientRect();
		this.movePointOffsetX = clientX - rect.left;
		this.movePointOffsetY = clientY - rect.top;

		// set the new coordinates
		this.dlg.style.margin = "0";
		this.dlg.style.top = rect.top + "px";
		this.dlg.style.left = rect.left + "px";

		window.addEventListener( "pointermove", this.onPointerMove);
        window.addEventListener( "pointerup", this.onPointerUp);
    }

	/**
     * Stops monitoring mouse movements. This method allows programmatically interrupt
     * dialog moving operations.
     */
    public stopMove()
	{
		window.removeEventListener( "pointermove", this.onPointerMove);
        window.removeEventListener( "pointerup", this.onPointerUp);

        this.movePointOffsetX = this.movePointOffsetY = 0;
	};

    /**
     * Moves the dialog to the given coordinates. The coordinates are adjusted so that at least
     * some part of the dialog at the top-left corner remains visible in order to the user to be
     * able to continue moving it.
     */
	public moveTo( newX: number, newY: number)
	{
        if (!this.dlg)
            return;

        this.move( newX, newY);
        this.dlg.style.margin = "0";
	};



    /**
     * If derived classes override this method, they must call super.willMount()
     */
    public willMount(): void
	{
        this.vn.publishService( "popup", this);
	};

    /**
     * If derived classes override this method, they must call super.willUnmount()
     */
	public willUnmount(): void
	{
        this.vn.unpublishService( "popup");

        // deactivate styles
        css.deactivate( this.defaultStyles);
        this.defaultStyles = null;
        if (this.optionalStyles)
        {
            css.deactivate( this.optionalStyles);
            this.optionalStyles = null;
        }

        // clean up
        this.dlg = null;
        this.anchorElement = null;
    };

    /**
     * The render method simply returns the current content but it can be overridden by derived classes
     */
	public render(): any
	{
        return this.content;
	};



    // Creates the dialog element
    private create(): void
    {
        // obtain the anchor element
        this.anchorElement = this.options && this.options.anchorElement ? this.options.anchorElement : document.body;

        // activate our default styles and if styles are specified in the options, then activate
        // them too.
        this.defaultStyles = css.activate( this.getDefaultStyles()) as TStyles;
        if (this.options && this.options.styles)
            this.optionalStyles = css.activate( this.options.styles) as TStyles;

        // create dialog element and add it to the DOM
        this.dlg = document.createElement( "dialog");
        this.dlg.className = css.chooseClass( this.options?.dialogStyleClass,
                        this.optionalStyles?.dialog, this.defaultStyles.dialog);
        this.anchorElement.appendChild( this.dlg);

        // assign positioning styles dirctly to the dialog element. If x and/or y are undefined,
        // we center the dialog horizontally and/or vertically
        let style: css.Styleset = { position: "fixed" };
        if (!this.options || this.options.initialX === undefined)
            style.left = style.right = 0;
        else
            style.left = this.options.initialX;

        if (!this.options || this.options.initialY === undefined)
            style.top = style.bottom = 0;
        else
            style.top = this.options.initialY;

        css.setElementStyle( this.dlg, style, css.SchedulerType.Sync);

        // mount the component
        mim.mount( this, this.dlg)
    }

    // Destroys the dialog element
    private destroy(): void
    {
        // unmount the content
        mim.unmount( this.dlg);

        // remove the dialog element
        this.dlg.remove();
    }

	/**
     * Moves the dialog to the given coordinates. The coordinates are adjusted so that at least
     * some part of the dialog at the top-left corner remains visible in order to the user to be
     * able to continue moving it.
     */
	private move( newX: number, newY: number)
	{
		if (newX < 0)
			newX = 0;
		else if (newX + 30 > window.innerWidth)
			newX = window.innerWidth - 30;

		if (newY < 0)
			newY = 0;
		else if (newY + 30 > window.innerHeight)
			newY = window.innerHeight - 30;

		// set the new coordinates
		this.dlg.style.left = newX + "px";
		this.dlg.style.top = newY + "px";
	};



    // Handles keydown event to prevent closing the dialog by Esc key.
	private onKeyDown = (e: KeyboardEvent): void =>
	{
        if (e.key === "Escape")
        {
            e.preventDefault();

            // we ignore the Escape key if the escapeReturnValue option is undefined; otherwise,
            // we close the dialog with its value
            let retVal = this.options?.escapeReturnValue;
            if (retVal !== undefined)
                this.close( retVal);
        }
	};

    // Detects whether a click occurred outside of the popup area. This handler is invoked only for
    // modal popups and only if the escapeReturnValue is defined in the options.
    private onDetectClickOutside = (e: MouseEvent) =>
    {
        // clicking on the backdrop of the modal popup has the target property of the event
        // pointing to the `<dialog>` element itself. If it is not this element, then the click
        // was on some element within the popup.
        if (e.target !== this.dlg)
            return;

        // just in case the click happend on the `<dialog>` element itself but within the bounds
        // of the popup (e.g. if popup is styleed with paddings), check that coordinates are
        // outside of the popup area.
        let rc = this.dlg.getBoundingClientRect();
        if (e.clientX < rc.left || e.clientX > rc.right || e.clientY < rc.top || e.clientY > rc.bottom)
            this.close( this.options?.escapeReturnValue);
    }

	private onPointerMove = (e: PointerEvent) =>
	{
        e.preventDefault();

        // we only move on the primary button
        if (!this.dlg || !e.isPrimary)
        {
            this.stopMove();
            return;
        }

		this.move( e.clientX - this.movePointOffsetX, e.clientY - this.movePointOffsetY);
	};

	private onPointerUp = (e: PointerEvent) =>
	{
        e.preventDefault();
        this.stopMove();
	};



    /**
     * Returns the default style definition instance or class
     */
	protected getDefaultStyles(): TStyles | css.IStyleDefinitionClass<TStyles>
	{
        return DefaultPopupStyles as css.IStyleDefinitionClass<TStyles>;
	};

    /**
     * This method is called when the popup opens. If derived classes override it they
     * must call super.onOpen().
     */
	protected onOpen( isModal: boolean): void
	{
        // notify any listeners
        this._events.open.fire( isModal);
    };

    /**
     * This method is called when the popup is being closed. If derived classes override it they
     * must call super.onClose().
     */
	protected onClose( retVal: any): void
	{
        // notify any listeners
        this._events.close.fire( retVal);
    };



    // Content to display
    @trigger(0)
    protected content: any;

    // Options
    protected options: TOptions;

    // Activated default styles
    protected defaultStyles: TStyles;

    // Activated optional styles
    protected optionalStyles: TStyles;

    // Anchor element under which to create the dialog element
    private anchorElement: HTMLElement;

    // Dialog element
    private dlg: HTMLDialogElement;

    // Promise that is created for modal dialogs and which is resolved when the dialog closes.
    private modalPromise: PromiseEx<any>;

    // Flag indicating whether the popup is currently visible
    private _isVisible: boolean;

    // Value passed to the close method.
    private _returnValue: any;

    // Events that can be fired by the Popup objects.
    private _events = createMultiEventSlot<IPopupEvents>();

	// Offsets of the point where the move started from the dialog top-left corner. We use them
	// to calculate the dialog top-left position based on the mouse coordinates while move is
	// in progress.
	private movePointOffsetX: number;
	private movePointOffsetY: number;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Dialog
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The IDialogButton interface describes a single button in the dialog's button bar.
 */
export interface IDialogButton
{
    /**
     * Unique identifier for the button. This ID is passed to the callback, which is called when
     * the button is clicked.
     */
    readonly id: any;

    /**
     * Callback, which is called when the button is clicked. If the callback is not defined, the
     * returnValue property must be defined.
     */
    readonly callback?: (id: any) => void;

    /**
     * Return value with which the dialog is closed when the button is clicked. This property is used
     * (and must be defined) only if the callback property is undefined.
     */
    readonly returnValue?: any;

    /**
     * Content to display in the button.
     */
    readonly content?: any;

    /**
     * Flag indicating whether the button is initially disabled. The default value is false; that
     * is, the button is enabled.
     */
    readonly disabled?: boolean;

    /**
     * Keyboard key or code associated with the button.
     */
    readonly keycode?: string;
}



/**
 * The IPopup interface represents a popup from the point of view of the content. This interface
 * is published as a service and can be used by the content components to close the popup.
 */
export interface IDialog extends IPopup
{
    /**
     * Adds a button to the button bar
     */
    addButton( btn: IDialogButton): void;

    /**
     * Returns the number of buttons in the button bar
     */
    readonly buttonCount: number;
}



/**
 * The IDialogStyles interface defines styles used by the Dialog class to create different elements
 * of the dialog. The implementations should provide class rules for the following properties:
 * - dialogCaption
 * - dialogBody
 * - dialogButtonBar
 * - dialogButton
 */
export interface IDialogStyles extends IPopupStyles
{
    /**
     * Defines what CSS class to use for the caption section.
     */
    readonly dialogCaption?: css.ClassPropType;

    /**
     * Defines what CSS class to use for the body section.
     */
    readonly dialogBody?: css.ClassPropType;

    /**
     * Defines what CSS class to use for the button bar section.
     */
    readonly dialogButtonBar?: css.ClassPropType;

    /**
     * Defines what CSS class to use for the buttons.
     */
    readonly dialogButton?: css.ClassPropType;
}



/**
 * Default styles that will be used by the Popup if styles are not specified using options.
 */
export class DefaultDialogStyles extends DefaultPopupStyles implements IDialogStyles
{
    dialogCaption = css.$class({
        backgroundColor: "dodgerblue",
        color: "white",
        boxShadow: { x: 0, y: 2, blur: 2, color: "lightgrey" },
        padding: 0.4,
    })

    dialogBody = css.$class({
        padding: 0.7,
    })

    dialogButtonBar = css.$class({
        // backgroundColor: "lightgrey",
        padding: [0.7, 1.01],
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
    })

    dialogButton = css.$class({
        padding: 0.3,
        marginInlineStart: 1.01,
        minWidth: 5.5,
        border: "none",
        backgroundColor: 0xf2f2f2,
		":hover": {
			backgroundColor: 0xe2e2e2,
		},
		":focus": {
            backgroundColor: 0xe2e2e2,
            outline: [1, "solid", 0xa2a2a2],
		}
    })
}



/**
 * The IDialogOptions interface represents the options that cofigure the behavior of the Dialog
 * object. They are passed in the constructor to the [[Dialog]] class
 */
export interface IDialogOptions<TStyles extends IDialogStyles = IDialogStyles> extends IPopupOptions<TStyles>
{
    /**
     * Defines what CSS class to use for the caption section.
     */
    readonly dialogCaptionStyleClass?: css.ClassPropType;

    /**
     * Defines what CSS class to use for the body section.
     */
    readonly dialogBodyStyleClass?: css.ClassPropType;

    /**
     * Defines what CSS class to use for the button bar section.
     */
    readonly dialogButtonBarStyleClass?: css.ClassPropType;

    /**
     * Defines what CSS class to use for the buttons.
     */
    readonly dialogButtonStyleClass?: css.ClassPropType;

    /**
     * Identifier of the default button, which will have focus when the dialog appears.
     */
    readonly defaultButton?: any;
}



/**
 * The Dialog class is a popup that divides the popup area into three sections: caption, body and
 * button bar. The caption area can be used to move the dialog around.
 */
export class Dialog<TStyles extends IDialogStyles = IDialogStyles,
            TOptions extends IDialogOptions<TStyles> = IDialogOptions<TStyles>>
            extends Popup<TStyles,TOptions> implements IDialog
{
    constructor( bodyContent?: any, captionContent?: any, options?: TOptions, ...buttons: IDialogButton[])
    {
        // we reuse the Popup's content property for dialog's body
        super( bodyContent, options);

        this.captionContent = captionContent;

        for( let btn of buttons)
            this.addButton( btn);
    }



    /**
     * Adds a button to the button bar
     */
    public setCaption( captionContent: any): void
    {
        this.captionContent = captionContent;
    }

    /**
     * Adds a button to the button bar
     */
    public addButton( btn: IDialogButton): void
    {
        let info = new DialogButtonInfo( btn, this.nextButtonTabIndex++);
        this.buttons.set( btn.id, info);
        if (btn.keycode)
            this.buttonKeys.set( btn.keycode, info)
    }

    /**
     * Returns the number of buttons in the button bar
     */
    public get buttonCount(): number { return this.buttons.size; }



    /**
     * Returns the default style definition instance or class
     */
	protected getDefaultStyles(): TStyles | css.IStyleDefinitionClass<TStyles>
	{
        return DefaultDialogStyles as css.IStyleDefinitionClass<TStyles>;
	};



    /**
     * If derived classes override this method, they must call super.willMount()
     */
    public willMount(): void
	{
        super.willMount();

        // obtain class names for our elements
        this.captionClassName = css.chooseClass( this.options?.dialogCaptionStyleClass,
            this.optionalStyles?.dialogCaption, this.defaultStyles.dialogCaption);
        this.bodyClassName = css.chooseClass( this.options?.dialogBodyStyleClass,
            this.optionalStyles?.dialogBody, this.defaultStyles.dialogBody);
        this.buttonBarClassName = css.chooseClass( this.options?.dialogButtonBarStyleClass,
            this.optionalStyles?.dialogButtonBar, this.defaultStyles.dialogButtonBar);
        this.buttonClassName = css.chooseClass( this.options?.dialogButtonStyleClass,
            this.optionalStyles?.dialogButton, this.defaultStyles.dialogButton);

        this.vn.publishService( "dialog", this);
	}

    /**
     * If derived classes override this method, they must call super.didMount()
     */
	public didMount(): void
	{
        if (this.options?.defaultButton != null)
        {
            let info = this.buttons.get( this.options?.defaultButton);
            if (info)
                info.elm.focus();
        }
	}

    /**
     * If derived classes override this method, they must call super.willUnmount()
     */
	public willUnmount(): void
	{
        this.vn.unpublishService( "dialog");
        super.willUnmount();
	}

    public render(): void
    {
        return <div keydown={this.onButtonKeyDown}>
            {this.renderCaption}
            {this.renderBody}
            {this.renderButtons}
        </div>
    }

    public renderCaption(): void
    {
        // have to specify touch-action "none" - otherwise, pointer events are canceled by the browser
        return <div class={this.captionClassName} pointerdown={this.onCaptionPointerDown} style={{touchAction: "none"}}>
            {this.captionContent}
        </div>
    }

    public renderBody(): void
    {
        return <div class={this.bodyClassName}>
            {this.content}
        </div>
    }

    public renderButtons(): void
    {
        return <div class={this.buttonBarClassName}>
            {Array.from( this.buttons.values()).map( info =>
                <button id={info.btn.id} ref={info.elm} class={this.buttonClassName} click={() => this.onButtonClicked(info)}>
                    {info.btn.content}
                </button>
            )}
        </div>
    }



    private onCaptionPointerDown( e: PointerEvent): void
    {
        // initiate move only on primary button down
        if (!e.isPrimary)
            return;

        e.preventDefault();
        this.startMove( e.clientX, e.clientY);
    }

    private onButtonClicked( info: DialogButtonInfo): void
    {
        if (info.btn.callback)
            info.btn.callback( info.btn.id);
        else
            this.close( info.btn.returnValue);
    }

    private onButtonKeyDown( e: KeyboardEvent): void
    {
        // check whether any button is associated with either the key or the code
        let info = this.buttonKeys.get( e.key);
        if (!info)
            info = this.buttonKeys.get( e.code);

        if (info)
        {
            e.preventDefault();
            this.onButtonClicked( info);
        }
    }



    // Map of button IDs to button information objects
    @trigger
    private captionContent: any;

    // Map of button IDs to button information objects
    @trigger(3)
    private buttons = new Map<any, DialogButtonInfo>();

    // Map of keyboard key or code values to the button objects associated with them
    private buttonKeys = new Map<string, DialogButtonInfo>();

    // Tab index value to use for the next button to be added
    private nextButtonTabIndex = 1001;

    // Class name to use for the caption
    private captionClassName: string;

    // Class name to use for the body
    private bodyClassName: string;

    // Class name to use for the button bar
    private buttonBarClassName: string;

    // Class name to use for the buttons
    private buttonClassName: string;
}



/**
 * The DialogButtonInfo class contains current informtaion about a single button in the dialog's
 * button bar.
 */
class DialogButtonInfo
{
    constructor( btn: IDialogButton, tabIndex: number)
    {
        this.btn = btn;
        this.disabled = btn.disabled;
        this.tabIndex = tabIndex;
    }

    /** Input information about the button. */
    btn: IDialogButton;

    /** Refernce to the button element. */
    @mim.ref elm: HTMLButtonElement;

    /** Tab index to use for the button the button. */
    tabIndex: number;

    /** Flag indicating whether the button is currently disabled. */
    disabled: boolean;
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Message box
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * The MsgBoxButton enumeration defines constants to indicate standard buttons used in dialogs.
 */
export const enum MsgBoxButton
{
	None = 0x0,
	OK = 0x1,
	Cancel = 0x2,
	Yes = 0x4,
	No = 0x8,
	Close = 0x10,
}



/**
 * The MsgBoxButton enumeration specifies values of predefined buttons and button combinations for
 * message boxes.
 */
export const enum MsgBoxButtonBar
{
	/** Message box will display no buttons */
	None = MsgBoxButton.None,

	/** Message box will have a single Close button */
	Close = MsgBoxButton.Close,

	/** Message box will have a single OK button */
	OK = MsgBoxButton.OK,

	/** Message box will have OK and Cancel buttons */
	OkCancel = MsgBoxButton.OK + MsgBoxButton.Cancel,

	/** Message box will have Yes and No buttons */
	YesNo = MsgBoxButton.Yes + MsgBoxButton.No,

	/** Message box will have Yes, No and Cancel buttons */
	YesNoCancel = MsgBoxButton.Yes + MsgBoxButton.No + MsgBoxButton.Cancel,
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// The MsgBoxIcon enumeration specifies values of predefined icons for message box.
//
///////////////////////////////////////////////////////////////////////////////////////////////////
export const enum MsgBoxIcon
{
	None = 0,
	Info,
	Warning,
	Error,
	Question,
}



/**
 * Default styles that will be used by the Popup if styles are not specified using options.
 */
export class MsgBoxStyles extends DefaultDialogStyles
{
    container = css.$class({
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
    })

    icon = css.$class({
        padding: css.rem(0.5),
        fontSize: css.em(3),
        fontWeight: 900,
    })

    text = css.$class({
        padding: 0.5,
        minWidth: css.em(15),
        maxWidth: css.em(60),
        minHeight: css.em(2),
        maxHeight: css.em(20),
        overflow: "auto",
        verticalAlign: "middle",
    })
}



/**
 * The MsgBox class is a dialog that displays a message with a set of pre-defined buttons.
 */
export class MsgBox extends Dialog<MsgBoxStyles>
{
    /**
     * Displays modal message box with the given parameters and returns a promise, which is
     * resolved when the user clicks on one of the buttons. The identifier of the button is used
     * as the promise's value.
     * @param message Content to be used in the message box's body.
     * @param title Content to display in the message box's caption.
     * @param buttons Identifier of a button ot button combination to be displayed.
     * @param icon Optional identifier of the icon to be displayed.
     * @returns Promise that is resolved with the identifier of the button clicked by the user.
     */
    public static showModal( message: string, title?: string,
                    buttons: MsgBoxButtonBar = MsgBoxButtonBar.OK,
                    icon: MsgBoxIcon = MsgBoxIcon.None,
                    defaultButton?: MsgBoxButton): Promise<MsgBoxButton>
	{
		let msgBox: MsgBox = new MsgBox( message, title, buttons, icon, defaultButton);
		return msgBox.showModal();
	}



	constructor( message: any, title?: string, buttons: MsgBoxButtonBar = MsgBoxButtonBar.OK,
					icon: MsgBoxIcon = MsgBoxIcon.None, defaultButton?: MsgBoxButton)
	{
        super( message, title, {
            styles: MsgBoxStyles,
            escapeReturnValue: buttons === MsgBoxButtonBar.None ? MsgBoxButton.Close : undefined,
            defaultButton
        });

		this.icon = icon;

		this.createButtons( buttons);
	}



	public renderBody(): any
	{
        let { char, color } = this.getIconClassAndColor();

        // we are using this.optionalStyles because we explicitly pass our styles in the options
        // parameter of the Dialog constructor.
		return <div class={this.optionalStyles.container}>
            {char && <span class={this.optionalStyles.icon} style={{color}}>{char}</span>}
            <span class={this.optionalStyles.text}>{this.content}</span>
        </div>;
	}



    /**
     * Returns the default style definition instance or class
     */
	protected getDefaultStyles(): MsgBoxStyles | css.IStyleDefinitionClass<MsgBoxStyles>
	{
        return MsgBoxStyles;
	};



    // Adds buttons according to the parameter specified in the constructor.
	private createButtons( buttons: MsgBoxButtonBar): void
	{
		switch( buttons)
		{
			case MsgBoxButtonBar.Close:
				this.createButton( "Close", MsgBoxButton.Close);
				break;

			case MsgBoxButtonBar.OK:
				this.createButton( "OK", MsgBoxButton.OK);
				break;

			case MsgBoxButtonBar.OkCancel:
				this.createButton( "OK", MsgBoxButton.OK);
				this.createButton( "Cancel", MsgBoxButton.Cancel, "Escape");
				break;

			case MsgBoxButtonBar.YesNo:
				this.createButton( "Yes", MsgBoxButton.Yes);
				this.createButton( "No", MsgBoxButton.No);
				break;

			case MsgBoxButtonBar.YesNoCancel:
				this.createButton( "Yes", MsgBoxButton.Yes);
				this.createButton( "No", MsgBoxButton.No);
				this.createButton( "Cancel", MsgBoxButton.Cancel, "Escape");
				break;
		}
	}

	// Returns symbol and color for displaying the icon.
	private getIconClassAndColor(): { char?: string, color?: css.CssColor }
	{
		switch( this.icon)
		{
			case MsgBoxIcon.Info: return { char: "i", color: "blue" };
			case MsgBoxIcon.Question: return { char: "?", color: "green" };
			case MsgBoxIcon.Warning: return { char: "!", color: "orange" };
			case MsgBoxIcon.Error: return { char: "x", color: "red" };

			default: return {};
		}
	}

	private createButton( text: string, id: MsgBoxButton, keycode?: string): void
	{
		this.addButton({ id, content: text, returnValue: id, keycode });
	}



	// Icon
	private icon: MsgBoxIcon;

}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
// Progress box
//
///////////////////////////////////////////////////////////////////////////////////////////////////



/**
 * Default styles that will be used by the Popup if styles are not specified using options.
 */
export class ProgressBoxStyles extends DefaultDialogStyles
{
    container = css.$class({
        width: css.rem(30),
        height: css.rem(5),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-around"
    })

    progress = css.$class({
        width: css.rem(20),
        height: css.rem(1),
        margin: css.rem(1)
    })

    text = css.$class({
        textAlign: "center",
    })

    constructor( parent?: css.StyleDefinition)
    {
        super(parent);
        this.dialogButtonBar.setProp( "justifyContent", "center")
    }
}



/**
 * The ProgressBox class is a dialog that displays a progress indicator, a text and an optional
 * Cancel button.
 */
export class ProgressBox extends Dialog<ProgressBoxStyles>
{
    /**
     * Displays the modal progress box with the given content and title, which is displayed until
     * the given promise is settled. The delayMilliseconds parameter controls whether the progress
     * box is displayed immediately or is delayed. If the input promise is settled before the
     * delay expires, the progress box is not displayed at all.
     * @param promise Promise to monitor - the progress box is displayed until this promis is settled.
     * @param content Content to be used in the progress box's body.
     * @param title Content to display in the progress box's caption.
     * @param delayMilliseconds Delay in milliseconds until which the progress box isn't displayed.
     * The default value is 750ms. To display the progress box immediately, set it to 0.
     * @returns Promise which is resolved ot rejected with the same value as the input promise.
     */
    public static async showUntil( promise: Promise<any>, content: any, title?: string,
        delayMilliseconds: number = 750): Promise<any>
	{
        let progress = new ProgressBox( content, title);
        progress.showModalWithDelay( delayMilliseconds);
        try
        {
            return await promise;
        }
        finally
        {
            progress.close();
        }
	}



	constructor( content?: string, title?: string, cancelReturnValue?: any)
	{
		super( content, title, { styles: ProgressBoxStyles });

        if (cancelReturnValue != null)
            this.addButton({ id: 1, content: "Cancel", returnValue: cancelReturnValue });
	}



    /**
     * Initiates displaying a progress box but doesn't really create it until the given timeout
     * expires. If the [[close]] method is called before the timeout expires, the popup isn't
     * created at all. This can be useful if you want the progress to reflect multiple operations
     * but don't show it if the operations finish quickly enough, for example:
     *
     * ```typescript
     * let progress = new Progress();
     * progress.showModalWithDelay( 1000);
     * progress.setContent( "First operation is in progress...")
     * performFirstOperation();
     * progress.setContent( "Second operation is in progress...")
     * performSecondOperation();
     * progress.close();
     * ```
     */
    public showModalWithDelay( delayMilliseconds: number): void
    {
        this.delayHandle = setTimeout( () => this.showNow(), delayMilliseconds);
    }

    /**
     * Closes the popup and passes a value to be used as a return value. For the modal popups,
     * this value will be the resolved value of the promise returned by the showModal() method.
     * For modeless popups, this value will be available as the returnValue property.
     * @param retVal
     */
    public close( retVal?: any): void
    {
        if (this.delayHandle > 0)
        {
            clearTimeout( this.delayHandle);
            this.delayHandle = 0;
        }

        super.close( retVal);
    }



	public renderBody(): any
	{
        // we are using this.optionalStyles because we explicitly pass our styles in the options
        // parameter of the Dialog constructor.
		return <div class={this.optionalStyles.container}>
            <progress class={this.optionalStyles.progress} />
            <div class={this.optionalStyles.text}>
                {this.content}
            </div>
        </div>;
	}



    /**
     * Returns the default style definition instance or class
     */
	protected getDefaultStyles(): ProgressBoxStyles | css.IStyleDefinitionClass<ProgressBoxStyles>
	{
        return ProgressBoxStyles;
	};



    private showNow()
    {
        this.delayHandle = 0;
        this.showModal();
    }



    // Handle of the setTimeout call when openeing the popup with delay.
    private delayHandle = 0;
}



