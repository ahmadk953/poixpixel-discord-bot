# Poixpixel's Discord Bot

> [!WARNING]
> This Discord bot is not production ready and is still in a testing state. Expect lots of breaking changes, missing features, and bugs.

> [!TIP]
> Want to see the bot in action? [Join our Discord server](https://discord.gg/KRTGjxx7gY).

## Documentation & Setup Instructions

> [!WARNING]
> Documentation is still under construction. Expect incomplete and undocumented features.

All documentation and setup instructions can be found at [https://docs.poixpixel.ahmadk953.org/](https://docs.poixpixel.ahmadk953.org/?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=docs_link)

## Community & Conduct

- Please review our [Code of Conduct](./CODE_OF_CONDUCT.md) before participating.
- Need to report a concern? Email [conduct@poixpixel.ahmadk953.org](mailto:conduct@poixpixel.ahmadk953.org) or, for escalation, [conduct-escalation@poixpixel.ahmadk953.org](mailto:conduct-escalation@poixpixel.ahmadk953.org).

## Development Commands

Install Dependencies: `yarn install`

Type Check: `yarn type-check`

Lint/Format Check: `yarn check`

Lint/Format Fix: `yarn fix`

Compile: `yarn compile`

Build notes: `yarn compile` clears `target/`, compiles TypeScript with `tsc`, then rewrites path aliases with `tsc-alias`.

Clean: `yarn clean`

Undeploy All Commands: `yarn undeploy-commands`

Undeploy notes: `yarn undeploy-commands` now runs directly from source via `tsx` and does not require a prior compile.

Start (dev): `yarn dev`

Command deployment runs automatically and skips Discord API updates when command definitions are unchanged.

Force command deployment (optional): `FORCE_COMMAND_DEPLOY=true yarn dev`

Start: `yarn start`

Start notes: `yarn start` now launches the already-compiled bot from `target/`. Run `yarn compile` first after code changes.

Restart (works only when the bot is started with `yarn start`): `yarn restart`

Pre-commit notes: Husky runs `yarn lint-staged` before commit. Lint-staged runs `yarn ultracite fix` on staged JS/TS/JSON files and runs `yarn type-check` when staged `.ts` files are present.
