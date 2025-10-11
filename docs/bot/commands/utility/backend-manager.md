# Backend Manager Command

## Overview

The `/backend-manager` command provides tools to manage and monitor the bot's backend services: PostgreSQL database and Redis cache. It allows checking status, forcing reconnections, and flushing cache.

## Command Details

### Permissions Required

- **User**: `MANAGE_GUILD` permission (Administrator)
- **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/backend-manager <subcommand>
```

## Subcommands

### Status

Check connection status of database and Redis.

```bash
/backend-manager status
```

Shows:

- ✅/❌ Database connection status
- ✅/❌ Redis connection status
- Connection details
- Uptime information

---

### Database

Force reconnection to PostgreSQL database.

```bash
/backend-manager database
```

Use when:

- Database connection is lost
- Connection errors occur
- After database maintenance
- Connection seems unstable

---

### Redis

Force reconnection to Redis cache.

```bash
/backend-manager redis
```

Use when:

- Redis connection is lost
- Cache seems unresponsive
- After Redis maintenance
- Connection issues occur

---

### Flush Cache

Clear all Redis cache data.

```bash
/backend-manager flush-cache
```

{% hint style="warning" %}
This clears ALL cached data! Use only when necessary. Confirmation required.
{% endhint %}

Clears:

- XP cooldowns
- Counting state
- Session data
- Temporary cache

---

## Features

### 1. **Interactive Confirmation**

For destructive actions (flush-cache), requires button confirmation to prevent accidents.

### 2. **Status Monitoring**

Real-time status of backend services with detailed health checks.

### 3. **Auto-Recovery**

Reconnection attempts with exponential backoff and retry logic.

### 4. **Manager Notifications**

Critical backend issues notify configured managers automatically.

## Usage Examples

### Example 1: Check Service Status

```bash
/backend-manager status
```

View current health of database and cache.

### Example 2: Reconnect Database

```bash
/backend-manager database
```

Force database reconnection if connection is lost.

### Example 3: Clear Cache

```bash
/backend-manager flush-cache
```

Clear all Redis cache (with confirmation).

## How It Works

### Status Check

1. Pings database connection
2. Checks Redis connection
3. Retrieves connection metadata
4. Displays formatted status

### Reconnection

1. Closes existing connection
2. Initiates new connection with retry logic
3. Validates connection
4. Reports success/failure

### Cache Flush

1. Shows confirmation button
2. Waits for confirmation (30s timeout)
3. Executes FLUSHALL command
4. Clears all Redis keys
5. Reports completion

## Backend Services

### PostgreSQL Database

**Used for:**

- User data (members, levels, XP)
- Moderation history
- Achievements
- Giveaways
- Facts
- Persistent data

**Connection:**

- Pooled connections (PgBouncer)
- Auto-reconnection
- Transaction support

### Redis Cache

**Used for:**

- XP cooldowns
- Counting game state
- Session data
- Temporary storage
- Rate limiting

**Connection:**

- Single connection
- Auto-reconnection
- Graceful degradation if unavailable

## Error Handling

### Database Connection Failed

- Bot attempts reconnection automatically
- Retries with exponential backoff
- Managers are notified
- Bot continues with degraded functionality

### Redis Connection Failed

- Bot continues operation
- Caching is disabled
- Features using Redis may be impacted
- Managers are notified

## Related Commands

- [Restart](restart.md) - Full bot restart
- [Config](config.md) - View backend configuration

## Use Cases

- **Connection issues**: Force reconnection
- **Maintenance**: Before/after backend maintenance
- **Troubleshooting**: Diagnose backend problems
- **Cache issues**: Clear corrupted cache
- **Monitoring**: Check service health

## Best Practices

- **Check status first**: Before forcing reconnection
- **Use reconnect sparingly**: Usually auto-recovery works
- **Flush cache carefully**: Only when necessary
- **Monitor after changes**: Verify services are healthy
- **Document incidents**: Note what required manual intervention

## Tips

- Most connection issues resolve automatically
- Flush cache if you see strange caching behavior
- Database reconnection rarely needed (auto-recovery is robust)
- Redis reconnection may be needed after Redis restarts
- Check logs after forcing reconnections
- Status command is safe to run anytime
- Flush cache after major database changes affecting cached data

## Troubleshooting

**Database won't reconnect:**

- Check database server is running
- Verify connection string in config
- Check network connectivity
- Review database logs
- Consider full bot restart

**Redis won't reconnect:**

- Check Redis server is running
- Verify Redis connection string
- Check authentication
- Test Redis CLI connection
- Check firewall rules

**Flush didn't work:**

- Verify Redis connection
- Check Redis permissions
- Review Redis logs
- Try manual flush via Redis CLI
