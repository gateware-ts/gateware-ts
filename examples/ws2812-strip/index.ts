import { CodeGenerator } from './../../src/generator/index';
import { Not, Signedness, HIGH, Switch, Case, Default, Constant, LOW, edge, microseconds, nanoseconds, picoseconds, Concat, Ternary } from './../../src/index';
import { GWModule, Signal, Edge, If } from '../../src/index';
import { SB_PLL40_PAD } from '../../vendor-modules/lattice-ice40/SB_PLL40_PAD';
import { ParamString } from '../../src/vendor-module';
import { createDebouncer } from './debouncer';

// WS2812B Timing
const ZERO_HIGH_TIME = 24-1;
const ZERO_LOW_TIME = 51-1;
const ONE_HIGH_TIME = 48-1;
const ONE_LOW_TIME = 27-1;
// I found the reset timing found to require a higher minimum than the data sheet states
const RESET_TIME = (3000) * 1.25;

const TOTAL_BIT_TIME = ZERO_HIGH_TIME + ZERO_LOW_TIME;

enum BitEncoderStates {
  /* 0 */ READY_AND_WAITING,
  /* 1 */ SEND_ZERO_HIGH,
  /* 2 */ SEND_ZERO_LOW,
  /* 3 */ SEND_ONE_HIGH,
  /* 4 */ SEND_ONE_LOW,
}
class BitEncoder extends GWModule {
  clk = this.input(Signal());
  bit = this.input(Signal());
  senderReady = this.input(Signal());

  state = this.internal(Signal(3, Signedness.Unsigned, BitEncoderStates.READY_AND_WAITING));
  counter = this.internal(Signal(6));

  ack = this.output(Signal());
  data = this.output(Signal());

  describe() {

    this.syncBlock(this.clk, Edge.Positive, [

      Switch(this.state, [

        Case(BitEncoderStates.READY_AND_WAITING, [
          // Always reset the counter in this state
          this.counter ['='] (0),

          // If the module feeding us the bit is ready, change state
          If (this.senderReady, [
            this.ack ['='] (HIGH),

            // Depending on whether we're sending a one or a zero, we enter
            // a certain state
            If (this.bit, [
              this.state ['='] (BitEncoderStates.SEND_ONE_HIGH)
            ]) .Else ([
              this.state ['='] (BitEncoderStates.SEND_ZERO_HIGH)
            ]),

            // In either case, we can immediately start sending a high signal
            // on the data line, because the WS2812 encoding for both 1 and 0
            // starts high for a period of time
            this.data ['='] (HIGH)
          ]) .Else([
            // Otherwise, wait in the ready state
            this.state ['='] (BitEncoderStates.READY_AND_WAITING),
            this.data ['='] (LOW)
          ])
        ]),

        Case(BitEncoderStates.SEND_ZERO_HIGH, [
          this.ack ['='] (LOW),

          If (this.counter ['=='] (ZERO_HIGH_TIME), [
            // Send a low signal on the data line
            this.data ['='] (LOW),

            // Reset the counter
            this.counter ['='] (0),

            // Go to the SEND_ZERO_LOW state
            this.state ['='] (BitEncoderStates.SEND_ZERO_LOW)
          ]) .Else ([
            this.data ['='] (HIGH),
            // Increment the counter
            this.counter ['='] (this.counter ['+'] (1))
          ])
        ]),

        Case(BitEncoderStates.SEND_ZERO_LOW, [
          this.ack ['='] (LOW),
          this.data ['='] (LOW),

          If (this.counter ['=='] (ZERO_LOW_TIME), [
            this.state ['='] (BitEncoderStates.READY_AND_WAITING),
            this.counter ['='] (0),
          ]) .Else ([
            this.counter ['='] (this.counter ['+'] (1)),
          ])
        ]),

        Case(BitEncoderStates.SEND_ONE_HIGH, [
          this.ack ['='] (LOW),

          If (this.counter ['=='] (ONE_HIGH_TIME), [
            // Send a low signal on the data line
            this.data ['='] (LOW),

            // Reset the counter
            this.counter ['='] (0),

            // Go to the SEND_ONE_LOW state
            this.state ['='] (BitEncoderStates.SEND_ONE_LOW)
          ]) .Else ([
            // Increment the counter
            this.counter ['='] (this.counter ['+'] (1)),
            this.data ['='] (HIGH),
          ])
        ]),

        Case(BitEncoderStates.SEND_ONE_LOW, [
          this.ack ['='] (LOW),
          this.data ['='] (LOW),

          If (this.counter ['=='] (ONE_LOW_TIME), [
            this.state ['='] (BitEncoderStates.READY_AND_WAITING),
            this.counter ['='] (0),
          ]) .Else ([
            this.counter ['='] (this.counter ['+'] (1))
          ])
        ]),

        Default([
          this.state ['='] (BitEncoderStates.READY_AND_WAITING),
          this.ack ['='] (LOW),
        ])
      ])
    ]);

  }
}

