import * as mocha from 'mocha';
import headers from './headers';
import internalRegisters from './internal-registers';

describe('generator', () => {
  describe('headers', headers);
  describe('internalRegisters', internalRegisters);
})