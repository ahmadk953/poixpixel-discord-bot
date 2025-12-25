---
name: Feature
about: Propose a new feature or command
title: 'feat(scope): short description'
labels: ['enhancement']
---

## Summary

<!-- What feature are you adding? Why is it valuable for the bot/community? -->

## Scope

- Commands affected/new (names, options):
- Events added/updated:
- Config additions (e.g., new fields in `config.json`):

## Design notes

<!-- Key decisions, trade-offs, alternatives considered. -->

## Tests

- [ ] Lint and type-check: `yarn lint`
- [ ] Build: `yarn compile`
- [ ] Manual run: `yarn dev` or `yarn no-deploy`
- [ ] Screenshots or logs (if applicable)

## DB/Redis

- [ ] No schema changes
- [ ] Added migration(s) with `drizzle-kit`
- [ ] New Redis keys prefixed with `bot:` and guarded by `isRedisConnected()`

## Checklist

- [ ] PR title uses Conventional Commits
- [ ] Updated docs (README or docs/), help text, and examples
- [ ] Used `safelyRespond()` and `validateInteraction()` where applicable
