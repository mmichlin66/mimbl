import * as mim from "../api/mim"
import * as css from "mimcss"
import {PromiseEx, createPromiseEx} from "../api/UtilAPI";
import {trigger} from "../internal";



declare module "../api/mim"
{
    interface IServiceDefinitions
    {
        popup: IPopup;
        dialog: IDialog;
    }
}



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
    readonly dialog?: css.IClassRule | css.IClassNameRule;
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
 */
export interface IPopupOptions<T extends IPopupStyles = IPopupStyles>
{
    /**
     * Defines what styles to use for the <dialog> element and optionally for the ::backdrop
     * pseudo element. The value can be either a style definition class implementing the
     * [[IPopupStyles]] interface or an instance of such class. The popup activates the styles
     * when it opens and deactivates them when it closes. The default value is undefined.
     * 
     * If this property is not defined, the popup will use styles last set using the
     * [[pushPopupStyles]] function. If this function has never been called before, the popup
     * will use default styles.
     */
    readonly styles?: T | css.IStyleDefinitionClass<T>;

    /**
     * Defines what CSS class to use for the `<dialog>` element. If this property is defined,
     * the [[style]] property is ignored
     */
    readonly dialogStyleClass?: css.ClassPropType;

    /**
     * Value that is returned when the user closes the popup by pressing the Escape key. If this
     * property is undefined, the popup cannot be closed with the Escape key. The default value is
     * undefined.
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
 */
export class Popup<T extends IPopupStyles = IPopupStyles> extends mim.Component implements IPopup
{
    /**
     * Popup is constructed by specifying the initial content it should display and the options
     * @param content 
     * @param options 
     */
    public constructor( content?: any, options?: IPopupOptions)
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
    }

    /**
     * Displays the popup as a modeless dialog and returns a promise that is resolved when the
     * popup is closed. The resolved value of the promise is the value passed to the close()
     * method.  The method will throw an exception if the popup is already open as a modeless
     * popup.
     */
    public showModal(): Promise<any>
    {
        if (this.isOpen)
            return Promise.reject( new Error( "Popup already open"));

        this._returnValue = undefined;

        this.create();
        this.dlg.showModal();

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

        this.dlg.close();
        this.destroy();

        this._returnValue = returnValue;
	
		if (this.modalPromise)
		{
			this.modalPromise.resolve( returnValue);
			this.modalPromise = undefined;
		}
    }

    /**
     * Determines whether the popup is currently open.
     */
    public get isOpen(): boolean
    {
        return this.dlg != null;
    }

	/**
     * Determines whether the dialog is currently open as modeless.
     */
	public isModeless(): boolean
	{
		return this.isOpen && !this.modalPromise;
	}

	/**
     * Determines whether the dialog is currently open as modal.
     */
	public isModal(): boolean
	{
		return this.isOpen && this.modalPromise != null;
	}

    /**
     * Returns the value set by the close() method. If the popup is open, the value is undefined.
     */
    public get returnValue(): any
    {
        return this._returnValue;
    }

    /**
     * Replaces the current content of the popup with the given one.
     * @param content 
     */
    public setContent( content: any): void
    {
        this.content = content;
    }

    /**
     * Gets or sets the flag determining whether the popup is currently visible or hidden.
     */
    public get isVisible(): boolean
    {
        return this._isVisible;
    }

    public set isVisible( v: boolean)
    {
        this._isVisible = v;
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

		window.addEventListener( "mousemove", this.onMove);
        window.addEventListener( "mouseup", this.onStopMove);
    }

	/**
     * Stops monitoring mouse movements. This method allows programmatically interrupt
     * dialog moving operations.
     */
    public stopMove()
	{
        if (!this.dlg)
            return;

		window.removeEventListener( "mousemove", this.onMove);
        window.removeEventListener( "mouseup", this.onStopMove);
        
        this.movePointOffsetX = this.movePointOffsetY = 0;
	};

    /**
     * Moves the dialog to the given coordinates. The coordinates are adjusted so that at least
     * some part of the dialog at the top-left corner remains visible in order to the user to be
     * able to continue moving it.
     */
	public moveTo( newX: number, newY: number)
	{
        this.move( newX, newY);
        this.dlg.style.margin = "0";
	};



    /**
     * If deribed classes override this method, they must call super.willMount()
     */
    public willMount(): void
	{
        this.vn.publishService( "popup", this);
	};

    /**
     * If deribed classes override this method, they must call super.willUnmount()
     */
	public willUnmount(): void
	{
        this.vn.unpublishService( "popup");
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
        this.defaultStyles = css.activate( this.getDefaultStyles()) as T;
        if (this.options && this.options.styles)
            this.optionalStyles = css.activate( this.options.styles) as T;

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

        // establish listener for keyboard events
        window.addEventListener( "keydown", this.onKeyDown);
    }

