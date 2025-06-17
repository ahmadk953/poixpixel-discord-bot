#!/bin/bash

# Get the Effective User ID
_uid="$(id -u)"
_gid="$(id -g)"

# Create the certificates directory
mkdir -p certs

# Generate PostgreSQL Certificates
openssl req -new -x509 -days 365 -nodes \
  -out certs/psql-server.crt \
  -keyout certs/psql-server.key \
  -subj "/CN=localhost"

# Generate Valkey Certificates
openssl req -new -x509 -days 365 -nodes \
  -out certs/cache-server.crt \
  -keyout certs/cache-server.key \
  -subj "/CN=localhost"

# Generate pgbouncer Certificates
openssl req -new -x509 -days 365 -nodes \
  -out certs/pgbouncer-server.crt \
  -keyout certs/pgbouncer-server.key \
  -subj "/CN=localhost"

# Get CA Certificates
cp certs/psql-server.crt certs/psql-ca.crt
cp certs/cache-server.crt certs/cache-ca.crt
cp certs/pgbouncer-server.crt certs/pgbouncer-ca.crt

# Setup Permissions
chmod 0600 certs/psql-server.key
chmod 0600 certs/cache-server.key
chmod 0600 certs/pgbouncer-server.key

# Assign Ownership
sudo chown 70:70 certs/psql-*.*
sudo chown 999:1000 certs/cache-*.*
sudo chown 1100:1100 certs/pgbouncer-*.*

# Get Client Keys
sudo cp certs/pgbouncer-server.key certs/pgbouncer-client.key
sudo cp certs/cache-server.key certs/cache-client.key

# Change Client Key Ownership
sudo chown $_uid:$_gid certs/pgbouncer-client.key
sudo chown $_uid:$_gid certs/cache-client.key

# Change Client Key Permissions
sudo chmod +r certs/pgbouncer-client.key
sudo chmod +r certs/cache-client.key
