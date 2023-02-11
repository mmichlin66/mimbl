---
layout: mimbl-guide
unit: 11
title: "Mimbl Guide: Custom Web Elements"
---

# Custom Web Elements

## General
Custom Web Elements are JavaScript classes deriving from the built-in *HTMLElement* or one of its descendants and registered using the built-in *window.customElements.define()* function. Custom Web Elements usually encapsulate their HTML structure under the element's *shadowRoot* node. The [Web Components standard](https://developer.mozilla.org/en-US/docs/Web/Web_Components) describes how Custom Web Elements' developers define and work with the elements' attributes, but the way their encapsulated HTML content is created is the standard DOM operations. Here the Mimbl library helps bridge the gap, so that all the methods described earlier in this guide can be used to lay out the elements' HTML content. In addition, Mimbl makes it easier to define the Custom Web Elements and to implement certain aspects of their behavior.
