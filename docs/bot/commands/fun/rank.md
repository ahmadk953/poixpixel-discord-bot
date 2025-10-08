# Rank Command

## Overview

The `/rank` command displays a visually appealing rank card showing a user's current level, XP, and progress towards the next level.

## Command Details

### Permissions Required

* **User**: No special permissions required (available to everyone)
* **Bot**: `SEND_MESSAGES`, `ATTACH_FILES`

### Command Syntax

```bash
/rank [user:<@user>]
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user` | User | ❌ No | The user to check rank for (defaults to yourself) |

## Features

### 1. **Visual Rank Card**

Generates a custom image displaying:

* User's avatar and username
* Current level
* Current XP
* XP required to reach next level
* Visual progress bar towards next level

### 2. **Check Other Users**

View any member's rank and level progress by mentioning them in the command.

### 3. **Real-time Progress**

Shows exactly how much XP is needed until the next level up.

## Usage Examples

### Example 1: Check Your Own Rank

```bash
/rank
```

Displays your current rank card with level, XP, and progress.

### Example 2: Check Another User's Rank

```bash
/rank user:@JohnDoe
```

View John Doe's rank card to see their level and XP.

## How It Works

1. **User Lookup**: Fetches the specified user's data from the database (or command author's data if no user specified).

2. **Level Calculation**: Retrieves current level and XP from the leveling system.

3. **XP Calculation**: Calculates XP needed for the next level using the leveling formula.

4. **Card Generation**: Generates a custom image with:
   * User avatar
   * Username
   * Level badge
   * XP progress bar
   * Themed background

5. **Display**: Sends the generated rank card as an image attachment.

## Leveling System

The XP and leveling system works as follows:

* **XP Gain**: Users earn XP by sending messages (configurable min/max per message)
* **XP Cooldown**: Cooldown between XP gains (default: 60 seconds)
* **Level Formula**: XP required increases with each level
* **Level Roles**: Automatic role assignment at specific level thresholds (if configured)

### XP Requirements

The XP needed for each level increases progressively. The formula used ensures balanced progression that rewards active participation.

## Related Commands

* [Leaderboard](leaderboard.md) - See where you rank compared to others
* [XP](../utility/xp.md) - Manage user XP (Admin only)
* [Achievements](achievements.md) - Track achievement progress
* [Recalculate Levels](../utility/recalculate-levels.md) - Recalculate all levels (Admin only)

## Configuration

Configure the leveling system in `config.json`:

```json
{
  "leveling": {
    "enabled": true,
    "minXpAwarded": 15,
    "maxXpAwarded": 25,
    "xpCooldown": 60000
  }
}
```

### Configuration Options

* `enabled` - Enable/disable the leveling system
* `minXpAwarded` - Minimum XP per message
* `maxXpAwarded` - Maximum XP per message
* `xpCooldown` - Cooldown between XP gains (milliseconds)

## Tips

* Send messages regularly to gain XP (respecting the cooldown)
* Check your rank to see how close you are to leveling up
* Level roles may be assigned automatically at certain milestones
* The rank card uses custom fonts and styling for a polished look
