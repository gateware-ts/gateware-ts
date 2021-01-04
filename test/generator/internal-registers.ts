import { MODULE_CODE_ELEMENTS } from './../../src/constants';
import * as mocha from 'mocha';
import * as chai from 'chai';
import { Signal } from '../../src/signals';
import { CodeGenerator } from '../../src/generator/index';
import { GWModule, Edge, Signedness } from '../../src/index';

const expect = chai.expect;

describe('internalRegisters', () => {
  it('should correctly generate for no signals', () => {
    class UUT extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      describe() {
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.internalRegisters).to.eq('');
  });

  it('should generate wires for internal signals that are not driven', () => {
    class UUT extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      int = this.internal(Signal());

      describe() {
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.internalRegisters).to.eq('  wire int;');
  });

  it('should generate wires for internal signals that are not driven (width >1)', () => {
    class UUT extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      int = this.internal(Signal(8));

      describe() {
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.internalRegisters).to.eq('  wire [7:0] int;');
  });

  it('should generate wires for internal signals that are combinationally driven', () => {
    class UUT extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      int = this.internal(Signal());

      describe() {
        this.combinationalLogic([
          this.int ['='] (1)
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.internalRegisters).to.eq('  wire int;');
  });

  it('should generate registers for internal signals that are sequentially driven', () => {
    class UUT extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      int = this.internal(Signal());

      describe() {
        this.syncBlock(this.in, Edge.Positive, [
          this.int ['='] (1)
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.internalRegisters).to.eq('  reg int;');
  });

  it('should generate registers for internal signals that are sequentially driven (width >1)', () => {
    class UUT extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      int = this.internal(Signal(8));

      describe() {
        this.syncBlock(this.in, Edge.Positive, [
          this.int ['='] (1)
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.internalRegisters).to.eq('  reg [7:0] int;');
  });

  it('should correctly generate initial values in the initial block when an internal signal is sequentially driven', () => {
    class UUT extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      int = this.internal(Signal(1, Signedness.Unsigned, 1));

      describe() {
        this.syncBlock(this.in, Edge.Positive, [
          this.int ['='] (1)
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.initialBlock).to.eq([
      '  initial begin',
      '    int = 1;',
      '  end'
    ].join('\n'));
  });

  it('should not generate initial values in the initial block when an internal signal is combinationally driven', () => {
    class UUT extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      int = this.internal(Signal());

      describe() {
        this.combinationalLogic([
          this.int ['='] (1)
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.initialBlock).to.eq('');
  });
});
