# Kick Command

## Overview

The `/kick` command removes a member from the server. Unlike banning, kicked users can rejoin using an invite link. This is useful for temporary removal without the permanence of a ban.

## Command Details

### Permissions Required

- **User**: `KICK_MEMBERS` permission
- **Bot**: `KICK_MEMBERS` permission

### Command Syntax

```bash
/kick member:<@member> reason:<text>
```

### Parameters

| Parameter | Type   | Required | Description                        |
| --------- | ------ | -------- | ---------------------------------- |
| `member`  | User   | ✅ Yes   | The member to kick from the server |
| `reason`  | String | ✅ Yes   | The reason for kicking the member  |

## Features

### 1. **Temporary Removal**

- User is removed from the server
- Can rejoin with any valid invite link
- Useful for "cooling off" periods
- Less severe than banning

### 2. **Role Hierarchy Protection**

- Moderators cannot kick members with equal or higher roles
- Prevents abuse of moderator powers
- Maintains proper permission structure

### 3. **DM Notifications**

Kicked users receive a DM with:

- Server name they were kicked from
- Reason for the kick
- Server invite link to rejoin

### 4. **Audit Logging**

- Logs action to audit channel
- Records in moderation history database
- Tracks: moderator, target, reason, timestamp

### 5. **Moderation History**

- Adds entry to user's moderation record
- Can be viewed with `/user-info`
- Helps track repeat offenders

## Usage Examples

### Example 1: Basic Kick

```bash
/kick member:@Spammer reason:Spamming promotional links
```

Removes the user for spamming. They can rejoin if they promise to follow rules.

### Example 2: Rule Violation

```bash
/kick member:@BadBehavior reason:Multiple warnings for inappropriate language
```

Kick for accumulated minor violations.

### Example 3: Cooling Off Period

```bash
/kick member:@HeatedArgument reason:Involved in heated argument, please cool off before rejoining
```

Temporary removal to de-escalate situation.

## How It Works

1. **Permission Validation**:
   - Checks moderator has `KICK_MEMBERS` permission
   - Verifies moderator's role is higher than target's
   - Ensures bot can kick the target

2. **DM Notification**:
   - Sends DM explaining the kick
   - Includes reason and server invite link
   - Failure to DM is logged but kick proceeds

3. **Execute Kick**:
   - Removes member from server
   - Discord API kick action with reason

4. **Database Updates**:
   - Adds entry to moderation history
   - Records moderator, reason, timestamp
   - Marked as type "kick"

5. **Audit Logging**:
   - Posts to configured audit channel
   - Formatted embed with details
   - Available for moderator review

## Kick vs Ban

| Feature        | Kick                             | Ban                                  |
| -------------- | -------------------------------- | ------------------------------------ |
| **Removal**    | Yes                              | Yes                                  |
| **Can Rejoin** | Yes (with invite)                | No (unless unbanned)                 |
| **Duration**   | Instant (can immediately rejoin) | Permanent or temporary               |
| **Severity**   | Lower                            | Higher                               |
| **Use Case**   | Minor offenses, cooling off      | Serious violations, repeat offenders |

## Error Handling

- **Equal/Higher Role**: "You cannot kick a member with equal or higher role than yours."
- **Not Kickable**: "I do not have permission to kick this member."
- **DM Failure**: Logged, but kick proceeds
- **General Error**: "Unable to kick member."

## Related Commands

- [Ban](ban.md) - Permanently or temporarily ban
- [Mute](mute.md) - Timeout without removal
- [Warn](warn.md) - Issue warning
- [Unban](unban.md) - Reverse a ban
- [User Info](../utility/user-info.md) - View moderation history

## Configuration

Configure in `config.json`:

```json
{
  "channels": {
    "logs": "AUDIT_CHANNEL_ID"
  },
  "serverInvite": "https://discord.gg/your-server"
}
```

## Best Practices

- **Use for minor offenses** - Kicks are less severe than bans
- **Provide clear reasons** - Helps users understand what they did wrong
- **Give chance to improve** - Kicks allow users to come back reformed
- **Document the action** - Always include detailed reason
- **Consider alternatives** - Warnings or mutes might be sufficient
- **Track repeat offenders** - Use `/user-info` to see history

## When to Use Kick

**Good Use Cases:**

- First-time rule violations
- Users who need a "wake-up call"
- De-escalating heated situations
- Giving users a chance to cool off
- When a warning isn't enough but ban is too harsh

**Consider Ban Instead:**

- Repeat offenders with multiple kicks
- Serious ToS violations
- Malicious behavior (raiding, doxxing)
- Users unlikely to improve

## Tips

- Kicks are temporary - users can rejoin immediately
- Keep your invite link updated in configuration
- Explain rules clearly when users rejoin
- Consider adding a "kicked members" role on rejoin to track
- Use with warnings as progressive discipline
- Review user history before re-kicking
