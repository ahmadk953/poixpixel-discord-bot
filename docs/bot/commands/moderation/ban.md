---
icon: hammer-crash
---

# Ban

## Overview

The `/ban` command allows moderators to ban members from the server with optional temporary duration. Banned users are removed from the server and cannot rejoin unless unbanned.

## Command Details

### Permissions Required

- **User**: `BAN_MEMBERS` permission
- **Bot**: `BAN_MEMBERS` permission

### Command Syntax

```bash
/ban member:<@member> reason:<text> [duration:<time>]
```

### Parameters

| Parameter  | Type   | Required | Description                                                     |
| ---------- | ------ | -------- | --------------------------------------------------------------- |
| `member`   | User   | ✅ Yes   | The member to ban                                               |
| `reason`   | String | ✅ Yes   | The reason for the ban                                          |
| `duration` | String | ❌ No    | Ban duration (e.g., 5m, 1h, 7d, 30d). Leave blank for permanent |

## Features

### 1. **Temporary Bans**

Set an optional duration for automatic unban:

- Supports various time formats: `5m`, `1h`, `7d`, `30d`
- Automatically schedules unban at expiration
- Unban is handled by the bot automatically
- Tracked in moderation history

### 2. **Role Hierarchy Protection**

- Moderators cannot ban members with equal or higher roles
- Ensures proper permission structure
- Prevents abuse of moderation powers

### 3. **DM Notifications**

Banned users receive a DM containing:

- Server name
- Ban reason
- Duration (if temporary)
- Unban timestamp (if temporary)
- Server invite link (for temporary bans)

### 4. **Comprehensive Audit Logging**

- Records action in moderation history database
- Logs to configured audit channel
- Includes: moderator, target, reason, duration, timestamp
- Tracks active ban status

### 5. **Database Tracking**

Updates member record with:

- `currentlyBanned` flag set to true
- Full moderation history entry
- Duration and expiration tracking

## Usage Examples

### Example 1: Permanent Ban

```bash
/ban member:@TrollUser reason:Repeated harassment and rule violations
```

Permanently bans the user. They cannot rejoin without an unban.

### Example 2: Temporary 7-Day Ban

```bash
/ban member:@SpamBot reason:Spamming advertisements duration:7d
```

Bans for 7 days. User is automatically unbanned after expiration.

### Example 3: Short Timeout Alternative

```bash
/ban member:@MinorOffender reason:Minor rule violation duration:1h
```

1-hour ban for minor offenses (consider using `/mute` for short timeouts instead).

### Example 4: Extended Ban

```bash
/ban member:@MajorViolator reason:Severe ToS violation duration:30d
```

30-day ban for serious violations.

## How It Works

1. **Permission Validation**:
   - Checks moderator has `BAN_MEMBERS` permission
   - Verifies moderator's role is higher than target's highest role
   - Ensures bot has permission to ban the target
2. **DM Notification**:
   - Attempts to send DM to user explaining the ban
   - Includes reason, duration (if any), and invite link (if temporary)
   - Failure to DM is logged but doesn't prevent the ban
3. **Execute Ban**:
   - Removes user from server immediately
   - Discord API ban action with reason
4. **Schedule Unban** (if temporary):
   - Calculates expiration timestamp
   - Schedules automatic unban using bot's scheduling system
   - Stored in database for persistence across restarts
5. **Database Updates**:
   - Adds entry to moderation history
   - Sets `currentlyBanned` flag
   - Records moderator, reason, timestamp, duration
6. **Audit Logging**:
   - Posts formatted embed to audit log channel
   - Includes all relevant details
   - Moderators and admins can review actions

## Duration Format

Accepted duration formats:

| Format | Meaning   | Example            |
| ------ | --------- | ------------------ |
| `Xm`   | X minutes | `30m` = 30 minutes |
| `Xh`   | X hours   | `12h` = 12 hours   |
| `Xd`   | X days    | `7d` = 7 days      |

**Examples:**

- `5m` - 5 minutes
- `1h` - 1 hour
- `7d` - 7 days

## Error Handling

The command handles various error scenarios:

- **Equal/Higher Role**: "You cannot ban a member with equal or higher role than yours."
- **Not Bannable**: "I do not have permission to ban this member."
- **DM Failure**: Logged but ban still proceeds
- **Database Error**: Reported to moderator

## Automatic Unban

For temporary bans:

1. Expiration time stored in database
2. Bot schedules unban task
3. At expiration:
   - User is unbanned via Discord API
   - Moderation history updated (`active` set to false)
   - Audit log entry created
   - `currentlyBanned` flag set to false

## Related Commands

- [Unban](unban.md) - Manually unban a user
- [Kick](kick.md) - Remove without ban (user can rejoin)
- [Mute](mute.md) - Timeout without removal
- [Warn](warn.md) - Issue warning without punishment
- [User Info](../utility/user-info.md) - View member's moderation history

## Configuration

Configure audit logging in `config.json`:

```json
{
  "channels": {
    "logs": "AUDIT_CHANNEL_ID"
  },
  "serverInvite": "https://discord.gg/your-server"
}
```

## Best Practices

- **Always provide detailed reasons** - Helps with transparency and appeals
- **Use temporary bans first** - Start with 7d, escalate to permanent if needed
- **Document repeat offenders** - Use `/user-info` to check history
- **Consider alternatives** - Use `/mute` for minor offenses
- **Communicate with team** - Discuss major bans with other moderators
- **Review history** - Check if user has prior offenses

## Tips

- Temporary bans are ideal for cooling-off periods
- Permanent bans should be reserved for severe violations
- Always explain the ban reason clearly
- Keep your server invite link updated in config
- Users can appeal bans through modmail or other channels you set up
