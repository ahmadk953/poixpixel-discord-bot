#!/bin/bash

# Get the Group ID
_gid="$(id -g)"

# Remove everything in the certs directory except for rootCA.pem and rootCA-key.pem
if [ -d certs ]; then
  find certs -mindepth 1 ! -name 'rootCA.pem' ! -name 'rootCA-key.pem' -exec rm -rf {} +
else
  mkdir certs
fi

# Set CAROOT Environment Variable
CAROOT="$(pwd)/certs"
export CAROOT

# Generate postgres Certificates
mkcert -key-file certs/psql-key.pem -cert-file certs/psql-cert.pem localhost 127.0.0.1 ::1

# Generate Cache Certificates
mkcert -key-file certs/cache-key.pem -cert-file certs/cache-cert.pem localhost 127.0.0.1 ::1

# Generate PgBouncer Certificates
mkcert -key-file certs/pgbouncer-key.pem -cert-file certs/pgbouncer-cert.pem localhost 127.0.0.1 ::1

# Install the Root CA
mkcert -install

# Setup Permissions
chmod 0600 certs/psql-key.pem
chmod 0640 certs/pgbouncer-key.pem
chmod 0640 certs/cache-key.pem

# Assign Ownership
sudo chown 70:70 certs/psql-key.pem
sudo chown 1100:"${_gid}" certs/pgbouncer-key.pem
sudo chown 999:"${_gid}" certs/cache-key.pem
