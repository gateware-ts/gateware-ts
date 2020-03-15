import {
  GWModule,
  Signal,
  Constant,
  Edge,
  Bit,
  Switch,
  Case,
  Default,
} from '../src/index';

const SevenSegValues = [1, 79, 18, 6, 76, 36, 32, 15, 0, 4, 8, 96, 49, 66, 48, 56].map(n => Constant(7, n));

export class SevenSegmentDriver extends GWModule {
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
    this.combinationalLogic([
      this.a ['='] (Bit(this.o, 6)),
      this.b ['='] (Bit(this.o, 5)),
      this.c ['='] (Bit(this.o, 4)),
      this.d ['='] (Bit(this.o, 3)),
      this.e ['='] (Bit(this.o, 2)),
      this.f ['='] (Bit(this.o, 1)),
      this.g ['='] (Bit(this.o, 0)),
    ]);

    this.syncBlock(this.clk, Edge.Positive, [
      Switch(this.byte, [
        ...SevenSegValues.map((SevenSegmentValue, i) =>
          Case(Constant(4, i), [ this.o ['='] (SevenSegmentValue) ])
        ),

        Default([ this.o ['='] (Constant(7, 0b1111111)) ])
      ])
    ])
  }
}
