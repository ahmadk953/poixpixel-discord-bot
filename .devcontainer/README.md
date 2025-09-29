# Devcontainer Configuration

This devcontainer configuration provides a complete development environment for the Poixpixel Discord Bot project, optimized for GitHub Codespaces.

## Features

### Environment Setup

- **Base Image**: Microsoft's TypeScript-Node devcontainer with Node.js 22
- **Docker-in-Docker**: Enabled for building and running containers (including the PgBouncer container)
- **Git**: Latest version with PPA support

### Development Tools

- TypeScript support with the latest TypeScript extension
- ESLint and Prettier for code formatting and linting
- Docker extension for container management
- GitHub Actions extension for workflow support
- JSON and YAML editing support

### Automatic Setup

- Installs project dependencies using `yarn install --immutable`
- Builds the PgBouncer Docker container automatically
- Compiles TypeScript code

### Port Forwarding

- **5432**: PostgreSQL database access (via PgBouncer)
- **6379**: Redis cache access

### Performance Optimizations

- Uses Docker volume mount for `node_modules` to improve installation and file system performance
- Excludes build artifacts and dependencies from VSCode file explorer for better performance

## Usage

1. Open the repository in GitHub Codespaces
2. Wait for the devcontainer to build and initialize
3. Dependencies will be automatically installed
4. PgBouncer container will be built
5. TypeScript code will be compiled
6. Start developing!

## Post-Setup

After the devcontainer is ready:

1. Copy `config.example.json` to `config.json` and configure your bot settings
2. Set up your Discord bot token and database connections
3. Generate SSL certificates if needed: `./generate-certs.sh`
4. Start the database services: `docker compose -f docker/docker-compose.yml up -d`
5. Run database migrations: `npx drizzle-kit migrate`
6. Start the bot: `yarn dev`

## Requirements Met

✅ **Downloads and installs dependencies**: Automatic `yarn install --immutable`  
✅ **Builds PgBouncer Docker container**: Automatic `docker build` command  
✅ **Enables Docker-in-Docker**: Feature configured with Docker Compose v2 support  
✅ **Compiles the bot**: Automatic `yarn compile` command
