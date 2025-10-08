# Config Command

## Overview

The `/config` command displays the current bot configuration in a paginated, organized format with sensitive data (tokens, passwords, connection strings) automatically redacted.

## Command Details

### Permissions Required

* **User**: `ADMINISTRATOR` permission
* **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/config
```

No parameters required. Response is ephemeral (only visible to you).

## Features

### 1. **Comprehensive Display**

Shows all configuration sections:

* Basic settings (bot token - redacted, guild ID, client ID)
* Channel IDs (audit log, counting, facts, etc.)
* Role configurations (staff roles, level roles)
* Leveling system settings
* Database configuration (redacted)
* Redis configuration (redacted)
* Feature flags
* Data retention settings
* Telemetry settings

### 2. **Security**

Automatically redacts sensitive data:

* Bot token
* Database connection strings
* Redis connection strings
* API keys
* Passwords

### 3. **Pagination**

* Multiple pages for organized viewing
* Navigate with previous/next buttons
* Each section on separate pages

### 4. **Load Time**

Shows when configuration was last loaded from disk.

## Usage Example

```bash
/config
```

Displays current configuration with sensitive data masked.

## Configuration Sections

### Page 1: Basic Configuration

* Bot token (redacted)
* Guild ID
* Client ID
* Server invite link
* Last loaded timestamp

### Page 2: Channel Configuration

All configured channel IDs for:

* Audit logs
* Counting
* Fact of the day
* Fact approval
* Welcome messages
* Leave messages

### Page 3: Role Configuration

* Staff roles (with IDs)
* Level roles (level thresholds and role IDs)
* Special role assignments

### Page 4: Leveling System

* Enabled status
* Min/Max XP per message
* XP cooldown
* Level calculation settings

### Page 5: Database & Cache

* Connection status
* Configuration (redacted)

### Page 6: Features & Retention

* Feature flags
* Data retention policies
* Telemetry settings

## Related Commands

* [Reload Config](reload-config.md) - Reload configuration from disk
* [Backend Manager](backend-manager.md) - Manage backend services

## Use Cases

* **Troubleshooting**: Verify configuration values
* **Documentation**: Reference current settings
* **Auditing**: Review configuration changes
* **Planning**: Check before making changes

## Tips

* Command response is ephemeral for security
* Take screenshots for reference, but don't share publicly
* Use before and after `/reload-config` to verify changes
* Check regularly to ensure configuration matches documentation
* Verify channel IDs are correct if features aren't working

## Configuration File

The displayed configuration comes from `config.json` in the bot's root directory. To modify:

1. Edit `config.json`
2. Use `/reload-config` to apply changes
3. Or restart bot with `/restart`

For configuration options documentation, see [Configuration Options](../../basics/configuration-options.md).
