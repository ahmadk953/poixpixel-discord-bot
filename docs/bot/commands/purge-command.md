# Purge Command

## Overview

The `/purge` command allows moderators to bulk delete messages in a Discord channel. This is useful for cleaning up spam, removing off-topic conversations, or managing channel content.

## Command Details

### Permissions Required

- **User**: `MANAGE_MESSAGES` permission
- **Bot**: `MANAGE_MESSAGES` and `READ_MESSAGE_HISTORY` permissions

### Command Syntax

```bash
/purge amount:<1-100> [age_limit:<duration>] [user:<@user>] [reason:<text>]
```

### Parameters

| Parameter   | Type    | Required | Description                                               |
| ----------- | ------- | -------- | --------------------------------------------------------- |
| `amount`    | Integer | ✅ Yes   | Number of messages to delete (1-100)                      |
| `age_limit` | String  | ❌ No    | Delete messages newer than this (e.g., 7d, 14d, max: 14d) |
| `user`      | User    | ❌ No    | Only delete messages from this specific user              |
| `reason`    | String  | ❌ No    | Reason for purging messages (for audit log)               |

## Features

### 1. **Bulk Message Deletion**

- Deletes up to 100 messages at a time
- Can filter messages by a specific user
- **Configurable age limit** (default: 14 days, max: 14 days per Discord API)
- Automatically filters out messages older than the specified limit

### 2. **Detailed Audit Logging**

- Creates a comprehensive log file containing:
  - Message ID, author, timestamp
  - Message content (including attachments and embeds)
  - Channel information
  - Moderator information
  - Reason for purging
- Uploads the log file to the configured audit log channel
- Automatically deletes the temporary log file after upload
- **Logging handled in** `logAction.ts` (purge case)

### 3. **Safety Features**

- Only works in guild text channels (not DMs)
- Validates bot permissions before executing
- Reports how many messages were skipped due to age restrictions
- Provides detailed error messages for failures

## Usage Examples

### Example 1: Delete Last 50 Messages (Default 14d Limit)

```bash
/purge amount:50 reason:Cleaning up spam
```

### Example 2: Delete Messages from Specific User with 7d Limit

```bash
/purge amount:30 age_limit:7d user:@SpamBot reason:Bot spam cleanup
```

### Example 3: Delete Last 10 Messages with Custom Age Limit

```bash
/purge amount:10 age_limit:3d reason:Recent off-topic cleanup
```

### Example 4: Quick Cleanup with Maximum Age Limit

```bash
/purge amount:100 age_limit:14d
```

## How It Works

1. **Validation**: The bot checks if the command is used in a valid guild text channel and verifies permissions.

2. **Age Limit Parsing**: Parses the optional `age_limit` parameter using the `parseDuration()` helper. If not specified, defaults to 14 days. Validates that the limit doesn't exceed Discord's 14-day maximum.

3. **Message Fetching**: Retrieves up to 100 messages from the channel. If a user is specified, it filters only their messages.

4. **Age Filtering**: Messages older than the specified age limit are automatically excluded.

5. **Bulk Delete**: Uses Discord's bulk delete API with the `filterOld` parameter to remove all eligible messages in one operation.

6. **Audit Logging**: Uses the `logAction()` utility (purge branch) which:
   - Creates a detailed log file with all deleted message information
   - Uploads the log file to the configured audit log channel
   - Creates an embed with summary information
   - Cleans up the temporary file

7. **Achievement Tracking**: Records the command usage for achievement progress.

## Limitations

### Discord API Limitations

- **Maximum messages per operation**: 100
- **Message age limit**: Cannot delete messages older than 14 days
- **Rate limits**: Discord may rate-limit bulk delete operations if used excessively

### Bot Limitations

- Messages older than the specified age limit (default 14d) are automatically skipped
- Requires specific bot permissions in the channel
- Cannot delete pinned messages (Discord API behavior)

## Audit Log Format

The audit log embed includes:

- 🗑️ **Title**: "PURGE"
- **Channel**: Which channel was purged
- **Moderator**: Who executed the command
- **Messages Deleted**: Number of successfully deleted messages
- **Target User**: If filtering by user, shows the target
- **Messages Skipped**: Count of messages that were too old (with age limit)
- **Reason**: The provided reason for the purge
- **Timestamp**: When the purge was executed
- **Attached File**: Complete log of all deleted messages

## Error Handling

The command handles various error scenarios:

| Error                     | Response                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| Wrong channel type        | "This command can only be used in guild text channels."                    |
| Missing bot permissions   | "I do not have permission to manage messages..."                           |
| No messages found         | "No messages found to delete." or user-specific message                    |
| All messages too old      | "All selected messages are older than [age_limit] and cannot be deleted."  |
| Invalid age limit format  | "Invalid age limit format. Please use format like: 7d, 14d, 12h, etc."    |
| Age limit exceeds maximum | "⚠️ Age limit cannot exceed 14 days (Discord API limitation)..."          |
| Fetch failure             | "Failed to fetch messages from this channel."                              |
| Delete failure            | "Failed to delete messages. Please try again."                             |
| Generic error             | "An error occurred while purging messages."                                |

## Configuration

The command uses the following configuration from `config.json`:

- `channels.logs`: The channel ID where audit logs are sent

## File Location

**Command**: `src/commands/moderation/purge.ts`
**Audit Logger**: `src/util/logging/logAction.ts`
**Compiled Command**: `target/commands/moderation/purge.js`
**Compiled Logger**: `target/util/logging/logAction.js`

## Notes

- The command responds with an ephemeral message (only visible to the moderator)
- The log file is temporarily stored in the `temp/` directory
- All operations are logged for transparency and accountability
- The default age limit is **14 days**
- Users can specify custom age limits up to 14 days using format like: `7d`, `12h`, `3d`, etc.
