#!/usr/bin/env bash

set -eufo pipefail

PROJ="seven-segment-driver"

rm "$PROJ.json" "$PROJ.asc" "$PROJ.bin" "$PROJ.log" "$PROJ.vvp" "$PROJ.vvp" || true

# # Build the verilog files
ts-node index.ts
echo "Built $PROJ.v and $PROJ-tb.v"

# Perform synthesis with yosys
yosys -ql $PROJ.log -p 'synth_ice40 -top top -json '"$PROJ"'.json' $PROJ.v

# Perform place and routing with nextpnr
nextpnr-ice40 --up5k --json ./$PROJ.json --pcf ../../board-constraints/icebreaker.pcf --asc $PROJ.asc

# Build a bitstream withicepack
icepack $PROJ.asc $PROJ.bin

# Send the bitstream to the fpga with iceprog
iceprog $PROJ.bin

# Simulate with icarus verilog
iverilog -o $PROJ.vvp "$PROJ-tb.v"
# Create a waveformwith vvp
vvp $PROJ.vvp