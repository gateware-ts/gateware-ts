#!/bin/sh

set -e pipefail

node ./bin/testware.js examples/one_shot_debouncer/one-shot-debounce-tb.ts
node ./bin/testware.js examples/uart/uart-rx_tb.ts