# =============================================================================
# Stage 1: deps
# Install production + dev dependencies with pnpm.
# better-sqlite3 requires native compilation so build tools are installed here
# and carried through to the builder stage where `pnpm rebuild` will recompile
# the native module for the target platform.
# =============================================================================
FROM node:22-slim AS deps

# Build tools needed by better-sqlite3 (node-gyp -> python3 + make + g++)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm via corepack (ships with Node 22)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifest files first for layer-cache efficiency
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (prod + dev) so the build stage has everything it needs.
# --frozen-lockfile ensures the lockfile is respected exactly.
RUN pnpm install --frozen-lockfile


# =============================================================================
# Stage 2: builder
# Compile the Next.js application.
# =============================================================================
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependencies installed in the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the source tree
COPY . .

# Recompile better-sqlite3 native bindings for the current platform/arch.
# This is necessary when the host machine (e.g. macOS arm64) differs from the
# build target (linux/amd64 or linux/arm64).
RUN pnpm rebuild better-sqlite3

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
RUN pnpm build


# =============================================================================
# Stage 3: runner
# Minimal production image – only the compiled output and prod node_modules.
# =============================================================================
FROM node:22-slim AS runner

# Runtime build tools are NOT needed; only libstdc++ for the native .node binary
RUN apt-get update && apt-get install -y --no-install-recommends \
    libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create a non-root user/group for security
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Create the data directory and set ownership before switching user.
# This directory is expected to be overlaid by a bind-mount or named volume
# at runtime; the directory exists as a fallback so SQLite can still write
# when no volume is mounted.
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Copy only what the production server needs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy the native better-sqlite3 binding and its package metadata so the
# standalone output can locate and load the compiled .node file at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# Expose SQLite data directory as a volume so the database survives container
# restarts and upgrades.
VOLUME ["/app/data"]

USER nextjs

EXPOSE 3000

# next start (standalone mode) uses server.js emitted by the build
CMD ["node", "server.js"]
