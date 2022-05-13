# Gateware-ts Overview

*Note: gateware-ts is under construction. Terms, classes, functions, and methods may all change a little during the process*

`gateware-ts` is an **embedded hardware description language** (eHDL) for defining RTL hardware modules. Modules are made up of signals (input, internal, and output), as well as synchronous and combinational logic that defines how those signals change over time.

## Modules and Signals

All hardware modules inherit from a class called `GWModule`, and must implement a `describe()` method.

Here is a simple example of a hardware module that implements a two input nand gate.

```typescript
class NANDGate extends GWModule {
  // Define two input signals and attach them to properties on the class
  A = this.addInput('A', 1);
  B = this.addInput('B', 1);

  // Define an output signal and attach it as a property on the class
  C = this.addOutput('C', 1);

  describe() {
    const {A, B, C} = this;

    this.combinationalProcess([
      // C = ~(A & B)
      C.setTo(A.and(B).inverse()),

      // This could also be expressed differently as:
      // C ['='] ( Inverse( A ['&'] (B)) )
    ])
  }
}
```

A combinational process is logic that is essentially continous; any time `A` or `B` changes, `C` changes immediately in response (or as close to immediate as is physically possible given the hardware delays).

This is in contrast to a synchronous process, where signals act as registers, and only change their value at discrete moments in response to a level change in another signal (such as a clock).

```typescript
class SyncNANDGate extends GWModule {
  // Define two input signals and attach them to properties on the class
  // Both signals are 1-bit wide
  A = this.addInput('A', 1);
  B = this.addInput('B', 1);

  // A 3rd input - a clock signal, which changes value from low to high at a fixed interval
  clock = this.addInput('clock', 1);

  // Define an output signal and attach it as a property on the class
  C = this.addOutput('C', 1);

  describe() {
    const {A, B, C, clock} = this;

    this.synchronousProcess(Edge.Positive, clock, [
      C.setTo(A.and(B).inverse()),
    ]);
  }
}
```

In this arrangement, `C` only changes it's value when `clock` goes from a low value to a high value - even if `A` and `B` changed in the meantime. In this case, we can say that `C` is a register.

You can combine synchronous and combinational logic in the same module:

```typescript
class SyncAndCombNANDGate extends GWModule {
  A = this.addInput('A', 1);
  B = this.addInput('B', 1);
  clock = this.addInput('clock', 1);

  // An internal signal will hold the combinational value
  comb = this.addInternal('comb', 1);

  C = this.addOutput('C', 1);

  describe() {
    const {A, B, C, clock} = this;

    this.combinationalProcess([
      comb.setTo(A.and(B).inverse())
    ]);

    this.synchronousProcess(Edge.Positive, clock, [
      C.setTo(comb)
    ]);
  }
}
```

In this arrangement, the logic gate is acting as a combinational circuit, but the output value is still only updated synchronously according to the clock.

### Syntax Semantics

`gateware-ts` is embedded into TypeScript/JavaScript, and as such is bound to the syntax and abstractions of the language. A block of combinational logic is expressed as an `Array` of `BlockElement`s. A `BlockElement` is one of the following kinds of constructs:

- `If` - an if block (which may contain `ElseIf`s and a final `Else`), where a signal is evaluated as a logical `0` or `1`, and a branch taken as a result
- `Switch` - a switch block, where a signal is evaluated, activating one of a series of `Case`s blocks
- `Assignment` - where the value of a signal is assigned to be the result of operations on other signals

To make sure the point about syntax is clear, an `If` element is actually a function call, taking a signal to be evaluated, and an array of `BlockElement`s that represent the "true" branch. What this function returns is an implementation detail, but in essence it is an object with an `ElseIf` method, as well as an `Else` method, that act in much the same way. These objects represent the logic, and are later translated into a lower-level HDL language called Verilog.

### Submodules

The examples we've looked at so far present a module with inputs and outputs, but there is nothing *driving* the inputs (deciding which values they take on). Modules need a parent module that *wires* the inputs and outputs together with it's own signals, and the signals of other modules. These are said to be submodules of the parent.

There is a moment where the rubber needs to meet the road so to speak, where one parent module does not have a parent. This is the top level module, and it's inputs and outputs must connect to the real world. Most of the time, this via the physical pins of an FPGA. Different FPGAs have different ways of mapping signal names to physical pins, but somewhere along the way, the inputs and outputs of the top level module will correspond to those pins.

Below is an example of a parent module that makes use of the `NANDGate`:

