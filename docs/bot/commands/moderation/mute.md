---
icon: volume-slash
---

# Mute

## Overview

The `/mute` command applies a timeout to a member, preventing them from sending messages, adding reactions, speaking in voice channels, and joining stage channels. Unlike kick/ban, the user remains in the server.

## Command Details

### Permissions Required

* **User**: `MODERATE_MEMBERS` permission
* **Bot**: `MODERATE_MEMBERS` permission

### Command Syntax

```bash
/mute member:<@member> reason:<text> duration:<time>
```

### Parameters

| Parameter  | Type   | Required | Description                                           |
| ---------- | ------ | -------- | ----------------------------------------------------- |
| `member`   | User   | ✅ Yes    | The member to timeout                                 |
| `reason`   | String | ✅ Yes    | The reason for the timeout                            |
| `duration` | String | ✅ Yes    | Timeout duration (e.g., 5m, 1h, 1d). **Max: 28 days** |

## Features

### 1. **Discord Native Timeouts**

Uses Discord's built-in timeout feature:

* Prevents sending messages
* Prevents adding reactions
* Prevents speaking in voice
* Prevents joining stages
* User remains visible in member list

### 2. **Maximum Duration**

Discord limits timeouts to **28 days maximum**. The command enforces this limit and rejects longer durations.

### 3. **Role Hierarchy Protection**

* Moderators cannot mute members with equal or higher roles
* Bot must be able to moderate the target member
* Maintains proper permission structure

### 4. **DM Notifications**

Muted users receive a DM containing:

* Server name
* Timeout reason
* Duration of timeout

### 5. **Audit Logging**

* Records in moderation history database
* Logs to configured audit channel
* Tracks: moderator, target, reason, duration, expiration

### 6. **Database Tracking**

Updates member record with:

* `currentlyMuted` flag set to true
* Moderation history entry
* Duration and expiration timestamp
* Active status tracking

## Usage Examples

### Example 1: Short Timeout (5 Minutes)

```bash
/mute member:@SpammingUser reason:Spamming messages duration:5m
```

Brief timeout to stop immediate spamming.

### Example 2: Standard Timeout (1 Hour)

```bash
/mute member:@MinorOffender reason:Minor rule violation duration:1h
```

Typical timeout for minor infractions.

### Example 3: Extended Timeout (1 Day)

```bash
/mute member:@RepeatedWarnings reason:Multiple warnings for inappropriate behavior duration:1d
```

Longer timeout for repeat offenders.

### Example 4: Maximum Timeout (28 Days)

```bash
/mute member:@SeriousViolation reason:Serious harassment duration:28d
```

Maximum allowed timeout duration.

## How It Works

1. **Permission Validation**:
   * Checks moderator has `MODERATE_MEMBERS` permission
   * Verifies moderator's role is higher than target's
   * Ensures bot can moderate the member
   * Validates duration doesn't exceed 28 days
2. **Duration Validation**:
   * Parses duration string (e.g., "1h", "7d")
   * Converts to milliseconds
   * Checks against 28-day maximum
   * Rejects if exceeds limit
3. **DM Notification**:
   * Attempts to DM user before timeout
   * Includes server name, reason, duration
   * Logs warning if DM fails
   * Timeout proceeds regardless of DM success
4. **Apply Timeout**:
   * Uses Discord's timeout API
   * Sets timeout duration
   * Includes reason in audit log
5. **Database Updates**:
   * Adds entry to moderation history
   * Sets `currentlyMuted` flag
   * Records expiration timestamp
   * Marks as active
6. **Automatic Expiration**:
   * Discord handles timeout expiration
   * Bot updates database when timeout ends
   * Sets `active` to false in history
   * Clears `currentlyMuted` flag

## Duration Format

Accepted duration formats:

| Format | Meaning   | Example | Max           |
| ------ | --------- | ------- | ------------- |
| `Xm`   | X minutes | `30m`   | 40,320m (28d) |
| `Xh`   | X hours   | `12h`   | 672h (28d)    |
| `Xd`   | X days    | `7d`    | 28d           |

**Valid Examples:**

* `5m` - 5 minutes
* `30m` - 30 minutes
* `1h` - 1 hour
* `12h` - 12 hours
* `1d` - 1 day
* `7d` - 7 days
* `28d` - 28 days (maximum)

**Invalid Examples:**

* `30d` - Exceeds 28-day limit
* `1w` - Week format not standard (use `7d`)

## Error Handling

* **Equal/Higher Role**: "You cannot mute a member with equal or higher role than yours."
* **Not Moderatable**: "I do not have permission to mute this member."
* **Duration Too Long**: "Timeout duration cannot exceed 28 days."
* **DM Failure**: Logged as warning, timeout proceeds
* **General Error**: "Unable to timeout member."

## Mute vs Other Actions

| Feature                  | Mute          | Kick   | Ban                    |
| ------------------------ | ------------- | ------ | ---------------------- |
| **User Stays in Server** | ✅ Yes         | ❌ No   | ❌ No                   |
| **Can See Messages**     | ✅ Yes         | ❌ No   | ❌ No                   |
| **Can Send Messages**    | ❌ No          | ❌ No   | ❌ No                   |
| **Duration**             | Up to 28 days | N/A    | Permanent or temporary |
| **Severity**             | Moderate      | Higher | Highest                |

## Related Commands

* [Unmute](unmute.md) - Remove timeout early
* [Warn](warn.md) - Issue warning without timeout
* [Kick](kick.md) - Remove from server temporarily
* [Ban](ban.md) - Remove from server permanently/temporarily
* [User Info](../utility/user-info.md) - View current timeout status

## Configuration

Configure audit logging in `config.json`:

```json
{
  "channels": {
    "logs": "AUDIT_CHANNEL_ID"
  }
}
```

## Best Practices

* **Escalate progressively** - Start with warnings, then short mutes, then longer
* **Clear reasons** - Always explain why and for how long
* **Appropriate durations** - Match severity (5m for spam, 1d for harassment)
* **Don't max out immediately** - Reserve 28d for serious repeat offenses
* **Document patterns** - Use `/user-info` to track repeat behavior
* **Communicate with team** - Discuss longer mutes (>7d) with other mods

## When to Use Mute

**Good Use Cases:**

* Active spamming or flooding
* Heated arguments that need cooling
* Minor rule violations
* First or second offense
* When user needs time to calm down

**Consider Other Actions:**

* **Warning**: For first-time minor issues
* **Kick**: When user needs stronger message
* **Ban**: For serious violations or repeat offenders

## Tips

* Start with shorter durations (5-30m) for first offenses
* Use 1-6h for standard infractions
* Reserve 1-7d for repeat offenders
* Only use 28d for serious, repeated violations
* Unmute early if user shows understanding
* Use with warnings as progressive discipline
* Check timeout status with `/user-info` before adding more time
