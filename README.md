# gateware-ts

**gateware-ts** is a *hardware definition library* written in TypeScript for generating Verilog code, ready to be piped into the open source FPGA toolchain.

The project aims to:

- Create a type-safe and modular way of specifying RTL hardware
- Integrate and facilitate the use of the open source FPGA toolchains
- Be approachable and usable by JavaScript and TypeScript developers

## TODO

- [x] Support for simulation
- [ ] Strict/Non-strict mode
  - Enforced width matching, including constants without width specified
- [ ] Interface to open source toolchain
  - Building, verifying, simulating, and programming directly from gateware-ts scripts
  - Automatic installation / compilation of tools
- [x] A way to define and instantiate vendor modules
- [ ] More examples
  - Simple stuff and more complex designs