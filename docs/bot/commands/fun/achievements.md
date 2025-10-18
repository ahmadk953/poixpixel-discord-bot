---
icon: trophy-star
---

# Achievements

## Overview

The `/achievements` command allows users to view their progress towards server achievements. It displays earned achievements, in-progress achievements, and available achievements in an interactive paginated view.

## Command Details

### Permissions Required

* **User**: No special permissions required (available to everyone)
* **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/achievements [user:<@user>]
```

### Parameters

| Parameter | Type | Required | Description                                                  |
| --------- | ---- | -------- | ------------------------------------------------------------ |
| `user`    | User | ❌ No     | View achievements for a specific user (defaults to yourself) |

## Features

### 1. **Achievement Categories**

Achievements are organized into three categories:

* **Earned** - Achievements you've completed (shows completion date)
* **In Progress** - Achievements you've started working towards (shows progress bar)
* **Available** - Achievements you haven't started yet

### 2. **Interactive View Selection**

Use the dropdown menu to switch between different categories:

* 📊 **Overview** - Summary statistics and overall progress
* 🏆 **Earned** - View all completed achievements
* 🎯 **In Progress** - Track ongoing achievement progress
* 📋 **Available** - See what's still to unlock

### 3. **Progress Tracking**

For in-progress achievements, the command displays:

* Visual progress bar (e.g., `[████████░░░░░░░░░░] 40%`)
* Current progress / Required threshold
* Achievement type (Message Count, Level, Reactions, etc.)

### 4. **Pagination**

When viewing specific categories with many achievements:

* Navigate with ◀️ **Previous** and ▶️ **Next** buttons
* Shows page number (e.g., "Page 1 of 3")
* Up to 10 achievements per page

## Usage Examples

### Example 1: View Your Own Achievements

```bash
/achievements
```

Shows your achievement progress with an overview of earned, in-progress, and available achievements.

### Example 2: View Another User's Achievements

```bash
/achievements user:@JohnDoe
```

View John Doe's achievement progress and see what they've unlocked.

## How It Works

1. **Data Collection**: Fetches all server achievement definitions and the user's achievement progress from the database.
2. **Progress Calculation**:
   * Calculates overall completion percentage
   * Categorizes achievements based on earned status and progress
3. **Interactive Display**:
   * Shows an overview embed with key statistics
   * Dropdown menu allows switching between categories
   * Pagination buttons for navigating large lists
4. **Progress Visualization**:
   * For in-progress achievements, generates ASCII progress bars
   * Shows percentage completion and raw progress numbers

## Achievement Types

The following requirement types are supported:

| Type            | Description         | Example               |
| --------------- | ------------------- | --------------------- |
| `message_count` | Total messages sent | Send 1000 messages    |
| `level`         | User level reached  | Reach level 10        |
| `reactions`     | Reactions given     | React to 500 messages |
| `command_usage` | Commands used       | Use 100 commands      |

## Related Commands

* [Manage Achievements](../utility/manage-achievements.md) - Create and manage achievement definitions (Admin only)
* [Rank](rank.md) - View your current level and XP
* [Leaderboard](leaderboard.md) - See top-ranked members

## Configuration

Achievement definitions are managed by administrators using the `/manage-achievements` command. Achievement tracking is automatic once definitions are created.

## Tips

* Check achievements regularly to track your progress
* Some achievements require specific actions (check the description)
* Achievement progress is updated in real-time as you interact with the server
* Use the overview to quickly see your completion percentage
