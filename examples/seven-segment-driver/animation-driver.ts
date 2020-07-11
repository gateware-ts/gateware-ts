import { CodeGenerator } from '../../src/generator/index';
import { Not, Constant } from '../../src/signals';
import { GWModule, Signal, Edge, If, Switch, Default, Case } from '../../src/index';

class Frame extends GWModule {
  clk = this.input(Signal());
  sel = this.input(Signal());

  out = this.internal(Signal(7));
  frame = this.internal(Signal(14));
  counter = this.internal(Signal(4));
  delayCounter = this.internal(Signal(22));

  a = this.output(Signal());
  b = this.output(Signal());
  c = this.output(Signal());
  d = this.output(Signal());
  e = this.output(Signal());
  f = this.output(Signal());
  g = this.output(Signal());

  describe() {
    const frameToCase = (n, next, frame) => Case(n, [
      this.frame ['='] (Constant(14, frame)),
      this.counter ['='] (next)
    ]);

    this.syncBlock(this.clk, Edge.Positive, [
      this.delayCounter ['='] (this.delayCounter ['+'] (1)),

      If (this.delayCounter ['=='] (0), [
        Switch (this.counter, [
          frameToCase(0,  1,  0b10000001000000),
          frameToCase(1,  2,  0b00000001100000),
          frameToCase(2,  3,  0b00000000100001),
          frameToCase(3,  4,  0b00000010000001),
          frameToCase(4,  5,  0b00001010000000),
          frameToCase(5,  6,  0b00011000000000),
          frameToCase(6,  7,  0b00010000001000),
          frameToCase(7,  8,  0b00000000011000),
          frameToCase(8,  9,  0b00000000010001),
          frameToCase(9,  10, 0b00000010000001),
          frameToCase(10, 11, 0b00000110000000),
          frameToCase(11, 0,  0b10000100000000),

          Default([ this.counter ['='] (0) ])
        ])
      ])
    ])

    this.combinationalLogic([
      this.out ['='] (Not(this.sel.ternary(
        this.frame.slice(6, 0),
        this.frame.slice(13, 7)
      ))),
      this.a ['='] (this.out.bit(6)),
      this.b ['='] (this.out.bit(5)),
      this.c ['='] (this.out.bit(4)),
      this.d ['='] (this.out.bit(3)),
      this.e ['='] (this.out.bit(2)),
      this.f ['='] (this.out.bit(1)),
      this.g ['='] (this.out.bit(0)),
    ])
  }
}

class Selector extends GWModule {
  clk = this.input(Signal());
  digitSelector = this.output(Signal());

  describe() {
    this.syncBlock(this.clk, Edge.Positive, [
      this.digitSelector ['='] (Not(this.digitSelector)),
    ]);
  }
}

class Top extends GWModule {
  CLK = this.input(Signal());
  P1A1 = this.output(Signal());
  P1A2 = this.output(Signal());
  P1A3 = this.output(Signal());
  P1A4 = this.output(Signal());
  P1A7 = this.output(Signal());
  P1A8 = this.output(Signal());
  P1A9 = this.output(Signal());
  P1A10 = this.output(Signal());

  describe() {
    const frame = new Frame();
    const selector = new Selector();

    this.addSubmodule(frame, 'frame', {
      inputs: {
        clk: this.CLK,
        sel: selector.digitSelector
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

    this.addSubmodule(selector, 'selector', {
      inputs: {
        clk: this.CLK,
      },
      outputs: {
        digitSelector: [this.P1A10, frame.sel]
      }
    });
  }
}

const cg = new CodeGenerator(new Top('top'));
cg.buildBitstream('seven-segment-animation');