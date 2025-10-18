---
icon: vial
---

# XP

## Overview

The `/xp` command allows administrators to manually manage user XP values. This includes adding, removing, setting, or resetting XP for any member.

## Command Details

### Permissions Required

* **User**: `MANAGE_GUILD` permission
* **Bot**: `SEND_MESSAGES`

### Command Syntax

```bash
/xp <subcommand> user:<@user> [amount:<number>]
```

## Subcommands

### Add XP

Add XP to a user's current total.

```bash
/xp add user:<@user> amount:<number>
```

**Example:** `/xp add user:@John amount:500` - Adds 500 XP to John's total.

***

### Remove XP

Subtract XP from a user's current total.

```bash
/xp remove user:<@user> amount:<number>
```

**Example:** `/xp remove user:@John amount:200` - Removes 200 XP from John.

***

### Set XP

Set a user's XP to a specific value.

```bash
/xp set user:<@user> amount:<number>
```

**Example:** `/xp set user:@John amount:1000` - Sets John's XP to exactly 1000.

***

### Reset XP

Reset a user's XP to 0.

```bash
/xp reset user:<@user>
```

**Example:** `/xp reset user:@John` - Resets John's XP to 0.

***

## Features

* **Immediate effect**: Changes apply instantly
* **Level recalculation**: Levels are automatically updated based on new XP
* **Flexible deltas**: Accepts any integer delta (positive or negative). The command does not enforce non-negative totals — totals may become negative. This will be fixed in a future update.
* **No audit logging**: Changes are not currently sent to an audit channel or audit log by this command. This will be implemented in a future update.

## Use Cases

* **Rewards**: Give bonus XP for events or contests
* **Corrections**: Fix XP errors or bugs
* **Penalties**: Remove XP for rule violations
* **Testing**: Set specific XP values for testing
* **Fresh starts**: Reset XP after server restructure

## Related Commands

* [Rank](../fun/rank.md) - View user's current XP and level
* [Leaderboard](../fun/leaderboard.md) - See top XP earners
* [Recalculate Levels](recalculate-levels.md) - Recalculate all levels

## Best Practices

* **Document changes**: Keep records of manual XP adjustments
* **Be fair**: Use consistently across all members
* **Communicate**: Explain to users why XP was changed
* **Use sparingly**: Don't manually adjust often (undermines earning system)
* **Consider alternatives**: Achievements or roles might be better for rewards

## Tips

* Use `add` for bonuses and rewards
* Use `remove` for minor corrections
* Use `set` for major corrections or specific targets
* Use `reset` for fresh starts or serious penalties
* Check current XP with `/rank` before adjusting
* Consider using `/recalculate-levels` after bulk changes
