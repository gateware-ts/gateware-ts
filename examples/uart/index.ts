import {writeFile} from 'fs';
import * as path from 'path';

import { CodeGenerator } from '../../src/index';
import { nanoseconds, picoseconds } from '../../src/simulation';
import { UART_TX } from './uart-tx';
import { UART_RX } from './uart-rx';
import { UART_RX_TestBench } from './uart-rx_tb';
import { UART_TX_TestBench } from './uart-tx_tb';

const uartRx = new UART_RX();
const uartRxTestbench = new UART_RX_TestBench();

const rxCg = new CodeGenerator(uartRx);
const rxTbCg = new CodeGenerator(uartRxTestbench, { simulation: {
  enabled: true,
  timescale: [ nanoseconds(1), picoseconds(10) ]
} });

const uartTx = new UART_TX();
const uartTxTestbench = new UART_TX_TestBench();

const txCg = new CodeGenerator(uartTx);
const txTbCg = new CodeGenerator(uartTxTestbench, { simulation: {
  enabled: true,
  timescale: [ nanoseconds(1), picoseconds(10) ]
} });

const rxv = rxCg.toVerilog();
const rxtbv = rxTbCg.toVerilog();
const txv = txCg.toVerilog();
const txtbv = txTbCg.toVerilog();


writeFile(path.join('/tmp', 'uart-rx.v'), rxv, err => {
  if (err) {
    throw err;
  }
  writeFile(path.join('/tmp', 'uart-rx_tb.v'), rxtbv, err => {
    if (err) {
      console.log(2)
      throw err;
    }
    console.log('wrote rx module & testbench');
  });
});

writeFile(path.join('/tmp', 'uart-tx.v'), txv, err => {
  if (err) {
    console.log(3)
    throw err;
  }
  writeFile(path.join('/tmp', 'uart-tx_tb.v'), txtbv, err => {
    if (err) {
      console.log(4)
      throw err;
    }
    console.log('wrote tx module & testbench');
  });
});