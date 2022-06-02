---
layout: mimbl-guide
unit: 7
title: "Mimbl Guide: Callbacks and this"
---

# Mimbl Guide: Callbacks and this
Callbacks are used heavily in JavaScript and, consequently, in Mimbl. Using callbacks as DOM event handlers was described in the previous unit; however, there are many other places where callbacks are used. Since Mimbl encourages developing class-based components, the callbacks will often be class methods, which will need to have access to the class instance properties via the `this` keyword. JavaScript is notorious for making it difficult to combine callbacks and `this` access. This unit describes the techniques available in Mimbl that make this process a bit easier.

## Callbacks and this in JavaScript
Originally a language without classes, JavaScript has always supported objects, constructor functions and the `this` keyword. Nowadays, when the modern JavaScript supports classes natively and especially with advent of TypeScript, classes are the preferred way of writing reusable components (notwithstanding React's promotion of Hooks). Compared to other object-oriented languages, however, JavaScript has very different mechanics around the use of `this`. While in other languages within a class method, `this` always refers to the instance no matter how the method was called, in JavaScript, it is exactly the way the method is called that determines what `this` will refer to.

When a method is called using the `object.method()` notation, `this` inside the `method` will refer to `object`; however, if a method is invoked as a callback (e.g. in `setTimeout`), `this` will either be undefined or refer to a global object such as `window`. For example:

```tsx
class A
{
    name: string;
    printName() { console.log( this.name); }
}

let a = new A();
a.name = "John";

a.printName());  // prints "John"

setTimeout( a.printName, 1000); // DOES NOT print "John"
```

In order to have a properly defined `this` when a method is used as a callback, the method should either be defined as an arrow function property or be bound to the class instance:

```tsx
class A
{
    name: string;

    // define property with an arrow function as the value
    printName = () => { console.log( this.name); };
}

// OR

class A
{
    name: string;
    printName() { console.log( this.name); };

    constructor()
    {
        // bind the method to `this` value
        this.printName = this.printName.bind( this);
    }
}

```

These two techniques are widely used to allow methods to be invoked as callbacks; however, let's notice what is actually happening here. In our original definition of class `A`, the `printName` method was really a method - that is, a function defined on the prototype of the class. This means that no matter how many objects of the class we create, there is a single definition of the method. When we define the `printName` method as an arrow function or bind the method to `this` in the constructor, what we actually create is a property and each instance of our class will have this property with a distinct value. This might be wasteful - especially if we have many callbacks and not all of them are necessarily used all the time.

## Wrapping Callback Methods
As we saw in the previous unit, Mimbl solves the above problem for event handlers defined as component classes' methods by wrapping the event handler methods with an internal function that stores the component instance and uses this instance in the call to the `Function.prototype.apply()` function. Mimbl also provides an explicit way of wrapping component methods so that they can be used in any context that expects a callback. This is accomplished via the `wrapCallback` method of the `mim.Component` class and thus is available to any managed or independent component implemented by extending this class.

Let's implement a simple DelayedMessage component, which will display a message every time the user clicks the button; however, displaying the message will be delayed by two seconds using the `setTimeout` function. The message will consists of the time the user clicked the button and the time the message was actually displayed.

```tsx
class DelayedMessage extends mim.Component
{
    /** Remembered time when the user clicked the button */
    @mim.trigger private clickedTime: Date;

    /** Remembered time when the message is displayed */
    @mim.trigger private displayedTime: Date;

    public render(): any
    {
        return <div>
            <button disabled={this.clickedTime && !this.displayedTime} click={this.onClick}>Click Me</button>
            <br/>
            {this.clickedTime && <span>Clicked at {this.clickedTime.toLocaleTimeString()}</span>}
            <br/>
            {this.displayedTime && <span>Displayed at {this.displayedTime.toLocaleTimeString()}</span>}
        </div>;
    }

    private onClick()
    {
        // remember current time
        this.clickedTime = new Date();

        // undefine the displayedTime, which will disable the button, so that it cannot be
        // clicked again until the message is displayed
        this.displayedTime = undefined;

        // wrap our displayTimes method and call it in 2 seconds
        setTimeout( this.wrapCallback( this.displayTimes), 2000);
    }

    private displayTimes()
    {
        // get current time
        this.displayedTime = new Date();
    }
}

mim.mount( new DelayedMessage());

```

## Why Wrapping is Needed
Looking at the code above, one might wonder whether wrapping a method is really worth it. Indeed, the code performs wrapping every time the button is clicked, while, obviously, the wrapping can be done just once and the result remembered in the component's data member. And is it really better than just having an arrow method property?

The answer is that wrapping involves more than just having a method instead of an arrow method property. Wrapping also makes the wrapped callback a part of the Mimbl error handling mechanism. Imagine that a callback throws an exception. Without wrapping, since the callback is invoked directly from the JavaScript engine, it bypasses the Mimbl error handling functionality and may leave the UI in an indeterminate state. With wrapping, Mimbl intercepts the call to the callback using its internal wrapping function and makes sure exceptions are caught and propagated to the nearest error handling component.


