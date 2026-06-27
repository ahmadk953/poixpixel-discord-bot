#!/bin/sh
# Based on https://raw.githubusercontent.com/edoburu/docker-pgbouncer/refs/heads/master/entrypoint.sh and https://raw.githubusercontent.com/brainsam/pgbouncer/master/entrypoint.sh

set -e

PG_CONFIG_DIR=/etc/pgbouncer
PG_CONFIG_FILE="${PG_CONFIG_DIR}/pgbouncer.ini"
_AUTH_FILE="${AUTH_FILE:-$PG_CONFIG_DIR/userlist.txt}"

append_setting() {
  printf '%s = %s\n' "$1" "$2" >> "$PG_CONFIG_FILE"
}

append_default_setting() {
  key=$1
  value=$2
  default=$3

  if [ -n "$value" ]; then
    append_setting "$key" "$value"
  else
    append_setting "$key" "$default"
  fi
}

append_optional_setting() {
  key=$1
  value=$2

  if [ -n "$value" ]; then
    append_setting "$key" "$value"
  fi
}

parse_url() {
  case $1 in
    *://*)
      url=${1#*://}
      ;;
    *)
      url=$1
      ;;
  esac

  case $url in
    *@*)
      userpass=${url%@*}
      hostport_path=${url#*@}
      case $userpass in
        *:*)
          DB_USER=${userpass%%:*}
          DB_PASSWORD=${userpass#*:}
          ;;
        *)
          DB_USER=$userpass
          DB_PASSWORD=
          ;;
      esac
      ;;
    *)
      hostport_path=$url
      DB_USER=
      DB_PASSWORD=
      ;;
  esac

  hostport=${hostport_path%%/*}
  DB_NAME=${hostport_path#*/}

  if [ "$DB_NAME" = "$hostport_path" ]; then
    DB_NAME=
  fi

  case $hostport in
    *:*)
      DB_HOST=${hostport%%:*}
      DB_PORT=${hostport##*:}
      ;;
    *)
      DB_HOST=$hostport
      DB_PORT=
      ;;
  esac
}

generate_userlist_if_needed() {
  if [ -n "$DB_USER" ] && [ -n "$DB_PASSWORD" ] && [ -e "$_AUTH_FILE" ] && ! grep -q "^\"${DB_USER}\"" "$_AUTH_FILE"; then
    case ${AUTH_TYPE:-md5} in
      plain|scram-sha-256)
        pass=$DB_PASSWORD
        ;;
      *)
        pass="md5$(printf '%s' "${DB_PASSWORD}${DB_USER}" | md5sum | cut -d ' ' -f 1)"
        ;;
    esac

    printf '"%s" "%s"\n' "$DB_USER" "$pass" >> "$_AUTH_FILE"
    printf "Wrote authentication credentials for '%s' to %s\n" "$DB_USER" "$_AUTH_FILE"
  fi
}

generate_config_db_entry() {
  append_setting "${DB_NAME:-*}" "host=${DB_HOST:?Setup pgbouncer config error! You must set DB_HOST env} port=${DB_PORT:-5432} auth_user=${DB_USER:-postgres}"
  append_optional_setting client_encoding "${CLIENT_ENCODING:-}"
}

process_database_urls() {
  urls=$1

  while [ -n "$urls" ]; do
    case $urls in
      *,*)
        url=${urls%%,*}
        urls=${urls#*,}
        ;;
      *)
        url=$urls
        urls=
        ;;
    esac

    [ -n "$url" ] || continue
    parse_url "$url"
    generate_userlist_if_needed
  done
}

write_config_database_entries() {
  urls=$1

  while [ -n "$urls" ]; do
    case $urls in
      *,*)
        url=${urls%%,*}
        urls=${urls#*,}
        ;;
      *)
        url=$urls
        urls=
        ;;
    esac

    [ -n "$url" ] || continue
    parse_url "$url"
    generate_config_db_entry
  done
}

[ -e "$_AUTH_FILE" ] || touch "$_AUTH_FILE"

