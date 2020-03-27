import {writeFile} from 'fs';
import { CodeGenerator } from './../../src/generator/index';
import { Ternary, Not } from './../../src/operational-expressions';
import { SevenSegmentDriver } from './seven-segment-driver';
import { GWModule, Signal, Edge, If, SignalT } from '../../src/index';

class Counter extends GWModule {
  clk = this.input(Signal());
  delayCounter = this.internal(Signal(22));
  counter = this.output(Signal(8));

  describe() {
    this.syncBlock(this.clk, Edge.Positive, [
      this.delayCounter ['='] (this.delayCounter ['+'] (1)),
      If (this.delayCounter ['=='] (0), [
        this.counter ['='] (this.counter ['+'] (1))
      ])
    ])
  }
}

class Selector extends GWModule {
  clk = this.input(Signal());
  byteInput = this.input(Signal(8));
  digitSelector = this.output(Signal());
  nibbleOutput = this.output(Signal(4));

  describe() {
    this.syncBlock(this.clk, Edge.Positive, [
      this.digitSelector ['='] (Not(this.digitSelector)),
      this.nibbleOutput ['='] (Ternary(
        this.digitSelector ['=='] (0),
        this.byteInput.slice(7, 4),
        this.byteInput.slice(3, 0)
      ))
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
    const ssDriver = new SevenSegmentDriver();
    const counter = new Counter();
    const selector = new Selector();

    this.addSubmodule(counter, 'counter', {
      inputs: { clk: this.CLK },
      outputs: { counter: [selector.byteInput] }
    });

    this.addSubmodule(selector, 'selector', {
      inputs: {
        clk: this.CLK,
        byteInput: counter.counter
      },
      outputs: {
        nibbleOutput: [ssDriver.byte],
        digitSelector: [this.P1A10]
      }
    });

    this.addSubmodule(ssDriver, 'ssDriver', {
      inputs: {
        clk: this.CLK,
        byte: selector.nibbleOutput
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

const cg = new CodeGenerator(new Top('top'));
cg.buildBitstream('seven-segment-display');