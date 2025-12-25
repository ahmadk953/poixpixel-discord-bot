---
icon: table-tennis-paddle-ball
---

# Ping

## Overview

The `/ping` command is a simple utility to check the bot's responsiveness and measure the latency between you and the bot.

## Command Details

### Permissions Required

- **User**: No special permissions (available to everyone)
- **Bot**: `SEND_MESSAGES`

### Command Syntax

```bash
/ping
```

No parameters required.

## Features

### 1. **Latency Measurement**

Calculates the time between:

- When you send the command
- When the bot responds

### 2. **Health Check**

Quick way to verify:

- Bot is online and responding
- Bot can read and respond to commands
- Connection is stable

## Usage Example

```bash
/ping
```

**Response:**

```
🏓 Pong! Latency: 125ms
```

## How It Works

1. **Interaction Received**: Bot receives your slash command
2. **Timestamp Calculation**:
   - Records current timestamp
   - Compares with interaction creation timestamp
   - Calculates difference in milliseconds
3. **Response**: Sends message with latency measurement

## Interpreting Results

### Latency Ranges

| Latency   | Status    | Description          |
| --------- | --------- | -------------------- |
| < 100ms   | Excellent | Very fast response   |
| 100-200ms | Good      | Normal response time |
| 200-500ms | Fair      | Noticeable delay     |
| > 500ms   | Poor      | Significant lag      |

### Factors Affecting Latency

- **Discord API response time** - Discord's server load
- **Bot server location** - Geographic distance
- **Your connection** - Your internet speed
- **Bot load** - How busy the bot is
- **Network congestion** - Internet traffic

## Use Cases

- **Quick check**: Verify bot is online
- **Troubleshooting**: Diagnose connection issues
- **Benchmarking**: Compare performance over time
- **Fun**: Just say hi to the bot!

## Related Commands

- [Server](server.md) - Get server information
- [Help](help.md) - Get help with commands
- [Backend Manager](backend-manager.md) - Check backend service status (Admin)

## Tips

- High latency doesn't always mean the bot is slow - could be Discord or your connection
- Run ping a few times to get average latency
- Compare with other bots to identify if issue is specific to this bot
- If latency is consistently high, report to bot administrator

## Differences from Network Ping

This is NOT the same as network ping:

- **Not ICMP**: Doesn't use network ping protocol
- **Application level**: Measures Discord interaction round-trip
- **Includes processing**: Bot processing time is included
- **Discord API**: Goes through Discord's API layer

For true network latency to bot server, use system ping tools with the bot's host IP (if available).
