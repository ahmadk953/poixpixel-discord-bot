# Counting Command

## Overview

The `/counting` command manages the counting game channel where members work together to count sequentially. It includes moderation tools, statistics tracking, and user management features.

## Command Details

### Permissions Required

- **User**: Everyone can use `/counting status`
- **Admin Commands**: Require `ADMINISTRATOR` permission
- **Bot**: `SEND_MESSAGES`, `MANAGE_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/counting <subcommand> [options]
```

## Subcommands

### Status (Everyone)

View current counting statistics and status.

```bash
/counting status
```

**Shows:**

- Current count
- Next expected number
- Highest count ever reached
- Total correct counts
- Last user who counted
- Counting channel link

---

### Set Count (Admin Only)

Set the current count to a specific number.

```bash
/counting setcount count:<number>
```

**Parameters:**

| Parameter | Type    | Required | Description                                     |
| --------- | ------- | -------- | ----------------------------------------------- |
| `count`   | Integer | ✅ Yes   | The number to set as the current count (min: 0) |

---

### Ban User (Admin Only)

Ban a user from participating in the counting channel.

```bash
/counting ban user:<@user> reason:<text> [duration:<time>]
```

**Parameters:**

| Parameter  | Type   | Required | Description                                                 |
| ---------- | ------ | -------- | ----------------------------------------------------------- |
| `user`     | User   | ✅ Yes   | User to ban from counting                                   |
| `reason`   | String | ✅ Yes   | Reason for the ban                                          |
| `duration` | String | ❌ No    | Ban duration (e.g., 30m, 1h, 7d). Leave blank for permanent |

---

### Unban User (Admin Only)

Remove a counting ban from a user.

```bash
/counting unban user:<@user> reason:<text>
```

**Parameters:**

| Parameter | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| `user`    | User   | ✅ Yes   | User to unban        |
| `reason`  | String | ✅ Yes   | Reason for unbanning |

---

### Reset Data (Admin Only)

Reset the current count and clear all warnings/mistakes.

```bash
/counting resetdata
```

{% hint style="warning" %}
This action will reset the count to 0 and clear all user mistakes and warnings. This cannot be undone!
{% endhint %}

---

### Clear Warnings (Admin Only)

Clear warnings and mistakes for a specific user.

```bash
/counting clearwarnings user:<@user>
```

**Parameters:**

| Parameter | Type | Required | Description                                        |
| --------- | ---- | -------- | -------------------------------------------------- |
| `user`    | User | ✅ Yes   | User whose warnings and mistakes should be cleared |

---

### List Bans (Admin Only)

View all users currently banned from counting.

```bash
/counting listbans
```

Shows paginated list of banned users and their ban expiry information.

Note: The command currently outputs the user and expiry (duration/expiry) only; it does not include ban reasons or timestamps for when the ban was issued.

---

### List Warnings (Admin Only)

View users with counting mistakes and warnings.

```bash
/counting listwarnings
```

Shows paginated list with:

- Users with mistakes
- Number of mistakes
- Number of warnings issued
- Last mistake timestamp

---

## How Counting Works

### Basic Rules

1. **Count sequentially** - Each message must be the next number (1, 2, 3, etc.)
2. **No double counting** - You cannot count twice in a row
3. **Numbers only** - Only the number should be in the message (no text)
4. **Reset on mistake** - Incorrect numbers reset the count to 0

### Mistake Tracking

When a user makes a mistake:

- Their mistake counter increases
- After a certain number of mistakes, they receive a warning
- Too many mistakes can result in automatic temporary bans
- Mistakes are tracked per user and persist across resets

### Automatic Moderation

The counting system includes:

- **Duplicate user detection** - Prevents same user counting twice
- **Mistake tracking** - Records all incorrect counts
- **Progressive warnings** - Escalating consequences for repeated mistakes
- **Auto-bans** - Temporary bans for excessive mistakes (if configured)
- **Age filtering** - Can filter out old messages

## Usage Examples

### Example 1: Check Counting Status

```bash
/counting status
```

View the current count, statistics, and who counted last.

### Example 2: Fix the Count After a Mistake

```bash
/counting setcount count:42
```

Set the count to 42 (next person should count 43).

### Example 3: Temporarily Ban a Troll

```bash
/counting ban user:@Troll reason:Intentionally breaking the count duration:7d
```

Ban a user from counting for 7 days.

### Example 4: Clear Someone's Mistakes

```bash
/counting clearwarnings user:@JohnDoe
```

Reset a user's mistake counter (fresh start).

### Example 5: View All Banned Users

```bash
/counting listbans
```

See who is currently banned and why.

## Configuration

Configure the counting channel in `config.json`:

```json
{
  "channels": {
    "counting": "CHANNEL_ID_HERE"
  }
}
```

## Related Commands

- [User Info](../utility/user-info.md) - View user's counting statistics (warnings and mistakes)
- [Purge](../utility/purge.md) - Clean up counting channel messages

## Tips for Administrators

- **Regular monitoring** - Use `/counting listwarnings` to identify problematic users
- **Clear communication** - Post the rules in the counting channel
- **Fair moderation** - Use temporary bans first before permanent ones
- **Fresh starts** - Consider clearing warnings for users who improve
- **Status checks** - Regularly verify the count is on track

## Tips for Users

- Only send the number, nothing else
- Wait for someone else to count before counting again
- Don't spam numbers hoping one is right
- If you make a mistake, learn from it
- Check `/counting status` if unsure of the current count
