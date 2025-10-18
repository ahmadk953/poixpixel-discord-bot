# Help Command

## Overview

The `/help` command provides an interactive guide to all available bot commands, organized by category. It can also provide detailed information about specific commands.

## Command Details

### Permissions Required

- **User**: No special permissions (available to everyone)
- **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/help [command:<command_name>]
```

### Parameters

| Parameter | Type   | Required | Description                              |
| --------- | ------ | -------- | ---------------------------------------- |
| `command` | String | ❌ No    | Get detailed help for a specific command |

## Features

### 1. **Interactive Category Browser**

When used without parameters:

- Shows overview of all command categories
- Dropdown menu to browse by category (Fun, Moderation, Utility, Testing)
- Lists all commands in selected category with descriptions

### 2. **Detailed Command Info**

When used with a command name:

- Shows command syntax
- Lists all parameters and their types
- Explains what the command does
- Provides usage examples (if available)

### 3. **Documentation Links**

Includes links to:

- Full online documentation
- Specific command pages
- Getting started guides

### 4. **Category Emojis**

- 🎮 Fun Commands
- 🛡️ Moderation Commands
- ⚙️ Utility Commands
- 🧪 Testing Commands

## Usage Examples

### Example 1: Browse All Commands

```bash
/help
```

Shows interactive menu to browse all commands by category.

### Example 2: Get Help for Specific Command

```bash
/help command:ban
```

Shows detailed information about the `/ban` command including syntax, parameters, and examples.

### Example 3: Learn About Fun Commands

```bash
/help
```

Then select "Fun Commands" from the dropdown to see all fun commands.

## How It Works

1. **Category Organization**: Commands are automatically organized by their file location (fun/, moderation/, util/, testing/)

2. **Interactive Menu**: Uses Discord select menus for category browsing

3. **Command Details**: Fetches command data directly from the registered commands

4. **Documentation Links**: Provides UTM-tagged links to full documentation site

## Related Commands

- [Ping](ping.md) - Check bot responsiveness
- [Server](server.md) - Get server info
- [Rules](rules.md) - View server rules

## Tips

- Use `/help` to discover new commands
- Bookmark the documentation site for detailed guides
- Check help before asking in support channels
- Commands are organized logically by function
- If a command seems confusing, read its full documentation page
