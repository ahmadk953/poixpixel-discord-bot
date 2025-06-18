# Based on https://raw.githubusercontent.com/edoburu/docker-pgbouncer/master/Dockerfile

FROM alpine:3.22 AS build

LABEL org.opencontainers.image.source=https://github.com/ahmadk953/poixpixel-discord-bot/tree/main/docker/pgbouncer
LABEL org.opencontainers.image.description="Docker image for pgbouncer with c-ares support"
LABEL org.opencontainers.image.licenses=Apache-2.0

ARG PGBOUNCER_VERSION=1.24.1
ARG C_ARES_VERSION=1.34.5

RUN apk add --no-cache autoconf autoconf-doc automake curl gcc git libc-dev libevent-dev libtool make openssl-dev pandoc pkgconfig

RUN set -eux; \
  curl -Lo /c-ares.tar.gz https://github.com/c-ares/c-ares/releases/download/v${C_ARES_VERSION}/c-ares-${C_ARES_VERSION}.tar.gz && \
  tar -xzf /c-ares.tar.gz && mv /c-ares-${C_ARES_VERSION} /c-ares && \
  cd /c-ares && ./configure && make && make install && \
  curl -Lo /pgbouncer.tar.gz https://pgbouncer.github.io/downloads/files/${PGBOUNCER_VERSION}/pgbouncer-${PGBOUNCER_VERSION}.tar.gz && \
  tar -xzf /pgbouncer.tar.gz -C / && mv /pgbouncer-${PGBOUNCER_VERSION} /pgbouncer && \
  cd /pgbouncer && ./configure --with-cares && make && make install

FROM alpine:3.22

RUN apk add --no-cache busybox libevent postgresql-client libssl3 \
  && mkdir -p /etc/pgbouncer /var/log/pgbouncer /var/run/pgbouncer \
  && touch /etc/pgbouncer/userlist.txt \
  && addgroup -S -g 1100 pgbouncer \
  && adduser  -S -u 1100 -G pgbouncer pgbouncer \
  && chown -R pgbouncer:pgbouncer /etc/pgbouncer /var/log/pgbouncer /var/run/pgbouncer

COPY --chmod=+x entrypoint.sh /entrypoint.sh
COPY --from=build /usr/local/bin /usr/local/bin
COPY --from=build /usr/local/lib /usr/local/lib
COPY --from=build /pgbouncer/etc/pgbouncer.ini /etc/pgbouncer/pgbouncer.ini.example
COPY --from=build /pgbouncer/etc/userlist.txt /etc/pgbouncer/userlist.txt.example
EXPOSE 5432
USER pgbouncer
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/local/bin/pgbouncer", "/etc/pgbouncer/pgbouncer.ini"]