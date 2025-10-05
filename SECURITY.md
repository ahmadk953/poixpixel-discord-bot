# Security Policy

Thank you for taking the time to help keep this project and its users safe. We take security issues seriously and appreciate responsible disclosure.

## Reporting a Vulnerability

- Please report security vulnerabilities privately using GitHub Security Advisories:
  - Report here: [Report a vulnerability](https://github.com/ahmadk953/poixpixel-discord-bot/security/advisories/new)
- Do not create a public GitHub issue for security reports.
- If you cannot use GitHub advisories, contact a maintainer privately via our Discord server and request a secure channel. Do not share sensitive details publicly.

When reporting, include as much detail as you can to help us triage and reproduce:

- A clear description of the issue and its impact.
- Steps to reproduce, proof-of-concept, or minimal test case.
- Affected version/commit (e.g., commit SHA or release tag) and branch.
- Runtime details: Node.js version (>=22), OS, and deployment mode (dev, PM2, Docker).
- Relevant logs and configuration snippets with all secrets removed and tokens redacted.
- Any known workarounds or suggested mitigations.

Please only test against environments you control. Do not perform tests that violate Discord’s Terms of Service, target third-party servers, or cause denial-of-service.

## Disclosure Process and Timelines

We aim to:

- Acknowledge your report within 72 hours.
- Triage and request additional information as needed within 7 days.
- Develop and release a fix as quickly as feasible, prioritizing severity and impact.
- Publish a security advisory with credits after a fix/mitigation is available. If you prefer to remain anonymous, let us know.

We may coordinate on a timeline for public disclosure depending on severity, complexity, and downstream impact.

## Supported Versions

This repository is currently under active development and not yet production-ready. Security fixes are generally applied to the default branch and may be backported to the latest tagged release when feasible.

Supported status:

- main (default branch): receives security updates
- older tags/releases: best-effort only; we recommend upgrading to the latest main or release

No formal LTS policy is in place at this time.

## Scope and Examples of Security Issues

In scope examples:

- Token, credential, or secret exposure (e.g., Discord bot token leakage).
- Command permission bypasses or escalation (e.g., moderation or admin-only actions accessible by unauthorized users).
- Injection vulnerabilities (SQL injection, command injection) or unsafe deserialization.
- Logic flaws in giveaways, leveling, or achievements leading to privilege or reward abuse.
- Sensitive data exposure in logs or responses.
- DoS vectors caused by unbounded inputs or expensive operations triggered remotely.

Out of scope examples (unless you can demonstrate a concrete security impact in this project):

- Vulnerabilities in third-party dependencies without a proof of exploitability in this codebase.
- Self-inflicted misconfiguration on your deployment (e.g., over-permissive Discord roles, exposed config.json).
- Social engineering, physical attacks, or issues that only affect outdated forks no longer maintained.
- Spam, phishing, or policy/content moderation concerns (see Code of Conduct instead).

## Third-Party Dependencies

This project depends on several upstream components (non-exhaustive):

- discord.js (Discord API client)
- Drizzle ORM and PostgreSQL
- ioredis and Redis
- OpenTelemetry (optional telemetry)

If you discover a vulnerability in a dependency, please report it upstream first. If the issue also affects this project, you may additionally open a private advisory here linking to the upstream report.

## Safe Handling of Sensitive Information

- Never include real tokens, passwords, or connection strings in reports. Redact them thoroughly.
- If sharing logs, remove or mask any secrets and user-identifying information.
- Rotate any potentially exposed credentials immediately.

## Hardening Tips for Operators

While not strictly part of reporting, these practices improve security of your own deployment:

- Keep Node.js and dependencies up to date; run linting and type checks regularly.
- Store secrets outside of VCS; do not commit your `config.json` with real tokens.
- Restrict the bot’s Discord permissions to the minimum required for your use.
- Use TLS for PostgreSQL/Redis in production and restrict network access.
- Monitor logs for unusual activity; enable only the features you need.

See docs: [docs.poixpixel.ahmadk953.org](https://docs.poixpixel.ahmadk953.org/)

## Code of Conduct

All interactions in this project are governed by our Code of Conduct. Please review it before engaging: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## Credit and Bounty

We are happy to credit reporters in advisories (unless you request otherwise). There is currently no bug bounty program associated with this repository.
