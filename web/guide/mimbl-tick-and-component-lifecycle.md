---
layout: mimbl-guide
unit: 8
title: "Mimbl Guide: Mimbl Tick and Component Life Cycle"
---

# Mimbl Guide: Mimbl Tick and Component Life Cycle
As the user interacts with the Mimbl-based application, components that require change request to be updated by calling the `updateMe` method. As a result, component's `render` method is called and the DOM is updated reflecting the new content. The `render` method, however, isn't called directly from the `updateMe` method; instead, the Mimbl infrastructure schedules the component for update and the actual update happens during the so called *Mimbl Tick*. The tick consists of several phases and components can implement *life cycle methods*, which are called during these phases. This section describes the Mimbl tick process and the life cycle methods.

## Scheduling Component Updates
The three types of components that Mimbl supports - functional, managed and independent - can be updated as a result of different actions:
- A functional component is updated only when its parent is updated and passes a different set of properties to it.
- A managed component is updated either when its parent is updated and passes a different set of properties to it; or when it calls the `updateMe` method.
- An independent component is updated only when it calls the `updateMe` method.

Components are scheduled for update when they call the `updateMe` method. Since the functional components can only be updated as a result of their parent being updated, they cannot be scheduled for updates on their own; therefore, this type of components will not be discussed here.

When a component calls the `updateMe` method, Mimbl puts the component into an internal list of components scheduled for update and schedules a new tick. If multiple components call the `updateMe` method before the tick processing begins, all the components will be updated during a single tick. If a single component calls the `updateMe` method multiple times before the tick processing begins, the component is scheduled only once. When the tick process runs, all the components are updated in a synchronous way.

## Scheduling Functions
In addition to the `updateMe` method, components can call the `callMe` method to schedule arbitrary functions to run either before or after the components are updated. If a component calls the `callMe` method multiple times for the same function to be scheduled either before or after component updates, the function is called only once for each phase. If the same function is specified in the calls to the `callMe` method once for the "before" phase and once for the "after" phase, the function will be called twice - once in each stage.

Components can also implement the `beforeUpdate` and `afterUpdate` methods, which will be called before or after all components are updated every time the component that implements them is updated. This is useful if a component always wants the "before" or "after" function to be called eliminating the need to invoke the `callMe` method every time.

## Mimbl Tick
Mimbl tick is a process of calling scheduled functions, rendering components and updating the DOM. Ticks are scheduled when components call `updateMe` or `callMe` methods. Mimbl uses the `requestAnimationFrame` function to schedule ticks and thus it runs not more frequently than 60 times a second.

Even if a full frame - 16ms - passes between the user action (e.g. a click) and the content change on the screen, for the user the change feels instant. On the other hand, there might be multiple events "accumulated" between the frames, which will be processed together. This is especially important for the frequent events such as scrolling and resizing. The `requestAnimationFrame` function provides the necessary throttling for handling such events.

Each Mimbl tick consists of the following phases:

1. Before Update phase - calling functions that were scheduled to be called before component updates. This includes the `beforeUpdate` methods of components scheduled for updates if they implement this method.
2. Rendering phase - calling `render` methods of components scheduled for update.
3. Commit phase - creating, updating and removing DOM elements.
4. After Update phase - calling functions that were scheduled to be called after component updates. This includes the `afterUpdate` methods of components scheduled for updates if they implement this method.

Mimbl maintains lists of functions scheduled to be called and components scheduled to be updated. During the tick, Mimbl goes through these lists and invokes the required functions and methods.

### Before Update Phase
During the Before Update phase, Mimbl calls all functions scheduled to be called before component updates as well as all `beforeUpdate` methods of the components scheduled to be updated. This is a good place to read layout information from the DOM without the risk of causing forced layouts. This can be useful for components that need to take measurements of  DOM elements in order to use them in their `render` method.

While there is no any mechanism to prevent this, the functions called during the Before Update phase should not make any DOM modification. This is because, the Before Update phase is executed with the premise that any DOM reads will not cause forced layout calculations.

If during the execution of the function, the component calls the `updateMe` method to request component update, the update will be performed in the same tick. Likewise, if during the execution of the function, the component calls the `callMe` method to schedule a function to be called *after* component updates, the function will be called in the same tick. However, if during the execution of the function, the component calls the `callMe` method to schedule a function to be called *before* component updates, the function will be called in the next tick.

### Render Phase
During the Render Phase, Mimbl goes over the components scheduled for updates and calls their `render` functions. If the `render` function returns elements and/or managed components, they are updated recursively. The rendering recursion stops whenever an independent component is encountered.

