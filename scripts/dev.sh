#!/bin/bash
# Dev server startup script
# Usage: bash scripts/dev.sh

# Node.js v20 LTS — most stable for Next.js 16 + Turbopack
export PATH="$HOME/.nvm/versions/node/v20.18.2/bin:$PATH"
unset NODE_OPTIONS

cd "$(dirname "$0")/.." || exit 1

echo "Starting Claude Dashboard dev server..."
echo "Node: $(node --version)"
echo ""

# Rebuild better-sqlite3 if needed (compiled for different Node version)
BUILT_ABI=$(node -e "try{require('better-sqlite3');console.log('ok')}catch(e){console.log('mismatch')}" 2>/dev/null)
if [ "$BUILT_ABI" = "mismatch" ]; then
  echo "Rebuilding better-sqlite3 for Node v$(node -v)..."
  pnpm rebuild better-sqlite3
  echo ""
fi

exec env NEXT_TELEMETRY_DISABLED=1 npx next dev --port 3000
