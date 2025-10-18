---
icon: vial
---

# Testing Commands

Commands designed for testing bot functionality in a development or staging environment.

{% hint style="warning" %}
These commands are for testing purposes only and should be restricted to administrators. They simulate events that would normally be triggered by Discord user actions.
{% endhint %}

## Available Commands

### [Test Join](test-join.md)

Simulate a member joining the server to test welcome messages and join events.

**Usage:** `/test-join`

**Permission Level:** 👑 Administrator

***

### [Test Leave](test-leave.md)

Simulate a member leaving the server to test leave events (while keeping you in the server).

**Usage:** `/test-leave`

**Permission Level:** 👑 Administrator

***

## Use Cases

These commands are useful for:

* **Testing Welcome Messages** - Verify welcome embeds and DMs
* **Testing Event Handlers** - Check if join/leave events fire correctly
* **Debugging** - Troubleshoot event-related issues
* **Development** - Test new features without needing actual member joins/leaves

## Safety Notes

{% hint style="info" %}
These commands do NOT actually add or remove members from the server. They only trigger the event handlers as if the action occurred.
{% endhint %}

* The test-leave command resets your server status in the database after triggering the event
* No actual Discord API actions are taken (no real joins or kicks)
* These should be disabled or removed in production environments

## Related Documentation

* [Event Handlers](../../developers/introduction.md) - Learn about event system
* [Commands Overview](../commands.md) - View all command categories