    // Destroys the dialog element
    private destroy(): void
    {
        // remove listener for keyboard events
		window.removeEventListener( "keydown", this.onKeyDown);

        // unmount the content
        mim.unmount( this.dlg);

        // deactivate styles
        css.activate( this.defaultStyles);
        this.defaultStyles = null;
        if (this.optionalStyles)
        {
            css.deactivate( this.optionalStyles);
            this.optionalStyles = null;
        }

        // remove the dialog element
        this.dlg.remove();
        this.dlg = null;
        this.anchorElement = null;
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
        if (e.keyCode === 27) // Esc
        {
            e.preventDefault();

            // we ignore the Escape key if the escapeReturnValue option is undefined; otherwise,
            // we close the dialog with its value
            let retVal = this.getReturnValueForEscapeKey();
            if (retVal != null)
                this.close( retVal);
        }
	};

	private onMove = (e: MouseEvent) =>
	{
		this.move( e.clientX - this.movePointOffsetX, e.clientY - this.movePointOffsetY);
	};

	private onStopMove = (e: MouseEvent) =>
	{
        this.stopMove();
	};



    /**
     * Returns the default style definition instance or class
     */
	protected getDefaultStyles(): T | css.IStyleDefinitionClass<T>
	{
        return DefaultPopupStyles as css.IStyleDefinitionClass<T>;
	};

    /**
     * Returns the value that should be used as a return value when closing the popup after the
     * user pressed the Esc key. If undefined is returned, the popup doesn't close
     */
	protected getReturnValueForEscapeKey(): any
	{
        // this implementation simply returns the value from the options.
        return this.options?.escapeReturnValue;
	};



    // Content to display
    @trigger(0)
    protected content: any;

    // Options
    protected options: IPopupOptions;

    // Activated default styles
    protected defaultStyles: T;

    // Activated optional styles
    protected optionalStyles: T;

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

	// Offsets of the point where the move started from the dialog top-left corner. We use them
	// to calculate the dialog top-left position based on the mouse coordinates while move is
	// in progress.
	private movePointOffsetX: number;
	private movePointOffsetY: number;
}



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
    readonly dialogCaption?: css.IClassRule | css.IClassNameRule;
    readonly dialogBody?: css.IClassRule | css.IClassNameRule;
    readonly dialogButtonBar?: css.IClassRule | css.IClassNameRule;
    readonly dialogButton?: css.IClassRule | css.IClassNameRule;
}



/**
 * Default styles that will be used by the Popup if styles are not specified using options.
 */
export class DefaultDialogStyles extends DefaultPopupStyles implements IDialogStyles
{
    dialogCaption = css.$class({
        backgroundColor: "blue",
        color: "white",
        // boxShadow: { x: 0, y: 4, blur: 2, color: "blue" },
        padding: 0.3,
    })

    dialogBody = css.$class({
        padding: 0.5,
    })

    dialogButtonBar = css.$class({
        backgroundColor: "lightgrey",
        padding: [0.7, 1.01],
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
    })

    dialogButton = css.$class({
        padding: 0.4,
        marginInlineStart: 1.01,
        minWidth: 6.5
    })
}



/**
 * The IDialogOptions interface represents the options that cofigure the behavior of the Dialog
 * object. They are passed in the constructor to the [[Dialog]] class
 */
export interface IDialogOptions extends IPopupOptions<IDialogStyles>
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
 * The Dialog class is a popup that divides the popup area into three sections: caption, body and
 * button bar. 
 */
export class Dialog<T extends IDialogStyles = IDialogStyles> extends Popup<T> implements IDialog
{
    constructor( bodyContent?: any, captionContent?: any, options?: any, ...buttons: IDialogButton[])
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
    public addButton( btn: IDialogButton): void
    {
        this.buttons.set( btn.id, new DialogButtonInfo( btn));
    }



    /**
     * Returns the default style definition instance or class
     */
	protected getDefaultStyles(): T | css.IStyleDefinitionClass<T>
	{
        return DefaultDialogStyles as css.IStyleDefinitionClass<T>;
	};



    /**
     * If deribed classes override this method, they must call super.willMount()
     */
    public willMount(): void
	{
        super.willMount();

        // obtain class names for our elements
        this.captionClassName = css.chooseClass( this.options?.dialogCaption,
            this.optionalStyles?.dialogCaption, this.defaultStyles.dialogCaption);
        this.bodyClassName = css.chooseClass( this.options?.dialogBody,
            this.optionalStyles?.dialogBody, this.defaultStyles.dialogBody);
        this.buttonBarClassName = css.chooseClass( this.options?.dialogButtonBar,
            this.optionalStyles?.dialogButtonBar, this.defaultStyles.dialogButtonBar);
        this.buttonClassName = css.chooseClass( this.options?.dialogButton,
            this.optionalStyles?.dialogButton, this.defaultStyles.dialogButton);

        this.vn.publishService( "dialog", this);
	};

    /**
     * If deribed classes override this method, they must call super.willUnmount()
     */
	public willUnmount(): void
	{
        this.vn.unpublishService( "dialog");
        super.willUnmount();
	};

    public render(): void
    {
        return <div>
            {this.renderCaption}
            {this.renderBody}
            {this.renderButtons}
        </div>
    }

