---
icon: party-horn
---

# Giveaway

## Overview

The `/giveaway` command provides a comprehensive giveaway system for your server. Community Managers can create, manage, list, end, and reroll giveaways with flexible eligibility requirements and bonus entry options.

## Command Details

### Permissions Required

- **User**: Community Manager role (configured in bot settings)
- **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`, `ADD_REACTIONS`, `MANAGE_MESSAGES`

### Command Syntax

```bash
/giveaway <subcommand> [options]
```

## Subcommands

### Create

Start the interactive giveaway builder.

```bash
/giveaway create
```

This launches a step-by-step modal-based wizard to configure:

- **Prize**: What you're giving away
- **Winner count**: How many winners to select
- **Duration**: How long the giveaway runs
- **Description**: Additional details about the giveaway
- **Requirements**: Eligibility criteria (roles, level, messages, etc.)
- **Bonus entries**: Extra entries for specific roles or achievements

{% hint style="info" %}
The builder adapts to your server size. For servers with >25 roles, it uses text input. For smaller servers, it uses dropdown menus.
{% endhint %}

---

### List

View all active giveaways.

```bash
/giveaway list
```

Shows paginated list with:

- Prize name
- Giveaway ID
- Host (who created it)
- Number of winners
- End time (relative)
- Current entry count
- Jump link to giveaway message

---

### End

End a giveaway early.

```bash
/giveaway end id:<giveaway_id>
```

**Parameters:**

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| `id`      | String | ✅ Yes   | The ID of the giveaway to end |

- Immediately selects winners
- Updates the original giveaway message
- Announces winners in the channel
- Marks giveaway as ended in database

---

### Reroll

Reroll winners for an ended giveaway.

```bash
/giveaway reroll id:<giveaway_id>
```

**Parameters:**

| Parameter | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| `id`      | String | ✅ Yes   | The ID of the giveaway to reroll |

- Selects new random winners from eligible participants
- Posts announcement with new winners
- Useful if original winners don't respond or are ineligible

---

## Giveaway Builder

### Step 1: Basic Information

The modal collects:

- **Prize**: Name of the prize (required)
- **Winners**: Number of winners (default: 1)
- **Duration**: How long it runs (e.g., "7d", "48h", "30m")
- **Description**: Additional information about the giveaway

### Step 2: Requirements (Optional)

Eligibility criteria participants must meet:

- **Required Roles**: Specific roles users must have
- **Excluded Roles**: Roles that disqualify users
- **Minimum Level**: Required XP level
- **Minimum Messages**: Required message count
- **Account Age**: Minimum Discord account age
- **Server Join Date**: How long they've been in the server

### Step 3: Bonus Entries (Optional)

Give extra entries to users with:

- **Bonus Roles**: Specific roles grant extra entries
- **Level Milestones**: Higher levels get more entries
- **Message Milestones**: Active users get more entries

## Entry System

### How to Enter

Users enter by clicking the 🎉 button on the giveaway message.

### Entry Validation

When a user clicks to enter:

1. **Requirements checked**: System verifies all eligibility criteria
2. **Feedback provided**: User receives confirmation or rejection reason
3. **Entry recorded**: Eligible users are added to participants list
4. **Bonus applied**: Extra entries calculated based on bonuses

### Entry Calculation

```
Total Entries = 1 (base) + Role Bonuses + Level Bonuses + Message Bonuses
```

**Example:**

- User has "Booster" role (+2 entries)
- User is Level 15 (+1 entry for Level 10+)
- User has 500 messages (+1 entry for 500+)
- **Total: 5 entries**

## Winner Selection

### Selection Process

1. **Pool creation**: All eligible participants with their entry counts
2. **Weighted random**: More entries = higher chance
3. **Duplicate prevention**: Same user can't win multiple times
4. **Validation**: Ensures winners still meet requirements

### Winner Announcement

When giveaway ends:

- Original message updated to show "ENDED"
- Winners announced with mentions
- Host notified
- Entry count displayed
- Jump button to giveaway added

### If No Valid Winners

If there aren't enough eligible participants:

- Announces available winners (even if less than target)
- Explains in the message
- Giveaway still marked as ended

## Usage Examples

### Example 1: Create Simple Giveaway

```bash
/giveaway create
```

Then in the modal:

- Prize: `Discord Nitro`
- Winners: `1`
- Duration: `7d`
- Description: `Win a month of Discord Nitro!`

### Example 2: Create Giveaway with Requirements

After `/giveaway create`, configure:

- Prize: `Server VIP Package`
- Winners: `2`
- Duration: `48h`
- Requirements:
  - Must have "Active Member" role
  - Minimum Level: 5
  - Account age: 30 days

### Example 3: Create Giveaway with Bonuses

- Prize: `Premium Game Key`
- Winners: `1`
- Duration: `3d`
- Bonus Entries:
  - Server Boosters: +5 entries
  - Level 20+: +2 entries
  - 1000+ messages: +3 entries

### Example 4: List Active Giveaways

```bash
/giveaway list
```

View all currently running giveaways with details and jump links.

### Example 5: End Giveaway Early

```bash
/giveaway end id:abc123def456
```

Immediately end the giveaway and select winners.

### Example 6: Reroll Winners

```bash
/giveaway reroll id:abc123def456
```

Select new winners if originals didn't claim or were ineligible.

## Configuration

Configure Community Manager role in `config.json`:

```json
{
  "roles": {
    "staffRoles": [
      {
        "name": "Community Manager",
        "roleId": "YOUR_ROLE_ID_HERE"
      }
    ]
  }
}
```

## Interactive Elements

### Giveaway Message Components

- **🎉 Enter Button**: Click to enter the giveaway
- **Embed**: Shows prize, host, end time, requirements, bonuses
- **Footer**: Shows entry count and giveaway ID

### Builder Interface

- **Modals**: For text input (prize, duration, description)
- **Select Menus**: For role selection (when <25 roles)
- **Pagination**: For listing many giveaways

## Best Practices

### For Hosts

- **Clear prize descriptions**: Be specific about what you're giving away
- **Reasonable durations**: 24h-7d is typical
- **Fair requirements**: Don't make it too hard to enter
- **Appropriate bonus entries**: Balance advantage without being unfair
- **Timely winner contact**: DM winners promptly after selection

### For Participants

- Check requirements before entering
- Enable DMs so hosts can contact you if you win
- Respond promptly if selected as a winner
- Don't spam the enter button (multiple clicks don't help!)

## Database Storage

Giveaways are stored with:

- Unique ID
- Prize details
- Host ID and channel/message IDs
- Start and end timestamps
- Winner count
- Participants array (with entry counts)
- Requirements (JSON)
- Bonus entry rules (JSON)
- Status (active/ended)

## Related Commands

- [User Info](../utility/user-info.md) - Check if users meet level/message requirements
- [Members](../utility/members.md) - View all server members

## Tips

- Test giveaways in a private channel first
- Keep track of giveaway IDs (use `/giveaway list`)
- Set reasonable winner counts (don't exceed participant count)
- Use bonus entries to reward active community members
- Consider time zones when scheduling end times
- Have a backup plan if not enough people enter
