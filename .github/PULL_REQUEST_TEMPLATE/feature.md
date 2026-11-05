---
name: Feature
about: Propose a new feature or command
title: 'feat(scope): short description'
labels: ['enhancement']
---

## Summary

<!-- What is being added, and why is it useful? -->

## Scope

- Commands added or updated:
- Events added or updated:
- Config additions:
- DB or Redis impact:

## Design notes

<!-- Key decisions, trade-offs, or alternatives considered. -->

## Tests

- [ ] `yarn check`
- [ ] `yarn type-check`
- [ ] `yarn compile`
- [ ] `yarn dev`
- [ ] Manual verification or screenshots/logs

## DB/Redis

- [ ] No schema changes
- [ ] Added migration(s) with `drizzle-kit`
- [ ] New Redis keys are prefixed with `bot:` and degrade gracefully

## Checklist

- [ ] PR title uses Conventional Commits
- [ ] Updated docs, help text, and examples
- [ ] Used `safelyRespond()` and `validateInteraction()` where applicable
