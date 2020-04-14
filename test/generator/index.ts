import * as mocha from 'mocha';
import headers from './headers';
import internalRegisters from './internal-registers';
import signals from './signals';

describe('generator', () => {
  describe('headers', headers);
  describe('internalRegisters', internalRegisters);
  describe('signals', signals);
})