```typescript
class ParentModule extends GWModule {
  // This module has a 2-bit signal as it's input
  AB = this.addInput('AB', 2);

  // We will split AB into two internal signals
  A = this.addInternal('A', 1);
  B = this.addInternal('B', 1);

  // And a 1-bit signal for it's output
  // Note: modules can have multiple outputs, all with different widths
  C = this.addOutput('C', 1);

  describe() {
    const {AB, A, B, C} = this;

    // Instaniate a module
    const nand = new NANDGate('nand');

    // Wire up it's inputs. We don't need to specify outputs, as can they
    // can be used directly in blocks or as inputs to other modules
    this.addSubmodule(nand, 'uartRx', { A, B });

    // Describe how all of the signals relate to each other
    this.combinationalProcess([
      A.setTo(AB.bit(0)),
      B.setTo(AB.bit(1)),
      C.setTo(nand.C)
    ]);
  }
}
```

As you can see, you can simply instaniate another module and add it to the parent. When adding a submodule, you need to specify what signals will be routed to the module's inputs. Its outputs can be used in process blocks just like any other signal.

The process of wiring submodules together is one of the most pleasant aspects of `gateware-ts`. Compared to how this is done in verilog (the language `gateware-ts` compiles down to), it's remarkably simpler.

## Parallelism

It's common when discussing HDLs and FPGAs to hear something like "This is hardware, you can't think of it like software. Everything is parallel. If you think about it like software bad things will happen".

It *is* something you need to understand, but I also think that you don't need to drop all of your software engineering skills.

The most important thing to wrap your head around is that all of the `BlockElement`s translate into some kind of electrical circuit element. As mental model, you can think of these being collections of logic gates and dedicated registers, but in FPGAs, it's typically lookup tables (LUTs). For example, an `If` turns into a multiplexer circuit, with a selection input and two output paths, one of which is activated. A `Switch` will similarly translate into one or more multiplexers. Assignments, in both synchronous and combinational processes, are essentially just defining a data path, that may end in a register for synchronous logic, or represent a symbolically named point of a circuit in combinational logic.

All of the `BlockElement`s in any given array (block) are running in parallel. Take the following example:

```typescript
If (A, [
  B.setTo(X),
  C.setTo(Y),
])
```

In this case, both `B` and `C` are taking on a new value at the same exact time - not sequentially. This makes sense when you keep in mind the translation process that is occuring. Since assignments are really just data paths, how could these effects possibly take place one after another?

Likewise, if we had the following:

```typescript
If (A, [
  B.setTo(X),
]),
If (C, [
  D.setTo(Y),
])
```

All of these `BlockElement`s are occurring in parallel. `If`s are really just multiplexers - in the simple mental model, a collection logic gates - and there isn't anything that would cause them to occur in parallel.

## Abstraction

The great thing about programming languages is that they offer facilities for abstraction - something that is unfortunately not that common in true HDLs. To see how this can be beneficial, and allow for type-safe, expressive code, let's consider a simple example:

```typescript
class AbstractionExample extends GWModule {
  // Define two 8-bit input signals
  A = this.addInput('A', 8);
  B = this.addInput('B', 8);

  // Define an 8-bit output signal
  C = this.addOutput('C', 8);

  describe() {
    const {A, B, C} = this;

    this.combinationalProcess([
      C.setTo(A ['+'] (B))
    ]);
  }
}
```

If we try to compile this example to verilog, gateware-ts will throw an error, stating that `A + B` cannot be assigned to `C` because they have different *widths*. When you add two signals together, it actually produces a signal that is 1-bit wider than `A` or `B`, because addition produces a carry. Often it is desirable for addition to simply overflow and remain the original width. Since gateware-ts lives inside a programming language, we can just write a function:

```typescript
const addNoCarry = (a: BaseSignalReference, b: BaseSignalReference) => (
  a.add(b).slice(a.width - 1, 0)
);
```

This function takes two signals of type `BaseSignalReference` - meaning it can be any kind of signal (including the result of other operations, like concatenation, logic operations, comparrisons, etc) - and returns the result of adding them, and taking a *slice* of the result. Just like in an `Array`, `.slice` allows you to create a new signal that uses a subset of the original bits, and is specified from most significant bit index to least. The slice that is taken is always 1-bit narrower than the width of `a` (`b` must have the same width as `a`, otherwise this would also throw an error). The result is addition whose carry bit is dropped.

Now we can simply use this function within the hardware module:

```typescript
class AbstractionExample extends GWModule {
  A = this.addInput('A', 8);
  B = this.addInput('B', 8);
  C = this.addOutput('C', 8);

  describe() {
    const {A, B, C} = this;

    this.combinationalProcess([
      C.setTo(addNoCarry(A, B))
    ]);
  }
}
```