At the beginning of the Render phase, Mimbl arranges all the scheduled components in the order of their nesting depth. Rendering process starts with the higher-level components and ends with the lower-level - that is, the deepest - components. This ensures that each component is rendered only once as well as no unnecessary rendering takes place. In order to understand why arranging components this way is necessary, let's consider the following two examples and what would happen without such arrangement:

1. Imagine two managed components - a parent and a child - both being updated as a result of some user action. Imagine also that the child component happens to be in the list before the parent component. The child component is rendered first and then the parent component is rendered. Note, however, that since the child component is a managed one, it will be rendered again because of the parent.

2. Imaging another example with two components - again a parent and a child - this time they can be either managed or independent ones. Imagine now that as a result of some user action, both components are scheduled for update, but the update of the parent component causes the child component to be removed. If the child component is first to be updated, then this update is just a waste of resources.

Arranging components by their nesting depths ensures that parent components are updated before the child ones thus eliminating inefficiencies.

If during the `render` method execution, the component calls the `updateMe` method to request component update, the update will be performed in the next tick. Likewise, if during the execution of the function, the component calls the `callMe` method to schedule a function to be called *before* component updates, the function will be called in the next tick. However, if during the execution of the function, the component calls the `callMe` method to schedule a function to be called *after* component updates, the function will be called in the same tick.

### Commit Phase
During the Commit phase Mimbl updates DOM according to the updates to the virtual DOM tree made during the Render phase. During the Commit phase, Mimbl adds, removes or moves DOM elements and adds, removes or updates element attributes and event listeners.

### After Update Phase
During the After Update phase, Mimbl calls all functions scheduled to be called after component updates as well as all `afterUpdate` methods of the components scheduled to be updated. Components are free to make direct DOM changes.

While there is no any mechanism to prevent this, the functions called during the After Update phase should not read any layout information from DOM. This is because, the After Update phase is executed after DOM updates have already been done and any reads of layout information will cause forced layout calculations.

If during the execution of the function, the component calls the `updateMe` or `callMe` methods the component update and the function invocations will be scheduled to the next tick.

## Component Life Cycle
Class-based components - both managed and independent ones - can implement a number of methods that are called by the Mimbl infrastructure at certain events during the component life cycle.

The main difference between the managed and independent components in regards to the life cycle methods stems from the fact that the independent components are only updated when they call the `updateMe` method while managed components can also be updated if the parent component is updated and passes new properties to them. In order to be able to avoid unnecessary rendering, managed components can implement the `shouldUpdate` method, which receives the new properties and returns `true` if the component should be rendered and `false` otherwise.

Component life cycle events occur in certain sequence when components are mounted, updated and unmounted. Here, *mounting*
refers to the process of making the component (more precisely, the elements it renders) part of the DOM tree. For managed components mounting occurs right after the component instance has been created by Mimbl infrastructure. For independent components, the instances are created by developers and might have been created well before the component is mounted. The *unmounting* refers to the process of removing the component from the DOM tree. An unmounted instance of a managed component cannot be reused in any way - even if there is an outstanding reference that keeps this instance alive. Instances of unmounted independent components can be reused and mounted again.

### Component Mounting
When a component was specified in the `render` method of its parent, the following sequence of events occurs:

1. For a managed component, Mimbl creates a component instance and calls the component's constructor.
1. Mimbl sets the `vn` property of the component to the object implementing the `IVNode` interface.
1. Mimbl calls the `willMount` method if the component implements it.
1. Mimbl calls the `beforeUpdate` method if the component implements it.
1. Mimbl calls the `render` method, which all components must implements.
1. Mimbl calls the `afterUpdate` method if the component implements it.

### Component Unmounting
When a component is not specified in the `render` method of its parent any longer, the following sequence of events occurs:

1. Mimbl calls the `willUnmount` method if the component implements it.
1. Mimbl sets the `vn` property of the component to `undefined`.

### Component Update
When a component is updated as a result of calling the `updateMe` method, the following sequence of events occurs:

1. Mimbl calls the `beforeUpdate` method if the component implements it.
1. Mimbl calls the `render` method, which all components must implements.
1. Mimbl calls the `afterUpdate` method if the component implements it.

When a managed component is updated as a result of the parent component being updated, the following sequence of events occurs:

1. Mimbl calls the `beforeUpdate` method if the component implements it.
1. Mimbl calls the `shouldUpdate` method, if the component implements it.
1. If the `shouldUpdate` method is not implemented by the component or if it returns `true`, Mimbl sets the new value to the component's `props` property and calls the `render` method, which all components must implements.
1. Mimbl calls the `afterUpdate` method if the component implements it.






