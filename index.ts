import { TSHDLModule } from "./hdl-module";
import { Signal, Constant, LOW, HIGH } from "./signals";
import { Edge } from "./main-types";
import { CodeGenerator } from './generator/index';
import { Bit, Not, Ternary } from './operational-expressions';
import { Switch, Case, Default, If } from "./block-expressions";

enum OneShotStates { Waiting, DebouncePush, Emit, DebounceRelease };
const COUNTER_BITS = 17;

class OneShotDebouncer extends TSHDLModule {
  clk = this.input(Signal());
  in = this.input(Signal());
  o = this.output(Signal());

  counter = this.internal(Signal(COUNTER_BITS));
  state = this.internal(Signal(3));

  describe() {
    this.syncBlock(this.clk, Edge.Positive, [
      Switch (this.state, [

        Case (OneShotStates.Waiting, [
          If (this.in.eq(HIGH), [
            this.state.setTo(OneShotStates.DebouncePush),
            this.o.setTo(LOW)
          ])
        ]),

        Case (OneShotStates.DebouncePush, [
          If (this.in.eq(LOW), [
            this.counter.setTo(0),
            this.state.setTo(OneShotStates.Waiting)
          ]). Else ([
            If (Bit(this.counter, COUNTER_BITS - 1).eq(LOW), [
              this.counter.setTo( this.counter.plus(1) )
            ]). Else ([
              this.o.setTo(HIGH),
              this.state.setTo(OneShotStates.Emit)
            ])
          ])
        ]),

        Case (OneShotStates.Emit, [
          this.o.setTo(LOW),
          this.state.setTo(OneShotStates.DebounceRelease)
        ]),

        Case(OneShotStates.DebounceRelease, [
          If (this.in.eq(HIGH), [
            this.counter.setTo(0)
          ]). Else ([
            If (Bit(this.counter, COUNTER_BITS - 1).eq(0), [
              this.counter.setTo(this.counter.plus(1))
            ]). Else ([
              this.state.setTo(OneShotStates.Waiting)
            ])
          ])
        ])
      ])
    ]);
  }
}

class ByteTracker extends TSHDLModule {
  clk = this.input(Signal());
  up = this.input(Signal());
  down = this.input(Signal());
  toggleEditable = this.input(Signal());

  byte1 = this.output(Signal(4));
  byte2 = this.output(Signal(4));
  doubleByte = this.internal(Signal(8));
  selected = this.internal(Signal());

  describe() {
    this.assignContinuous(this.byte1, this.doubleByte.slice(3, 0));
    this.assignContinuous(this.byte2, this.doubleByte.slice(7, 4));

    this.syncBlock(this.clk, Edge.Positive, [
      If (this.selected.eq(LOW), [
        If (this.up.eq(HIGH), [ this.doubleByte.setTo(this.doubleByte.plus(0x01)) ]),
        If (this.down.eq(HIGH), [ this.doubleByte.setTo(this.doubleByte.minus(0x01)) ]),
      ]). Else ([
        If (this.up.eq(HIGH), [ this.doubleByte.setTo(this.doubleByte.plus(0x10)) ]),
        If (this.down.eq(HIGH), [ this.doubleByte.setTo(this.doubleByte.minus(0x10)) ]),
      ]),

      If (this.toggleEditable.eq(HIGH), [
        this.selected.setTo(Not(this.selected))
      ])
    ]);
  }
}

const Mux2xN = N => class extends TSHDLModule {
  sel = this.input(Signal());
  a = this.input(Signal(N));
  b = this.input(Signal(N));
  o = this.output(Signal(N));

  describe() {
    this.assignContinuous(this.o, Ternary(
      this.sel.eq(LOW),
      this.a,
      this.b
    ));
  }
}

const Mux2x4 = Mux2xN(4);

const SevenSegValues = [1, 79, 18, 6, 76, 36, 32, 15, 0, 4, 8, 96, 49, 66, 48, 56].map(n => Constant(7, n));
class SevenSegmentDriver extends TSHDLModule {
  clk = this.input(Signal());
  byte = this.input(Signal(4));

