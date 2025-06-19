#!/bin/sh
# Based on https://raw.githubusercontent.com/brainsam/pgbouncer/master/entrypoint.sh
# and https://raw.githubusercontent.com/edoburu/docker-pgbouncer/master/entrypoint.sh

set -e

# Here are some parameters. See all on
# https://pgbouncer.github.io/config.html

PG_CONFIG_DIR=/etc/pgbouncer
PG_CONFIG_FILE="${PG_CONFIG_DIR}/pgbouncer.ini"
_AUTH_FILE="${AUTH_FILE:-$PG_CONFIG_DIR/userlist.txt}"

# Workaround userlist.txt missing issue
# https://github.com/edoburu/docker-pgbouncer/issues/33
if [ ! -e "${_AUTH_FILE}" ]; then
  touch "${_AUTH_FILE}"
fi

# Extract all info from a given URL. Sets variables because shell functions can't return multiple values.
#
# Parameters:
#   - The url we should parse
# Returns (sets variables): DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
parse_url() {
  # Thanks to https://stackoverflow.com/a/17287984/146289

  # Allow to pass values like dj-database-url / django-environ accept
  proto="$(echo $1 | grep :// | sed -e's,^\(.*://\).*,\1,g')"
  url="$(echo $1 | sed -e s,$proto,,g)"

  # extract the user and password (if any)
  userpass="$(echo $url | grep @ | sed -r 's/^(.*)@([^@]*)$/\1/')"
  DB_PASSWORD="$(echo $userpass | grep : | cut -d: -f2)"
  if [ -n "${DB_PASSWORD}" ]; then
    DB_USER="$(echo $userpass | grep : | cut -d: -f1)"
  else
    DB_USER="${userpass}"
  fi

  # extract the host -- updated
  hostport=$(echo $url | sed -e s,$userpass@,,g | cut -d/ -f1)
  port=$(echo $hostport | grep : | cut -d: -f2)
  if [ -n "$port" ]; then
    DB_HOST=$(echo $hostport | grep : | cut -d: -f1)
    DB_PORT="${port}"
  else
    DB_HOST="${hostport}"
  fi

  DB_NAME="$(echo $url | grep / | cut -d/ -f2-)"
}

# Grabs variables set by `parse_url` and adds them to the userlist if not already set in there.
generate_userlist_if_needed() {
  if [ -n "${DB_USER}" ] && [ -n "${DB_PASSWORD}" ] && [ -e "${_AUTH_FILE}" ] && ! grep -q "^\"${DB_USER}\"" "${_AUTH_FILE}"; then
    if [ "${AUTH_TYPE}" = "plain" ] || [ "${AUTH_TYPE}" = "scram-sha-256" ]; then
      pass="${DB_PASSWORD}"
    else
      pass="md5$(printf '%s' "${DB_PASSWORD}${DB_USER}" | md5sum | cut -f 1 -d ' ')"
    fi
    echo "\"${DB_USER}\" \"${pass}\"" >>"${_AUTH_FILE}"
    echo "Wrote authentication credentials for '${DB_USER}' to ${_AUTH_FILE}"
  fi
}

# Grabs variables set by `parse_url` and adds them to the PG config file as a database entry.
generate_config_db_entry() {
  # Prepare values
  dbname=${DB_NAME:-*}
  host=${DB_HOST:?"Setup pgbouncer config error! You must set DB_HOST env"}
  port=${DB_PORT:-5432}
  auth_user=${DB_USER:-postgres}

  # Print main entry
  printf '%s = host=%s port=%s auth_user=%s\n' \
    "$dbname" "$host" "$port" "$auth_user" \
    >>"$PG_CONFIG_FILE"

  # Optional client_encoding
  if [ -n "$CLIENT_ENCODING" ]; then
    printf 'client_encoding = %s\n' "$CLIENT_ENCODING" \
      >>"$PG_CONFIG_FILE"
  fi
}

# Write the password with MD5 encryption, to avoid printing it during startup.
# Notice that `docker inspect` will show unencrypted env variables.
if [ -n "${DATABASE_URLS}" ]; then
  echo "${DATABASE_URLS}" | tr ',' '\n' | while IFS= read -r url; do
    parse_url "$url"
    generate_userlist_if_needed
  done
