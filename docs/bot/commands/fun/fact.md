---
icon: octagon-check
---

# Fact

## Overview

The `/fact` command allows users to submit interesting facts for your server's "Fact of the Day" feature. Moderators can approve, delete, and manage submitted facts.

## Command Details

### Permissions Required

- **Submit**: No special permissions (Everyone)
- **Approve/Delete/Pending**: `MODERATE_MEMBERS` permission
- **Post**: `ADMINISTRATOR` permission
- **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/fact <subcommand> [options]
```

## Subcommands

### Submit (Everyone)

Submit a new fact for approval.

```bash
/fact submit content:<text> [source:<text>]
```

**Parameters:**

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| `content` | String | ✅ Yes   | The fact content              |
| `source`  | String | ❌ No    | Source of the fact (optional) |

{% hint style="info" %}
Administrators' facts are automatically approved. Regular users' facts require moderator approval.
{% endhint %}

---

### Approve (Moderator)

Approve a pending fact by ID.

```bash
/fact approve id:<number>
```

**Parameters:**

| Parameter | Type    | Required | Description                   |
| --------- | ------- | -------- | ----------------------------- |
| `id`      | Integer | ✅ Yes   | The ID of the fact to approve |

---

### Delete (Moderator)

Delete a fact by ID.

```bash
/fact delete id:<number>
```

**Parameters:**

| Parameter | Type    | Required | Description                  |
| --------- | ------- | -------- | ---------------------------- |
| `id`      | Integer | ✅ Yes   | The ID of the fact to delete |

---

### Pending (Moderator)

List all facts awaiting approval.

```bash
/fact pending
```

Shows paginated list with:

- Fact ID
- Content preview
- Submitted by (user mention)
- Source (if provided)
- Submission date

---

### Post (Administrator)

Manually post a fact of the day.

```bash
/fact post
```

{% hint style="warning" %}
This command randomly selects an approved fact and posts it. It does not respect the scheduled posting time.
{% endhint %}

---

## How It Works

### Submission Process

1. **User submits fact** via `/fact submit`
2. **Fact enters pending state** (unless submitted by admin)
3. **Notification sent** to fact approval channel
4. **Moderators review** using interactive buttons or `/fact approve`
5. **Approved facts** enter the pool for daily posting

### Approval Workflow

When a fact is submitted:

- An embed is posted in the configured fact approval channel
- Moderators see "Approve" and "Reject" buttons
- Clicking buttons immediately approves/rejects the fact
- Alternatively, use `/fact approve` or `/fact delete` commands with fact ID

### Daily Posting (Automatic)

The bot automatically posts facts based on schedule:

- **Scheduled time**: Configured in bot settings
- **Random selection**: Picks from approved, unused facts
- **Posted to**: Configured fact channel
- **Tracking**: Marks facts as posted to avoid repeats

## Usage Examples

### Example 1: Submit a Fact

```bash
/fact submit content:The Great Wall of China is over 13,000 miles long source:National Geographic
```

Submit an interesting fact with a source.

### Example 2: Submit Without Source

```bash
/fact submit content:Octopuses have three hearts
```

Submit a fact without specifying a source.

### Example 3: Approve a Pending Fact

```bash
/fact approve id:42
```

Approve fact #42 to add it to the pool.

### Example 4: View Pending Facts

```bash
/fact pending
```

See all facts waiting for approval with pagination.

### Example 5: Delete an Inappropriate Fact

```bash
/fact delete id:15
```

Remove fact #15 from the database.

### Example 6: Manually Post a Fact

```bash
/fact post
```

Immediately post a random approved fact (admin only).

## Configuration

Configure fact channels in `config.json`:

```json
{
  "channels": {
    "factOfTheDay": "FACT_CHANNEL_ID",
    "factApproval": "APPROVAL_CHANNEL_ID"
  }
}
```

### Configuration Options

- `factOfTheDay` - Channel where approved facts are posted
- `factApproval` - Channel where pending facts await moderator review

## Interactive Buttons

The fact approval system uses Discord buttons:

- **Approve Button** (Green) - Approves the fact immediately
- **Reject Button** (Red) - Deletes the fact immediately

These buttons are attached to fact submission notifications in the approval channel.

## Related Commands

- [Manage Achievements](../utility/manage-achievements.md) - Similar approval workflow
- [Rules](../utility/rules.md) - Display server rules

## Tips for Users

- **Be accurate** - Double-check your facts before submitting
- **Provide sources** - Sources help moderators verify accuracy
- **Keep it appropriate** - Facts should follow server rules
- **Stay interesting** - Unique and surprising facts are more likely to be approved

## Tips for Moderators

- **Check sources** - Verify facts are accurate before approving
- **Use `/fact pending`** regularly to stay on top of submissions
- **Be consistent** - Apply the same approval standards to all submissions
- **Use delete for inappropriate** content, not just incorrect facts
- **Interactive buttons** are faster than commands for quick approvals

## Database Schema

Facts are stored with:

- Unique ID
- Content
- Source (optional)
- Submitter user ID
- Approved status (boolean)
- Posted status (boolean)
- Submission timestamp
