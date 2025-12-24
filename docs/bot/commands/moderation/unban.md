---
icon: unlock
---

# Unban

## Overview

The `/unban` command removes a ban from a user, allowing them to rejoin the server. This is useful for appealed bans, temporary ban expirations, or correcting mistakes.

## Command Details

### Permissions Required

- **User**: `BAN_MEMBERS` permission
- **Bot**: `BAN_MEMBERS` permission

### Command Syntax

```bash
/unban userid:<user_id> reason:<text>
```

### Parameters

| Parameter | Type   | Required | Description                                              |
| --------- | ------ | -------- | -------------------------------------------------------- |
| `userid`  | String | ✅ Yes   | The Discord ID of the user to unban (17-19 digit number) |
| `reason`  | String | ✅ Yes   | The reason for unbanning the user                        |

## Features

### 1. **Manual Unban**

- Removes Discord ban manually
- User can rejoin with invite link
- Useful for appeals or corrections

### 2. **Validation**

- Checks if user is actually banned
- Provides helpful error messages
- Prevents unnecessary API calls

### 3. **Audit Trail**

- Logs unban action
- Records moderator and reason
- Updates moderation history

### 4. **Database Updates**

- Sets ban record to inactive
- Clears `currentlyBanned` flag
- Maintains full history

## Usage Examples

### Example 1: Appeal Accepted

```bash
/unban userid:123456789012345678 reason:Appeal accepted after review
```

Unban user whose appeal was approved.

### Example 2: Ban Expired

```bash
/unban userid:123456789012345678 reason:Temporary ban period expired
```

Manually unban if automatic unban failed (usually handled automatically).

### Example 3: Mistaken Ban

```bash
/unban userid:123456789012345678 reason:Banned wrong user, correcting mistake
```

Quickly correct an accidental ban.

### Example 4: Second Chance

```bash
/unban userid:123456789012345678 reason:User has shown improvement, giving second chance
```

Unban user who has demonstrated positive change.

## How It Works

1. **Validation**:
   - Checks if user ID is valid
   - Verifies user is actually banned
   - Returns error if not banned
2. **Execute Unban**:
   - Calls Discord API to remove ban
   - Uses helper function `executeUnban()`
   - Removes ban from Discord
3. **Database Updates**:
   - Updates moderation history
   - Sets ban record `active` to false
   - Clears `currentlyBanned` flag
   - Records moderator and reason
4. **Audit Logging**:
   - Posts to audit log channel
   - Includes: moderator, user, reason
   - Timestamp of unban
5. **Confirmation**: Sends success message to moderator.

## Finding User IDs

Since banned users aren't in the server, you need their User ID:

### Method 1: Audit Log Channel

Check your audit log channel for the original ban - the embed shows the user ID.

### Method 2: Discord Audit Log

1. Go to Server Settings → Audit Log
2. Find the ban action
3. Copy the user ID from there

### Method 3: User Info

If you have the username and discriminator, you can sometimes find them via search (but this requires dev mode and right-click Copy ID).

### Method 4: Bot Database

Use `/user-info` command before they leave (if possible) or check database records.

## Error Handling

- **User Not Banned**: "This user is not banned."
- **Invalid User ID**: "Error getting ban. Is this user banned?"
- **Permission Error**: Bot or moderator lacks `BAN_MEMBERS`
- **General Error**: Error message with details

## Automatic vs Manual Unban

### Automatic Unbans

For temporary bans created with `/ban duration:<time>`:

- Bot automatically unbans at expiration
- Database automatically updated
- Audit log entry created
- No manual action needed

### Manual Unbans

Use `/unban` for:

- Appealed permanent bans
- Early release from temporary bans
- Correcting mistaken bans
- When automatic unban failed

## Related Commands

- [Ban](ban.md) - Ban a user (with optional duration)
- [Kick](kick.md) - Remove without ban
- [User Info](../utility/user-info.md) - View user's ban history
- [Warn](warn.md) - Issue warning

## Configuration

Uses audit log channel from `config.json`:

```json
{
  "channels": {
    "logs": "AUDIT_CHANNEL_ID"
  }
}
```

## Best Practices

- **Review ban reason first** - Understand why they were banned
- **Check for pattern** - Look at full moderation history
- **Clear communication** - Explain expectations when unbanning
- **Document reason** - Be detailed about why unban was granted
- **Set conditions** - Make it clear this might be last chance
- **Team consensus** - Discuss major unbans with other moderators
- **Monitor after unban** - Watch for repeat behavior

## When to Unban

**Good Reasons:**

- Successful appeal with genuine remorse
- Temporary ban expired (if automatic unban failed)
- Ban was mistake or too harsh
- Significant time passed and user matured
- Extenuating circumstances came to light

**Proceed with Caution:**

- User hasn't shown understanding of rules
- Temporary ban hasn't expired yet (early release requested)
- User has history of repeat offenses
- Community strongly opposed
- User made no effort to appeal properly

## Appeal Process

Consider establishing:

1. **Appeal Form** - Standard questions for ban appeals
2. **Review Period** - Time moderators discuss
3. **Requirements** - What user must demonstrate
4. **Communication** - How to notify of decision
5. **Conditions** - Terms of unban (e.g., warning status)

## Tips

- Keep a log of all unban decisions and reasoning
- Consider implementing a probationary period after unban
- Make sure user has read and understood rules before unbanning
- Give users invite link after unbanning
- Welcome them back but set clear expectations
- Monitor their behavior closely after rejoining
- Have a "strike" system (e.g., "this is your final chance")
- Document any conditions attached to the unban

## Common Scenarios

### Scenario 1: Rage Ban

User was banned during heated moment, calmer review shows it was too harsh.

**Action**: Unban with apology, explain proper punishment

### Scenario 2: Time Served

User was permanently banned, but a year has passed and they've matured.

**Action**: Review appeal, unban with probation

### Scenario 3: Wrong Person

Accidentally banned user with similar name.

**Action**: Immediate unban, apologize, compensate if appropriate

### Scenario 4: Rules Changed

User was banned for rule that no longer exists or was clarified.

**Action**: Review all similar bans, unban if appropriate

## Post-Unban Monitoring

After unbanning:

- Watch their messages for first 24-48 hours
- Check if they engage positively with community
- See if they follow rules they previously broke
- Be ready to re-ban quickly if necessary
- Document behavior for future reference
