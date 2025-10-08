# Reload Config Command

## Overview

The `/reload-config` command reloads the bot's configuration from the `config.json` file without requiring a full bot restart. This allows you to apply configuration changes instantly.

## Command Details

### Permissions Required

* **User**: `ADMINISTRATOR` permission
* **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/reload-config
```

No parameters required. Response is ephemeral (only visible to you).

## Features

### 1. **Live Reload**

* Reloads configuration without restarting bot
* Applies changes immediately
* No downtime required

### 2. **Validation**

* Validates configuration file format
* Reports errors if config is invalid
* Shows what changed

### 3. **Timestamps**

* Shows previous load time
* Shows new load time
* Confirms successful reload

### 4. **Change Summary**

Displays which configuration sections were modified.

## Usage Example

```bash
/reload-config
```

**Response includes:**

* ✅ Success confirmation
* Previous load time
* New load time
* Summary of changes

## How It Works

1. **Read File**: Loads `config.json` from disk
2. **Validation**: Parses and validates JSON structure
3. **Application**: Replaces in-memory configuration
4. **Confirmation**: Reports success/failure

## When to Use

**Use reload-config for:**

* Channel ID changes
* Role ID changes
* Feature flag toggles
* XP/leveling setting changes
* Text content changes

**Requires full restart for:**

* Token changes
* Database connection changes
* Redis connection changes
* Major structural changes

## Configuration Changes That Apply Immediately

* Channel configurations
* Role configurations
* Leveling system settings
* Feature flags
* Content strings
* Thresholds and limits

## Related Commands

* [Config](config.md) - View current configuration
* [Restart](restart.md) - Full bot restart

## Use Cases

* **Quick fixes**: Correct channel/role IDs
* **Feature toggles**: Enable/disable features
* **Tuning**: Adjust XP rates, cooldowns
* **Content updates**: Change messages, embeds

## Best Practices

* **Backup first**: Keep a copy of working config
* **Validate JSON**: Use JSON validator before reloading
* **Test in staging**: Test changes in dev environment first
* **Document changes**: Note what you changed and why
* **Use version control**: Track config changes in Git

## Error Handling

If reload fails:

* **Invalid JSON**: Fix syntax errors in config.json
* **Missing required fields**: Add required configuration
* **Invalid values**: Correct value types/formats
* Bot keeps using previous valid configuration

## Tips

* Use `/config` before and after to verify changes
* Make one change at a time for easier troubleshooting
* Keep a backup of `config.json`
* Document your changes in comments or separate doc
* Test thoroughly after reloading
* If in doubt, use `/restart` instead for full reload

## Emergency Rollback

If reload breaks something:

1. Have backup `config.json` ready
2. Replace current config with backup
3. Run `/reload-config` again
4. Or use `/restart` if reload-config fails

## Example Workflow

1. Backup current `config.json`
2. Edit `config.json` with changes
3. Validate JSON syntax
4. Save file
5. Run `/reload-config`
6. Run `/config` to verify
7. Test affected features
8. Document changes
