import { ParameterString } from './../main-types';
import { ConstantT } from "../signals";
import { CONSTANT, PARAMETER_STRING } from '../constants';

export class ParameterEvaluator {
  evaluate(expr:ConstantT | ParameterString) {
    switch (expr.type) {
      case PARAMETER_STRING:{
        return this.evaluateString(expr as ParameterString);
      }
      case CONSTANT:{
        return this.evaluateConstant(expr as ConstantT);
      }
      default: {
        debugger;
        throw new Error('Unrecognised expression type');
      }
    }
  }

  evaluateString(s:ParameterString) {
    return s.value;
  }

  evaluateConstant(c:ConstantT) {
    return `${c.width}'b${c.value.toString(2).padStart(c.width, '0')}`;
  }
}
