# Warn Command

## Overview

The `/warn` command issues a formal warning to a member without immediate punishment. Warnings are tracked in the moderation history and can escalate to timeouts or bans if accumulated.

## Command Details

### Permissions Required

* **User**: `MODERATE_MEMBERS` permission
* **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/warn member:<@member> reason:<text>
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `member` | User | ✅ Yes | The member to warn |
| `reason` | String | ✅ Yes | The reason for the warning |

## Features

### 1. **No Immediate Punishment**

* User remains in server with full permissions
* Serves as official documented caution
* Can escalate to action if warnings accumulate

### 2. **Role Hierarchy Protection**

* Moderators cannot warn members with equal or higher roles
* Maintains proper permission structure

### 3. **DM Notifications**

Warned users receive a DM containing:

* Server name
* Warning reason
* Implicit message to improve behavior

### 4. **Persistent Tracking**

* Stored permanently in database (expiration policies may affect their weight in escalation decisions)
* Visible in `/user-info` command
* Helps identify repeat offenders
* Used for escalation decisions

### 5. **Audit Logging**

* Logs to audit channel
* Records moderator, target, reason, timestamp
* Creates paper trail for moderation decisions

## Usage Examples

### Example 1: First Offense

```bash
/warn member:@NewUser reason:Using inappropriate language in general chat
```

First warning for minor rule violation.

### Example 2: Repeated Minor Issues

```bash
/warn member:@MildOffender reason:Third instance of spam this week
```

Document pattern of minor infractions.

### Example 3: Preventive Warning

```bash
/warn member:@BorderlineUser reason:Repeatedly pushing boundaries of rule 3, official warning
```

Formal caution before behavior escalates.

### Example 4: After Unmute

```bash
/warn member:@RecentlyMuted reason:Final warning - any future violations will result in extended timeout
```

Make consequences clear after early unmute.

## How It Works

1. **Permission Check**:
   * Verifies moderator has `MODERATE_MEMBERS`
   * Checks moderator's role is higher than target's

2. **Database Entry**:
   * Creates moderation history record
   * Type set to "warning"
   * Records moderator, target, reason, timestamp
   * Marked as permanent record

3. **DM Notification**:
   * Attempts to DM user about warning
   * Includes server name and reason
   * Logged as warning if DM fails
   * Warning recorded regardless

4. **Audit Logging**:
   * Posts to audit log channel
   * Formatted embed with details
   * Includes all relevant information

5. **Confirmation**: Moderator receives confirmation message.

## Error Handling

* **Equal/Higher Role**: "You cannot warn a member with equal or higher role than yours."
* **DM Failure**: Logged as warning, but warning still recorded
* **Database Error**: "There was an error trying to warn the member."

## Warning Escalation

Establish a clear escalation policy:

### Sample Escalation Path

1. **First Warning**: Verbal/informal warning
2. **Second Warning**: Formal `/warn` command
3. **Third Warning**: `/warn` + short `/mute` (30m-1h)
4. **Fourth Warning**: `/mute` for longer (6-24h)
5. **Fifth Warning**: `/ban` temporary (7d)
6. **Sixth Offense**: `/ban` permanent

Adjust based on severity:

* **Minor offenses**: Slower escalation
* **Major offenses**: Skip to ban/kick
* **Context matters**: Consider circumstances

## Viewing Warnings

Use `/user-info` to see:

* Total number of warnings
* Most recent 5 warnings
* When they were issued
* Who issued them
* What they were for

## Warnings vs Other Actions

| Action | When to Use | Severity |
|--------|-------------|----------|
| **Verbal Warning** | First-time minor offense | Lowest |
| **Formal Warning** | Second offense or semi-serious | Low |
| **Warn + Mute** | Third offense or continuing behavior | Moderate |
| **Mute Only** | Immediate behavior stop needed | Moderate |
| **Kick** | Multiple warnings ignored | High |
| **Ban** | Serious violation or many warnings | Highest |

## Related Commands

* [User Info](../utility/user-info.md) - View warning history
* [Mute](mute.md) - Timeout after warnings
* [Kick](kick.md) - Remove after warnings
* [Ban](ban.md) - Permanent removal

## Configuration

Configure audit logging in `config.json`:

```json
{
  "channels": {
    "auditLog": "AUDIT_CHANNEL_ID"
  }
}
```

## Best Practices

* **Be specific** - Clearly state what rule was violated
* **Quote if possible** - Reference specific messages or incidents
* **Stay professional** - Warnings are formal, not personal
* **Escalate appropriately** - Don't go straight to ban for minor issues
* **Check history first** - Use `/user-info` before warning
* **Be consistent** - Warn for same offenses across all users
* **Document thoroughly** - Future moderators will read these

## Warning Messages

### Good Warning Reasons

✅ "Repeatedly posting NSFW content in #general after being asked to stop"
✅ "Third instance of spamming promotional links this week"
✅ "Using slurs in voice chat, rule 1 violation"
✅ "Harassing @User about personal topics despite being asked to stop"

### Poor Warning Reasons

❌ "Being annoying" (too vague)
❌ "You know what you did" (not documented)
❌ "Rule violation" (which rule?)
❌ "Just stop" (not professional)

## When to Use Warnings

**Good Use Cases:**

* First or second rule violations
* Minor to moderate offenses
* Building paper trail for escalation
* User might not realize they're breaking rules
* Giving chance to improve before punishment

**Skip Warning, Use Action:**

* Severe violations (doxxing, serious harassment)
* Raiding or malicious behavior
* Obvious trolls/ban evaders
* ToS violations
* Dangerous or illegal content

## Tips for Moderators

* Keep a "warning log" channel for team reference
* Discuss warning thresholds with mod team
* Review user's full history before warning
* Consider time frame (5 warnings over 2 years vs. 1 month)
* Reset warning "weight" after extended good behavior
* Use warnings to show patterns to admins
* Be willing to explain warnings if user asks respectfully
* Don't warn for every small thing - save for documented pattern

## Warning Expiration

Consider implementing warning expiration:

* **Informal policy**: Old warnings (>6 months) carry less weight
* **Formal policy**: Warnings "expire" after 1 year of good behavior
* **Never expire**: Keep permanent record but discount old ones
* **By severity**: Minor warnings expire, serious ones don't

Document your server's policy clearly.

## Tips for Users

If you receive a warning:

* Read it carefully and understand what you did wrong
* Don't argue in DMs with the moderator
* Ask for clarification if genuinely confused
* Improve your behavior going forward
* Warnings can expire with consistent good behavior
* Multiple warnings lead to stronger actions
* Take warnings seriously even if "just a warning"
