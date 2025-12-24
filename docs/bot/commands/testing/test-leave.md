---
icon: right-from-bracket
---

# Test Leave

## Overview

The `/test-leave` command simulates a member leaving the server, triggering the `guildMemberRemove` event and all associated handlers without actually removing you from the server.

## Command Details

### Permissions Required

* **User**: `ADMINISTRATOR` permission
* **Bot**: Depends on triggered handlers

### Command Syntax

```bash
/test-leave
```

No parameters required. Response is ephemeral (only visible to you).

## Purpose

This command is designed for **testing and development** purposes to:

* Test leave message functionality
* Verify member remove event handlers
* Debug leave-related features
* Test database member updates
* Check cleanup operations
* Verify leave logging

## What It Does

1. **Simulates Event**: Fires the `guildMemberRemove` event
2. **Uses Your Account**: Simulates YOU leaving (you stay in server)
3. **Triggers Handlers**: All leave event handlers execute
4. **Database Reset**: Sets your `currentlyInServer` flag back to true
5. **No Actual Leave**: You remain in server with all roles

## Features

### 1. **Safe Testing**

* You don't actually leave the server
* Database flag is reset automatically
* Can test repeatedly
* No disruption to your account

### 2. **Complete Simulation**

* Triggers ALL leave event handlers
* Tests database operations
* Verifies leave messages
* Checks cleanup logic

### 3. **Automatic Restoration**

* Command resets your server status
* Ensures you're marked as present in database
* Prevents data inconsistencies

## Usage Example

```bash
/test-leave
```

**Response:**

```text
Triggered the leave event!
```

**What happens:**

* Leave message posted (if configured)
* Member record updated in database (marked as left)
* Leave event handlers execute
* Database flag automatically reset to present
* Any custom leave logic executes

## Use Cases

* **Testing leave messages**: Verify message format and content
* **Debugging leave handlers**: Identify issues in leave logic
* **Testing data cleanup**: Verify proper data handling on leave
* **Verifying logging**: Check leave events are logged correctly
* **Testing notifications**: Ensure staff are notified if configured

## Testing Workflow

1. Make changes to leave event handlers
2. Compile code: `yarn compile`
3. Use `/test-leave` to trigger handlers
4. Verify behavior
5. Check database state
6. Iterate as needed

No need to:

* Actually leave and rejoin
* Lose roles and progress
* Use alt accounts

## What Gets Triggered

### Event Handlers

Located in `src/events/memberEvents.ts`:

* `guildMemberRemove` event handler
* Database member status update
* Leave message posting
* Staff notifications (if configured)
* Data cleanup operations
* Any custom leave logic

### Typical Leave Flow

1. **Member Remove Event** fires
2. **Database**: `currentlyInServer` set to false
3. **Leave Channel**: Leave message posted
4. **Cleanup**: Temporary data cleaned up
5. **Notifications**: Staff notified (if configured)
6. **Logging**: Leave logged to audit channel

## Database Safety

The command includes a safety mechanism:

```typescript
await updateMember({
  discordId: interaction.user.id,
  currentlyInServer: true,
});
```

This ensures your database record correctly shows you as present after the test, preventing data inconsistencies.

## Related Commands

* [Test Join](test-join.md) - Simulate member joining
* [User Info](../utility/user-info.md) - Check member database record
* [Backend Manager](../utility/backend-manager.md) - Verify database status

## Best Practices

* **Test in development first**: Before production testing
* **Check database after**: Verify flag was reset
* **Review logs**: Check for errors or unexpected behavior
* **Test complete flow**: Use both test-join and test-leave
* **Monitor leave channel**: Verify messages appear correctly
* **Disable in production**: Remove or restrict in live environment

## Configuration

Leave behaviors are configured in:

* `config.json` - Leave channel, message format
* `src/events/memberEvents.ts` - Leave event handlers

Configure:

* Leave channel ID
* Leave message content
* Cleanup operations
* Staff notifications

## Data Handling

### Data Preserved

When members actually leave, the bot typically PRESERVES:

* XP and level data
* Achievement progress
* Moderation history
* Account creation date

### Data Cleaned

Some temporary data may be cleared:

* Active sessions
* Temporary cache entries
* Pending operations

### Re-join Handling

When members rejoin:

* Previous data is restored
* Progress is maintained
* History is available

## Security Note

{% hint style="warning" %}
This command should be restricted to administrators only. Consider disabling or removing testing commands in production.
{% endhint %}

## Tips

* Pair with `/test-join` for full join/leave flow testing
* Check leave channel immediately after running
* Verify database state with `/user-info`
* Test different leave message configurations
* Monitor logs for errors during processing
* Test cleanup operations thoroughly
* Ensure notification systems work

## Troubleshooting

**Nothing happens:**

* Check leave event handler is registered
* Verify leave channel is configured
* Check bot permissions in leave channel
* Review console logs for errors

**Database shows as left:**

* Use `/user-info` to check status
* Manually update if needed with database tools
* Check if the auto-reset failed

**No leave message:**

* Verify channel ID in config
* Check bot permissions in channel
* Ensure leave messages are enabled

**Cleanup didn't run:**

* Check cleanup functions in event handler
* Verify they're being called
* Review logs for errors
* Test cleanup logic independently

## Development Notes

### Event Structure

The command emits:

```typescript
guild.client.emit('guildMemberRemove', fakeMember);
```

Where `fakeMember` is your current guild member object.

### Safety Reset

After event processing:

```typescript
await updateMember({
  discordId: interaction.user.id,
  currentlyInServer: true,
});
```

This prevents you from being incorrectly marked as having left the server.
