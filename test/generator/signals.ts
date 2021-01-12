import { MODULE_CODE_ELEMENTS } from '../../src/constants';
import * as mocha from 'mocha';
import * as chai from 'chai';
import { Signal, Constant, SignalT, asSigned, asUnsigned, Ternary } from '../../src/signals';
import { CodeGenerator } from '../../src/generator/index';
import { GWModule, Not } from '../../src/index';

const expect = chai.expect;

const operationTest = (op:string, a:SignalT, b:SignalT, expectation:string) => () => {
  class UUT extends GWModule {
    a = this.input(a);
    b = this.input(b);
    o = this.output(Signal(8));

    describe() {
      this.combinationalLogic([
        this.o ['='] (a[op](b))
      ])
    }
  }

  const m = new UUT();
  const cg = new CodeGenerator(m);
  const result = cg.generateVerilogCodeForModule(m, false);

  if (result.code.type !== MODULE_CODE_ELEMENTS) {
    throw new Error('Wrong module type generated');
  }

  expect(result.code.combAssigns).to.eq(`  assign o = ${expectation};`);
}

const comparrisonTest = (op:string, a:SignalT, b:SignalT, expectation:string) => () => {
  class UUT extends GWModule {
    a = this.input(a);
    b = this.input(b);
    o = this.output(Signal(8));

    describe() {
      this.combinationalLogic([
        this.o ['='] (Ternary(a[op](b), a, b))
      ])
    }
  }

  const m = new UUT();
  const cg = new CodeGenerator(m);
  const result = cg.generateVerilogCodeForModule(m, false);

  if (result.code.type !== MODULE_CODE_ELEMENTS) {
    throw new Error('Wrong module type generated');
  }

  expect(result.code.combAssigns).to.eq(`  assign o = (${expectation} ? a : b);`);
}

