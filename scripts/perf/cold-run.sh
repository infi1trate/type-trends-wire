#!/bin/bash
# C1 · start a production build under the hosted runtime engine (wrangler dev): cold-run.sh <dist-dir> <port>. Needs wrangler 4 in /tmp/wr
# (cd /tmp/wr && bun add wrangler@4) and a dist/server/.dev.vars with the public database address and publishable key (never a secret key).
cd "$1/server" && exec /tmp/wr/node_modules/.bin/wrangler dev -c wrangler.json --port "$2" --ip 127.0.0.1 --compatibility-flags nodejs_compat --compatibility-flags nodejs_compat_populate_process_env --log-level info --show-interactive-dev-session=false
