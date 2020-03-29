import { LOW, HIGH } from './../../src/signals';
import { createOneShotDebouncer } from './one-shot-debouncer';
import { GWModule, Signal, Not, edges, Edge, assert, display, If } from '../../src/index';

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

    this.simulation.run([
      pulse(),

      assert(this.out ['=='] (LOW), [
        'Test failed - sending an output pulse before triggered'
      ]),

      this.trigger ['='] (HIGH),
      pulse((1 << (COUNTER_BITS - 1)) - 1),

      assert(this.out ['=='] (LOW), [ 'Test failed - output went high too early!' ]),
      pulse(2),
      this.trigger ['='] (LOW),
      pulse(),
      assert(this.out ['=='] (HIGH), [ 'Test failed - output not high when it should be' ]),

      pulse(),
      assert(this.out ['=='] (LOW), [ 'Test failed - output was high for longer than one clock cycle' ]),

      display("Test passed!")
    ])
  }
}