# Test Join Command

## Overview

The `/test-join` command simulates a member joining the server, triggering the `guildMemberAdd` event and all associated handlers without requiring an actual user to join.

## Command Details

### Permissions Required

* **User**: `ADMINISTRATOR` permission
* **Bot**: Depends on triggered handlers

### Command Syntax

```bash
/test-join
```

No parameters required. Response is ephemeral (only visible to you).

## Purpose

This command is designed for **testing and development** purposes to:

* Test welcome message functionality
* Verify member join event handlers
* Debug join-related features
* Test database member creation
* Verify role assignment on join
* Check DM welcome messages

## What It Does

1. **Simulates Event**: Fires the `guildMemberAdd` event
2. **Uses Your Account**: Simulates YOU joining (you're already in the server)
3. **Triggers Handlers**: All join event handlers execute
4. **No Actual Join**: You don't actually leave and rejoin

## Features

### 1. **Safe Testing**

* No actual member changes
* You remain in server with existing roles
* Can test repeatedly without side effects

### 2. **Complete Simulation**

* Triggers ALL join event handlers
* Tests database operations
* Verifies welcome messages
* Checks role assignments

### 3. **Development Tool**

* Essential for development workflow
* Saves time versus actual joins/leaves
* Allows rapid iteration on join features

## Usage Example

```bash
/test-join
```

**Response:**

```text
Triggered the join event!
```

**What happens:**

* Welcome message posted (if configured)
* Welcome DM sent to you (if configured)
* Member record created/updated in database
* Join roles assigned (if configured)
* Any custom join logic executes

## Use Cases

* **Developing welcome messages**: Test message format and content
* **Testing role assignments**: Verify auto-roles on join work
* **Debugging join handlers**: Identify issues in join logic
* **Verifying database**: Check member records are created
* **Testing DMs**: Ensure welcome DMs send properly

## Testing Workflow

1. Make changes to join event handlers
2. Compile code: `yarn compile`
3. Use `/test-join` to trigger handlers
4. Verify behavior
5. Iterate as needed

No need to:

* Leave and rejoin server
* Use alt accounts
* Ask others to join for testing

## What Gets Triggered

### Event Handlers

Located in `src/events/memberEvents.ts`:

* `guildMemberAdd` event handler
* Database member creation
* Welcome message posting
* Welcome DM sending
* Initial role assignment
* Achievement system initialization
* Any custom join logic

### Typical Join Flow

1. **Member Added Event** fires
2. **Database**: Member record created/updated
3. **Welcome Channel**: Welcome message posted
4. **DM**: Welcome DM sent to user
5. **Roles**: Auto-roles assigned
6. **Achievements**: User achievement records initialized

## Limitations

{% hint style="info" %}
Since you're already in the server, some behaviors may differ from a real join:
{% endhint %}

* You already have roles (won't remove them)
* Database record likely already exists
* Some checks may handle existing members differently

For most accurate testing of NEW member joins, test in development server or use test accounts.

## Related Commands

* [Test Leave](test-leave.md) - Simulate member leaving
* [Backend Manager](backend-manager.md) - Check database after testing

## Best Practices

* **Test in development server first**: Before production testing
* **Review logs**: Check console/logs for errors
* **Check database**: Verify records are created correctly
* **Test DMs**: Confirm messages are sent
* **Disable in production**: Remove or restrict in live environment

## Configuration

Join behaviors are configured in:

* `config.json` - Welcome channel, messages, roles
* `src/events/memberEvents.ts` - Join event handlers

Configure:

* Welcome channel ID
* Welcome message content
* Auto-assigned roles
* DM welcome message

## Security Note

{% hint style="warning" %}
This command should be restricted to administrators only. In production, consider disabling or removing testing commands.
{% endhint %}

## Tips

* Use frequently during development
* Combine with `/test-leave` for complete flow testing
* Check audit logs after test to verify all actions
* Test with different configurations
* Verify database state after each test
* Watch for errors in console
* Test DM permissions (ensure bot can DM you)

## Troubleshooting

**Nothing happens:**

* Check event handler is registered
* Verify welcome channel is configured
* Check bot permissions in welcome channel
* Review console logs for errors

**No DM received:**

* Check your DM settings (allow DMs from server members)
* Verify bot has proper permissions
* Check DM sending code for errors

**Database not updated:**

* Check database connection
* Verify database write permissions
* Review database logs

**Welcome message missing:**

* Verify channel ID in config
* Check bot permissions in channel
* Ensure welcome feature is enabled
