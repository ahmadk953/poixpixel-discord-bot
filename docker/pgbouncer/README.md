# Pgbouncer

Pgbouncer is a lightweight connection pooler for PostgreSQL that helps optimize database connections by reusing established sessions.

## Overview

This directory contains all the necessary files to build and run Pgbouncer as part of the Poixpixel Discord Bot project. It is based on Alpine Linux and includes support for c-ares.

## Contents

- **Dockerfile**: Builds the Pgbouncer image with c-ares support.
- **entrypoint.sh**: Generates and configures the Pgbouncer configuration file at container startup.

## Building the Docker Image

To build the Pgbouncer Docker image, run:

```sh
docker build -t my-pgbouncer ./docker/pgbouncer
```

## Running the Container

Run the container with your desired environment variables. For example:

```sh
docker run --rm \
    -e DATABASE_URL="postgres://user:pass@postgres-host/database" \
    -p 5432:5432 \
    my-pgbouncer
```

Or, if you would like to use separate environment variables:

```sh
docker run --rm \
    -e DB_USER=user \
    -e DB_PASSWORD=pass \
    -e DB_HOST=postgres-host \
    -e DB_NAME=database \
    -p 5432:5432 \
    my-pgbouncer
```

You can also use the prebuilt image. For example:

```sh
docker run --rm \
    -e DB_USER=user \
    -e DB_PASSWORD=pass \
    -e DB_HOST=postgres-host \
    -e DB_NAME=database \
    -p 5432:5432 \
    ghcr.io/ahmadk953/poixpixel-discord-bot-pgbouncer
```

## Customizing Your Setup

- **Dockerfile**: Modify build arguments or dependencies as needed.
- **entrypoint.sh**: Adjust how the configuration file is generated and updated.
- **Environment Variables**: Almost all settings found in the `pgbouncer.ini` file can be set as environment variables with the exception of a few, system-specific configuration options. For an example, check out [the example Docker compose file](../../docker-compose.yml). For all configuration options, check the [pgbouncer configuration documentation](https://www.pgbouncer.org/config.html).
- **Configuration File**: You can specify your own `pgbouncer.ini` file by mounting it as a volume like so:
```sh
docker run --rm \
    -e DB_USER=user \
    -e DB_PASSWORD=pass \
    -e DB_HOST=postgres-host \
    -e DB_NAME=database \
    -v pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini:ro \
    -p 5432:5432
    ghcr.io/ahmadk953/poixpixel-discord-bot-pgbouncer
```

## License

See the [LICENSE](../../LICENSE) file in the root of the project for licensing details.
