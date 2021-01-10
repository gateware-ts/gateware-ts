import { Signedness, Edge } from './../../src/main-types';
import { Case, Constant, Default, GWModule, HIGH, If, LOW, Not, Signal, Switch } from "../../src/index";

const rndName = () => Math.random().toString(36).slice(2);

export const createDebouncer = (DEBOUNCE_COUNTER_BITS:number = 21) => {
  class Debounce extends GWModule {
    clk = this.input(Signal());
    i = this.input(Signal());
    li1 = this.internal(Signal());
    li2 = this.internal(Signal());
    counter = this.internal(Signal(DEBOUNCE_COUNTER_BITS, Signedness.Unsigned, 0));
    o = this.output(Signal());

    describe() {
      this.combinationalLogic([
        this.o ['='] (Not(this.li2) ['&'] (this.li1))
      ]),

      this.syncBlock(this.clk, Edge.Positive, [
        this.counter ['='] (this.counter ['+'] (1)),

        // HIGH
        If (this.counter ['=='] (Constant(DEBOUNCE_COUNTER_BITS, ((1 << (DEBOUNCE_COUNTER_BITS-1))))), [
          this.li1 ['='] (this.i),
          this.li2 ['='] (this.li1),
        ]),
      ])
    }
  }

  enum SinglePulseStates {
    /* 0 */ WAIT,
    /* 1 */ PULSE,
    /* 2 */ COUNTDOWN,
  }
  class SinglePulse extends GWModule {
    clk = this.input(Signal());
    i = this.input(Signal());
    prev = this.internal(Signal(1, Signedness.Unsigned, 0));
    state = this.internal(Signal(2, Signedness.Unsigned, SinglePulseStates.WAIT));
    counter = this.internal(Signal(DEBOUNCE_COUNTER_BITS-1, Signedness.Unsigned, 0));
    o = this.output(Signal());

    describe() {
      this.syncBlock(this.clk, Edge.Positive, [
        Switch (this.state, [
          Case (SinglePulseStates.WAIT, [
            this.prev ['='] (this.i),
            If (this.prev ['=='] (LOW) ['&'] (this.i ['=='] (HIGH)), [
              this.state ['='] (SinglePulseStates.PULSE),
              this.o ['='] (HIGH)
            ])
          ]),

          Case (SinglePulseStates.PULSE, [
            this.state ['='] (SinglePulseStates.COUNTDOWN),
            this.o ['='] (LOW),
            this.counter ['='] ((1 << DEBOUNCE_COUNTER_BITS) - 1)
          ]),

          Case (SinglePulseStates.COUNTDOWN, [
            this.counter ['='] (this.counter ['-'] (1)),
            If (this.counter ['=='] (0), [
              this.state ['='] (SinglePulseStates.WAIT),
            ])
          ]),

          Default ([
            this.state ['='] (SinglePulseStates.WAIT)
          ])
        ])
      ]);
    }
  }

  return class DebounceParent extends GWModule {
    clk = this.input(Signal());
    i = this.input(Signal());
    o = this.output(Signal());

    describe() {
      const singlePulse = new SinglePulse();
      const debounce = new Debounce();
      this.addSubmodule(singlePulse, `singlePulse${rndName()}`, {
        inputs: {
          clk: this.clk,
          i: debounce.o
        },
        outputs: {
          o: [this.o]
        }
      });

      this.addSubmodule(debounce, `debounce${rndName()}`, {
        inputs: {
          clk: this.clk,
          i: this.i
        },
        outputs: {
          o: [singlePulse.i]
        }
      });
    }
  }
};
