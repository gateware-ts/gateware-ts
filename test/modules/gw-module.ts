import { MODULE_CODE_ELEMENTS } from './../../src/constants';
import * as mocha from 'mocha';
import * as chai from 'chai';
import { Signal } from './../../src/signals';
import { CodeGenerator } from './../../src/generator/index';
import { GWModule, Edge } from '../../src/index';

const expect = chai.expect;

describe('gateware-ts modules', () => {
  it('should correctly find and process a named input signal', () => {
    class UUT extends GWModule {
      something = this.output(Signal());
      describe() {
      }
    }

    const m = new UUT();
    m.createInput('clk', Signal());

    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error(`Shouldn't happen`);
    }

    expect(result.code.header).to.eq([
      'module UUT(',
      '  input clk,',
      '  output something',
      ');'
    ].join('\n'));
  });

  it('should correctly find and process a named output signal', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      describe() {
      }
    }

    const m = new UUT();
    m.createOutput('led', Signal());

    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error(`Shouldn't happen`);
    }

    expect(result.code.header).to.eq([
      'module UUT(',
      '  input clk,',
      '  output led',
      ');'
    ].join('\n'));
  });

  it('should throw an error when a signal already exists with a given name', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      describe() {
      }
    }

    const m = new UUT();

    expect(() => {
      m.createInput('clk', Signal());
    }).to.throw(`UUT.clk already exists`);
  });
});
