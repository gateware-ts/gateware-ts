import {
  GWModule,
  Edge,
  Signal,
  LOW,
  HIGH,
  Bit,
  Switch,
  Case,
  If,
} from '../../src/index';

enum OneShotStates {
  Waiting,
  DebouncePush,
  Emit,
  DebounceRelease
};

export const createOneShotDebouncer = (COUNTER_BITS:number = 17) => {
  console.log(`creating ${COUNTER_BITS} bit counter`);

  class OneShotDebouncer extends GWModule {
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
              this.state ['='] (OneShotStates.DebouncePush),
              this.o ['='] (LOW)
            ])
          ]),

          Case (OneShotStates.DebouncePush, [
            If (this.in.eq(LOW), [
              this.counter ['='] (0),
              this.state ['='] (OneShotStates.Waiting)
            ])
            .Else ([
              If (Bit(this.counter, COUNTER_BITS - 1).eq(LOW), [
                this.counter ['='] ( this.counter ['+'] (1) ),
              ])
              .Else ([
                this.o ['='] (HIGH),
                this.state ['='] (OneShotStates.Emit)
              ])
            ])
          ]),

          Case (OneShotStates.Emit, [
            this.o ['='] (LOW),
            this.state ['='] (OneShotStates.DebounceRelease)
          ]),

          Case(OneShotStates.DebounceRelease, [
            If (this.in.eq(HIGH), [
              this.counter ['='] (0)
            ])
            .Else ([
              If (Bit(this.counter, COUNTER_BITS - 1).eq(0), [
                this.counter ['='] (this.counter ['+'] (1))
              ])
              .Else ([
                this.state ['='] (OneShotStates.Waiting)
              ])
            ])
          ])
        ])
      ]);
    }
  }

  return OneShotDebouncer;
}