if [ -n "${DATABASE_URLS:-}" ]; then
  process_database_urls "$DATABASE_URLS"
else
  if [ -n "${DATABASE_URL:-}" ]; then
    parse_url "$DATABASE_URL"
  fi
  generate_userlist_if_needed
fi

if [ ! -f "$PG_CONFIG_FILE" ]; then
  echo "Creating pgbouncer config in ${PG_CONFIG_DIR}"

  cat > "$PG_CONFIG_FILE" <<'EOF'
################## Auto generated ##################
[databases]
EOF

  if [ -n "${DATABASE_URLS:-}" ]; then
    write_config_database_entries "$DATABASE_URLS"
  else
    if [ -n "${DATABASE_URL:-}" ]; then
      parse_url "$DATABASE_URL"
    fi
    generate_config_db_entry
  fi

  printf '\n[pgbouncer]\n' >> "$PG_CONFIG_FILE"
  append_setting listen_addr "${LISTEN_ADDR:-0.0.0.0}"
  append_setting listen_port "${LISTEN_PORT:-5432}"
  append_setting unix_socket_dir "${UNIX_SOCKET_DIR:-}"
  append_setting user postgres
  append_setting auth_file "$_AUTH_FILE"
  append_optional_setting auth_hba_file "${AUTH_HBA_FILE:-}"
  append_setting auth_type "${AUTH_TYPE:-md5}"
  append_optional_setting auth_user "${AUTH_USER:-}"
  append_optional_setting auth_query "${AUTH_QUERY:-}"
  append_optional_setting auth_dbname "${AUTH_DBNAME:-}"
  append_optional_setting pool_mode "${POOL_MODE:-}"
  append_optional_setting max_client_conn "${MAX_CLIENT_CONN:-}"
  append_optional_setting pool_size "${POOL_SIZE:-}"
  append_optional_setting default_pool_size "${DEFAULT_POOL_SIZE:-}"
  append_optional_setting min_pool_size "${MIN_POOL_SIZE:-}"
  append_optional_setting reserve_pool_size "${RESERVE_POOL_SIZE:-}"
  append_optional_setting reserve_pool_timeout "${RESERVE_POOL_TIMEOUT:-}"
  append_optional_setting max_db_connections "${MAX_DB_CONNECTIONS:-}"
  append_optional_setting max_user_connections "${MAX_USER_CONNECTIONS:-}"
  append_optional_setting server_round_robin "${SERVER_ROUND_ROBIN:-}"
  append_default_setting ignore_startup_parameters "${IGNORE_STARTUP_PARAMETERS:-}" extra_float_digits
  append_optional_setting disable_pqexec "${DISABLE_PQEXEC:-}"
  append_optional_setting application_name_add_host "${APPLICATION_NAME_ADD_HOST:-}"
  append_optional_setting timezone "${TIMEZONE:-}"
  append_optional_setting max_prepared_statements "${MAX_PREPARED_STATEMENTS:-}"

  printf '\n# Log settings\n' >> "$PG_CONFIG_FILE"
  append_optional_setting log_connections "${LOG_CONNECTIONS:-}"
  append_optional_setting log_disconnections "${LOG_DISCONNECTIONS:-}"
  append_optional_setting log_pooler_errors "${LOG_POOLER_ERRORS:-}"
  append_optional_setting log_stats "${LOG_STATS:-}"
  append_optional_setting stats_period "${STATS_PERIOD:-}"
  append_optional_setting verbose "${VERBOSE:-}"
  append_default_setting admin_users "${ADMIN_USERS:-}" postgres
  append_optional_setting stats_users "${STATS_USERS:-}"
  append_optional_setting logfile "${LOGFILE:-}"

  printf '\n# Connection sanity checks, timeouts\n' >> "$PG_CONFIG_FILE"
  append_optional_setting server_reset_query "${SERVER_RESET_QUERY:-}"
  append_optional_setting server_reset_query_always "${SERVER_RESET_QUERY_ALWAYS:-}"
  append_optional_setting server_check_delay "${SERVER_CHECK_DELAY:-}"
  append_optional_setting server_check_query "${SERVER_CHECK_QUERY:-}"
  append_optional_setting server_lifetime "${SERVER_LIFETIME:-}"
  append_optional_setting server_idle_timeout "${SERVER_IDLE_TIMEOUT:-}"
  append_optional_setting server_connect_timeout "${SERVER_CONNECT_TIMEOUT:-}"
  append_optional_setting server_login_retry "${SERVER_LOGIN_RETRY:-}"
  append_optional_setting client_login_timeout "${CLIENT_LOGIN_TIMEOUT:-}"
  append_optional_setting autodb_idle_timeout "${AUTODB_IDLE_TIMEOUT:-}"
  append_optional_setting dns_max_ttl "${DNS_MAX_TTL:-}"
  append_optional_setting dns_nxdomain_ttl "${DNS_NXDOMAIN_TTL:-}"

  printf '\n# TLS settings\n' >> "$PG_CONFIG_FILE"
  append_optional_setting client_tls_sslmode "${CLIENT_TLS_SSLMODE:-}"
  append_optional_setting client_tls_key_file "${CLIENT_TLS_KEY_FILE:-}"
  append_optional_setting client_tls_cert_file "${CLIENT_TLS_CERT_FILE:-}"
  append_optional_setting client_tls_ca_file "${CLIENT_TLS_CA_FILE:-}"
  append_optional_setting client_tls_protocols "${CLIENT_TLS_PROTOCOLS:-}"
  append_optional_setting client_tls_ciphers "${CLIENT_TLS_CIPHERS:-}"
  append_optional_setting client_tls_ecdhcurve "${CLIENT_TLS_ECDHCURVE:-}"
  append_optional_setting client_tls_dheparams "${CLIENT_TLS_DHEPARAMS:-}"
  append_optional_setting server_tls_sslmode "${SERVER_TLS_SSLMODE:-}"
  append_optional_setting server_tls_ca_file "${SERVER_TLS_CA_FILE:-}"
  append_optional_setting server_tls_key_file "${SERVER_TLS_KEY_FILE:-}"
  append_optional_setting server_tls_cert_file "${SERVER_TLS_CERT_FILE:-}"
  append_optional_setting server_tls_protocols "${SERVER_TLS_PROTOCOLS:-}"
  append_optional_setting server_tls_ciphers "${SERVER_TLS_CIPHERS:-}"

  printf '\n# Dangerous timeouts\n' >> "$PG_CONFIG_FILE"
  append_optional_setting query_timeout "${QUERY_TIMEOUT:-}"
  append_optional_setting query_wait_timeout "${QUERY_WAIT_TIMEOUT:-}"
  append_optional_setting client_idle_timeout "${CLIENT_IDLE_TIMEOUT:-}"
  append_optional_setting idle_transaction_timeout "${IDLE_TRANSACTION_TIMEOUT:-}"
  append_optional_setting pkt_buf "${PKT_BUF:-}"
  append_optional_setting max_packet_size "${MAX_PACKET_SIZE:-}"
  append_optional_setting listen_backlog "${LISTEN_BACKLOG:-}"
  append_optional_setting sbuf_loopcnt "${SBUF_LOOPCNT:-}"
  append_optional_setting suspend_timeout "${SUSPEND_TIMEOUT:-}"
  append_optional_setting tcp_defer_accept "${TCP_DEFER_ACCEPT:-}"
  append_optional_setting tcp_keepalive "${TCP_KEEPALIVE:-}"
  append_optional_setting tcp_keepcnt "${TCP_KEEPCNT:-}"
  append_optional_setting tcp_keepidle "${TCP_KEEPIDLE:-}"
  append_optional_setting tcp_keepintvl "${TCP_KEEPINTVL:-}"
  append_optional_setting tcp_user_timeout "${TCP_USER_TIMEOUT:-}"

  printf '################## end file ##################\n' >> "$PG_CONFIG_FILE"
  cat "$PG_CONFIG_FILE"
fi

printf 'Starting %s...\n' "$*"
exec "$@"