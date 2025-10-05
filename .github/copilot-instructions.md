# Copilot Instructions for Poixpixel Discord Bot

## Project Architecture Overview

This is a Discord bot built with Discord.js v14, TypeScript, Drizzle ORM (PostgreSQL), and Redis caching. The bot features an achievement system, leveling, moderation tools, giveaway system, and various fun commands.

### Core Structure
- **Entry Point**: `src/discord-bot.ts` → initializes `ExtendedClient` 
- **Client Extension**: `src/structures/ExtendedClient.ts` - custom client with command collection
- **Commands**: Auto-discovered from `src/commands/**/*.ts` using `deployCommands()`
- **Events**: Auto-registered from `src/events/*.ts` using `registerEvents()`

## Critical Development Patterns

### Command Architecture
Commands must export a default object with `data` (SlashCommandBuilder) and `execute` function:

```typescript
export default {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command'),
  async execute(interaction: ChatInputCommandInteraction) {
    // Implementation
  }
};
```

Three command interfaces exist: `Command`, `OptionsCommand`, `SubcommandCommand` in `src/types/CommandTypes.ts`.

### Event Handling Pattern
Events in `src/events/interactionCreate.ts` use centralized routing with handler maps:
- Button interactions: `giveawayHandlers` object maps customId to functions
- Modal submissions: `modalHandlers` object for form processing
- Select menus: `selectHandlers` object for dropdown interactions

### Database Patterns
- **Schema**: `src/db/schema.ts` uses Drizzle ORM with relations
- **Operations**: Import functions from `src/db/db.ts` 
- **Migrations**: Use `drizzle-kit` with config in `drizzle.config.ts`
- **Tables**: `memberTable`, `levelTable`, `moderationTable`, `factTable`, `giveawayTable`, `achievementDefinitionsTable`, `userAchievementsTable`

### Redis Caching System
- **Wrapper**: `src/db/redis.ts` provides fault-tolerant Redis operations
- **Pattern**: All Redis keys prefixed with `'bot:'`
- **Functions**: `set()`, `get()`, `setJson()`, `getJson()`, `incr()`, `exists()`, `del()`
- **Resilience**: Auto-reconnection with exponential backoff, graceful degradation when unavailable

## Build System & Development Workflow

### Key Scripts
- `yarn start:dev` - Compile TypeScript and deploy commands to Discord
- `yarn start:dev:no-deploy` - Skip command deployment (set `SKIP_COMMAND_DEPLOY=true`)
- `yarn compile` - TypeScript compilation to `target/` directory
- `yarn target` - Run compiled JavaScript

### TypeScript Configuration
- **Paths**: `@/*` alias maps to `src/*` 
- **Output**: Compiles to `target/` directory
- **Transform**: Uses `typescript-transform-paths` plugin for path resolution

### Configuration Management
- `config.json` contains bot token, database URLs, Redis connection
- `loadConfig()` from `src/util/configLoader.ts` validates and loads config
- Certificates in `certs/` for PostgreSQL and Redis TLS connections

## Feature-Specific Patterns

### Achievement System
- Definitions in `achievementDefinitionsTable` with `requirementType` and `threshold`
- User progress tracked in `userAchievementsTable` 
- Progress processing in `src/util/achievementManager.ts`
- Auto-triggered from command usage and message events

### Leveling System
- XP and levels stored in `levelTable`
- Message counting and reaction tracking
- Cooldown system prevents XP farming

### Giveaway System
- Complex builder pattern in `src/util/giveaways/`
- Bonus entries via roles, levels, message count
- Modal/dropdown hybrid UI based on guild size (`> 25` items = modal)

## Common Pitfalls & Conventions

1. **Command Deployment**: Commands are auto-deployed unless `SKIP_COMMAND_DEPLOY=true`
2. **Error Handling**: Use `safelyRespond()` from `src/util/helpers.js` for interaction responses
3. **Achievement Processing**: Always call `processCommandAchievements()` after command execution
4. **Redis Graceful Degradation**: Check `isRedisConnected()` before non-critical caching operations
5. **Interaction Validation**: Use `validateInteraction()` helper before processing interactions
6. **Path Imports**: Always use `@/` alias for internal imports if the file is more than one level deep, append `.js` extension for compiled compatibility

## Logging Conventions

- Use the shared `logger` exported from `src/util/logger.ts` for all application logging. This ensures consistent formatting, levels, and optional OpenTelemetry export.
- Log levels (highest -> lowest): `fatal`, `crit`, `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`.
- Preferred call patterns:
  - For normal messages: `logger.info('Started job', { jobId })`
  - For errors: `logger.error('Failed to fetch user', error)` where `error` is an `Error` instance or a plain object. The logger prints message, stack, and any extra error properties.
  - For unusual levels or programmatic cases: `logger.log('fatal', 'Uncaught Exception', error)`.
- The console output is timestamped using `YYYY-MM-DD HH:mm:ss` and colorizes the level. Metadata is pretty-printed under a `Metadata:` block. Stack traces and error properties are shown under `Error:` / `Stack Trace:` blocks.
- When logging, pass structured metadata (objects) rather than concatenating into strings. The logger filters out `undefined`/`null` values automatically and prettifies nested objects.
- Global handlers: call `initLogger()` early on startup (it registers `uncaughtException` and `unhandledRejection` handlers and attempts graceful transport shutdown on fatal errors).
- Telemetry: if `config.telemetry.otel.enabled` is true, logs are also sent to an OTEL transport; control verbosity with `config.telemetry.level`.
- Colors mapping (console): `fatal` -> red bold underline, `crit` -> red bold, `error` -> red, `warn` -> yellow, `info` -> green, `http` -> cyan, `verbose` -> blue, `debug` -> magenta, `silly` -> grey.


## Testing & Production Considerations

- PM2 process manager for production (`yarn start:prod`)
- Husky pre-commit hooks with lint-staged
- ESLint + Prettier for code quality
- Bot targets specific guild (not global commands)
- TLS certificates required for PostgreSQL and Redis in production