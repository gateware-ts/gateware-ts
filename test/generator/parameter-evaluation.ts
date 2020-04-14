import { ParameterEvaluator } from './../../src/generator/parameter-evaluation';
import * as mocha from 'mocha';
import * as chai from 'chai';
import { Constant } from '../../src/signals';
import { ParamString } from '../../src/vendor-module';

const expect = chai.expect;



describe('parameterEvaluation', () => {
  it('should correctly generate string parameters', () => {
    const pe = new ParameterEvaluator();
    const ps = ParamString("Hello World")

    expect(pe.evaluate(ps)).to.eq("Hello World");
  });

  it('should correctly generate constant parameters', () => {
    const pe = new ParameterEvaluator();
    const pc = Constant(8, 0x64);

    expect(pe.evaluate(pc)).to.eq("8'b01100100");
  });
});
