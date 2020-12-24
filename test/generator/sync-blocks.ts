import * as mocha from 'mocha';
import * as chai from 'chai';
import { MODULE_CODE_ELEMENTS } from './../../src/constants';
import { Constant, Signal, SignalArray } from '../../src/signals';
import { CodeGenerator } from '../../src/generator/index';
import { GWModule, Edge, If, Switch, Case, Default } from '../../src/index';

const expect = chai.expect;

describe('syncBlocks', () => {
  it('should correctly generate if statements (if expression)', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal(2));
      o = this.output(Signal());

      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          If (this.in ['=='] (0b00), [ this.o ['='] (0) ]),
          If (this.in ['=='] (0b11), [ this.o ['='] (0) ])
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.syncBlocks).to.eq([
      '  always @(posedge clk) begin',
      '    if (in == 0) begin',
      '      o <= 0;',
      '    end',
      '    if (in == 3) begin',
      '      o <= 0;',
      '    end',
      '  end'
    ].join('\n'));
  });

  it('should correctly generate slices of sub-expressions', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal(10));
      in2 = this.input(Signal(10));
      o = this.output(Signal());
      o2 = this.output(Signal());
      o3 = this.output(Signal());

      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          this.o ['='] (this.in ['&'] (this.in2) .slice(5, 0)),
          this.o2 ['='] (this.in ['|'] (this.in2) .slice(5, 0)),
          this.o3 ['='] (this.in ['&'] (this.in2) .slice(5, 0)),
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.syncBlocks).to.eq([
      '  always @(posedge clk) begin',
      '    o <= gwGeneratedSlice0[5:0];',
      '    o2 <= gwGeneratedSlice1[5:0];',
      '    o3 <= gwGeneratedSlice0[5:0];',
      '  end'
    ].join('\n'));

    expect(result.code.wireDeclarations).to.eq([
      '  wire [9:0] gwGeneratedSlice0;',
      '  wire [9:0] gwGeneratedSlice1;'
    ].join('\n'));

    expect(result.code.combAssigns).to.eq([
      '  assign gwGeneratedSlice0 = in & (in2);',
      '',
      '  assign gwGeneratedSlice1 = in | (in2);',
    ].join('\n'));
  });

  it('should correctly generate if statements (if-elseif expression)', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal(2));
      o = this.output(Signal());

      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          If (this.in ['=='] (0b00), [ this.o ['='] (0) ])
          .ElseIf(this.in ['=='] (0b01), [ this.o ['='] (1) ]),

          If (this.in ['=='] (0b11), [ this.o ['='] (0) ])
          .ElseIf(this.in ['=='] (0b10), [ this.o ['='] (1) ]),
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.syncBlocks).to.eq([
      '  always @(posedge clk) begin',
      '    if (in == 0) begin',
      '      o <= 0;',
      '    end',
      '    else if (in == 1) begin',
      '      o <= 1;',
      '    end',
      '    if (in == 3) begin',
      '      o <= 0;',
      '    end',
      '    else if (in == 2) begin',
      '      o <= 1;',
      '    end',
      '  end'
    ].join('\n'));
  });

  it('should correctly generate if statements (if-else expression)', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal(2));
      o = this.output(Signal());

      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          If (this.in ['=='] (0b00), [ this.o ['='] (0) ])
          .ElseIf (this.in ['=='] (0b01), [ this.o ['='] (1) ])
          .ElseIf (this.in ['=='] (0b10), [ this.o ['='] (0) ])
          .Else([ this.o ['='] (1) ]),

          If (this.in ['=='] (0b11), [ this.o ['='] (0) ])
          .Else([ this.o ['='] (1) ]),
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.syncBlocks).to.eq([
      '  always @(posedge clk) begin',
      '    if (in == 0) begin',
      '      o <= 0;',
      '    end',
      '    else if (in == 1) begin',
      '      o <= 1;',
      '    end',
      '    else if (in == 2) begin',
      '      o <= 0;',
      '    end',
      '    else begin',
      '      o <= 1;',
      '    end',
      '    if (in == 3) begin',
      '      o <= 0;',
      '    end',
      '    else begin',
      '      o <= 1;',
      '    end',
      '  end'
    ].join('\n'));
  });

  it('should disallow assigning to an input', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal(2));
      o = this.output(Signal());

      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          this.in ['='] (1)
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    expect(() => {
      cg.generateVerilogCodeForModule(m, false)
    }).to.throw('Cannot assign to an input in a synchronous block');
  });

  it('should correctly generate switch statements', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal(2));
      o = this.output(Signal(3));

      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          Switch (this.in, [
            Case (0, [ this.o ['='] (3) ]),
            Case (1, [ this.o ['='] (2) ]),
            Case (2, [ this.o ['='] (1) ]),
            Case (3, [ this.o ['='] (0) ]),
            Default ([ this.o ['='] (0b111) ])
          ])
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.syncBlocks).to.eq([
      '  always @(posedge clk) begin',
      '    case (in)',
      '      0 : begin',
      '        o <= 3;',
      '      end',
      '',
      '      1 : begin',
      '        o <= 2;',
      '      end',
      '',
      '      2 : begin',
      '        o <= 1;',
      '      end',
      '',
      '      3 : begin',
      '        o <= 0;',
      '      end',
      '',
      '      default : begin',
      '        o <= 7;',
      '      end',
      '    endcase',
      '  end'
    ].join('\n'));
  });

  it('should throw an error if a signal is driven by both synchronous and combinational logic', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal(2));
      o = this.output(Signal(3));

      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          this.o ['='] (this.in ['+'] (1))
        ]);

        this.combinationalLogic([
          this.o ['='] (this.in ['-'] (1))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    expect(() => {
      cg.generateVerilogCodeForModule(m, false);
    }).to.throw(
      'Driver-driver conflict on UUT.o. A signal cannot be driven by both syncronous and combinational logic.'
    )

  });

  it('should correctly generate signal arrays', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      value = this.input(Signal(8));
      addr = this.input(Signal(2));
      regArr = this.internal(SignalArray(8, 4));
      o = this.output(Signal(4));

      describe() {
        this.syncBlock(this.clk, Edge.Positive, [
          this.regArr.at(this.addr) ['='] (this.value),
          this.o ['='] (this.regArr.at(Constant(2, 0b01)).slice(7, 4))
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
    expect(result.code.internalRegisters).to.eq('  reg [7:0] regArr [0:3];');
    expect(result.code.syncBlocks).to.eq([
      '  always @(posedge clk) begin',
      '    regArr[addr] <= value;',
      `    o <= regArr[2'b01][7:4];`,
      '  end'
    ].join('\n'));
  });
});