    public renderCaption(): void
    {
        return <div class={this.captionClassName}
            mousedown={this.onCaptionMouseDown}>
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
                <button id={info.btn.id} class={this.buttonClassName} click={() => this.onButtonClicked(info)}>
                    {info.btn.content}
                </button>
            )}
        </div>
    }



    private onCaptionMouseDown( e: MouseEvent): void
    {
        this.startMove( e.clientX, e.clientY);
    }

    private onButtonClicked( info: DialogButtonInfo): void
    {
        if (info.btn.callback)
            info.btn.callback( info.btn.id);
        else
            this.close( info.btn.returnValue);
    }



    // Options
    protected options: IDialogOptions;

    // Map of button IDs to button information objects
    @trigger
    private captionContent: any;

    // Map of button IDs to button information objects
    @trigger(3)
    private buttons = new Map<any, DialogButtonInfo>();

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
    constructor( btn: IDialogButton)
    {
        this.btn = btn;
        this.disabled = btn.disabled;
    }

    /**
     * Input information about the button.
     */
    btn: IDialogButton;

    /**
     * Flag indicating whether the button is currently disabled.
     */
    readonly disabled?: boolean;
}



/**
 * The DialogButton enumeration defines constants to indicate standard buttons used in dialogs.
 */
export const enum DialogButton
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
export const enum MsgBoxButtons
{
	/** Message box will display no buttons */
	None = DialogButton.None,

	/** Message box will have a single Close button */
	Close = DialogButton.Close,

	/** Message box will have a single OK button */
	OK = DialogButton.OK,

	/** Message box will have OK and Cancel buttons */
	OkCancel = DialogButton.OK + DialogButton.Cancel,

	/** Message box will have Yes and No buttons */
	YesNo = DialogButton.Yes + DialogButton.No,

	/** Message box will have Yes, No and Cancel buttons */
	YesNoCancel = DialogButton.Yes + DialogButton.No + DialogButton.Cancel,
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
        alignItems: "stretch",
    })

    icon = css.$class({
        padding: "0.5rem",
        fontSize: "3em",
        fontWeight: 900,
        // marginInlineEnd: "1em",
    })

    text = css.$class({
        padding: 0.5,
        minWidth: "15em",
        maxWidth: "60em",
        minHeight: "2em",
        maxHeight: "20em",
        overflow: "auto",
    })
}



/**
 * The MsgBox class is a dialog that displays a message with a set of pre-defined buttons.
 */
export class MsgBox extends Dialog<MsgBoxStyles>
{
	public static showModal( message: string, title?: string, buttons: MsgBoxButtons = MsgBoxButtons.OK,
					icon: MsgBoxIcon = MsgBoxIcon.None): Promise<DialogButton>
	{
		let msgBox: MsgBox = new MsgBox( message, title, buttons, icon);
		return msgBox.showModal();
	}



	constructor( message: string, title?: string, buttons: MsgBoxButtons = MsgBoxButtons.OK,
					icon: MsgBoxIcon = MsgBoxIcon.None)
	{
		super( message, title, { styles: MsgBoxStyles });
		this.icon = icon;

		this.createButtons( buttons);
	}



	public renderBody(): any
	{
		let { char, color } = this.getIconClassAndColor();
		return <div class={this.optionalStyles.container}>
            {char &&
                <span class={this.optionalStyles.icon} style={{color}}>{char}</span>
            }
            <div class={this.optionalStyles.text}>
                {this.content}
            </div>
        </div>;
	}



	// Adds buttons according to the parameter specified in the constructor.
	private createButtons( buttons: MsgBoxButtons): void
	{
		switch( buttons)
		{
			case MsgBoxButtons.Close:
				this.createButton( "Close", DialogButton.Close);
				break;

			case MsgBoxButtons.OK:
				this.createButton( "OK", DialogButton.OK);
				break;

			case MsgBoxButtons.OkCancel:
				this.createButton( "OK", DialogButton.OK);
				this.createButton( "Cancel", DialogButton.Cancel);
				break;

			case MsgBoxButtons.YesNo:
				this.createButton( "Yes", DialogButton.Yes);
				this.createButton( "No", DialogButton.No);
				break;

			case MsgBoxButtons.YesNoCancel:
				this.createButton( "Yes", DialogButton.Yes);
				this.createButton( "No", DialogButton.No);
				this.createButton( "Cancel", DialogButton.Cancel);
				break;
		}
	}



	// Returns symbol and color for displaying the icon.
	private getIconClassAndColor(): { char?: string, color?: css.CssColor }
	{
		switch( this.icon)
		{
			case MsgBoxIcon.Info: return { char: "I", color: "blue" };
			case MsgBoxIcon.Warning: return { char: "!", color: "orange" };
			case MsgBoxIcon.Error: return { char: "X", color: "red" };
			case MsgBoxIcon.Question: return { char: "?", color: "green" };

			default: return {};
		}
	}



	private createButton( text: string, key: DialogButton): void
	{
		this.addButton( {
            id: key,
            content: text,
            returnValue: key
        });
	}



	// Icon
	private icon: MsgBoxIcon;

}



