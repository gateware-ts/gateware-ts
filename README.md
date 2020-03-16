# gateware-ts

**gateware-ts** is a *hardware definition library* written in TypeScript for generating Verilog code, ready to be piped into the open source FPGA toolchain.

The project aims to:

- Create a type-safe and modular way of specifying RTL hardware
- Integrate and facilitate the use of the open source FPGA toolchains
- Be approachable and usable by JavaScript and TypeScript developers

## TODO

- [ ] Support for simulation
  - Statements for managing the clock, instantly setting values, displaying debug info, outputting vcd files
- [ ] Strict/Non-strict mode
  - Enforced width matching, including constants without width specified
- [ ] Interface to open source toolchain
  - Building, verifying, simulating, and programming directly from gateware-ts scripts
  - Automatic installation / compilation of tools
- [x] A way to define and instantiate vendor modules
  - Modules like Block RAMs, PLLs, etc
  - Must be type safe
  - Defined by parameters, inputs and outputs
  - Union type representing GWModules and Vendor Modules
- [ ] More examples
  - Simple stuff and more complex designs