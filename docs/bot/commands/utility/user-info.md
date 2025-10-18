---
icon: user-magnifying-glass
---

# User Info

## Overview

The `/user-info` command provides detailed information about a user, including moderation history, counting statistics, and account details. Available to moderators only.

## Command Details

### Permissions Required

* **User**: `MODERATE_MEMBERS` permission
* **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/user-info user:<@user>
```

### Parameters

| Parameter | Type | Required | Description                            |
| --------- | ---- | -------- | -------------------------------------- |
| `user`    | User | ✅ Yes    | The user to retrieve information about |

## Information Displayed

### Account Information

* Discord username and ID
* Account creation date
* Server join date

### Moderation History

* **Warnings**: Total count and recent 5 warnings with reasons
* **Mutes**: Total timeouts and current active mute status
* **Bans**: Total bans and current ban status

### Counting Statistics

* Counting mistakes
* Counting warnings
* Counting ban status

### Server Status

* Currently in server (true/false)
* Currently banned (true/false)
* Currently muted (true/false)

## Usage Examples

### Example 1: Check User's History

```bash
/user-info user:@SuspiciousUser
```

View complete moderation history and statistics.

### Example 2: Verify Mute Status

```bash
/user-info user:@MutedPerson
```

Check if user is currently timed out and when it expires.

### Example 3: Review Before Action

```bash
/user-info user:@ReportedUser
```

Check history before deciding on moderation action.

## How It Works

1. Fetches member data from database
2. Retrieves all moderation history records
3. Sorts and filters moderation actions
4. Gets counting statistics from Redis/database
5. Formats into comprehensive embed
6. Displays with all relevant information

## Related Commands

* [Warn](../moderation/warn.md) - Add warning to history
* [Ban](../moderation/ban.md) - Ban user
* [Mute](../moderation/mute.md) - Timeout user
* [Counting](../fun/counting.md) - Counting statistics

## Use Cases

* **Pre-moderation review**: Check history before taking action
* **Pattern identification**: Spot repeat offenders
* **Appeal review**: Verify claims in ban appeals
* **Incident investigation**: Review context of reports
* **Status verification**: Check if user is currently sanctioned

## Best Practices

* Always check user info before major moderation actions
* Look for patterns, not just single incidents
* Consider timeframe (recent vs old offenses)
* Review with other moderators for serious cases
* Use for objective decision-making

## Tips

* Recent warnings appear at the top (up to 5 shown)
* Total counts show full history
* Active status indicates current sanctions
* Counting stats help identify gaming-related issues
* Export or screenshot for detailed review meetings
