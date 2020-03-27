import { CodeGenerator } from '../../src/index';
import { nanoseconds, picoseconds } from '../../src/simulation';
import { Top as TopTx } from './uart-tx';
import { Top as TopRx } from './uart-rx';
import { UART_RX_TestBench } from './uart-rx_tb';
import { UART_TX_TestBench } from './uart-tx_tb';

const uartTx = new TopTx();
const uartRx = new TopRx();
const uartTxTestbench = new UART_TX_TestBench();
const uartRxTestbench = new UART_RX_TestBench();

const simulationOptions = {
  simulation: {
    enabled: true,
    timescale: [ nanoseconds(1), picoseconds(10) ]
  }
};

const txCg = new CodeGenerator(uartTx);
const rxCg = new CodeGenerator(uartRx);
const txTbCg = new CodeGenerator(uartTxTestbench, simulationOptions);
const rxTbCg = new CodeGenerator(uartRxTestbench, simulationOptions);


txTbCg.runSimulation('uart-tx-sim', 'uart-tx.vcd');
rxTbCg.runSimulation('uart-rx-sim', 'uart-rx.vcd');
rxCg.buildBitstream('uart-rx', false).catch(console.log);
txCg.buildBitstream('uart-tx', false).catch(console.log);
