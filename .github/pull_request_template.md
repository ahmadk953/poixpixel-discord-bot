# Pull Request

<!-- Thank you for your contribution! Please read CONTRIBUTING.md before submitting. -->

## Summary

Describe the purpose of this PR in 1–3 sentences.

## Related issues

Closes #ISSUE_NUMBER
Refs #ISSUE_NUMBER

## Type of change

- [ ] feat (new feature)
- [ ] fix (bug fix)
- [ ] refactor (no functional changes)
- [ ] docs (documentation only)
- [ ] chore (maintenance, deps)
- [ ] perf (performance)
- [ ] ci (build/CI/CD)

## What changed

Briefly list key changes. For commands, mention command names and options; for DB, note tables/columns; for events, list event names.

## How was this tested?

- [ ] Local run: `yarn dev` / `yarn no-deploy`
- [ ] Lint: `yarn lint`
- [ ] Format: `yarn format:fix`
- [ ] Build: `yarn compile`
- [ ] Manual verification (describe steps below)

Test notes:

- Environment (OS, Node, Discord guild):
- Steps and expected results:
- Screenshots/logs (if applicable):

## Database or cache changes

- [ ] N/A
- [ ] Schema changed; generated and applied migrations with `drizzle-kit`
- [ ] Data migration required
- [ ] Redis key(s) added/changed (prefix with `bot:`); includes graceful degradation

Details:

## Breaking changes

- [ ] No breaking changes
- [ ] Breaking change (describe impact and migration path)

Migration notes:

## Security and privacy

- [ ] No new sensitive data handled
- [ ] Secrets management unchanged
- [ ] Considered abuse/spam vectors for new commands/events

Notes:

## Checklist

- [ ] I followed the contribution guidelines in `CONTRIBUTING.md`
- [ ] PR title follows Conventional Commits (e.g., `feat(commands/fun): ...`)
- [ ] Branch name follows repo convention (e.g., `username/feature-name`)
- [ ] Updated docs and examples where needed
- [ ] Added or updated telemetry/logging where useful
- [ ] For long-running operations, ensured `deferReply()` usage where needed

## Additional context for reviewers

Anything that would help reviewers (design choices, tradeoffs, follow-ups).

<!-- Multiple templates are available in .github/PULL_REQUEST_TEMPLATE/. To prefill with one, use the `template` query parameter when creating a PR. -->
