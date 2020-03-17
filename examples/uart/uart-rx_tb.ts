import { SimulationExpression } from './../../src/main-types';
import { UART_RX } from './uart-rx';
import {
  GWModule,
  Not,
  Edge,
  LOW,
  Constant,
  SIf,
  edges,
  display,
  edge,
  assert
} from "../../src/index";
import { CLOCK_CYCLES_PER_BIT, uSignal } from './common';

export class UART_RX_TestBench extends GWModule {
  clk = this.input(uSignal());
  rx = this.input(uSignal(1, 1));
  out = this.output(uSignal(8));
  valid = this.output(uSignal());

  describe() {
    const uut = new UART_RX();

    this.addSubmodule(uut, 'uartRx', {
      inputs: {
        clk: this.clk,
        in: this.rx,
      },
      outputs: {
        out: [this.out],
        valid: [this.valid],
      }
    });

    this.simulation.everyTimescale(5, [
      this.clk ['='] (Not(this.clk))
    ])

    const pulseClockForPeriod = edges(CLOCK_CYCLES_PER_BIT, Edge.Positive, this.clk);

    const sendByte = (byte:number) => {
      const out:SimulationExpression[] = [];
      for (let i = 0; i < 8; i++) {
        out.push(
          // Send a bit
          this.rx ['='] ((byte & (1 << i)) >> i),
          // Pulse the clock for one bit CLOCK_CYCLES_PER_BIT
          pulseClockForPeriod
        )
      }
      return out;
    }

    this.simulation.run([
      // Pulse the clock
      edge(Edge.Positive, this.clk),
      // Start bit
      this.rx ['='] (LOW),
      pulseClockForPeriod,
      ...sendByte(0x37),

      assert(this.out ['=='] (Constant(8, 0x37)), [
        "Test failed - Incorrect Byte Received"
      ]),

      display("Test Passed - Correct Byte Received")
    ])
  }
}