  o = this.internal(Signal(7));

  a = this.output(Signal());
  b = this.output(Signal());
  c = this.output(Signal());
  d = this.output(Signal());
  e = this.output(Signal());
  f = this.output(Signal());
  g = this.output(Signal());

  describe() {
    this.assignContinuous(this.a, Bit(this.o, 6));
    this.assignContinuous(this.b, Bit(this.o, 5));
    this.assignContinuous(this.c, Bit(this.o, 4));
    this.assignContinuous(this.d, Bit(this.o, 3));
    this.assignContinuous(this.e, Bit(this.o, 2));
    this.assignContinuous(this.f, Bit(this.o, 1));
    this.assignContinuous(this.g, Bit(this.o, 0));

    this.syncBlock(this.clk, Edge.Positive, [
      Switch(this.byte, [
        ...SevenSegValues.map((SevenSegmentValue, i) =>
          Case(Constant(4, i), [ this.o.setTo(SevenSegmentValue) ])
        ),

        Default([ this.o.setTo(Constant(7, 0b1111111)) ])
      ])
    ])
  }
}

class Selector extends TSHDLModule {
  clk = this.input(Signal());
  o = this.output(Signal());

  describe() {
    this.syncBlock(this.clk, Edge.Positive, [
      this.o.setTo(Not(this.o))
    ]);
  }
}

class Top extends TSHDLModule {
  CLK = this.input(Signal());
  BTN1 = this.input(Signal());
  BTN2 = this.input(Signal());
  BTN3 = this.input(Signal());
  P1A1 = this.output(Signal());
  P1A2 = this.output(Signal());
  P1A3 = this.output(Signal());
  P1A4 = this.output(Signal());
  P1A7 = this.output(Signal());
  P1A8 = this.output(Signal());
  P1A9 = this.output(Signal());
  P1A10 = this.output(Signal());

  describe() {
    const btn1Debounce = new OneShotDebouncer();
    const btn2Debounce = new OneShotDebouncer();
    const btn3Debounce = new OneShotDebouncer();
    const byteTracker = new ByteTracker();
    const selectorMod = new Selector();
    const mux = new Mux2x4('Mux2x4');
    const SSDriver = new SevenSegmentDriver();


    this.addSubmodule(btn1Debounce, 'btn1Debounce', {
      inputs: {
        clk: this.CLK,
        in: this.BTN1,
      },
      outputs: {o: [byteTracker.up]}
    });

    this.addSubmodule(btn3Debounce, 'btn3Debounce', {
      inputs: {
        clk: this.CLK,
        in: this.BTN3,
      },
      outputs: {o: [byteTracker.down]}
    });

    this.addSubmodule(btn2Debounce, 'btn2Debounce', {
      inputs: {
        clk: this.CLK,
        in: this.BTN2,
      },
      outputs: {o: [byteTracker.toggleEditable]}
    });

    this.addSubmodule(byteTracker, 'byteTracker', {
      inputs: {
        clk: this.CLK,
        up: btn1Debounce.o,
        down: btn3Debounce.o,
        toggleEditable: btn2Debounce.o,
      },
      outputs: {
        byte1: [mux.a],
        byte2: [mux.b]
      }
    });

    this.addSubmodule(selectorMod, 'selectorMod', {
      inputs: { clk: this.CLK },
      outputs: { o: [mux.sel, this.P1A10] }
    })

    this.addSubmodule(mux, 'mux', {
      inputs: {
        a: byteTracker.byte1,
        b: byteTracker.byte2,
        sel: selectorMod.o,
      },
      outputs: { o: [SSDriver.byte] }
    });

    this.addSubmodule(SSDriver, 'SSDriver', {
      inputs: {
        clk: this.CLK,
        byte: mux.o,
      },
      outputs: {
        a: [this.P1A1],
        b: [this.P1A2],
        c: [this.P1A3],
        d: [this.P1A4],
        e: [this.P1A7],
        f: [this.P1A8],
        g: [this.P1A9],
      }
    });
  }
}

const m = new Top('top');


const cg = new CodeGenerator(m);
console.log(cg.toVerilog());