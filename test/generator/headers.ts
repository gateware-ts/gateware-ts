import * as mocha from 'mocha';
import * as chai from 'chai';
import { Signal } from './../../src/signals';
import { CodeGenerator } from './../../src/generator/index';
import { GWModule, Edge } from '../../src/index';

const expect = chai.expect;

export default () => {
  it('should correctly generate for no signals', () => {
    class UUT extends GWModule {
      describe() {
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);
    expect(result.code.header).to.eq('module UUT();');
  });

  it('should correctly generate for input signals', () => {
    class UUT extends GWModule {
      in1 = this.input(Signal());
      in2 = this.input(Signal());
      describe() {
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);
    expect(result.code.header).to.eq([
      'module UUT(',
      '  input in1,',
      '  input in2',
      ');'
    ].join('\n'));
  });

  it('should correctly generate for output signals', () => {
    class UUT extends GWModule {
      out1 = this.output(Signal());
      out2 = this.output(Signal());
      describe() {
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);
    expect(result.code.header).to.eq([
      'module UUT(',
      '  output out1,',
      '  output out2',
      ');'
    ].join('\n'));
  });

  it('should correctly generate for input and output signals', () => {
    class UUT extends GWModule {
      in1 = this.input(Signal());
      in2 = this.input(Signal());
      out1 = this.output(Signal());
      out2 = this.output(Signal());
      describe() {
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);
    expect(result.code.header).to.eq([
      'module UUT(',
      '  input in1,',
      '  input in2,',
      '  output out1,',
      '  output out2',
      ');'
    ].join('\n'));
  });

  it('should correctly generate ignore internal signals', () => {
    class UUT extends GWModule {
      in1 = this.input(Signal());
      in2 = this.input(Signal());
      out1 = this.output(Signal());
      out2 = this.output(Signal());

      internalSignal = this.internal(Signal());

      describe() {
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);
    expect(result.code.header).to.eq([
      'module UUT(',
      '  input in1,',
      '  input in2,',
      '  output out1,',
      '  output out2',
      ');'
    ].join('\n'));
  });

  it('should not use a register type for combinational-driven outputs', () => {
    class UUT extends GWModule {
      o = this.output(Signal());
      describe() {
        this.combinationalLogic([
          this.o ['='] (1)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);
    expect(result.code.header).to.eq([
      'module UUT(',
      '  output o',
      ');'
    ].join('\n'));
  });

  it('should use a register type for sync-driven outputs', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      o = this.output(Signal());
      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          this.o ['='] (1)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);
    expect(result.code.header).to.eq([
      'module UUT(',
      '  input clk,',
      '  output reg o',
      ');'
    ].join('\n'));
  });

  it('should use a register type for sync-driven outputs', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      o = this.output(Signal());
      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          this.o ['='] (1)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);
    expect(result.code.header).to.eq([
      'module UUT(',
      '  input clk,',
      '  output reg o',
      ');'
    ].join('\n'));
  });

  it('should use generate the correct widths for multibit signals', () => {
    class UUT extends GWModule {
      a = this.input(Signal(4));
      o = this.output(Signal(8));
      o2 = this.output(Signal(16));
      describe() {
        this.syncBlock(this.a, Edge.Positive, [
          this.o2 ['='] (1)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);
    expect(result.code.header).to.eq([
      'module UUT(',
      '  input [3:0] a,',
      '  output [7:0] o,',
      '  output reg [15:0] o2',
      ');'
    ].join('\n'));
  });
};
