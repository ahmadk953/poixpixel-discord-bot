---
icon: rotate-reverse
---

# Restart

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

### PM2 Restart

* Calls PM2 to restart the running bot process named `poixpixel-discord-bot`.
* Minimal local behavior: the command acknowledges the issuer and triggers the restart.
* Expected downtime while PM2 restarts the process.

## Usage Example

```bash
/restart
```

Bot will:

1. Acknowledge the command to the issuer (ephemeral reply).
2. Execute `pm2 restart poixpixel-discord-bot` on the host. This may cause a brief downtime while PM2 restarts the process.

## How It Works

1. **Permission Check**: Verifies the caller has `ADMINISTRATOR` permission.
2. **Restart Command**: The handler issues `pm2 restart poixpixel-discord-bot` on the host.
3. **Process Restart**: PM2 restarts the process; the bot will reconnect to Discord when the process comes back up.

Note: The current command handler does not perform pre-restart DB/Redis health checks, manager notifications, or a multi-step graceful shutdown. If you need those guardrails, implement them in the runtime handler or open an issue/PR to add them.

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

* **PM2 Process Manager**: The bot should be running under PM2 on the host.
* **Process name**: The PM2 process should be named `poixpixel-discord-bot` so the command targets the correct process.

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