// Given a byte and a ready signal, send out the encoded bits on the data line
enum ByteStreamStates {
  /* 0 */ WAIT_FOR_SENDER,
  /* 1 */ READY,
  /* 2 */ SHIFT_DATA,
  /* 3 */ CHECK_BIT_COUNT,
}
class ByteStream extends GWModule {
  clk = this.input(Signal());
  senderReady = this.input(Signal());
  byte = this.input(Signal(8));
  receiveAck = this.input(Signal());

  state = this.internal(Signal(3));
  latchedByte = this.internal(Signal(8));
  bitCount = this.internal(Signal(4));

  bitToSend = this.output(Signal());
  ack = this.output(Signal());
  ready = this.output(Signal());

  describe() {
    this.combinationalLogic([
      this.bitToSend ['='] (this.latchedByte.bit(7)),
    ]);

    this.syncBlock(this.clk, Edge.Positive, [
      Switch (this.state, [

        Case (ByteStreamStates.WAIT_FOR_SENDER, [
          // We're not ready
          this.ready ['='] (LOW),

          this.bitCount ['='] (0),

          If (this.senderReady, [
            // Acknowledge the sender module
            this.ack ['='] (HIGH),

            // Latch the input
            this.latchedByte ['='] (this.byte),

            // Move to the ready state
            this.state ['='] (ByteStreamStates.READY)
          ])
        ]),

        Case (ByteStreamStates.READY, [
          // Stop acknowledging the sender
          this.ack ['='] (LOW),

          // In the ready state we can advertise that we're ready
          this.ready ['='] (HIGH),

          // Wait for the receiver to acknowledge their latch
          If (this.receiveAck, [
            // Goto the next state
            this.state ['='] (ByteStreamStates.SHIFT_DATA),

            // Increment the bit count
            this.bitCount ['='] (this.bitCount ['+'] (1)),
          ])
        ]),

        Case (ByteStreamStates.SHIFT_DATA, [
          // While we're shifting/checking the bit count
          // the receiving module should consider us busy
          this.ready ['='] (LOW),

          // Shift the bits
          this.latchedByte ['='] (Concat([ this.latchedByte.slice(6, 0), LOW ])),

          // Goto the next state
          this.state ['='] (ByteStreamStates.CHECK_BIT_COUNT)
        ]),

        Case (ByteStreamStates.CHECK_BIT_COUNT, [
          // When the counter reaches 8
          If (this.bitCount.bit(3), [
            // We need a new byte to send
            this.state ['='] (ByteStreamStates.WAIT_FOR_SENDER),
          ]) .Else ([
            // Goto the ready to send next bit state
            this.state ['='] (ByteStreamStates.READY),
          ])
        ]),

        Default ([
          this.state ['='] (ByteStreamStates.WAIT_FOR_SENDER),
        ])
      ])
    ]);
  }
}

class ByteStreamParent extends GWModule {
  clk = this.input(Signal());
  byte = this.input(Signal(8));
  senderReady = this.input(Signal());

  data = this.output(Signal());
  ack = this.output(Signal());

  describe() {
    const bitEncoder = new BitEncoder();
    const byteStream = new ByteStream();

    this.addSubmodule(byteStream, 'byteStream', {
      inputs: {
        clk: this.clk,
        senderReady: this.senderReady,
        byte: this.byte,
        receiveAck: bitEncoder.ack
      },
      outputs: {
        bitToSend: [bitEncoder.bit],
        ack: [this.ack],
        ready: [bitEncoder.senderReady],
      }
    });

    this.addSubmodule(bitEncoder, 'bitEncoder', {
      inputs: {
        clk: this.clk,
        bit: byteStream.bitToSend,
        senderReady: byteStream.ready
      },
      outputs: {
        ack: [byteStream.receiveAck],
        data: [this.data],
      }
    });

  }
}

enum RGBStreamStates {
  /* 0 */ WAIT_FOR_SENDER,
  /* 1 */ BYTE_READY,
  /* 2 */ SHIFT_BYTE,
  /* 3 */ CHECK_BYTE_COUNT,
}
class RGBStream extends GWModule {
  clk = this.input(Signal());
  senderReady = this.input(Signal());
  rgb = this.input(Signal(24));
  receiveAck = this.input(Signal());

