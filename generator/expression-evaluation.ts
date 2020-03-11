import { COMPARRISON_EXPRESSION, OPERATION_EXPRESSION, SLICE } from './../constants';
import { UnaryExpression, Operation, SignalLikeOrValue, TernaryExpression, ComparrisonExpression, ComparrisonOperation, OperationExpression, SignalLike } from './../main-types';
import { TSHDLModule } from "../hdl-module"
import { SignalT, WireT, ConstantT, SliceT } from "../signals";
import { SIGNAL, WIRE, CONSTANT, UNARY_EXPRESSION, TERNARY_EXPRESSION } from '../constants';

const parenthize = (s:SignalLike, fn:(s:SignalLikeOrValue) => string):string =>
  (s.type === SIGNAL || s.type === WIRE) ? fn(s) : `(${fn(s)})`;

export class ExpressionEvaluator {
  private workingModule: TSHDLModule;

  constructor(m?:TSHDLModule) {
    if (m) {
      this.workingModule = m;
    }
    this.evaluate = this.evaluate.bind(this);
  }

  setWorkingModule(m:TSHDLModule) {
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
      case UNARY_EXPRESSION:{
        return this.evaluateUnaryExpression(expr as UnaryExpression);
      }
      case COMPARRISON_EXPRESSION:{
        return this.evaluateComparrisonExpression(expr as ComparrisonExpression);
      }
      case TERNARY_EXPRESSION:{
        return this.evaluateTernaryExpression(expr as TernaryExpression);
      }
      case TERNARY_EXPRESSION:{
        return this.evaluateTernaryExpression(expr as TernaryExpression);
      }
      case OPERATION_EXPRESSION: {
        return this.evaluateOperationExpression(expr as OperationExpression);
      }
      case SLICE: {
        return this.evaluateSlice(expr as SliceT);
      }
      default: {
        debugger;
        throw new Error('Unrecognised expression type');
      }
    }
  }

  evaluateSignalOrWire(s:SignalT | WireT) {
    return this.workingModule.getModuleSignalDescriptor(s).name;
  }

  evaluateConstant(c:ConstantT) {
    return `${c.width}'b${c.value.toString(2).padStart(c.width, '0')}`;
  }

  evaluateUnaryExpression(u:UnaryExpression) {
    switch (u.op) {
      case Operation.Not: {
        return `~${parenthize(u.a, this.evaluate)}`;
      }

      default: {
        throw new Error(`Unrecognised unary operation`);
      }
    }
  }

  evaluateComparrisonExpression(c:ComparrisonExpression) {
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

  evaluateTernaryExpression(t:TernaryExpression) {
    return `${this.evaluateComparrisonExpression(t.comparrison)} ? ${this.evaluate(t.a)} : ${this.evaluate(t.b)}`;
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