describe('signals', () => {
  it('should able to be sliced MSB->LSB', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      // Leaving this as a 1 bit signal, so when I implement strict mode this will fail
      o = this.output(Signal());

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.slice(7, 4))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq('  assign o = in[7:4];');
  });

  it('should able to be sliced LSB->MSB', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      // Leaving this as a 1 bit signal, so when I implement strict mode this will fail
      o = this.output(Signal());

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.slice(4, 7))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq('  assign o = in[4:7];');
  });

  it('should fail to create a slice larger than the signal being sliced', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      // Leaving this as a 1 bit signal, so when I implement strict mode this will fail
      o = this.output(Signal());

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.slice(8, 0)) // 9-bit slice
        ])
      }
    }

    const expectedFail = () => new CodeGenerator(new UUT());

    expect(expectedFail).to.throw(
      'Slice cannot have a larger width than the signal being sliced (slice=9, signal=8)'
    )
  });

  it('should fail to create a slice with non-integer width', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      // Leaving this as a 1 bit signal, so when I implement strict mode this will fail
      o = this.output(Signal());

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.slice(1.23, 5.3))
        ])
      }
    }

    const expectedFail = () => new CodeGenerator(new UUT());

    expect(expectedFail).to.throw(
      'Slice width must be integer, but got 5.07'
    )
  });

  it('should able to be zero extended', () => {
    class UUT extends GWModule {
      in = this.input(Signal(12));
      o = this.output(Signal(16));

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.zeroExtend(16))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq(`  assign o = {4'b0000, in};`);
  });

  it('should fail to zero extend when the toWidth is non-integer', () => {
    class UUT extends GWModule {
      in = this.input(Signal(12));
      o = this.output(Signal(16));

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.zeroExtend(16.1))
        ])
      }
    }

    const m = new UUT();
    expect(() => {
      // Expect this to fail when describe is called, after creating the inital code generator
      new CodeGenerator(m);
    }).to.throw(`Non integer number of bits specified (16.1)`);
  });

  it('should fail to sign extend when the toWidth is non-integer', () => {
    class UUT extends GWModule {
      in = this.input(Signal(12));
      o = this.output(Signal(16));

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.signExtend(16.1))
        ])
      }
    }

    const m = new UUT();
    expect(() => {
      // Expect this to fail when describe is called, after creating the inital code generator
      new CodeGenerator(m);
    }).to.throw(`Non integer number of bits specified (16.1)`);
  });

  it('should able to be sign extended', () => {
    class UUT extends GWModule {
      in = this.input(Signal(12));
      o = this.output(Signal(16));

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.signExtend(16))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq(`  assign o = {in[11], in[11], in[11], in[11], in};`);
  });

  it('should able to be used as a ternary selector', () => {
    class UUT extends GWModule {
      in = this.input(Signal(12));
      o = this.output(Signal(12));
      o2 = this.output(Signal(12));

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.ternary(1, 2)),
          this.o2 ['='] (this.in ['?'] (1, 2)),
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq([
      '  assign o = (in ? 1 : 2);',
      '  assign o2 = (in ? 1 : 2);',
    ].join('\n'));
  });

  it('should able to get a signal bit', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      // Leaving this as a 1 bit signal, so when I implement strict mode this will fail
      o = this.output(Signal());

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in.bit(0))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq('  assign o = in[0];');
  });

  it('should able to concat', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      in2 = this.input(Signal(8));
      o = this.output(Signal(16));

      describe() {
        this.combinationalLogic([
          this.o ['='] (this.in ['++'] ([this.in2]))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq('  assign o = {in, in2};');
  });

  it('should able to handle negative constants', () => {
    class UUT extends GWModule {
      o = this.output(Signal(16));

      describe() {
        this.combinationalLogic([
          this.o ['='] (Constant(16, -42))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq(`  assign o = 16'b1111111111010110;`);
  });

  it('should able to handle positive constants', () => {
    class UUT extends GWModule {
      o = this.output(Signal(16));

      describe() {
        this.combinationalLogic([
          this.o ['='] (Constant(16, 42))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq(`  assign o = 16'b0000000000101010;`);
  });

  it('should throw if a constant is created out of the width bounds', () => {
    class UUT extends GWModule {
      o = this.output(Signal(16));

      describe() {
        this.combinationalLogic([
          this.o ['='] (Constant(16, 66000))
        ])
      }
    }

    const m = new UUT();
    expect(() => new CodeGenerator(m)).to.throw('Cannot create constant of width 16 and value 66000 (Max possible value 65535)');
  });

  it('should able to be inverted', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      o = this.output(Signal(8));

      describe() {
        this.combinationalLogic([
          this.o ['='] (Not(this.in))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq('  assign o = ~in;');
  });

  it('should allow signals to be treated as signed explicitly', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      o = this.output(Signal(8));

      describe() {
        this.combinationalLogic([
          this.o ['='] (asSigned(this.in))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq('  assign o = $signed(in);');
  });

  it('should allow signals to be treated as unsigned explicitly', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      o = this.output(Signal(8));

      describe() {
        this.combinationalLogic([
          this.o ['='] (asUnsigned(this.in))
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq('  assign o = $unsigned(in);');
  });

  it('should be clonable', () => {
    const inSignal1 = Signal(8);
    const inSignal2 = inSignal1.clone();

    expect(inSignal1).to.not.eq(inSignal2);
    expect(inSignal1.width).to.eq(inSignal2.width);
    expect(inSignal1.signedness).to.eq(inSignal2.signedness);
    expect(inSignal1.defaultValue).to.eq(inSignal2.defaultValue);

  });

  it('should be able be added', operationTest('+', Signal(8), Signal(8), 'a + b'));
  it('should be able be subtracted', operationTest('-', Signal(8), Signal(8), 'a - b'));
  it('should be able be and\'d', operationTest('&', Signal(8), Signal(8), 'a & (b)'));
  it('should be able be logical and\'d', operationTest('&&', Signal(8), Signal(8), 'a && (b)'));
  it('should be able be logical or\'d', operationTest('||', Signal(8), Signal(8), 'a || (b)'));
  it('should be able be or\'d', operationTest('|', Signal(8), Signal(8), 'a | (b)'));
  it('should be able be xor\'d', operationTest('^', Signal(8), Signal(8), 'a ^ (b)'));
  it('should be able be left shifted', operationTest('>>', Signal(8), Signal(8), 'a >> (b)'));
  it('should be able be right shifted', operationTest('<<', Signal(8), Signal(8), 'a << (b)'));
  it('should be able be left shifted (arithmetic)', operationTest('>>>', Signal(8), Signal(8), 'a >>> (b)'));
  it('should be able be right shifted (arithmetic)', operationTest('<<<', Signal(8), Signal(8), 'a <<< (b)'));

  it('should be able be compared for equality', comparrisonTest('==', Signal(8), Signal(8), 'a == b'));
  it('should be able be compared for non-equality', comparrisonTest('!=', Signal(8), Signal(8), 'a != b'));
  it('should be able be compared for less than', comparrisonTest('<', Signal(8), Signal(8), 'a < b'));
  it('should be able be compared for less than or equal to', comparrisonTest('<=', Signal(8), Signal(8), 'a <= b'));
  it('should be able be compared for greater than', comparrisonTest('>', Signal(8), Signal(8), 'a > b'));
  it('should be able be compared for greater than or equal to', comparrisonTest('>=', Signal(8), Signal(8), 'a >= b'));

  it('should able to be made of complex sets of operations', () => {
    class UUT extends GWModule {
      in = this.input(Signal(8));
      b = this.input(Signal(4));
      o = this.output(Signal(8));

      describe() {
        this.combinationalLogic([
          this.o ['='] (
            Not(this.in) ['|'] (Constant(4, 0b0000).concat([this.b])) ['^'] (Constant(8, 0xAA))
          )
        ])
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    const result = cg.generateVerilogCodeForModule(m, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.combAssigns).to.eq(`  assign o = ((~in) | ({4'b0000, b})) ^ (8'b10101010);`);
  });
});
