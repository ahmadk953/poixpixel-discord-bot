# Contributing to Poixpixel Discord Bot

Thank you for your interest in contributing to Poixpixel Discord Bot! We welcome contributions from the community and are grateful for any help you can provide.

## Table of Contents

- [Contributing to Poixpixel Discord Bot](#contributing-to-poixpixel-discord-bot)
  - [Table of Contents](#table-of-contents)
  - [Code of Conduct](#code-of-conduct)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Development Setup](#development-setup)
  - [How Can I Contribute?](#how-can-i-contribute)
    - [Reporting Bugs](#reporting-bugs)
    - [Suggesting Enhancements](#suggesting-enhancements)
    - [Your First Code Contribution](#your-first-code-contribution)
    - [Pull Requests](#pull-requests)
      - [Before Submitting](#before-submitting)
      - [PR Process](#pr-process)
    - [Choosing Issue and PR Templates](#choosing-issue-and-pr-templates)
      - [Pull request templates](#pull-request-templates)
      - [Issue templates](#issue-templates)
  - [Development Workflow](#development-workflow)
    - [Branching Strategy](#branching-strategy)
    - [Commit Message Guidelines](#commit-message-guidelines)
    - [Code Style](#code-style)
      - [TypeScript](#typescript)
      - [Formatting](#formatting)
      - [ESLint](#eslint)
      - [Code Patterns](#code-patterns)
  - [Project Structure](#project-structure)
  - [Testing](#testing)
  - [Additional Resources](#additional-resources)
  - [Questions?](#questions)
  - [License](#license)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold these guidelines and foster a welcoming, inclusive environment.

If you witness or experience unacceptable behavior, please report it privately to [conduct@poixpixel.ahmadk953.org](mailto:conduct@poixpixel.ahmadk953.org). If the concern involves a recipient of that inbox, please escalate to [conduct-escalation@poixpixel.ahmadk953.org](mailto:conduct-escalation@poixpixel.ahmadk953.org). We treat all reports seriously and as confidentially as possible.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 22.0.0
- **Yarn** 4.10.3+ (managed via Corepack)
- **PostgreSQL** (for database)
- **Redis** (for caching)
- **Git** for version control

### Development Setup

1. **Fork and Clone the Repository**

   ```bash
   git clone https://github.com/YOUR-USERNAME/poixpixel-discord-bot.git
   cd poixpixel-discord-bot
   ```

1. **Enable Corepack** (for Yarn)

   ```bash
   corepack enable
   ```

1. **Install Dependencies**

   ```bash
   yarn install
   ```

1. **Configure the Bot**

   Copy the example configuration file and fill in your credentials:

   ```bash
   cp config.example.json config.json
   ```

   Update `config.json` with your Discord bot token, database credentials, and other required settings. See the [documentation](https://docs.poixpixel.ahmadk953.org/) for detailed configuration instructions.

1. **Set Up the Database**

   Run database migrations:

   ```bash
   npx drizzle-kit migrate
   ```

1. **Generate Certificates** (if using TLS for PostgreSQL)

   ```bash
   bash generate-certs.sh
   ```

1. **Start Development**

   ```bash
   yarn dev
   ```

   This will compile TypeScript and start the bot with command deployment.

   For faster iteration without redeploying commands:

   ```bash
   yarn no-deploy
   ```

## How Can I Contribute?

### Reporting Bugs

Before submitting a bug report:

- **Check the [documentation](https://docs.poixpixel.ahmadk953.org/)** to ensure it's not a configuration issue
- **Search existing issues** to avoid duplicates
- **Join our [Discord server](https://discord.gg/KRTGjxx7gY)** to discuss if unsure

When filing a bug report, include:

- **Clear and descriptive title**
- **Steps to reproduce** the behavior
- **Expected vs. actual behavior**
- **Environment details** (Node.js version, OS, etc.)
- **Relevant logs** from the console or log files
- **Screenshots or error messages** if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear and descriptive title**
- **Detailed description** of the proposed feature
- **Use cases** explaining why this would be useful
- **Mockups or examples** if applicable
- **Alternative solutions** you've considered

### Your First Code Contribution

Unsure where to start? Look for issues labeled:

- `good first issue` - Simple issues for beginners
- `help wanted` - Issues where we need community help
- `documentation` - Documentation improvements

### Pull Requests

#### Before Submitting

1. **Search existing PRs** to avoid duplicates
2. **Create an issue** to discuss major changes first
3. **Follow the coding standards** outlined below
4. **Test your changes** thoroughly
5. **Update documentation** if needed

#### PR Process

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b username/feature-description
   ```

2. **Make your changes** following our [Code Style](#code-style)

3. **Commit your changes** using [Conventional Commits](#commit-message-guidelines)

4. **Run tests and linting**:

   ```bash
   yarn lint
   yarn format:fix
   yarn compile
   ```

5. **Push to your fork**:

   ```bash
   git push origin username/feature-description
   ```

6. **Open a Pull Request** with:
   - Clear title following commit conventions
   - Description of changes and motivation
   - Reference to related issues (e.g., "Fixes #123")
   - Screenshots/videos if UI changes
   - Note any breaking changes

7. **Respond to feedback** from maintainers

8. **Once approved**, your PR will be merged to `main`

### Choosing Issue and PR Templates

#### Pull request templates

This repository provides a default PR template and multiple specialized templates you can opt into.

- Default template: Opening a PR normally auto-fills from `.github/pull_request_template.md`.
- Specialized templates: Use the `template` query parameter to prefill one of the files in `.github/PULL_REQUEST_TEMPLATE/`.

Available templates:

- `feature.md` – New features/commands
- `bug_fix.md` – Bug fixes and regressions
- `refactor.md` – Code improvements without behavior changes
- `docs.md` – Documentation-only updates
- `ci.md` – CI/workflow/build changes

Example (replace `YOUR-BRANCH`):

[Prefill with feature template](https://github.com/ahmadk953/poixpixel-discord-bot/compare/main...YOUR-BRANCH?quick_pull=1&template=feature.md)

Swap `feature.md` with: `bug_fix.md`, `refactor.md`, `docs.md`, or `ci.md`.

Tip: Ensure your PR title follows Conventional Commits (for example: `feat(commands/fun): add trivia command`). See [Commit Message Guidelines](#commit-message-guidelines).

#### Issue templates

To open a new issue, use the chooser (if enabled):

[Issue template chooser](https://github.com/ahmadk953/poixpixel-discord-bot/issues/new/choose)

If a chooser is not available, open a new issue and follow the guidance in [Reporting Bugs](#reporting-bugs) or [Suggesting Enhancements](#suggesting-enhancements).

Once issue templates are available, you can deep-link to a specific one using:

[Open with template by name](https://github.com/ahmadk953/poixpixel-discord-bot/issues/new?template=TEMPLATE_NAME.md)

For example: `bug_report.md`, `feature_request.md`, or `documentation.md` (actual names may vary).

## Development Workflow

### Branching Strategy

We follow a simplified Git workflow:

- **`main`** - Production-ready code (protected branch)
- **`development`** - Integration branch for ongoing work
- **Feature branches** - Named `username/feature-description` (e.g., `ahmadk953/repo-cleanup`)

**Branch naming conventions:**

- `username/feature-name` - New features
- `username/fix-issue` - Bug fixes
- `username/refactor-component` - Code refactoring
- `username/docs-update` - Documentation changes

### Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) specification. All commits **must** follow this format:

```text
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring (no functional changes)
- `chore` - Maintenance tasks (dependencies, build config)
- `docs` - Documentation changes
- `style` - Code style changes (formatting, missing semicolons)
- `test` - Adding or updating tests
- `perf` - Performance improvements
- `ci` - CI/CD changes

**Scopes (optional but recommended):**

- `bot` - Core bot functionality
- `commands` - Command implementations
- `commands/fun`, `commands/moderation`, `commands/util` - Specific command categories
- `events` - Event handlers
- `db` - Database functions/schema
- `util` - Utility functions
- `logger` - Logging system
- `deps` - Dependencies
- `deps-dev` - Development dependencies

**Examples:**

```text
feat(commands/fun): add new trivia game command

refactor(util/helpers): improve type usage and pass guild context

fix(db): typing and safer error handling for connection and queries

chore(deps-dev): bump eslint from 9.35.0 to 9.37.0

docs: update contributing guidelines
```

**Commitlint** will automatically validate your commit messages in CI. To test locally:

```bash
git log --format="%s" -1 | npx commitlint
```

### Code Style

#### TypeScript

- **Use TypeScript** for all new code
- **Path aliases**: Import from `@/` for `src/` (e.g., `import { foo } from '@/util/helpers.js'`)
- **Add `.js` extensions** to all imports (required for TypeScript path resolution)
- **Use `type` imports** for type-only imports:

  ```typescript
  import type { Guild } from 'discord.js';
  ```

- **Strict typing**: Avoid `any` types; use proper interfaces and type definitions

#### Formatting

- **Prettier** is used for code formatting
- **Auto-format before committing**:

  ```bash
  yarn format:fix
  ```

- **Pre-commit hooks** (Husky + lint-staged) automatically format staged files

#### ESLint

- Follow the ESLint configuration (flat config format)
- Run linting before pushing:

  ```bash
  yarn lint
  ```

#### Code Patterns

**Command Structure** - All commands **must** follow this pattern:

```typescript
import type { ChatInputCommandInteraction } from 'discord.js';
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '@/types/CommandTypes.js';

export default {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command'),

  async execute(interaction: ChatInputCommandInteraction) {
    // Implementation here
  },
} satisfies Command;
```

**Error Handling** - Use centralized error handling utilities:

```typescript
import { safelyRespond, validateInteraction } from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

// Validate interaction before processing
// The helpers exported from `@/util/helpers.js` have these shapes:
// - `validateInteraction(interaction): Promise<boolean>` — returns true when the interaction
//    is usable (in-guild, channel available, message present for component interactions).
// - `safelyRespond(interaction, content): Promise<void>` — replies or follows up as needed and
//    sends an ephemeral response when appropriate.

// Validate interaction before processing (await the promise):
if (!(await validateInteraction(interaction))) {
  return await safelyRespond(
    interaction,
    'This interaction is no longer valid or cannot be processed (missing channel or message).',
  );
}

try {
  // Your code here
} catch (error) {
  logger.error('Operation failed', error);
  await safelyRespond(interaction, 'An error occurred while processing your request.');
}
```

**Database Operations** - Import from `src/db/db.ts`:

```typescript
import { db, handleDbError } from '@/db/db.js';

try {
  const result = await db.query(...);
} catch (error) {
  handleDbError(error, 'operation_name');
}
```

**Redis Caching** - Always check connectivity:

```typescript
import { isRedisConnected, setJson, getJson } from '@/db/redis.js';

if (isRedisConnected()) {
  await setJson(`bot:key:${id}`, data);
}
```

**Logging** - Use structured logging:

```typescript
import { logger } from '@/util/logger.js';

logger.info('Event occurred', { userId, guildId, action });
logger.error('Error details', error); // Pass Error instance
```

## Project Structure

```text
src/
├── discord-bot.ts          # Entry point
├── commands/               # Slash commands (auto-discovered)
│   ├── fun/               # Fun commands (achievements, giveaways, etc.)
│   ├── moderation/        # Moderation commands (ban, kick, etc.)
│   ├── util/              # Utility commands (help, config, etc.)
│   └── testing/           # Testing commands
├── events/                # Discord.js event handlers
├── db/                    # Database layer
│   ├── schema.ts          # Drizzle ORM schema
│   ├── db.ts              # Database functions
│   ├── redis.ts           # Redis client
│   └── functions/         # Database query functions
├── util/                  # Utility functions
│   ├── logger.ts          # Winston logger
│   ├── helpers.ts         # Helper utilities
│   ├── achievementManager.ts
│   ├── levelingSystem.ts
│   └── giveaways/         # Giveaway system
└── types/                 # TypeScript type definitions
```

**Key Principles:**

1. **Commands auto-discovery**: Place commands in `src/commands/**/*.ts`, export default with `data` and `execute`
2. **Guild-specific deployment**: Commands register only to configured guild (not global)
3. **Event routing**: Use handler maps in `interactionCreate.ts` for buttons/modals/select menus
4. **Drizzle ORM**: Schema in `src/db/schema.ts`, migrations in `drizzle/`
5. **Redis fault tolerance**: All operations check connectivity and degrade gracefully

## Testing

While comprehensive test coverage is being developed, please ensure:

1. **Manual testing** of your changes
2. **Test in a development Discord server** (not production)
3. **Verify command registration** works after changes
4. **Check for TypeScript errors**:

   ```bash
   yarn lint
   ```

5. **Ensure compilation succeeds**:

   ```bash
   yarn compile
   ```

Test commands are available in `src/commands/testing/` for development purposes.

## Additional Resources

- **Documentation**: [https://docs.poixpixel.ahmadk953.org/](https://docs.poixpixel.ahmadk953.org/)
- **Discord Server**: [Join here](https://discord.gg/KRTGjxx7gY) for questions and discussions
- **Issue Tracker**: [GitHub Issues](https://github.com/ahmadk953/poixpixel-discord-bot/issues)
- **Discord.js Guide**: [https://discordjs.guide/](https://discordjs.guide/)
- **Drizzle ORM Docs**: [https://orm.drizzle.team/](https://orm.drizzle.team/)

---

## Questions?

If you have questions not covered here:

1. Check the [documentation](https://docs.poixpixel.ahmadk953.org/)
2. Search [existing issues](https://github.com/ahmadk953/poixpixel-discord-bot/issues)
3. Join our [Discord server](https://discord.gg/KRTGjxx7gY)
4. Open a new issue with the `question` label

## License

By contributing to this project, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).

---

Thank you for contributing to Poixpixel Discord Bot! 🎉
