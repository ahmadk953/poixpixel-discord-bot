# Moderation Commands

Powerful moderation tools to help you maintain a safe and welcoming server environment.

## Available Commands

### [Ban](ban.md)

Ban members from the server with optional temporary duration.

**Usage:** `/ban <member> <reason> [duration]`

**Permission Level:** 🛡️ Moderator (BAN_MEMBERS)

---

### [Kick](kick.md)

Remove a member from the server (they can rejoin with an invite).

**Usage:** `/kick <member> <reason>`

**Permission Level:** 🛡️ Moderator (KICK_MEMBERS)

---

### [Mute](mute.md)

Timeout a member temporarily (up to 28 days).

**Usage:** `/mute <member> <reason> <duration>`

**Permission Level:** 🛡️ Moderator (MODERATE_MEMBERS)

---

### [Unban](unban.md)

Remove a ban from a user, allowing them to rejoin the server.

**Usage:** `/unban <userid> <reason>`

**Permission Level:** 🛡️ Moderator (BAN_MEMBERS)

---

### [Unmute](unmute.md)

Remove an active timeout from a member.

**Usage:** `/unmute <member> <reason>`

**Permission Level:** 🛡️ Moderator (MODERATE_MEMBERS)

---

### [Warn](warn.md)

Issue a warning to a member, which is logged and tracked.

**Usage:** `/warn <member> <reason>`

**Permission Level:** 🛡️ Moderator (MODERATE_MEMBERS)

---

## Features

All moderation commands include:

* **Audit Logging** - Comprehensive logs sent to the configured audit channel
* **DM Notifications** - Users receive DMs explaining the moderation action
* **Moderation History** - All actions are tracked in the database
* **Role Hierarchy** - Moderators cannot action members with equal/higher roles
* **Permission Checks** - Ensures the bot has necessary permissions

## Best Practices

1. **Always provide clear reasons** - This helps with transparency and record-keeping
2. **Use appropriate durations** - Start with shorter timeouts/bans and escalate if needed
3. **Check moderation history** - Use `/user-info` to review a member's past infractions
4. **Communicate with your team** - Moderation logs help keep all staff informed

## Related Documentation

* [User Info Command](../utility/user-info.md) - View moderation history
* [Configuration Options](../../basics/configuration-options.md) - Configure audit logging
* [Commands Overview](../README.md) - View all command categories
