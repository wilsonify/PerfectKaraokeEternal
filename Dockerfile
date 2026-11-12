# syntax=docker/dockerfile:1

# PerfectKaraokeEternal
# ---------------------------------------------------------------------------
# The application is a browser-only karaoke player: static HTML/CSS/JS plus a
# dependency-free Node static file server (serve.js). It has no build step, no
# database, no media scanner and no server-side user data, so this image
# contains only the files that server is allowed to serve.
#
# Build from this repository root:
#   docker build -t wilsonify/perfectkaraokeeternal:latest .
#
# Runtime contract, configuration and migration notes live in
# karaoke-vault/docs/docker.md:
#   PORT=8080, HOST=0.0.0.0   (read by serve.js)
#   uid/gid 1000 ("node"), read-only /app, no volumes required
# ---------------------------------------------------------------------------

# Pinned to a Node minor and an explicit Alpine release so rebuilds stay close
# to reproducible. This tag publishes linux/amd64 and linux/arm64 (verified
# against the registry index); the fully pinned 22.23.5-alpine3.24 tag did not
# carry an arm64/v8 manifest when this was written.
FROM node:22.23-alpine3.24

LABEL org.opencontainers.image.title="PerfectKaraokeEternal" \
      org.opencontainers.image.description="Browser-based karaoke player (MP3+G, LRC/ELRC, ZIP, MP4)" \
      org.opencontainers.image.source="https://github.com/wilsonify/PerfectKaraokeEternal" \
      org.opencontainers.image.licenses="ISC"

# serve.js reads PORT and HOST from the environment and defaults to
# 127.0.0.1:3000, which is unreachable from outside a container.
ENV PORT=8080 \
    HOST=0.0.0.0

WORKDIR /app

# npm, npx and corepack are build-time tooling only; the runtime needs node.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Exactly what serve.js serves and nothing else: no tests, docs, lint config,
# node_modules or package metadata from the repository reach the image.
# The app is plain ES modules, so there is nothing to compile or bundle and no
# multi-stage build is needed (see docs/docker.md, "Image design").
COPY index.html serve.js ./
COPY css/ ./css/
COPY js/ ./js/
COPY assets/ ./assets/

# Unprivileged. Everything under /app is read-only at runtime and the app keeps
# no server-side state, so there is no data directory to own and no need to
# remap uids (the old PUID/PGID contract).
USER node

EXPOSE 8080

# GET / returns the app shell with 200; a 404 for /package.json is correct.
# The check reads PORT so a reconfigured port is still probed correctly.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Exec form, so node is PID 1 and receives SIGTERM directly from `docker stop`.
# No CMD: serve.js only takes optional flags, so arguments given to
# `docker run` (for example `--port 9000`) are appended to this entrypoint.
ENTRYPOINT ["node", "serve.js"]
