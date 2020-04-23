import {
  GWModule,
  Signal,
  LOW,
  HIGH,
  Concat,
  Edge,
  BlockStatement,
  Switch,
  Case,
  If,
  Bit,
  Ternary,
  Not,
} from '../../src/index';
import {
  CLOCK_CYCLES_PER_BIT,
  CLOCK_CYCLES_TILL_MID,
  uSignal,
  minimumBitsToFit,
  inc
} from './common';
import { SevenSegmentDriver } from "../seven-segment-driver/seven-segment-driver";

enum RXStates {
  Idle,
  ReceiveStartBit,
  Bit1,
  Bit2,
  Bit3,
  Bit4,
  Bit5,
  Bit6,
  Bit7,
  Bit8,
  EmitByte,
  ReceiveStopBit,
};


export class UART_RX extends GWModule {
  clk = this.input(uSignal());
  in = this.input(uSignal());

  out = this.output(uSignal(8));
  valid = this.output(uSignal());
  debug = this.output(uSignal());

  inSync = this.internal(uSignal(2, 0b11));
  rx = this.internal(uSignal(1, 1));
  count = this.internal(uSignal(minimumBitsToFit(CLOCK_CYCLES_PER_BIT)));
  state = this.internal(uSignal(minimumBitsToFit(12))); // 12 different states
  bit = this.internal(uSignal(minimumBitsToFit(8), 0));

  onIdle():BlockStatement[] {
    return [
      If (this.rx ['=='] (LOW), [
        this.state ['='] (RXStates.ReceiveStartBit),
      ]),
      this.valid ['='] (LOW)
    ];
  }

  onReceiveStartBit():BlockStatement[] {
    return [
      // Reset what we have in the shift register
      this.out ['='] (0),

      If (this.count ['!='] (CLOCK_CYCLES_TILL_MID), [
        inc(this.count)
      ])
      .Else ([
        this.count ['='] (0),
        this.state ['='] (RXStates.Bit1),
      ])
    ];
  }

  onReceiveBit(bitIndex:number, nextState:RXStates):BlockStatement[] {
    return [
      If (this.count ['!='] (CLOCK_CYCLES_PER_BIT), [
        inc(this.count)
      ]) .Else ([
        // Reset the counter
        this.count ['='] (0),

        // Shift this bit
        this.out ['='] (this.out ['|'] (this.rx ['<<'] (bitIndex))),

        // Go to the next state
        this.state ['='] (nextState),
      ])
    ];
  }

  onReceiveStopBit():BlockStatement[] {
    return [
      If (this.count ['!='] (CLOCK_CYCLES_PER_BIT), [
        inc(this.count),
      ]) .Else ([
        this.count ['='] (0),
        this.state ['='] (RXStates.EmitByte),
      ])
    ];
  }

  onEmitByte():BlockStatement[] {
    return [
      this.valid ['='] (HIGH),
      this.state ['='] (RXStates.Idle),
    ];
  }

  describe() {
    this.syncBlock(this.clk, Edge.Positive, [
      // Double flop the input rx signal
      this.inSync ['='] (Concat([ Bit(this.inSync, 0), this.in ])),
      this.rx ['='] (Ternary(
        Bit(this.inSync, 0) ['=='] (Bit(this.inSync, 1)),
        Bit(this.inSync, 0),
        this.rx
      )),

      Switch(this.state, [
        Case(RXStates.Idle, this.onIdle()),
        Case(RXStates.ReceiveStartBit, this.onReceiveStartBit()),
        Case(RXStates.Bit1, this.onReceiveBit(0, RXStates.Bit2)),
        Case(RXStates.Bit2, this.onReceiveBit(1, RXStates.Bit3)),
        Case(RXStates.Bit3, this.onReceiveBit(2, RXStates.Bit4)),
        Case(RXStates.Bit4, this.onReceiveBit(3, RXStates.Bit5)),
        Case(RXStates.Bit5, this.onReceiveBit(4, RXStates.Bit6)),
        Case(RXStates.Bit6, this.onReceiveBit(5, RXStates.Bit7)),
        Case(RXStates.Bit7, this.onReceiveBit(6, RXStates.Bit8)),
        Case(RXStates.Bit8, this.onReceiveBit(7, RXStates.ReceiveStopBit)),
        Case(RXStates.ReceiveStopBit, this.onReceiveStopBit()),
        Case(RXStates.EmitByte, this.onEmitByte())
      ])
    ]);
  }
}

class DataLatch extends GWModule {
  clk = this.input(uSignal());
  in = this.input(uSignal(8));
  enabled = this.input(uSignal());

  lowNibble = this.output(uSignal(4));
  highNibble = this.output(uSignal(4));

  o = this.internal(uSignal(8));
  ssSelector = this.output(uSignal());

  describe() {
    this.combinationalLogic([
      this.lowNibble ['='] (this.o.slice(3, 0)),
      this.highNibble ['='] (this.o.slice(7, 4)),
    ]);

    this.syncBlock(this.clk, Edge.Positive, [
      If (this.enabled ['=='] (HIGH), [
        this.o ['='] (this.in),
      ]),
      this.ssSelector ['='] (Not(this.ssSelector))
    ]);
  }
}

const Mux2xN = N => class extends GWModule {
  sel = this.input(Signal());
  a = this.input(Signal(N));
  b = this.input(Signal(N));
  o = this.output(Signal(N));

  describe() {
    this.combinationalLogic([
      this.o ['='] (Ternary(this.sel ['=='] (LOW),
        this.a,
        this.b
      ))
    ]);
  }
}
const Mux2x4 = Mux2xN(4);

export class Top extends GWModule {
  CLK = this.input(uSignal());
  RX = this.input(uSignal());

  P1A1 = this.output(uSignal());
  P1A2 = this.output(uSignal());
  P1A3 = this.output(uSignal());
  P1A4 = this.output(uSignal());
  P1A7 = this.output(uSignal());
  P1A8 = this.output(uSignal());
  P1A9 = this.output(uSignal());
  P1A10 = this.output(uSignal());
  LED1 = this.output(uSignal());
  LED2 = this.output(uSignal());

  describe() {
    const uart = new UART_RX();
    const latch = new DataLatch();
    const mux = new Mux2x4('Mux2x4');
    const ssDriver = new SevenSegmentDriver();

    this.addSubmodule(uart, 'uart', {
      inputs: {
        clk: this.CLK,
        in: this.RX
      },
      outputs: {
        valid: [latch.enabled],
        out: [latch.in],
      }
    });

    this.addSubmodule(latch, 'dataLatch', {
      inputs: {
        clk: this.CLK,
        in: uart.out,
        enabled: uart.valid
      },
      outputs: {
        lowNibble: [mux.a],
        highNibble: [mux.b],
        ssSelector: [this.P1A10, mux.sel]
      }
    });

    this.addSubmodule(mux, 'mux', {
      inputs: {
        a: latch.lowNibble,
        b: latch.highNibble,
        sel: latch.ssSelector
      },
      outputs: {
        o: [ssDriver.byte]
      }
    });

    this.addSubmodule(ssDriver, 'ssDriver', {
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
    })
  }
}
