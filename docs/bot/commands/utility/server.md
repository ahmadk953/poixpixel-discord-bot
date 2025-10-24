---
icon: pager
---

# Server

## Overview

The `/server` command provides basic information about the current Discord server, including member count, creation date, and server age.

## Command Details

### Permissions Required

* **User**: No special permissions (available to everyone)
* **Bot**: `SEND_MESSAGES`

### Command Syntax

```bash
/server
```

No parameters required.

## Features

### 1. **Server Information**

Displays:

* **Server Name**: The name of the Discord server
* **Member Count**: Total number of members (including bots)
* **Creation Date**: When the server was created
* **Server Age**: How many years old the server is

### 2. **Quick Access**

Fast way to get basic server stats without opening settings.

## Usage Example

```bash
/server
```

**Response:**

```
The server **Poixpixel Community** has **1,234** members and was created on **Tue Jan 15 2020 10:30:45 (local timezone)**. It is **5** years old.
```

## How It Works

1. **Server Fetch**: Retrieves server (guild) object from Discord API
2. **Data Extraction**:
   * Gets server name from guild object
   * Counts total members
   * Retrieves creation timestamp
3. **Age Calculation**:
   * Compares creation date with current date
   * Calculates years difference
4. **Response**: Formats and sends information message

## Related Commands

* [Members](members.md) - List all server members
* [User Info](user-info.md) - Get detailed user information (Moderator)
* [Rules](rules.md) - Display server rules

## Use Cases

* **New members**: Learn about the server
* **Quick reference**: Check member count
* **History**: See when server was founded
* **Statistics**: Track server growth over time

## Tips

* Member count includes both humans and bots
* Creation date is displayed in the bot's server timezone (usually UTC)
* Server age is calculated in whole years
* For more detailed statistics, consider a dedicated stats bot

## Enhancement Ideas

If you want to extend this command, consider adding:

* Bot count vs human count
* Role count
* Channel count
* Server boost level
* Server icon
* Server banner
* Verification level
* Vanity URL (if any)
