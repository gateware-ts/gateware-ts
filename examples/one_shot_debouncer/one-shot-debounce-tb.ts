import { describe, test } from './../../testware/index';
import { LOW, HIGH } from './../../src/signals';
import { createOneShotDebouncer } from './one-shot-debouncer';
import { GWModule, Signal, Not, edges, Edge, assert, display, If, CodeGenerator, microseconds, nanoseconds } from '../../src/index';

const COUNTER_BITS = 8;
const OneShotDebouncer = createOneShotDebouncer(COUNTER_BITS);

export class OneShotDebouncerTB extends GWModule {
  clk = this.input(Signal());
  trigger = this.input(Signal());
  counter = this.input(Signal(COUNTER_BITS))
  out = this.output(Signal());

  describe() {
    const pulse = (n:number = 1) => edges(n, Edge.Positive, this.clk);

    const osd = new OneShotDebouncer();
    this.addSubmodule(osd, 'osd', {
      inputs: {
        clk: this.clk,
        in: this.trigger
      },
      outputs: { o: [this.out] }
    });

    this.simulation.everyTimescale(1, [
      this.clk ['='] (Not(this.clk)),
      If (this.clk ['=='] (1), [
        this.counter ['='] (this.counter ['+'] (1))
      ])
    ]);

    this.simulation.run(
      describe("One shot debouncer", [
        test(`It shouldn't send an output pulse before it's triggered`, expect => [
          pulse(),
          expect(this.out ['=='] (LOW), '')
        ]),

        test(`It shouldn't prematurely send an output signal`, expect => [
          this.trigger ['='] (HIGH),
          pulse((1 << (COUNTER_BITS - 1)) - 1),
          expect(this.out ['=='] (LOW), ''),
        ]),

        test(`It should send an output signal at the correct time`, expect => [
          pulse(2),
          this.trigger ['='] (LOW),
          pulse(),
          expect(this.out ['=='] (HIGH), ''),
        ]),

        test(`It should only send a HIGH output signal for a single clock cycle`, expect => [
          pulse(),
          expect(this.out ['=='] (LOW), ''),
        ])
      ])
    );
  }
}

const testBench = new OneShotDebouncerTB();
const tbCg = new CodeGenerator(testBench, {
  simulation: {
    enabled: true,
    timescale: [ microseconds(1), nanoseconds(10) ]
  }
});

tbCg.runSimulation('one-shot-debouncer', 'one-shot-debouncer.vcd');
