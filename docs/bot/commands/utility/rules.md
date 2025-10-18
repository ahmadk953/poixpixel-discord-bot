---
icon: clipboard-list-check
---

# Rules

## Overview

The `/rules` command displays the server rules in a formatted, easy-to-read embed. This helps members quickly reference the rules without searching through channels.

## Command Details

### Permissions Required

* **User**: No special permissions (available to everyone)
* **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/rules
```

No parameters required.

## Features

### 1. **Formatted Display**

Rules are shown in a clean, professional embed with:

* Server-themed colors
* Numbered rules
* Clear formatting
* Easy to read layout

### 2. **Always Accessible**

* Works in any channel
* No need to scroll through pinned messages
* Quick reference for new and existing members

### 3. **Consistent Presentation**

* Same format every time
* Prevents confusion about rules
* Professional appearance

## Server Rules

The bot displays the following rules:

### Rule #1: Be respectful

Treat everyone with kindness. No harassment, bullying, hate speech, or toxic behavior.

### Rule #2: Keep it Family-Friendly

No explicit content, including NSFW images, language, or discussions. This is a safe space for everyone.

### Rule #3: Use Common Sense

Think before you act or post. If something seems questionable, it is probably best not to do it.

### Rule #4: No Spamming

Avoid excessive messages, emoji use, or CAPS LOCK. Keep the chat clean and readable.

### Rule #5: No Raiding

Do not disrupt the server or other servers with spam, unwanted content, or malicious behavior.

### Rule #6: No Self-Promotion

Do not advertise your own content or other servers without permission from staff.

### Rule #7: No Impersonation

Do not pretend to be someone else, including staff or other members.

### Rule #8: No Violence

Do not post or share content that is offensive, harmful, or contains violent or dangerous content.

### Rule #9: No Doxxing or Sharing Personal Information

Protect your privacy and the privacy of others. Do not share personal details.

### Rule #10: No Ping Abuse

Do not ping staff members unless it is absolutely necessary. Use pings responsibly for all members.

### Rule #11: Use Appropriate Channels

Post content in the right channels. Off-topic content may be moved or deleted.

### Rule #12: Follow the Discord Terms of Service and Community Guidelines

All members must adhere to the Discord Terms of Service and Community Guidelines.

### Rule #13: Moderator Discretion

Moderators reserve the right to moderate at their discretion. If you feel mistreated, please create a support ticket.

### Disclaimer

**These rules may be updated at any time. It is your responsibility to review them regularly. Moderators and admins have the authority to enforce these rules and take appropriate action.**

## Usage Example

```bash
/rules
```

Displays the complete server rules in an embed.

## How It Works

1. **Command Invoked**: User runs `/rules`
2. **Embed Generation**: Bot creates pre-formatted embed with all rules
3. **Display**: Sends embed to channel where command was used

## Customization

To customize the rules for your server, edit the `rules.ts` file:

```typescript
// File: src/commands/util/rules.ts

const rulesEmbed = new EmbedBuilder()
  .setColor(0x0099ff)
  .setTitle('Server Rules')
  .setDescription('These are the rules for this server...')
  .addFields(
    {
      name: '**Rule #1: Your Rule**',
      value: 'Your rule description',
    },
    // Add more rules...
  );
```

After editing, recompile and restart the bot.

## Best Practices

* **Keep rules clear and concise** - Easy to understand
* **Number your rules** - Easy to reference
* **Cover essential topics** - Safety, respect, spam, etc.
* **Match your server's needs** - Adjust as necessary
* **Review regularly** - Update as community evolves

## Related Commands

* [Help](help.md) - Get help with bot commands
* [Server](server.md) - Get server information

## Use Cases

* **New member onboarding** - Quick rules overview
* **Rule clarification** - When discussing rule violations
* **Quick reference** - During moderation decisions
* **Reminders** - Post periodically in chat

## Tips for Server Admins

* Pin rules in a dedicated rules channel as well
* Reference specific rule numbers in warnings (e.g., "Violation of Rule #4")
* Keep rules command accessible in all channels
* Consider adding links to longer rule documents
* Make rules reasonable and enforceable
* Update rules embed when rules change

## Tips for Members

* Read rules when you first join
* Reference rules when unsure about something
* Use `/rules` to refresh your memory
* Don't try to find loopholes
* Ask staff if you have questions about rules
