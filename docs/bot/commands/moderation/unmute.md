---
icon: volume
---

# Unmute

## Overview

The `/unmute` command removes an active timeout from a member, allowing them to send messages, add reactions, and participate in voice channels again.

## Command Details

### Permissions Required

* **User**: `MODERATE_MEMBERS` permission
* **Bot**: `MODERATE_MEMBERS` permission

### Command Syntax

```bash
/unmute member:<@member> reason:<text>
```

### Parameters

| Parameter | Type   | Required | Description                         |
| --------- | ------ | -------- | ----------------------------------- |
| `member`  | User   | ✅ Yes    | The member to remove timeout from   |
| `reason`  | String | ✅ Yes    | The reason for removing the timeout |

## Features

### 1. **Early Timeout Removal**

* Removes active Discord timeout
* Member can immediately participate again
* Useful for early releases or mistakes

### 2. **Audit Trail**

* Logs the unmute action
* Records reason for removal
* Tracks moderator who removed timeout

### 3. **Database Updates**

* Updates moderation history
* Sets timeout record to inactive
* Clears `currentlyMuted` flag

### 4. **DM Notification** (Optional)

Member may receive notification that their timeout was removed early.

## Usage Examples

### Example 1: Early Release for Good Behavior

```bash
/unmute member:@ReformedUser reason:Showed understanding of rules, early release
```

Remove timeout before expiration for users who demonstrate improvement.

### Example 2: Accidental Mute

```bash
/unmute member:@WrongPerson reason:Muted wrong user by mistake
```

Quickly correct an accidental timeout.

### Example 3: Appeal Accepted

```bash
/unmute member:@AppealedUser reason:Appeal accepted, timeout removed
```

Remove timeout after reviewing an appeal.

## How It Works

1. **Permission Check**: Verifies moderator has `MODERATE_MEMBERS` permission.
2. **Member Fetch**: Retrieves the member from the guild.
3. **Execute Unmute**:
   * Calls Discord API to remove timeout
   * Uses helper function `executeUnmute()`
   * Removes timeout instantly
4. **Database Updates**:
   * Updates moderation history entry
   * Sets `active` flag to false
   * Clears `currentlyMuted` flag
   * Records moderator and reason
5. **Audit Logging**:
   * Posts to audit log channel
   * Includes: who unmuted, who was unmuted, reason
   * Timestamp of removal
6. **Confirmation**: Sends confirmation message to moderator.

## Error Handling

* **Not Timed Out**: This command does not send a specific error—verify the member is timed out before running.
* **Permission Error**: Bot or moderator lacks permissions
* **Member Not Found**: Cannot find specified member
* **General Error**: "Error executing unmute command"

## Related Commands

* [Mute](mute.md) - Apply a timeout
* [User Info](../utility/user-info.md) - Check if user is currently timed out
* [Warn](warn.md) - Issue warning without timeout
* [Ban](ban.md) - Ban a member

## Configuration

Uses audit log channel from `config.json`:

```json
{
  "channels": {
    "auditLog": "AUDIT_CHANNEL_ID"
  }
}
```

## Best Practices

* **Always provide clear reasons** - Document why timeout was removed early
* **Check history first** - Use `/user-info` to see what they were muted for
* **Communicate expectations** - Make sure user understands why they were muted
* **Don't repeatedly unmute** - If user continues bad behavior, don't keep unmuting
* **Team coordination** - Discuss with other mods before unmuting serious cases
* **Document decisions** - Keep detailed reasons for early releases

## When to Use Unmute

**Good Reasons:**

* User shows genuine understanding and remorse
* Timeout was accidental or too harsh
* User successfully appealed
* Situation was misunderstood
* User needed in server for important reason

**Bad Reasons:**

* User begged in DMs without showing understanding
* Not enough time passed for reflection
* User has pattern of repeat offenses
* Pressure from friends without improvement

## Tips

* Let timeouts run their course for first offenses (teaches consequences)
* Early unmute is a privilege, not a right
* Use early unmute as a teaching moment
* Consider setting expectations when unmuting
* Document the unmute reason thoroughly
* If unmuting repeat offender, warn them this is final chance
* Don't feel pressured to unmute just because someone asks

## Moderation Philosophy

Timeouts serve multiple purposes:

1. **Immediate behavior correction** - Stop problematic behavior
2. **Cooling off period** - Give user time to reflect
3. **Message to community** - Show rules are enforced

When deciding to unmute early:

* Has enough time passed for reflection?
* Has user shown genuine understanding?
* Is there pressure from the user or others?
* What message does it send to the community?
* Will user likely repeat the behavior?