  state = this.internal(Signal(2));
  latchedRGB = this.internal(Signal(24));
  byteCount = this.internal(Signal(2));

  byteToSend = this.output(Signal(8));
  ack = this.output(Signal());
  ready = this.output(Signal());

  describe() {
    this.combinationalLogic([
      // We're always sending the most significant byte of our 24 bits
      this.byteToSend ['='] (this.latchedRGB.slice(23, 16)),
    ]);

    this.syncBlock(this.clk, Edge.Positive, [

      Switch (this.state, [
        Case (RGBStreamStates.WAIT_FOR_SENDER, [
          // We're not ready
          this.ready ['='] (LOW),
          this.byteCount ['='] (0),

          If (this.senderReady, [
            // Acknowledge the sender module
            this.ack ['='] (HIGH),

            // Latch the input
            this.latchedRGB ['='] (this.rgb),

            // Move to the ready state
            this.state ['='] (RGBStreamStates.BYTE_READY)
          ])
        ]),

        Case (RGBStreamStates.BYTE_READY, [
          this.ready ['='] (HIGH),

          If (this.receiveAck, [
            this.state ['='] (RGBStreamStates.SHIFT_BYTE),
            this.byteCount ['='] (this.byteCount ['+'] (1))
          ])
        ]),

        Case (RGBStreamStates.SHIFT_BYTE, [
          this.ready ['='] (LOW),
          this.latchedRGB ['='] (this.latchedRGB ['<<'] (8)),
          this.state ['='] (RGBStreamStates.CHECK_BYTE_COUNT),
        ]),

        Case (RGBStreamStates.CHECK_BYTE_COUNT, [
          If (this.byteCount.bit(0) ['&'] (this.byteCount.bit(1)), [
            this.state ['='] (RGBStreamStates.WAIT_FOR_SENDER)
          ]) .Else ([
            this.state ['='] (RGBStreamStates.BYTE_READY)
          ])
        ]),

        Default([
          this.state ['='] (RGBStreamStates.WAIT_FOR_SENDER)
        ])
      ])
    ]);
  }
}

class RGBStreamParent extends GWModule {
  clk = this.input(Signal());
  senderReady = this.input(Signal());
  rgb = this.input(Signal(24));

  data = this.output(Signal());
  ack = this.output(Signal());

  describe() {
    const byteStream = new ByteStreamParent();
    const rgbStream = new RGBStream();

    this.addSubmodule(rgbStream, 'rgbStream', {
      inputs: {
        clk: this.clk,
        senderReady: this.senderReady,
        rgb: this.rgb,
        receiveAck: byteStream.ack,
      },
      outputs: {
        byteToSend: [byteStream.byte],
        ack: [this.ack],
        ready: [byteStream.senderReady],
      }
    });

    this.addSubmodule(byteStream, 'byteStream', {
      inputs: {
        clk: this.clk,
        senderReady: rgbStream.ready,
        byte: rgbStream.byteToSend,
      },
      outputs: {
        ack: [rgbStream.receiveAck],
        data: [this.data],
      }
    });
  }
}

enum SingleLightTimingControlStates {
  /* 0 */ START,
  /* 1 */ WAIT,
  /* 2 */ READY,
  /* 3 */ COLOR,
  /* 4 */ BLANKING,
}
class SingleLightTimingControl extends GWModule {
  clk = this.input(Signal());
  receiveAck = this.input(Signal());
  clkReady = this.input(Signal());
  isLit = this.input(Signal());

  counter = this.internal(Signal(21));
  cycleCounter = this.internal(Signal(20));
  state = this.internal(Signal(3));
  isLitLatch = this.internal(Signal());
  g = this.internal(Signal(8, Signedness.Unsigned, 0x00));
  r = this.internal(Signal(8, Signedness.Unsigned, 0xFF));
  b = this.internal(Signal(8, Signedness.Unsigned, 0x00));
  bitCount = this.internal(Signal(3));

  ready = this.output(Signal());
  rgb = this.output(Signal(24));

