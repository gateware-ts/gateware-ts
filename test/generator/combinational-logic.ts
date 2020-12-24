import * as mocha from 'mocha';
import * as chai from 'chai';
import { MODULE_CODE_ELEMENTS } from '../../src/constants';
import { Concat, ConcatT, Constant, Signal, SignalArray } from '../../src/signals';
import { CodeGenerator } from '../../src/generator/index';
import { GWModule, CombinationalSwitchAssignment } from '../../src/index';

const expect = chai.expect;

describe('combinationalLogic', () => {
  it('should correctly generate combinational switch statements', () => {
    class UUT extends GWModule {
      in = this.input(Signal(2));
      o = this.output(Signal(2));

      describe() {
        this.combinationalLogic([
          CombinationalSwitchAssignment(this.o, this.in, [
            [0, 3],
            [1, 2],
            [2, 1],
            [3, 0],
          ], 0)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.header).to.eq([
      'module UUT(',
      '  input [1:0] in,',
      '  output reg [1:0] o',
      ');'
    ].join('\n'));

    expect(result.code.combAlways).to.eq([
      '  always @(*) begin',
      '    case (in)',
      '      0 : begin',
      '        o = 3;',
      '      end',
      '      1 : begin',
      '        o = 2;',
      '      end',
      '      2 : begin',
      '        o = 1;',
      '      end',
      '      3 : begin',
      '        o = 0;',
      '      end',
      '      default : begin',
      '        o = 0;',
      '      end',
      '    endcase',
      '  end',
    ].join('\n'));
  })

  it('should correctly generate assignment statements', () => {
    class UUT extends GWModule {
      in = this.input(Signal(2));
      o = this.output(Signal(2));
      o2 = this.output(Signal(2));

      describe() {
        this.combinationalLogic([
          this.o ['='] (0b10),
          this.o2 ['='] (0b11),
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.header).to.eq([
      'module UUT(',
      '  input [1:0] in,',
      '  output [1:0] o,',
      '  output [1:0] o2',
      ');'
    ].join('\n'));

    expect(result.code.combAssigns).to.eq([
      '  assign o = 2;',
      '  assign o2 = 3;',
    ].join('\n'));
  });

  it('should correctly generate slices of sub-expressions', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal(10));
      in2 = this.input(Signal(10));
      o = this.output(Signal());

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in ['&'] (this.in2) .slice(5, 0))
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.wireDeclarations).to.eq([
      '  wire [9:0] gwGeneratedSlice0;'
    ].join('\n'));

    expect(result.code.combAssigns).to.eq([
      '  assign gwGeneratedSlice0 = in & (in2);',
      '  assign o = gwGeneratedSlice0[5:0];'
    ].join('\n'));
  });

  it('should disallow driving a combinational output signal as a wire and a register', () => {
    class UUT extends GWModule {
      in = this.input(Signal(2));
      o = this.output(Signal(2));

      describe() {
        this.combinationalLogic([
          CombinationalSwitchAssignment(this.o, this.in, [
            [0, 3],
            [1, 2],
            [2, 1],
            [3, 0],
          ], 0),

          this.o ['='] (3)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    expect(() => cg.generateVerilogCodeForModule(m, false)).to.throw(
      `Combinational Drive Type Error: Cannot drive UUT.o as both a register and a wire.`
    );
  });

  it('should correctly generate signal arrays', () => {
    class UUT extends GWModule {
      value = this.input(Signal(8));
      regArr = this.internal(SignalArray(2, 4));
      o = this.output(Signal(4));
      o2 = this.output(Signal(4));

      describe() {
        this.combinationalLogic([
          this.regArr.at(Constant(2, 0)) ['='] (this.value.slice(7, 6)),
          this.regArr.at(Constant(2, 1)) ['='] (this.value.slice(5, 4)),
          this.regArr.at(Constant(2, 2)) ['='] (this.value.slice(3, 2)),
          this.regArr.at(Constant(2, 3)) ['='] (this.value.slice(1, 0)),

          this.o ['='] (Concat([
            this.regArr.at(Constant(2, 0)),
            this.regArr.at(Constant(2, 2)),
          ])),

          this.o2 ['='] (Concat([
            this.regArr.at(Constant(2, 1)),
            this.regArr.at(Constant(2, 3)),
          ]))
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.internalRegisters).to.eq('  wire [1:0] regArr [0:3];');
    expect(result.code.combAssigns).to.eq([
      `  assign regArr[2'b00] = value[7:6];`,
      `  assign regArr[2'b01] = value[5:4];`,
      `  assign regArr[2'b10] = value[3:2];`,
      `  assign regArr[2'b11] = value[1:0];`,
      `  assign o = {regArr[2'b00], regArr[2'b10]};`,
      `  assign o2 = {regArr[2'b01], regArr[2'b11]};`,
    ].join('\n'));
  });
});
