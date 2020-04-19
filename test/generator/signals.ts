import { Ternary } from './../../src/operational-expressions';
import { MODULE_CODE_ELEMENTS } from '../../src/constants';
import * as mocha from 'mocha';
import * as chai from 'chai';
import { Signal, Constant, SignalT } from '../../src/signals';
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

  expect(result.code.combAssigns).to.eq(`  assign o = ${expectation} ? a : b;`);
}

describe('signals', () => {
  it('should able to be sliced', () => {
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
  it('should be able be and\'d', operationTest('&', Signal(8), Signal(8), 'a & b'));
  it('should be able be logical and\'d', operationTest('&&', Signal(8), Signal(8), 'a && b'));
  it('should be able be logical or\'d', operationTest('||', Signal(8), Signal(8), 'a || b'));
  it('should be able be or\'d', operationTest('|', Signal(8), Signal(8), 'a | b'));
  it('should be able be xor\'d', operationTest('^', Signal(8), Signal(8), 'a ^ b'));
  it('should be able be left shifted', operationTest('>>', Signal(8), Signal(8), 'a >> b'));
  it('should be able be right shifted', operationTest('<<', Signal(8), Signal(8), 'a << b'));
  it('should be able be left shifted (arithmetic)', operationTest('>>>', Signal(8), Signal(8), 'a >>> b'));
  it('should be able be right shifted (arithmetic)', operationTest('<<<', Signal(8), Signal(8), 'a <<< b'));

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

    expect(result.code.combAssigns).to.eq(`  assign o = ((~in) | {4'b0000, b}) ^ 8'b10101010;`);
  });
});