  describe() {
    const assignRGB = this.rgb ['='] (Ternary(
      this.isLitLatch,
      Constant(24, 0),
      Concat([ this.g, this.r, this.b ]),
    ));

    this.combinationalLogic([
      assignRGB,
    ]);

    this.syncBlock(this.clk, Edge.Positive, [
      this.isLitLatch ['='] (this.isLit),

      Switch (this.state, [

        Case (SingleLightTimingControlStates.START, [
          this.state ['='] (SingleLightTimingControlStates.WAIT),
        ]),

        Case (SingleLightTimingControlStates.WAIT, [
          If (this.clkReady, [
            this.state ['='] (SingleLightTimingControlStates.READY),
          ])
        ]),

        Case (SingleLightTimingControlStates.READY, [
          this.ready ['='] (HIGH),
          this.counter ['='] (0),

          If (this.receiveAck, [
            this.state ['='] (SingleLightTimingControlStates.COLOR),
          ])
        ]),

        Case (SingleLightTimingControlStates.COLOR, [
          this.ready ['='] (LOW),

          // TOTAL_BIT_TIME * BITS_PER_BYTE * BYTES_PER_COLOR + State transiitions for each bit
          If (this.counter ['=='] ((TOTAL_BIT_TIME * 8 * 3) + (8 * 3)), [
            If (this.bitCount ['=='] (0b011), [ //  (0b111), [
              this.state ['='] (SingleLightTimingControlStates.BLANKING),
              this.counter ['='] (0),
              this.bitCount ['='] (0)
            ]) .Else ([
              this.bitCount ['='] (this.bitCount ['+'] (1)),
              this.state ['='] (SingleLightTimingControlStates.READY)
            ]),
          ]) .Else ([
            this.counter ['='] (this.counter ['+'] (1))
          ])
        ]),

        Case (SingleLightTimingControlStates.BLANKING, [
          If (this.counter ['=='] (RESET_TIME), [
            this.state ['='] (SingleLightTimingControlStates.READY),
          ]) .Else ([
            this.counter ['='] (this.counter ['+'] (1))
          ])
        ]),

        Default ([
          // this.state ['='] (SingleLightTimingControlStates.WAIT)
          this.state ['='] (SingleLightTimingControlStates.START)
        ])
      ])
    ]);
  }
}

class PLL extends GWModule {
  clkIn = this.input(Signal());
  lock = this.output(Signal());
  clkOut = this.output(Signal());

  describe() {
    const pll = new SB_PLL40_PAD('pll', {
      FEEDBACK_PATH: ParamString('SIMPLE'),
      DIVR: Constant(4, 0),
      DIVF: Constant(7, 79),
      DIVQ: Constant(3, 4),
      FILTER_RANGE: Constant(3, 1),
      ENABLE_ICEGATE: Constant(1, 0),
      PLLOUT_SELECT: ParamString("GENCLK"),
      DELAY_ADJUSTMENT_MODE_FEEDBACK: ParamString("FIXED"),
    });

    this.addVendorModule(pll, 'pll', {
      inputs: {
        PACKAGEPIN: this.clkIn,
        RESETB: Constant(1, 1),
        BYPASS: Constant(1, 0),
      },
      outputs: {
        PLLOUTGLOBAL: [this.clkOut],
        LOCK: [this.lock]
      }
    })
  }
}

class Inverter extends GWModule {
  i = this.input(Signal());
  o = this.output(Signal());

  describe() {
    this.combinationalLogic([
      this.o ['='] (Not(this.i))
    ])
  }
}

class BrightnessValue extends GWModule {
  clk = this.input(Signal());
  btnPulse = this.input(Signal());
  value = this.internal(Signal(4, Signedness.Unsigned, 0x0));
  counter = this.internal(Signal(4, Signedness.Unsigned, 0x0));
  selfCounter = this.internal(Signal(8, Signedness.Unsigned, 0x0));
  isLit = this.output(Signal());

  describe() {
    this.combinationalLogic([
      this.isLit ['='] (this.counter ['<='] (this.value))
    ]);

    this.syncBlock(this.clk, Edge.Positive, [
      this.counter ['='] (this.counter ['+'] (1)),
      this.selfCounter ['='] (this.selfCounter ['+'] (1)),

      If (this.btnPulse ['=='] (HIGH), [
      // If (this.btnPulse ['=='] (HIGH) .or (this.selfCounter ['=='] (0)), [
        this.value ['='] (this.value ['+'] (0x1))
      ]) .Else ([
        this.value ['='] (this.value)
      ])
    ]);
  }
}

const SinglePulseDebouncer = createDebouncer(21);

class SingleLightTimingControlParent extends GWModule {
  CLK = this.input(Signal());
  BTN1 = this.input(Signal());
  P1A1 = this.output(Signal());
  P1A2 = this.output(Signal());
  P1A3 = this.output(Signal());
  LEDR_N = this.output(Signal());
  LEDG_N = this.output(Signal());
  LED1 = this.output(Signal());

