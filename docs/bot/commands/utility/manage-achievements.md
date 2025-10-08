# Manage Achievements Command

## Overview

The `/manage-achievements` command allows administrators to create, delete, award, and manage achievement definitions and user progress in the server's achievement system.

## Command Details

### Permissions Required

* **User**: `MANAGE_GUILD` permission (Administrator)
* **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/manage-achievements <subcommand> [options]
```

## Subcommands

### Create

Create a new achievement definition.

```bash
/manage-achievements create name:<text> description:<text> requirement_type:<type> threshold:<number> [image_url:<url>] [command_name:<text>] [reward_type:<type>] [reward_value:<value>]
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | String | ✅ Yes | Achievement name |
| `description` | String | ✅ Yes | Achievement description |
| `requirement_type` | Choice | ✅ Yes | Type: `message_count`, `level`, `reactions`, `command_usage` |
| `threshold` | Integer | ✅ Yes | Value needed to complete achievement |
| `image_url` | String | ❌ No | URL for achievement badge image |
| `command_name` | String | ❌ No | Specific command name (for `command_usage` type only) |
| `reward_type` | Choice | ❌ No | `xp` or `role` |
| `reward_value` | String | ❌ No | XP amount or role ID |

---

### Delete

Delete an achievement definition.

```bash
/manage-achievements delete id:<achievement_id>
```

{% hint style="warning" %}
This also removes all user progress for this achievement!
{% endhint %}

---

### Award

Manually award an achievement to a user.

```bash
/manage-achievements award user:<@user> achievement_id:<id>
```

Immediately grants the achievement regardless of progress.

---

### Unaward

Remove an achievement from a user.

```bash
/manage-achievements unaward user:<@user> achievement_id:<id>
```

Removes the achievement and resets progress.

---

## Achievement Types

### Message Count

Tracks total messages sent by user.

**Example:** "Send 1000 messages"

```bash
requirement_type:message_count threshold:1000
```

### Level

Tracks user level from XP system.

**Example:** "Reach level 10"

```bash
requirement_type:level threshold:10
```

### Reactions

Tracks reactions given to messages.

**Example:** "React to 500 messages"

```bash
requirement_type:reactions threshold:500
```

### Command Usage

Tracks command usage (all or specific command).

**Example:** "Use 100 commands"

```bash
requirement_type:command_usage threshold:100
```

**Example:** "Use /giveaway 10 times"

```bash
requirement_type:command_usage threshold:10 command_name:giveaway
```

## Rewards

### XP Reward

Give XP when achievement is earned.

```bash
reward_type:xp reward_value:500
```

### Role Reward

Grant role when achievement is earned.

```bash
reward_type:role reward_value:ROLE_ID_HERE
```

## Usage Examples

### Example 1: Create Message Milestone

```bash
/manage-achievements create name:Chatterbox description:Send 1000 messages requirement_type:message_count threshold:1000 reward_type:xp reward_value:500
```

### Example 2: Create Level Achievement

```bash
/manage-achievements create name:Veteran description:Reach level 25 requirement_type:level threshold:25 reward_type:role reward_value:123456789012345678
```

### Example 3: Delete Achievement

```bash
/manage-achievements delete id:5
```

### Example 4: Manually Award Achievement

```bash
/manage-achievements award user:@JohnDoe achievement_id:3
```

### Example 5: Remove Achievement

```bash
/manage-achievements unaward user:@JohnDoe achievement_id:3
```

## How It Works

### Achievement Tracking

1. **Automatic Tracking**: Bot tracks progress automatically based on type
2. **Progress Updates**: Updates user progress as actions occur
3. **Completion Check**: Checks if threshold is met
4. **Award**: Grants achievement and reward when earned
5. **Announcement**: Posts achievement card to channel

### Progress Storage

* Each user has progress records for all achievements
* Progress is incremented automatically
* Completion is marked with `earnedAt` timestamp

## Related Commands

* [Achievements](../fun/achievements.md) - View user achievements

## Use Cases

* **Milestones**: Create achievements for participation levels
* **Events**: Create special event achievements
* **Roles**: Award roles for reaching milestones
* **Engagement**: Encourage specific behaviors
* **Competitions**: Create limited-time achievements

## Best Practices

* **Clear names**: Make achievement names descriptive
* **Achievable thresholds**: Set realistic goals
* **Meaningful rewards**: Make rewards worthwhile
* **Varied types**: Mix different requirement types
* **Progressive difficulty**: Create easy, medium, hard tiers
* **Visual appeal**: Use good badge images

## Tips

* Test achievements with low thresholds first
* Use `/achievements` to verify they appear correctly
* Award manually for special cases or events
* Delete unused achievements to reduce clutter
* Keep achievement count manageable (10-30 total)
* Consider tiered achievements (Bronze, Silver, Gold)
* Update descriptions to be motivating
* Track which achievements are popular

## Achievement Ideas

* **Milestones**: 100, 500, 1000, 5000 messages
* **Levels**: Reach levels 5, 10, 25, 50, 100
* **Commands**: Use various commands X times
* **Participation**: React to X messages
* **Longevity**: Be a member for X days
* **Special**: Event-specific achievements

## Image URLs

For `image_url`, use:

* Direct image links (must end in .png, .jpg, .gif, .webp, .avif)
* Imgur links
* Discord CDN links
* Public image hosting

**Recommended size**: 256x256 pixels
