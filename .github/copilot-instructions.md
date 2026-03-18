# Copilot Instructions for Poixpixel Discord Bot

## Architecture Overview

Discord.js v14 bot with TypeScript, Drizzle ORM (PostgreSQL), Redis caching. Features: achievements, leveling, moderation, giveaways, fun commands.

**Boot sequence**: `src/discord-bot.ts` → `initLogger()` → `loadConfig()` → `ExtendedClient.initialize()` → `loadModules()` → auto-discovers commands from `target/commands/**/*.js` (compiled from `src/commands/`) → deploys to Discord REST API (guild-specific, NOT global) → registers event handlers from `src/events/` → logs in.

## Critical Workflows

### Development Loop
```bash
yarn dev              # Start bot in watch mode and auto-check command deployment
yarn compile          # Just compile TypeScript to target/
yarn check            # Ultracite/Biome lint + formatting checks
yarn fix              # Auto-fix lint/format issues
yarn type-check       # TypeScript type checking
```

**TypeScript quirk**: Path alias `@/*` maps to `src/*` and imports MUST append `.js` (e.g., `import { foo } from '@/util/helpers.js'`). Builds run through `tsc` and then `tsc-alias` to rewrite aliases in compiled output under `target/`.

**Command deployment**: `yarn dev` loads commands and only updates guild commands when command definitions change. Use `FORCE_COMMAND_DEPLOY=true yarn dev` to force re-registration.

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
  }
} satisfies Command;  // or OptionsCommand, SubcommandCommand
```

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

1. **Interaction responses**: Use `safelyRespond(interaction, content)` from `src/util/helpers.ts`. It will choose between
   replying, following up, or skipping when the interaction is not repliable, and it logs unexpected Discord API errors.
2. **Validation**: Call `await validateInteraction(interaction)` before processing. It returns `true` when the
   interaction is safe to use (in-guild, channel available, and for component interactions the original message is fetchable).

Example pattern to use in commands or interaction handlers:
```typescript
import { safelyRespond, validateInteraction } from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

// Ensure the interaction is still valid before doing work
if (!(await validateInteraction(interaction))) {
  return await safelyRespond(
    interaction,
    'This interaction is no longer valid or cannot be processed (missing channel or message).',
  );
}

try {
  // handler logic
} catch (error) {
  logger.error('Handler failed', error);
  await safelyRespond(interaction, 'An error occurred while processing your request.');
}
```
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
- `processCommandAchievements()` and `processMessageAchievements()` **are only called once per event** (in `src/events/interactionCreate.ts`, and `src/util/levelingSystem.ts` inside the `processMessage()` function, respectively) to batch-process all relevant achievements for efficiency

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
2. **Command not appearing**: `yarn dev` should re-register commands when `data` changes (name, options, etc.); use `FORCE_COMMAND_DEPLOY=true yarn dev` only as an override if you need to force a redeploy.
3. **Redis unavailable**: Check logs for connection failures; bot degrades gracefully but features like XP cooldown, counting state may behave unexpectedly
4. **Interaction token expired**: If command takes >3s, call `interaction.deferReply()` immediately
5. **Type imports**: Use `type` keyword for imports only used in type positions: `import type { Guild } from 'discord.js'`

## Production Considerations

- **Process manager**: `yarn start` uses PM2 (`poixpixel-discord-bot` process name), `yarn restart` to reload
- **TLS certificates**: `certs/psql-ca.pem` for PostgreSQL, Redis TLS in `config.redis.redisConnectionString`
- **Guild-specific commands**: Bot only registers commands in `config.guildId` (not global slash commands)
- **Pre-commit hooks**: Husky runs `yarn type-check`, then `yarn dlx ultracite fix`, and re-stages already-staged files
- **Data retention**: Optional `config.dataRetention` purges old member data (see `src/util/dataRetention.ts`)

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `yarn dlx ultracite fix`
- **Check for issues**: `yarn dlx ultracite check`
- **Diagnose setup**: `yarn dlx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**
- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**
- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**
- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `yarn dlx ultracite fix` before committing to ensure compliance.
