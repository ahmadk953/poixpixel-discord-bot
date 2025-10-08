# Members Command

## Overview

The `/members` command lists all registered members from the bot's database in a paginated, sorted format.

## Command Details

### Permissions Required

* **User**: No special permissions (available to everyone)
* **Bot**: `SEND_MESSAGES`, `EMBED_LINKS`

### Command Syntax

```bash
/members
```

No parameters required.

## Features

### 1. **Paginated Display**

* Shows 15 members per page
* Navigate with pagination buttons
* Current page and total pages shown

### 2. **Sorted Alphabetically**

Members are sorted by username (A-Z) for easy lookup.

### 3. **Complete Information**

Each entry shows:

* **Username**: Discord username
* **Discord ID**: Full 18-digit Discord user ID

### 4. **Total Count**

Each page shows the total member count at the bottom.

## Usage Example

```bash
/members
```

Shows alphabetically sorted list of all registered members from the database with navigation.

## How It Works

1. **Database Query**: Fetches all registered members from database
2. **Sorting**: Sorts alphabetically by username
3. **Pagination**: Splits into pages of 15 members each
4. **Navigation**: Interactive buttons for page navigation

## Related Commands

* [Server](server.md) - Get server member count
* [User Info](user-info.md) - Get detailed info about specific user (Moderator)

## Use Cases

* **Member lookup**: Find specific members in database
* **Audit**: Verify who is registered
* **Statistics**: See total registered members
* **Administration**: Review member database

## Tips

* List shows database records, not live Discord members
* Members who left may still appear if not cleaned up
* Use for administrative purposes
* Consider data retention policies for old members
