import { OneShotDebouncerTB } from './one-shot-debounce-tb';
import {createOneShotDebouncer} from './one-shot-debouncer';
import { GWModule, Signal, Edge, If, HIGH, CodeGenerator, Constant, nanoseconds, microseconds } from '../../src/index';

export const minimumBitsToFit = n => Math.ceil(Math.log2(n));

const OneShotDebouncer = createOneShotDebouncer();

const LED_BITS = minimumBitsToFit(4);
class LedCycle extends GWModule {
  clk = this.input(Signal());
  rst = this.input(Signal());
  next = this.input(Signal());
  prev = this.input(Signal());

  ledToOutput = this.internal(Signal(LED_BITS));

  l1 = this.output(Signal());
  l2 = this.output(Signal());
  l3 = this.output(Signal());
  l4 = this.output(Signal());

  onReset() {
    return [
      this.ledToOutput ['='] (Constant(LED_BITS, 0b00)),
    ];
  }

  onNext() {
    return [
      this.ledToOutput ['='] (
        this.ledToOutput ['+'] (1)
      )
    ];
  }

  onPrev() {
    return [
      this.ledToOutput ['='] (
        this.ledToOutput ['-'] (1)
      )
    ];
  }

  describe() {
    this.combinationalLogic([
      this.l1 ['='] (this.ledToOutput ['=='] (0)),
      this.l2 ['='] (this.ledToOutput ['=='] (1)),
      this.l3 ['='] (this.ledToOutput ['=='] (2)),
      this.l4 ['='] (this.ledToOutput ['=='] (3)),
    ]);

    this.syncBlock(this.clk, Edge.Positive, [
      // Make a decision: Is the next, prev, or reset signal asserted?
      If (this.rst ['=='] (HIGH),
        this.onReset()
      ) .ElseIf (this.next ['=='] (HIGH),
        this.onNext()
      ) .ElseIf (this.prev ['=='] (HIGH),
        this.onPrev()
      )
    ]);
  }
}

class Top extends GWModule {
  CLK = this.input(Signal());
  BTN1 = this.input(Signal());
  BTN2 = this.input(Signal());
  BTN3 = this.input(Signal());

  LED2 = this.output(Signal());
  LED3 = this.output(Signal());
  LED4 = this.output(Signal());
  LED5 = this.output(Signal());

  describe() {
    const ledCycle = new LedCycle();
    const nextDebounced = new OneShotDebouncer();
    const rstDebounced = new OneShotDebouncer();
    const prevDebounced = new OneShotDebouncer();

    this.addSubmodule(nextDebounced, 'nextDebounced', {
      inputs: {
        clk: this.CLK,
        in: this.BTN1
      },
      outputs: {
        o: [ledCycle.next]
      }
    });

    this.addSubmodule(prevDebounced, 'prevDebounced', {
      inputs: {
        clk: this.CLK,
        in: this.BTN3
      },
      outputs: {
        o: [ledCycle.prev]
      }
    });

    this.addSubmodule(rstDebounced, 'rstDebounced', {
      inputs: {
        clk: this.CLK,
        in: this.BTN2
      },
      outputs: {
        o: [ledCycle.rst]
      }
    });

    this.addSubmodule(ledCycle, 'ledCycle', {
      inputs: {
        clk: this.CLK,
        rst: rstDebounced.o,
        next: nextDebounced.o,
        prev: prevDebounced.o
      },
      outputs: {
        l1: [this.LED2],
        l2: [this.LED4],
        l3: [this.LED3],
        l4: [this.LED5],
      }
    })
  }
}

const cg = new CodeGenerator(new Top('top'));
cg.buildBitstream('one-shot-debouncer');

const testBench = new OneShotDebouncerTB();
const tbCg = new CodeGenerator(testBench, {
  simulation: {
    enabled: true,
    timescale: [ microseconds(1), nanoseconds(10) ]
  }
});

tbCg.runSimulation('one-shot-debouncer', 'one-shot-debouncer.vcd');