  describe() {
    const singleLightTimingControl = new SingleLightTimingControl();
    const rgbStream = new RGBStreamParent();
    const pll = new PLL();
    const clkDiv = new ClkDownscaler();

    const pllLockInverter = new Inverter();
    const osd = new SinglePulseDebouncer();
    const brightnessValue = new BrightnessValue();

    this.combinationalLogic([
      this.LED1 ['='] (this.BTN1)
    ]);

    this.addSubmodule(pllLockInverter, 'pllLockInverter', {
      inputs: {
        i: pll.lock
      },
      outputs: {
        o: [singleLightTimingControl.clkReady]
      }
    });

    this.addSubmodule(osd, 'osd', {
      inputs: {
        clk: pll.clkOut,
        i: this.BTN1
      },
      outputs: {
        o: [brightnessValue.btnPulse]
      }
    });

    this.addSubmodule(brightnessValue, 'brightnessValue', {
      inputs: {
        clk: pll.clkOut,
        btnPulse: osd.o
      },
      outputs: {
        isLit: [singleLightTimingControl.isLit]
      }
    });

    this.addSubmodule(pll, 'pll', {
      inputs: {
        clkIn: this.CLK
      },
      outputs: {
        clkOut: [
          singleLightTimingControl.clk,
          rgbStream.clk,
          clkDiv.clk,
          brightnessValue.clk
        ],
        lock: [singleLightTimingControl.clkReady],
      }
    });

    this.addSubmodule(clkDiv, 'clkDiv', {
      inputs: {
        clk: pll.clkOut
      },
      outputs: {
        clkOut: [this.LEDG_N]
      }
    });

    this.addSubmodule(singleLightTimingControl, 'singleLightTimingControl', {
      inputs: {
        clk: pll.clkOut,
        clkReady: pllLockInverter.o,
        receiveAck: rgbStream.ack,
        isLit: brightnessValue.isLit
      },
      outputs: {
        ready: [rgbStream.senderReady],
        rgb: [rgbStream.rgb],
      }
    });

    this.addSubmodule(rgbStream, 'rgbStream', {
      inputs: {
        clk: pll.clkOut,
        senderReady: singleLightTimingControl.ready,
        rgb: singleLightTimingControl.rgb,
      },
      outputs: {
        data: [this.P1A1],
        ack: [singleLightTimingControl.receiveAck],
      }
    });
  }
}

// Simulation module for the RGB controller
class SimRGBStream extends GWModule {
  clk = this.input(Signal());
  senderReady = this.input(Signal());
  rgb = this.input(Signal(24));

  // Helps read the waveforms
  counter = this.input(Signal(12));

  datax = this.output(Signal());
  data = this.output(Signal());
  ack = this.output(Signal());

  describe() {
    const rgbStream = new RGBStreamParent();

    this.addSubmodule(rgbStream, 'rgbStream', {
      inputs: {
        clk: this.clk,
        senderReady: this.senderReady,
        rgb: this.rgb,
      },
      outputs: {
        data: [this.data],
        ack: [this.ack],
      }
    });

    // Create an edge on the clock every 17 nanoseconds
    this.simulation.everyTimescale(16.6666667, [
      this.clk ['='] (Not(this.clk)),
      If (this.clk ['=='] (1), [
        this.counter ['='] (this.counter ['+'] (1))
      ])
    ]);

    const edges = n => Array.from({length: n}, () => edge(Edge.Positive, this.clk));

    this.simulation.run([
      edge(Edge.Positive, this.clk),

      this.rgb ['='] (Concat([
        Constant(8, 0xFF), // G
        Constant(8, 0x00), // R
        Constant(8, 0x00), // B
      ])),

      this.senderReady ['='] (HIGH),

      ...edges((TOTAL_BIT_TIME * 8 * 3) + (TOTAL_BIT_TIME * 8))
    ]);
  }
}

// This is here mainly to provide some visible feedback for the PLL timing
class ClkDownscaler extends GWModule {
  clk = this.input(Signal());
  counter = this.internal(Signal(25));
  clkOut = this.output(Signal());

  describe() {
    this.combinationalLogic([
      this.clkOut.setTo(this.counter.bit(24))
    ]);
    this.syncBlock(this.clk, Edge.Positive, [
      this.counter.setTo(this.counter.plus(1))
    ]);
  }
}

const cg = new CodeGenerator(new SingleLightTimingControlParent('top'), {});

cg.buildBitstream('with-inverter', false);

// const testBench = new SimRGBStream();
// const tbCg = new CodeGenerator(testBench, {
//   simulation: {
//     enabled: true,
//     timescale: [ microseconds(1), nanoseconds(10) ]
//   }
// });
// tbCg.runSimulation('ws2812-rgb-stream', 'ws2812-rgb-stream.vcd', false);


// Module 1 -> timed data
// Byte Sending
// RGB Stream
// ...
// Serial Port talk computer