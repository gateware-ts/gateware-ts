import {
  GWModule,
  Signal,
  LOW,
  HIGH,
  Edge,
  BlockExpression,
  Bit,
  Not,
  Ternary,
  Switch,
  Case,
  If,
} from '../../src/index';

import { OneShotDebouncer } from "../one-shot-debouncer";
import { SevenSegmentDriver } from "../seven-segment-driver";
import { CLOCK_CYCLES_PER_BIT, uSignal, minimumBitsToFit, inc } from './common';

enum TXStates {
  Idle,
  SendStartBit,
  Bit1,
  Bit2,
  Bit3,
  Bit4,
  Bit5,
  Bit6,
  Bit7,
  Bit8,
  SendStopBit,
};
export class UART_TX extends GWModule {
  clk = this.input(uSignal());
  sendEnable = this.input(uSignal());
  byte = this.input(uSignal(8));

  txOut = this.output(uSignal(1, 1)); // Normally high

  latchedByte = this.internal(uSignal(8));
  state = this.internal(uSignal(minimumBitsToFit(11), TXStates.Idle));
  counter = this.internal(uSignal(minimumBitsToFit(CLOCK_CYCLES_PER_BIT)));

  onIdle():BlockExpression[] {
    return [
      // We're ready to receive and have data ready to send
      If (this.sendEnable['=='](HIGH), [
        // Next state
        this.state ['='] (TXStates.SendStartBit),
        // Latch the data byte so we don't have to worry about it
        // changing while sending
        this.latchedByte ['='] (this.byte),
        // Ensure the counter is at 0
        this.counter ['='] (0)
      ])
    ];
  }

  onSendStartBit():BlockExpression[] {
    return [
      // The start bit is a low signal for the entire duration
      this.txOut ['='] (LOW),

      If (this.counter ['<'] (CLOCK_CYCLES_PER_BIT - 1), [
        inc(this.counter)
      ])
      .Else ([
        // Reset the counter
        this.counter ['='] (0),
        // Goto the first bit state
        this.state ['='] (TXStates.Bit1),

        // Already set the first bit
        this.txOut ['='] (Bit(this.latchedByte, 0))
      ])
    ];
  }

  onSendBit(bitIndex:number, nextState:TXStates):BlockExpression[] {
    return [

      If (this.counter ['<'] (CLOCK_CYCLES_PER_BIT - 1), [
        // Assert bit value is latchedByte[bitIndex] for the whole period
        this.txOut ['='] (Bit(this.latchedByte, bitIndex)),
        inc(this.counter)
      ])
      .Else ([
        // Reset the counter
        this.counter ['='] (0),
        // Goto the next state
        this.state ['='] (nextState),

        // Already set the first bit if we have one
        ...(bitIndex < 7 ? [
          this.txOut ['='] (Bit(this.latchedByte, bitIndex + 1))
        ] : [])
      ])
    ];
  }

  onSendStopBit():BlockExpression[] {
    return [
      // The start bit is a low signal for the entire duration
      this.txOut ['='] (HIGH),

      If (this.counter ['<'] (CLOCK_CYCLES_PER_BIT - 1), [
        inc(this.counter)
      ])
      .Else ([
        // Reset the counter
        this.counter ['='] (0),
        // Goto the first bit state
        this.state ['='] (TXStates.Idle)
      ])
    ];
  }

  describe() {
    this.syncBlock(this.clk, Edge.Positive, [
      Switch(this.state, [
        Case (TXStates.Idle, this.onIdle()),
        Case (TXStates.SendStartBit, this.onSendStartBit()),
        Case (TXStates.Bit1, this.onSendBit(0, TXStates.Bit2)),
        Case (TXStates.Bit2, this.onSendBit(1, TXStates.Bit3)),
        Case (TXStates.Bit3, this.onSendBit(2, TXStates.Bit4)),
        Case (TXStates.Bit4, this.onSendBit(3, TXStates.Bit5)),
        Case (TXStates.Bit5, this.onSendBit(4, TXStates.Bit6)),
        Case (TXStates.Bit6, this.onSendBit(5, TXStates.Bit7)),
        Case (TXStates.Bit7, this.onSendBit(6, TXStates.Bit8)),
        Case (TXStates.Bit8, this.onSendBit(7, TXStates.SendStopBit)),
        Case (TXStates.SendStopBit, this.onSendStopBit()),
      ])
    ])
  }
}

class ByteTracker extends GWModule {
  clk = this.input(Signal());
  up = this.input(Signal());
  down = this.input(Signal());
  toggleEditable = this.input(Signal());

  byte1 = this.output(Signal(4));
  byte2 = this.output(Signal(4));
  byte = this.output(Signal(8));
  selected = this.internal(Signal());

  describe() {
    this.combinationalLogic([
      this.byte1.setTo(this.byte.slice(3, 0)),
      this.byte2.setTo(this.byte.slice(7, 4))
    ]);

    this.syncBlock(this.clk, Edge.Positive, [
      If (this.selected.eq(LOW), [
        If (this.up.eq(HIGH), [ this.byte ['='] (this.byte ['+'] (0x01)) ]),
        If (this.down.eq(HIGH), [ this.byte ['='] (this.byte ['-'] (0x01)) ]),
      ]). Else ([
        If (this.up.eq(HIGH), [ this.byte ['='] (this.byte ['+'] (0x10)) ]),
        If (this.down.eq(HIGH), [ this.byte ['='] (this.byte ['-'] (0x10)) ]),
      ]),

      If (this.toggleEditable.eq(HIGH), [
        this.selected ['='] (Not(this.selected))
      ])
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
      this.o ['='] (Ternary(this.sel.eq(LOW),
        this.a,
        this.b
      ))
    ]);
  }
}

const Mux2x4 = Mux2xN(4);

class Selector extends GWModule {
  clk = this.input(Signal());
  o = this.output(Signal());

  describe() {
    this.syncBlock(this.clk, Edge.Positive, [
      this.o ['='] (Not(this.o))
    ]);
  }
}

class Top extends GWModule {
  CLK = this.input(Signal());
  BTN_N = this.input(Signal());
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
  TX = this.output(Signal());

  describe() {
    const sendBtnDebounce = new OneShotDebouncer();
    const btn1Debounce = new OneShotDebouncer();
    const btn2Debounce = new OneShotDebouncer();
    const btn3Debounce = new OneShotDebouncer();
    const byteTracker = new ByteTracker();
    const selectorMod = new Selector();
    const mux = new Mux2x4('Mux2x4');
    const SSDriver = new SevenSegmentDriver();
    const uartTx = new UART_TX();

    this.addSubmodule(sendBtnDebounce, 'sendBtnDebounce', {
      inputs: {
        clk: this.CLK,
        in: this.BTN_N,
      },
      outputs: {
        o: [uartTx.sendEnable]
      }
    });

    this.addSubmodule(uartTx, 'uartTx', {
      inputs: {
        clk: this.CLK,
        sendEnable: sendBtnDebounce.o,
        byte: byteTracker.byte
      },
      outputs: {
        txOut: [this.TX],
      }
    });

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
        byte2: [mux.b],
        byte: [uartTx.byte]
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
