import { flatten } from './../../src/helpers';
import { SimulationExpression } from './../../src/main-types';
import {
  GWModule,
  Edge,
  LOW,
  HIGH,
  Not,
  edges,
  display,
  edge,
  If,
  assert
} from "../../src/index";
import { CLOCK_CYCLES_PER_BIT, uSignal } from './common';
import { UART_TX } from './uart-tx';

const VALUE_TO_BE_TRANSMITTED = 0x37;

// Helper to get a bit from a byte at an index
const getBitOfByte = (byte:number, bit:number) => (byte & (1 << bit)) >> bit;

export class UART_TX_TestBench extends GWModule {
  clk = this.input(uSignal());
  sendEnabled = this.input(uSignal());
  txByte = this.input(uSignal(8, VALUE_TO_BE_TRANSMITTED));

  // Counter is just to assist with debugging in the waveforms
  counter = this.input(uSignal(10));

  txLine = this.output(uSignal());
  valid = this.output(uSignal());

  describe() {
    const uut = new UART_TX();

    this.addSubmodule(uut, 'uartTx', {
      inputs: {
        clk: this.clk,
        sendEnable: this.sendEnabled,
        byte: this.txByte
      },
      outputs: {
        txOut: [this.txLine]
      }
    });

    // Create an edge on the clock every 5 nanoseconds
    this.simulation.everyTimescale(5, [
      this.clk ['='] (Not(this.clk)),
      If (this.clk ['=='] (0), [
        this.counter ['='] (this.counter ['+'] (1))
      ])
    ]);

    // Function to create clock cycles lasting an entire bit period
    const pulseClockForPeriod  = () => edges(CLOCK_CYCLES_PER_BIT, Edge.Positive, this.clk);

    const assertBitReceived = (bit:number):SimulationExpression => (
      assert(
        this.txLine ['=='] (getBitOfByte(VALUE_TO_BE_TRANSMITTED, bit)),
        [
          `Test failed - tx line failed to the ${bit}th bit. Counter = %h`,
          this.counter
        ]
      )
    )

    this.simulation.run([
      edge(Edge.Positive, this.clk),

      this.sendEnabled ['='] (HIGH),
      edge(Edge.Positive, this.clk),
      this.sendEnabled ['='] (LOW),
      edge(Edge.Positive, this.clk),

      assert(this.txLine ['=='] (LOW), [
        'Test failed - tx line failed to send start bit'
      ]),

      ...flatten(Array.from({length: 8}, (_, i) => [
        pulseClockForPeriod(),
        assertBitReceived(i),
      ])),

      pulseClockForPeriod(),
      assert(this.txLine ['=='] (HIGH), [
        'Test failed - tx line failed to send stop bit'
      ]),

      display("Test passed!")
    ])
  }
}