else
  if [ -n "${DATABASE_URL}" ]; then
    parse_url "${DATABASE_URL}"
  fi
  generate_userlist_if_needed
fi

if [ ! -f "$PG_CONFIG_FILE" ]; then
  echo "Creating pgbouncer config in ${PG_CONFIG_DIR}"

  # Config file is in "ini" format. Section names are between "[" and "]".
  # Lines starting with ";" or "#" are taken as comments and ignored.
  # The characters ";" and "#" are not recognized when they appear later in the line.
  # write static header
  printf '%s\n%s\n' \
    '################## Auto generated ##################' \
    '[databases]' \
    >"$PG_CONFIG_FILE"

  if [ -n "$DATABASE_URLS" ]; then
    echo "$DATABASE_URLS" | tr , '\n' | while read -r url; do
      parse_url "$url"
      generate_config_db_entry
    done
  else
    if [ -n "$DATABASE_URL" ]; then
      parse_url "$DATABASE_URL"
    fi
    generate_config_db_entry
  fi

  # write [pgbouncer] section with a constant format string
  {
    printf '%s\n' '[pgbouncer]'
    printf 'listen_addr = %s\n' "${LISTEN_ADDR:-0.0.0.0}"
    printf 'listen_port = %s\n' "${LISTEN_PORT:-5432}"
    printf 'unix_socket_dir = %s\n' "${UNIX_SOCKET_DIR}"
    printf 'user = %s\n' "pgbouncer"
    printf 'auth_file = %s\n' "${_AUTH_FILE}"
  } >>"$PG_CONFIG_FILE"

  # now handle each optional setting in its own if-block:
  if [ -n "${AUTH_HBA_FILE}" ]; then
    printf 'auth_hba_file = %s\n' "${AUTH_HBA_FILE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${AUTH_TYPE}" ]; then
    printf 'auth_type = %s\n' "${AUTH_TYPE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${AUTH_USER}" ]; then
    printf 'auth_user = %s\n' "${AUTH_USER}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${AUTH_QUERY}" ]; then
    printf 'auth_query = %s\n' "${AUTH_QUERY}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${AUTH_DBNAME}" ]; then
    printf 'auth_dbname = %s\n' "${AUTH_DBNAME}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${POOL_MODE}" ]; then
    printf 'pool_mode = %s\n' "${POOL_MODE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${MAX_CLIENT_CONN}" ]; then
    printf 'max_client_conn = %s\n' "${MAX_CLIENT_CONN}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${POOL_SIZE}" ]; then
    printf 'pool_size = %s\n' "${POOL_SIZE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${DEFAULT_POOL_SIZE}" ]; then
    printf 'default_pool_size = %s\n' "${DEFAULT_POOL_SIZE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${MIN_POOL_SIZE}" ]; then
    printf 'min_pool_size = %s\n' "${MIN_POOL_SIZE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${RESERVE_POOL_SIZE}" ]; then
    printf 'reserve_pool_size = %s\n' "${RESERVE_POOL_SIZE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${RESERVE_POOL_TIMEOUT}" ]; then
    printf 'reserve_pool_timeout = %s\n' "${RESERVE_POOL_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${MAX_DB_CONNECTIONS}" ]; then
    printf 'max_db_connections = %s\n' "${MAX_DB_CONNECTIONS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${MAX_USER_CONNECTIONS}" ]; then
    printf 'max_user_connections = %s\n' "${MAX_USER_CONNECTIONS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_ROUND_ROBIN}" ]; then
    printf 'server_round_robin = %s\n' "${SERVER_ROUND_ROBIN}" >>"$PG_CONFIG_FILE"
  fi
  printf 'ignore_startup_parameters = %s\n' "${IGNORE_STARTUP_PARAMETERS:-extra_float_digits}" >>"$PG_CONFIG_FILE"
  if [ -n "${DISABLE_PQEXEC}" ]; then
    printf 'disable_pqexec = %s\n' "${DISABLE_PQEXEC}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${APPLICATION_NAME_ADD_HOST}" ]; then
    printf 'application_name_add_host = %s\n' "${APPLICATION_NAME_ADD_HOST}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${TIMEZONE}" ]; then
    printf 'timezone = %s\n' "${TIMEZONE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${MAX_PREPARED_STATEMENTS}" ]; then
    printf 'max_prepared_statements = %s\n' "${MAX_PREPARED_STATEMENTS}" >>"$PG_CONFIG_FILE"
  fi

  # Log settings
  if [ -n "${LOG_CONNECTIONS}" ]; then
    printf 'log_connections = %s\n' "${LOG_CONNECTIONS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${LOG_DISCONNECTIONS}" ]; then
    printf 'log_disconnections = %s\n' "${LOG_DISCONNECTIONS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${LOG_POOLER_ERRORS}" ]; then
    printf 'log_pooler_errors = %s\n' "${LOG_POOLER_ERRORS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${LOG_STATS}" ]; then
    printf 'log_stats = %s\n' "${LOG_STATS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${STATS_PERIOD}" ]; then
    printf 'stats_period = %s\n' "${STATS_PERIOD}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${VERBOSE}" ]; then
    printf 'verbose = %s\n' "${VERBOSE}" >>"$PG_CONFIG_FILE"
  fi
  printf 'admin_users = %s\n' "${ADMIN_USERS:-postgres}" >>"$PG_CONFIG_FILE"
  if [ -n "${STATS_USERS}" ]; then
    printf 'stats_users = %s\n' "${STATS_USERS}" >>"$PG_CONFIG_FILE"
  fi

  # Connection sanity checks, timeouts
  if [ -n "${SERVER_RESET_QUERY}" ]; then
    printf 'server_reset_query = %s\n' "${SERVER_RESET_QUERY}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_RESET_QUERY_ALWAYS}" ]; then
    printf 'server_reset_query_always = %s\n' "${SERVER_RESET_QUERY_ALWAYS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_CHECK_DELAY}" ]; then
    printf 'server_check_delay = %s\n' "${SERVER_CHECK_DELAY}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_CHECK_QUERY}" ]; then
    printf 'server_check_query = %s\n' "${SERVER_CHECK_QUERY}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_LIFETIME}" ]; then
    printf 'server_lifetime = %s\n' "${SERVER_LIFETIME}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_IDLE_TIMEOUT}" ]; then
    printf 'server_idle_timeout = %s\n' "${SERVER_IDLE_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_CONNECT_TIMEOUT}" ]; then
    printf 'server_connect_timeout = %s\n' "${SERVER_CONNECT_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_LOGIN_RETRY}" ]; then
    printf 'server_login_retry = %s\n' "${SERVER_LOGIN_RETRY}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${CLIENT_LOGIN_TIMEOUT}" ]; then
    printf 'client_login_timeout = %s\n' "${CLIENT_LOGIN_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${AUTODB_IDLE_TIMEOUT}" ]; then
    printf 'autodb_idle_timeout = %s\n' "${AUTODB_IDLE_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${DNS_MAX_TTL}" ]; then
    printf 'dns_max_ttl = %s\n' "${DNS_MAX_TTL}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${DNS_NXDOMAIN_TTL}" ]; then
    printf 'dns_nxdomain_ttl = %s\n' "${DNS_NXDOMAIN_TTL}" >>"$PG_CONFIG_FILE"
  fi

  # TLS settings
  if [ -n "${CLIENT_TLS_SSLMODE}" ]; then
    printf 'client_tls_sslmode = %s\n' "${CLIENT_TLS_SSLMODE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${CLIENT_TLS_KEY_FILE}" ]; then
    printf 'client_tls_key_file = %s\n' "${CLIENT_TLS_KEY_FILE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${CLIENT_TLS_CERT_FILE}" ]; then
    printf 'client_tls_cert_file = %s\n' "${CLIENT_TLS_CERT_FILE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${CLIENT_TLS_CA_FILE}" ]; then
    printf 'client_tls_ca_file = %s\n' "${CLIENT_TLS_CA_FILE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${CLIENT_TLS_PROTOCOLS}" ]; then
    printf 'client_tls_protocols = %s\n' "${CLIENT_TLS_PROTOCOLS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${CLIENT_TLS_CIPHERS}" ]; then
    printf 'client_tls_ciphers = %s\n' "${CLIENT_TLS_CIPHERS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${CLIENT_TLS_ECDHCURVE}" ]; then
    printf 'client_tls_ecdhcurve = %s\n' "${CLIENT_TLS_ECDHCURVE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${CLIENT_TLS_DHEPARAMS}" ]; then
    printf 'client_tls_dheparams = %s\n' "${CLIENT_TLS_DHEPARAMS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_TLS_SSLMODE}" ]; then
    printf 'server_tls_sslmode = %s\n' "${SERVER_TLS_SSLMODE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_TLS_CA_FILE}" ]; then
    printf 'server_tls_ca_file = %s\n' "${SERVER_TLS_CA_FILE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_TLS_KEY_FILE}" ]; then
    printf 'server_tls_key_file = %s\n' "${SERVER_TLS_KEY_FILE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_TLS_CERT_FILE}" ]; then
    printf 'server_tls_cert_file = %s\n' "${SERVER_TLS_CERT_FILE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_TLS_PROTOCOLS}" ]; then
    printf 'server_tls_protocols = %s\n' "${SERVER_TLS_PROTOCOLS}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SERVER_TLS_CIPHERS}" ]; then
    printf 'server_tls_ciphers = %s\n' "${SERVER_TLS_CIPHERS}" >>"$PG_CONFIG_FILE"
  fi

  # Dangerous timeouts
  if [ -n "${QUERY_TIMEOUT}" ]; then
    printf 'query_timeout = %s\n' "${QUERY_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${QUERY_WAIT_TIMEOUT}" ]; then
    printf 'query_wait_timeout = %s\n' "${QUERY_WAIT_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${CLIENT_IDLE_TIMEOUT}" ]; then
    printf 'client_idle_timeout = %s\n' "${CLIENT_IDLE_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${IDLE_TRANSACTION_TIMEOUT}" ]; then
    printf 'idle_transaction_timeout = %s\n' "${IDLE_TRANSACTION_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${PKT_BUF}" ]; then
    printf 'pkt_buf = %s\n' "${PKT_BUF}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${MAX_PACKET_SIZE}" ]; then
    printf 'max_packet_size = %s\n' "${MAX_PACKET_SIZE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${LISTEN_BACKLOG}" ]; then
    printf 'listen_backlog = %s\n' "${LISTEN_BACKLOG}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SBUF_LOOPCNT}" ]; then
    printf 'sbuf_loopcnt = %s\n' "${SBUF_LOOPCNT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${SUSPEND_TIMEOUT}" ]; then
    printf 'suspend_timeout = %s\n' "${SUSPEND_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${TCP_DEFER_ACCEPT}" ]; then
    printf 'tcp_defer_accept = %s\n' "${TCP_DEFER_ACCEPT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${TCP_KEEPALIVE}" ]; then
    printf 'tcp_keepalive = %s\n' "${TCP_KEEPALIVE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${TCP_KEEPCNT}" ]; then
    printf 'tcp_keepcnt = %s\n' "${TCP_KEEPCNT}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${TCP_KEEPIDLE}" ]; then
    printf 'tcp_keepidle = %s\n' "${TCP_KEEPIDLE}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${TCP_KEEPINTVL}" ]; then
    printf 'tcp_keepintvl = %s\n' "${TCP_KEEPINTVL}" >>"$PG_CONFIG_FILE"
  fi
  if [ -n "${TCP_USER_TIMEOUT}" ]; then
    printf 'tcp_user_timeout = %s\n' "${TCP_USER_TIMEOUT}" >>"$PG_CONFIG_FILE"
  fi
  printf '\n################## end file ##################\n' >>"$PG_CONFIG_FILE"
  if [ "${DEBUG}" = "true" ]; then
    cat "${PG_CONFIG_FILE}"
  fi
fi

echo "Starting $*..."
exec "$@"
