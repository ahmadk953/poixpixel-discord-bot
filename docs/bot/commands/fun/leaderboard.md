---
icon: ranking-star
---

# Leaderboard

## Overview

The `/leaderboard` command displays the server's XP leaderboard, showing the highest-ranked members based on their level and XP.

## Command Details

### Permissions Required

* **User**: No special permissions required (available to everyone)
* **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/leaderboard [limit:<1-100>]
```

### Parameters

| Parameter | Type    | Required | Description                                      |
| --------- | ------- | -------- | ------------------------------------------------ |
| `limit`   | Integer | ❌ No     | Number of users per page (default: 10, max: 100) |

## Features

### 1. **Paginated Display**

* Shows users in pages for easy navigation
* Configurable users per page (1-100)
* Navigate with ◀️ **Previous** and ▶️ **Next** buttons

### 2. **Ranked List**

Each entry shows:

* **Position** - Numerical rank (1, 2, 3, etc.)
* **User** - Member mention
* **Level** - Current level
* **XP** - Total experience points

### 3. **Server Members Only**

The leaderboard automatically filters out:

* Users who have left the server
* Bot accounts
* Deleted or inaccessible users

### 4. **Live Data**

Always shows current rankings based on the latest XP and level data.

## Usage Examples

### Example 1: View Default Leaderboard

```bash
/leaderboard
```

Shows the top 10 members per page with pagination.

### Example 2: View More Members Per Page

```bash
/leaderboard limit:25
```

Displays 25 members per page for a more comprehensive view.

### Example 3: Maximum Display

```bash
/leaderboard limit:100
```

Shows up to 100 members per page (good for seeing broader rankings).

## How It Works

1. **Data Retrieval**: Fetches the top 100 users from the leveling database, sorted by level and XP.
2. **Member Verification**: Validates that each user is still a member of the server.
3. **Filtering**: Removes users who have left the server or are inaccessible.
4. **Pagination**: Splits the results into pages based on the specified limit.
5. **Interactive Display**:
   * Shows the first page initially
   * Provides navigation buttons for moving between pages
   * Updates display when users interact with buttons

## Leaderboard Format

```
**1.** @TopUser - Level 50 (12,500 XP)
**2.** @SecondPlace - Level 45 (11,200 XP)
**3.** @ThirdPlace - Level 42 (10,800 XP)
...
```

## Related Commands

* [Rank](rank.md) - View detailed rank card for yourself or another user
* [XP](../utility/xp.md) - Manage user XP (Admin only)
* [Recalculate Levels](../utility/recalculate-levels.md) - Recalculate all levels (Admin only)
* [Achievements](achievements.md) - Track achievement progress

## Tips

* Use a higher limit to see where you rank if you're not in the top 10
* The leaderboard updates in real-time based on current database values
* Level and XP determine ranking (higher level takes precedence)
* Compete with other members to climb the leaderboard!

## Performance Notes

* The command fetches up to 100 top users for performance
* Member verification happens in parallel for faster loading
* Navigation uses Discord components (buttons) for smooth interaction
* Pagination prevents overwhelming single displays
