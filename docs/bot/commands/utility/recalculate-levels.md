---
icon: calculator
---

# Recalculate Levels

## Overview

The `/recalculate-levels` command recalculates all user levels based on their current XP. This is useful after changing leveling formulas or fixing XP/level discrepancies.

## Command Details

### Permissions Required

* **User**: `ADMINISTRATOR` permission
* **Bot**: `SEND_MESSAGES`

### Command Syntax

```bash
/recalculate-levels
```

No parameters required. Response is ephemeral.

## Features

### 1. **Full Recalculation**

* Processes all users in database
* Recalculates levels from XP
* Updates database records
* Applies new leveling formula

### 2. **Bulk Operation**

* Handles all users at once
* Efficient database updates
* Progress reporting

### 3. **Formula Application**

* Uses current leveling formula
* Ensures consistency
* Fixes discrepancies

## Usage Example

```bash
/recalculate-levels
```

Bot will:

1. Acknowledge command
2. Process all user records
3. Recalculate levels
4. Update database
5. Report completion

## When to Use

**Use recalculate-levels after:**

* Changing XP-to-level formula
* Database migrations
* Importing user data
* Fixing bulk XP errors
* System updates
* Formula bugs

**Not needed for:**

* Individual XP adjustments (automatic)
* Normal XP gains (automatic)
* Single user corrections

## How It Works

1. **Fetch All Users**: Retrieves all user records from database
2. **Calculate Levels**: Applies leveling formula to each user's XP
3. **Update Database**: Updates level values in batch
4. **Role Updates**: Triggers level role assignments if needed
5. **Completion**: Reports success

## Processing Time

Depends on user count:

* **< 100 users**: Few seconds
* **100-1000 users**: 10-30 seconds
* **1000+ users**: 30-60+ seconds

## Related Commands

* [XP](xp.md) - Manually adjust XP
* [Rank](../fun/rank.md) - View user level
* [Leaderboard](../fun/leaderboard.md) - View rankings

## Use Cases

* **Formula changes**: After modifying leveling algorithm
* **Data corrections**: Fix inconsistencies
* **Migrations**: After importing data
* **Auditing**: Verify level accuracy
* **Maintenance**: Periodic recalculation

## Best Practices

* **Backup first**: Export database before recalculating
* **Off-peak**: Run during low activity
* **Test formula**: Verify formula is correct first
* **Announce**: Warn users levels may change
* **Monitor**: Check logs for errors

## Post-Recalculation

After running:

* Verify random sample of users with `/rank`
* Check leaderboard for consistency
* Monitor for user reports of issues
* Review logs for errors
* Document what changed

## Tips

* Run after any leveling system changes
* Test on staging/dev environment first
* Keep users informed about level changes
* Consider running weekly/monthly for consistency
* Log old vs new levels for review
* Be prepared to explain level changes to users

## Technical Details

The recalculation uses the same formula as normal XP gains:

```typescript
level = calculateLevelFromXp(xp);
```

This ensures consistency between natural progression and recalculated levels.
