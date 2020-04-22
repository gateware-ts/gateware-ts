/**
 * @internal
 * @packageDocumentation
 */
import { Inverse, ExplicitSignedness, ComparrisonT, TernaryT, UnaryT } from './../signals';
import { COMPARRISON_EXPRESSION, OPERATION_EXPRESSION, SLICE, BOOLEAN_EXPRESSION, CONCAT, INVERSE, EXPLICIT_SIGNEDNESS } from './../constants';
import { Operation, SignalLikeOrValue, ComparrisonOperation, OperationExpression, SignalLike, BooleanOperation, Signedness } from './../main-types';
import { GWModule } from "../gw-module"
import { SignalT, WireT, ConstantT, SliceT, ConcatT, BooleanExpression } from "../signals";
import { SIGNAL, WIRE, CONSTANT, UNARY_EXPRESSION, TERNARY_EXPRESSION } from '../constants';

const parenthize = (s:SignalLike, fn:(s:SignalLikeOrValue) => string):string =>
  (s.type === SIGNAL || s.type === WIRE) ? fn(s) : `(${fn(s)})`;

const twosComplementNegative = (n, width) => {
  const abs = Math.abs(n);
  const binStr = BigInt(abs).toString(2).padStart(width, '1').split('');

  const twos = (BigInt(1) + binStr.reduce((acc, x, i, a) => {
    return acc + (BigInt(1)<<BigInt(a.length - i - 1)) * BigInt(x === '1' ? 0 : 1);
  }, BigInt(0)));

  return ('0' + twos.toString(2)).padStart(width, '1');
};

export class ExpressionEvaluator {
  private workingModule: GWModule;

  constructor(m:GWModule) {
    this.workingModule = m;
    this.evaluate = this.evaluate.bind(this);
  }

  setWorkingModule(m:GWModule) {
    this.workingModule = m;
  }

  evaluate(expr:SignalLikeOrValue) {
    if (typeof expr === 'number') {
      return expr.toString();
    }

    switch (expr.type) {
      case SIGNAL:{
        return this.evaluateSignalOrWire(expr as SignalT);
      }
      case WIRE:{
        return this.evaluateSignalOrWire(expr as WireT);
      }
      case CONSTANT:{
        return this.evaluateConstant(expr as ConstantT);
      }
      case CONCAT:{
        return this.evaluateConcat(expr as ConcatT);
      }
      case UNARY_EXPRESSION:{
        return this.evaluateUnaryExpression(expr as UnaryT);
      }
      case INVERSE:{
        return this.evaluateInverse(expr as Inverse);
      }
      case COMPARRISON_EXPRESSION:{
        return this.evaluateComparrisonExpression(expr as ComparrisonT);
      }
      case TERNARY_EXPRESSION:{
        return this.evaluateTernaryExpression(expr as TernaryT);
      }
      case BOOLEAN_EXPRESSION:{
        return this.evaluateBooleanExpression(expr as BooleanExpression);
      }
      case OPERATION_EXPRESSION: {
        return this.evaluateOperationExpression(expr as OperationExpression);
      }
      case SLICE: {
        return this.evaluateSlice(expr as SliceT);
      }
      case EXPLICIT_SIGNEDNESS: {
        return this.evaluateExplicitSignedness(expr as ExplicitSignedness);
      }
      default: {
        debugger;
        throw new Error('Unrecognised expression type');
      }
    }
  }

  evaluateExplicitSignedness(s:ExplicitSignedness) {
    return `$${s.signedness === Signedness.Unsigned ? 'un' : ''}signed(${this.evaluate(s.signal)})`;
  }

  evaluateSignalOrWire(s:SignalT | WireT) {
    return this.workingModule.getModuleSignalDescriptor(s).name;
  }

  evaluateConstant(c:ConstantT) {
    if (c.value < 0) {
      return `${c.width}'b${twosComplementNegative(c.value, c.width)}`;
    }
    return `${c.width}'b${c.value.toString(2).padStart(c.width, '0')}`;
  }

  evaluateConcat(c:ConcatT) {
    return `{${c.signals.map(this.evaluate).join(', ')}}`;
  }

  evaluateInverse(i:Inverse) {
    return `~${parenthize(i.a, this.evaluate)}`;
  }

  evaluateUnaryExpression(u:UnaryT) {
    switch (u.op) {
      case Operation.Not: {
        return `~${parenthize(u.a, this.evaluate)}`;
      }

      case Operation.LogicalNot: {
        return `!${parenthize(u.a, this.evaluate)}`;
      }

      default: {
        throw new Error(`Unrecognised unary operation`);
      }
    }
  }

  evaluateComparrisonExpression(c:ComparrisonT) {
    let op:string;

    if (c.comparrisonOp === ComparrisonOperation.Equal)
      op = '==';
    else if (c.comparrisonOp === ComparrisonOperation.GreaterThan)
      op = '>';
    else if (c.comparrisonOp === ComparrisonOperation.GreaterThanOrEqualTo)
      op = '>=';
    else if (c.comparrisonOp === ComparrisonOperation.LessThan)
      op = '<';
    else if (c.comparrisonOp === ComparrisonOperation.LessThanOrEqualTo)
      op = '<=';
    else if (c.comparrisonOp === ComparrisonOperation.NotEqual)
      op = '!=';
    else
      throw new Error(`Unrecognised comparrison operation`);

    return `${parenthize(c.a, this.evaluate)} ${op} ${this.evaluate(c.b)}`;
  }

  evaluateBooleanExpression(expr:BooleanExpression) {
    let op:string;

    switch (expr.op) {
      case BooleanOperation.And: {
        op = '&';
        break;
      }
      case BooleanOperation.Or: {
        op = '|';
        break;
      }
      case BooleanOperation.LogicalAnd: {
        op = '&&';
        break;
      }
      case BooleanOperation.LogicalOr: {
        op = '||';
        break;
      }
      case BooleanOperation.Xor: {
        op = '^';
        break;
      }
      case BooleanOperation.LeftShift: {
        op = '<<';
        break;
      }
      case BooleanOperation.LeftArithmeticShift: {
        op = '<<<';
        break;
      }
      case BooleanOperation.RightShift: {
        op = '>>';
        break;
      }
      case BooleanOperation.RightArithmeticShift: {
        op = '>>>';
        break;
      }
      default: {
        throw new Error(`Unrecognised boolean operation`);
      }
    }

    return `${parenthize(expr.a, this.evaluate)} ${op} ${this.evaluate(expr.b)}`;
  }

  evaluateTernaryExpression(t:TernaryT) {
    return `(${this.evaluate(t.comparrison)} ? ${this.evaluate(t.a)} : ${this.evaluate(t.b)})`;
  }

  evaluateOperationExpression(o:OperationExpression) {
    let op:string;
    if (o.op === Operation.Plus)
      op = '+';
    else if (o.op === Operation.Minus)
      op = '-';
    else
      throw new Error('Unrecognised binary operation');

    return `${parenthize(o.a, this.evaluate)} ${op} ${this.evaluate(o.b)}`;
  }

  evaluateSlice(s:SliceT) {
    return (s.fromBit === s.toBit)
      ? `${parenthize(s.a, this.evaluate)}[${s.fromBit}]`
      : `${parenthize(s.a, this.evaluate)}[${s.fromBit}:${s.toBit}]`;
  }
}
