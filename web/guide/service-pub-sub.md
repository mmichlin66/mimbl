---
layout: mimbl-guide
unit: 6
title: "Mimbl Guide: Publishing/Subscribe Mechanism"
---

# Publishing and Subscribing to Services
Mimbl components can publish and subscribe to services. In Mimbl, a service is an object that is exposed by a component under a certain name and is available to the components down the hierarchy from the publishing component. The service publish/subscribe mechanism is an extension of the React's Context concept. Mimbl components can publish and subscribe to multiple services. Whenever the service's value changes, the subscribed components are notified. Note that component's are not automatically re-rendered when the value of the service changes; it is up to the component how to react on the change notification.

Service publish/subscribe mechanism provides the way to make information maintained by an upstream component available to the downstream components without passing this information through layers of intermediary components between the publisher and the subscriber. For these intermediary components, there is no need to know anything about the service.

Multiple components can publish the same service. The service subscription always finds a service publisher that is the closest to the subscriber up the ancestor chain. If during re-rendering a new component that resides between the subscriber and the publisher publishes the same service, the subscriber's reference will be updated to point to the newly published service. Similarly, if a component that previously published a service is removed from the hierarchy, the subscriber's reference will be updated to point to the service instance from another publisher. If another publisher is not found, the subscriber's reference will be set to `undefined`.

Sometimes an auto-updated subscription is not necessary, but a component may want to ask the service value at certain points during the execution. In this case, the component can use the `getService` method of the `mim.Component` base class. This method returns the value of the service by finding the current closest service publisher up the ancestor chain.

In this unit we will build a *UserProfile* service, which provides information about the user currently logged in to the application (such as name and email address) and notifies when this information changes.

## Service Declaration
Each service has a name and a type. The name is a unique string distinguishing it from all other services. The type defines how the service can be used. Simple services can be just primitive types (string, number, object, array), while more involved services can have properties and methods that service consumers can invoke. When programming in plain JavaScript, the type should be known to the developer and any incorrect uses of the type will be reported only at run time. In TypeScript, however, Mimbl allows defining service type using the module augmentation mechanism so that any incorrect uses will be discovered at compile time.

Let's define our *UserProfile* service:

```tsx
type UserProfileService = null | { username: string , fullName: string, email?: string };

declare module "mimbl"
{
    interface IServiceDefinitions
    {
        UserProfile: UserProfileService;
    }
}
```

Defining the service this way allows type checking when publishing and subscribing to a service. The service name can only be the name of a property declared in the `mim.IServiceDefinitions` interface and the service value can be only of the type declared for this property.

Publishing a service is performed by calling the `publishService` method of the `mim.Component` base class. To publish a service, a component specifies the service name and provides the service value. Publishing a service is usually performed in the `willMount` lifecycle method. Correspondingly, the `unpublishService` is usually implemented in the `willUnmount` lifecycle method. For example, the component `ContainerWithUserProfile` can be implemented the following way:

```tsx
class ContainerWithUserProfile extends mim.Component
{
    willMount()
    {
        this.publishService( "UserProfile", null);
    }

    willUnmount()
    {
        this.unpublishService( "UserProfile");
    }
}
```

Subscribing to a service is performed by calling the `subscribeService` method of the `mim.Component` base class. To subscribe to a service, a component specifies the service name and provides the reference object. Subscribing to a service is usually performed in the `willMount` lifecycle method. Correspondingly, the `unsubscribeService` is usually implemented in the `willUnmount` lifecycle method. For example, the component UserProfileConsumer can be implemented the following way:

```tsx
class UserProfileConsumer extends mim.Component
{
    srvRef = new mim.Ref<UserProfileService>();

    willMount()
    {
        this.subscribeService( "UserProfile", this.srvRef);
    }

    willUnmount()
    {
        this.unsubscribeService( "UserProfile");
    }

    render()
    {
        return <span>User e-mail: {srvRef.r.email}</span>
    }
}
```

Now we can render a hierarchy that includes the ContainerWithUserProfile and UserProfileConsumer components:

```tsx
render(): any
{
    return <ContainerWithUserProfile>
        <div>
            <div>
                <div>
                    <UserProfileConsumer/>
                </div>
            </div>
        </div>
    </ContainerWithUserProfile>
}
```



