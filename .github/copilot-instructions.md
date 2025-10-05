# Copilot Instructions for Poixpixel Discord Bot

## Architecture Overview

Discord.js v14 bot with TypeScript, Drizzle ORM (PostgreSQL), Redis caching. Features: achievements, leveling, moderation, giveaways, fun commands.

**Boot sequence**: `src/discord-bot.ts` → `initLogger()` → `loadConfig()` → `ExtendedClient.initialize()` → `loadModules()` → auto-discovers commands from `target/commands/**/*.js` (compiled from `src/commands/`) → deploys to Discord REST API (guild-specific, NOT global) → registers event handlers from `src/events/` → logs in.

## Critical Workflows

### Development Loop
```bash
yarn dev              # Compile TS → Deploy commands → Start bot
yarn no-deploy        # Skip command deployment (faster iteration)
yarn compile          # Just compile TypeScript to target/
yarn lint             # ESLint + TypeScript type checking
yarn format:fix       # Auto-format with Prettier
```

**TypeScript quirk**: Path alias `@/*` maps to `src/*` but MUST append `.js` extension in imports (e.g., `import { foo } from '@/util/helpers.js'`) because `typescript-transform-paths` resolves aliases at compile time. Output goes to `target/` directory.

**Command deployment**: By default, `yarn dev` UNDEPLOYS all existing guild commands then re-registers them. Skip with `SKIP_COMMAND_DEPLOY=true` or `yarn no-deploy` during rapid iteration to avoid rate limits.

### Database Migrations
```bash
npx drizzle-kit generate  # Generate migration SQL from schema changes
npx drizzle-kit migrate   # Apply pending migrations
```

Schema in `src/db/schema.ts` with relations. Config in `drizzle.config.ts` uses `database.directDbConnectionString` (bypasses pooler for DDL). Production requires TLS certificate in `certs/rootCA.pem`.

## Command Pattern (REQUIRED)

All commands in `src/commands/**/*.ts` MUST default export an object with:
```typescript
export default {
  data: new SlashCommandBuilder().setName('example').setDescription('...'),
  async execute(interaction: ChatInputCommandInteraction) {
    // Implementation
    await processCommandAchievements(interaction.user.id, 'example', interaction.guild);
  }
} satisfies Command;  // or OptionsCommand, SubcommandCommand
```

**Always call `processCommandAchievements(userId, commandName, guild)` after command execution** to track achievement progress (see `src/util/achievementManager.ts`).

## Event Routing Pattern

`src/events/interactionCreate.ts` uses handler maps (object literals) for centralized routing:
- **Buttons**: `giveawayHandlers[customId](interaction)` 
- **Modals**: `modalHandlers[customId](interaction)`
- **Select Menus**: `selectHandlers[customId](interaction)`

Add new handlers to these objects instead of duplicating switch statements. CustomIds use prefixes like `giveaway_enter_`, `fact_approve_`.

## Database & Caching Strategy

### Drizzle ORM
- **Import functions from `src/db/db.ts`**, not direct DB access (wraps error handling, retries)
- Tables: `memberTable`, `levelTable`, `moderationTable`, `giveawayTable`, `achievementDefinitionsTable`, `userAchievementsTable`, `factTable`
- Use `handleDbError(error, operation)` for consistent error handling
- Foreign keys cascade on delete (e.g., deleting member removes levels, achievements)

### Redis Fault Tolerance
- **All Redis keys prefixed `'bot:'`** (e.g., `bot:counting:${guildId}`)
- **Always check `isRedisConnected()`** before non-critical caching operations
- Functions: `setJson()`, `getJson()`, `incr()`, `exists()`, `del()` (auto-serializes JSON)
- **Graceful degradation**: Redis failures log warnings but don't crash bot (see `src/db/redis.ts`)
- Auto-reconnection with exponential backoff (config: `redis.retryAttempts`, `redis.initialRetryDelay`)

## Error Handling Conventions

1. **Interaction responses**: Use `safelyRespond(interaction, content, ephemeral)` from `src/util/helpers.ts` (handles already replied/deferred states, DiscordAPIErrors)
2. **Validation**: Call `validateInteraction(interaction)` before processing (checks guild context, bot permissions)
3. **Logging**: Use structured logging with metadata objects:
   ```typescript
   logger.info('Command executed', { userId, commandName, guildId });
   logger.error('Database query failed', error);  // error = Error instance
   ```

## Logging System

**Import**: `import { logger } from '@/util/logger.js'`  
**Initialization**: `initLogger()` in `src/discord-bot.ts` (registers global error handlers)  
**Levels**: `fatal` > `crit` > `error` > `warn` > `info` > `http` > `verbose` > `debug` > `silly`  
**Format**: `YYYY-MM-DD HH:mm:ss [LEVEL] Message` with colorized console output, pretty-printed metadata blocks  
**Telemetry**: Optional OTLP export if `config.telemetry.otel.enabled` (see `src/util/telemetry/`)

## Feature-Specific Patterns

### Achievement System
- **Never modify `achievementDefinitionsTable` directly** (seed once, update via admin commands)
- Progress tracked in `userAchievementsTable.progress` (integer count toward `threshold`)
- Check `requirementType`: `command_usage`, `message_count`, `reaction_count`, `level`, etc.
- Use `processCommandAchievements()` or `processMessageAchievements()` from `src/util/achievementManager.ts`

### Leveling System
- **XP cooldown**: `leveling.xpCooldown` ms between XP gains per user (stored in Redis `bot:xp_cooldown:${userId}`)
- Level roles auto-assigned in `config.roles.levelRoles` (check `src/events/messageEvents.ts`)
- Formula: XP = random(`minXpAwarded`, `maxXpAwarded`) per message (within cooldown)

### Giveaway System
- **Modal vs. Select Menu UI**: If guild has >25 eligible roles/etc., use modal for role input (Discord's 25-option limit)
- Bonus entries configurable: role multipliers, level thresholds, message count
- Manager functions in `src/util/giveaways/giveawayManager.ts` (create, enter, draw, end)
- Stored in `giveawayTable` with `requirements` JSONB column (complex eligibility rules)

## Common Pitfalls

1. **Don't import from `target/`**: Always import from `src/` with `.js` extensions
2. **Command not appearing**: Run `yarn dev` (not `yarn no-deploy`) to re-register commands after changes to `data` (name, options, etc.)
3. **Redis unavailable**: Check logs for connection failures; bot degrades gracefully but features like XP cooldown, counting state may behave unexpectedly
4. **Interaction token expired**: If command takes >3s, call `interaction.deferReply()` immediately
5. **Type imports**: Use `type` keyword for imports only used in type positions: `import type { Guild } from 'discord.js'`

## Production Considerations

- **Process manager**: `yarn start` uses PM2 (`poixpixel-discord-bot` process name), `yarn restart` to reload
- **TLS certificates**: `certs/psql-ca.pem` for PostgreSQL, Redis TLS in `config.redis.redisConnectionString`
- **Guild-specific commands**: Bot only registers commands in `config.guildId` (not global slash commands)
- **Pre-commit hooks**: Husky runs `lint-staged` (ESLint, Prettier) before commits
- **Data retention**: Optional `config.dataRetention` purges old member data (see `src/util/dataRetention.ts`)