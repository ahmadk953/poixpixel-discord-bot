# Utility Commands

Administrative and general-purpose commands for server management and bot configuration.

## Available Commands

### [Backend Manager](backend-manager.md)

Manage database and Redis cache connections and status.

**Usage:** `/backend-manager <subcommand>`

**Permission Level:** 👑 Administrator (MANAGE_GUILD)

---

### [Config](config.md)

View the current bot configuration with sensitive data redacted.

**Usage:** `/config`

**Permission Level:** 👑 Administrator

---

### [Help](help.md)

Get information about available commands and detailed help for specific commands.

**Usage:** `/help [command]`

**Permission Level:** 👤 Everyone

---

### [Manage Achievements](manage-achievements.md)

Create, delete, and manage achievement definitions and user progress.

**Usage:** `/manage-achievements <subcommand>`

**Permission Level:** 👑 Administrator (MANAGE_GUILD)

---

### [Members](members.md)

List all registered members in the database.

**Usage:** `/members`

**Permission Level:** 👤 Everyone

---

### [Ping](ping.md)

Check the bot's latency and responsiveness.

**Usage:** `/ping`

**Permission Level:** 👤 Everyone

---

### [Purge](purge.md)

Bulk delete messages with advanced filtering options.

**Usage:** `/purge <amount> [age_limit] [user] [reason]`

**Permission Level:** 🛡️ Moderator (MANAGE_MESSAGES)

---

### [Recalculate Levels](recalculate-levels.md)

Recalculate all user levels based on their current XP.

**Usage:** `/recalculate-levels`

**Permission Level:** 👑 Administrator

---

### [Reload Config](reload-config.md)

Reload the bot configuration from disk without restarting.

**Usage:** `/reload-config`

**Permission Level:** 👑 Administrator

---

### [Restart](restart.md)

Restart the bot process (requires PM2 process manager).

**Usage:** `/restart`

**Permission Level:** 👑 Administrator

---

### [Rules](rules.md)

Display the server rules in a formatted embed.

**Usage:** `/rules`

**Permission Level:** 👤 Everyone

---

### [Server](server.md)

Get information about the current server.

**Usage:** `/server`

**Permission Level:** 👤 Everyone

---

### [User Info](user-info.md)

View detailed information about a user including moderation history.

**Usage:** `/user-info <user>`

**Permission Level:** 🛡️ Moderator (MODERATE_MEMBERS)

---

### [XP](xp.md)

Manage user XP (add, remove, set, or reset).

**Usage:** `/xp <subcommand>`

**Permission Level:** 👑 Administrator (MANAGE_GUILD)

---

## Features

Utility commands provide:

- **Bot Management** - Monitor and control bot services
- **Configuration Control** - View and reload settings
- **User Management** - Manage member data and progression
- **Server Information** - Access server and member details
- **Help System** - Interactive command documentation

## Related Documentation

- [Configuration Options](../../basics/configuration-options.md) - Detailed config documentation
- [Backend Setup](../../getting-started/quickstart/self-hosting.md) - Database and Redis setup
- [Commands Overview](../README.md) - View all command categories
