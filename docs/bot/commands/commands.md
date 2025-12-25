---
icon: newspaper
---

# Overview

Welcome to the Poixpixel Discord Bot commands documentation! This section provides detailed information about all available bot commands, organized by category.

## Command Categories

### 🎮 [Fun Commands](fun/)

Interactive and engaging commands for community building and entertainment:

- **Achievements** - View and track server achievements
- **Counting** - Manage the counting game channel
- **Fact** - Submit and manage daily facts
- **Giveaway** - Create and manage server giveaways
- **Leaderboard** - View the server XP leaderboard
- **Rank** - Check your or another user's rank and level

### 🛡️ [Moderation Commands](moderation/)

Tools for server moderation and member management:

- **Ban** - Ban members from the server (with optional duration)
- **Kick** - Remove members from the server
- **Mute** - Timeout members temporarily
- **Unban** - Remove a ban from a user
- **Unmute** - Remove a timeout from a member
- **Warn** - Issue warnings to members

### ⚙️ [Utility Commands](utility/)

Administrative and general-purpose commands:

- **Backend Manager** - Manage database and Redis connections
- **Config** - View current bot configuration
- **Help** - Get help with bot commands
- **Manage Achievements** - Create and manage achievement definitions
- **Members** - List all server members
- **Ping** - Check bot latency
- **Purge** - Bulk delete messages
- **Recalculate Levels** - Recalculate all user levels
- **Reload Config** - Reload bot configuration
- **Restart** - Restart the bot
- **Rules** - Display server rules
- **Server** - Get server information
- **User Info** - View detailed user information
- **XP** - Manage user XP

### 🧪 [Testing Commands](testing/)

Commands for testing bot functionality (Admin only):

- **Test Join** - Simulate a member join event
- **Test Leave** - Simulate a member leave event

## Command Syntax

All commands use Discord's slash command format:

```bash
/command-name <required-option> [optional-option]
```

### Parameter Types

- **Required parameters** are shown in angle brackets: `<parameter>`
- **Optional parameters** are shown in square brackets: `[parameter]`

## Permission Levels

Commands require different permission levels:

| Icon | Permission Level  | Description                        |
| ---- | ----------------- | ---------------------------------- |
| 👤   | Everyone          | Available to all server members    |
| 🛡️   | Moderator         | Requires moderation permissions    |
| 👑   | Administrator     | Requires administrator permissions |
| 🔧   | Community Manager | Requires Community Manager role    |

## Getting Help

For detailed information about a specific command, use:

```bash
/help command:<command-name>
```

Or visit the individual command documentation pages in this section.

## Documentation Links

For more information:

- [Configuration Options](../basics/configuration-options.md)
- [Getting Started Guide](../getting-started/quickstart/)
- [Developer Documentation](../developers/introduction.md)
