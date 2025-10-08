# Restart Command

## Overview

The `/restart` command restarts the bot process using PM2 process manager. This is useful for applying updates, clearing memory, or recovering from errors.

## Command Details

### Permissions Required

* **User**: `ADMINISTRATOR` permission
* **Bot**: `SEND_MESSAGES`

### Command Syntax

```bash
/restart
```

No parameters required. Response is ephemeral.

## Features

### 1. **PM2 Integration**

* Uses PM2 for graceful restart
* Automatically restarts process
* Preserves logs and monitoring

### 2. **Status Check**

Before restarting, checks:

* Database connection status
* Redis connection status
* Overall service health

### 3. **Manager Notification**

* Notifies configured managers about restart
* Includes who initiated it
* Shows service status

### 4. **Graceful Shutdown**

* Completes ongoing operations
* Closes connections properly
* Minimal disruption

## Usage Example

```bash
/restart
```

Bot will:

1. Acknowledge command
2. Check service status
3. Notify managers
4. Restart process
5. Come back online in ~10-30 seconds

## How It Works

1. **Permission Check**: Verifies administrator permission
2. **Status Check**: Checks database and Redis connections
3. **Notification**: Notifies configured managers
4. **Restart Command**: Executes `yarn restart` (PM2 restart)
5. **Process Restart**: PM2 gracefully restarts bot
6. **Reconnection**: Bot reconnects to Discord and services

## When to Restart

**Good reasons:**

* After code updates/deployments
* After configuration changes requiring restart
* Memory leaks or performance degradation
* Stuck processes or zombie threads
* After database schema changes
* Recovering from errors

**Not needed for:**

* Simple configuration changes (use `/reload-config`)
* Channel/role updates
* Content changes

## Restart Duration

Typical restart timeline:

* **Shutdown**: 2-5 seconds
* **Process restart**: 5-15 seconds
* **Discord reconnection**: 3-10 seconds
* **Total**: 10-30 seconds usually

## Requirements

* **PM2 Process Manager**: Bot must be running under PM2
* **Proper setup**: `yarn start` must use PM2
* **Process name**: Must be named "poixpixel-discord-bot"

## Related Commands

* [Reload Config](reload-config.md) - Reload config without restart
* [Backend Manager](backend-manager.md) - Manage services

## Use Cases

* **Deployment**: Apply code updates
* **Maintenance**: Regular restarts for performance
* **Troubleshooting**: Clear stuck states
* **Recovery**: Recover from errors
* **Updates**: Apply system updates

## Best Practices

* **Announce**: Warn users before restarting
* **Off-peak**: Restart during low activity
* **Backup**: Ensure recent backups exist
* **Monitor**: Watch logs after restart
* **Test**: Verify all features work after restart

## Post-Restart Checks

After restarting, verify:

* ✅ Bot comes back online
* ✅ Commands respond properly
* ✅ Database connection works
* ✅ Redis connection works
* ✅ Scheduled tasks resume
* ✅ Event handlers work

## Troubleshooting

If bot doesn't come back:

1. Check PM2 process: `pm2 list`
2. Check logs: `pm2 logs poixpixel-discord-bot`
3. Manual restart: `pm2 restart poixpixel-discord-bot`
4. Check config.json for errors
5. Check database/Redis connectivity

## Tips

* Use `/backend-manager status` to check services before restart
* Restart during maintenance windows when possible
* Keep restart logs for troubleshooting
* Monitor resource usage to determine if restarts are needed
* Consider scheduled daily restarts for optimal performance
* Have rollback plan if restart fails
