import {
  Signedness,
  SignalLikeOrValue,
  Operation,
  AssignmentExpression,
  OperationExpression,
  ComparrisonOperation,
  ComparrisonExpression,
  SignalLike,
  BooleanOperation,
} from "./main-types";
import {
  ASSIGNMENT_EXPRESSION,
  OPERATION_EXPRESSION,
  COMPARRISON_EXPRESSION,
  SIGNAL,
  CONSTANT,
  CONCAT,
  SLICE,
  WIRE,
  BOOLEAN_EXPRESSION
} from "./constants";

export abstract class BaseSignalLike {
  type:string;
  width:number;

  slice(fromBit:number, toBit:number):SliceT {
    return Slice(this, fromBit, toBit);
  }

  concat(signals:SignalLike[]):ConcatT {
    return new ConcatT([this, ...signals]);
  }

  eq(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.Equal,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  lt(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.LessThan,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  gt(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.GreaterThan,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  lte(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.LessThanOrEqualTo,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  gte(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.GreaterThanOrEqualTo,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  neq(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.NotEqual,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  plus(b:SignalLikeOrValue):OperationExpression {
    return {
      a: this,
      b,
      op: Operation.Plus,
      type: OPERATION_EXPRESSION,
      width: this.width
    };
  }

  minus(b:SignalLikeOrValue):OperationExpression {
    return {
      a: this,
      b,
      op: Operation.Minus,
      type: OPERATION_EXPRESSION,
      width: this.width
    };
  }

  and(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.And, this.width);
  }

  andLogical(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.LogicalAnd, 1);
  }

  orLogical(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.LogicalOr, 1);
  }

  or(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.Or, this.width);
  }

  xor(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.Xor, this.width);
  }

  shiftLeft(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.LeftShift, this.width);
  }

  shiftRight(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.RightShift, this.width);
  }

  shiftLeftA(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.LeftArithmeticShift, this.width);
  }

  shiftRightA(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.RightArithmeticShift, this.width);
  }

  ['+'](b:SignalLikeOrValue) {
    return this.plus(b);
  }

  ['-'](b:SignalLikeOrValue) {
    return this.minus(b);
  }

  ['&'](b:SignalLikeOrValue) {
    return this.and(b);
  }

  ['&&'](b:SignalLikeOrValue) {
    return this.andLogical(b);
  }

  ['|'](b:SignalLikeOrValue) {
    return this.or(b);
  }

  ['||'](b:SignalLikeOrValue) {
    return this.orLogical(b);
  }

  ['^'](b:SignalLikeOrValue) {
    return this.xor(b);
  }

  ['<<<'](b:SignalLikeOrValue) {
    return this.shiftLeftA(b);
  }

  ['>>>'](b:SignalLikeOrValue) {
    return this.shiftRightA(b);
  }

  ['<<'](b:SignalLikeOrValue) {
    return this.shiftLeft(b);
  }

  ['>>'](b:SignalLikeOrValue) {
    return this.shiftRight(b);
  }

  ['++'](signals:SignalLike[]) {
    return this.concat(signals);
  }

  ['=='](b:SignalLikeOrValue) {
    return this.eq(b);
  }

  ['!='](b:SignalLikeOrValue) {
    return this.neq(b);
  }

  ['<'](b:SignalLikeOrValue) {
    return this.lt(b);
  }

  ['>'](b:SignalLikeOrValue) {
    return this.gt(b);
  }

  ['<='](b:SignalLikeOrValue) {
    return this.lte(b);
  }

  ['>='](b:SignalLikeOrValue) {
    return this.gte(b);
  }
}

export class BooleanExpression extends BaseSignalLike {
  readonly type:string = BOOLEAN_EXPRESSION;
  a:SignalLike;
  b:SignalLikeOrValue;
  op:BooleanOperation;

  constructor(a:SignalLike, b:SignalLikeOrValue, op:BooleanOperation, width:number) {
    super();
    this.a = a;
    this.b = b;
    this.op = op;
  }
}

export class ConstantT extends BaseSignalLike {
  value:number;
  signedness:Signedness;
  readonly type:string = CONSTANT;

  constructor(width:number, value:number, signedness:Signedness) {
    super();
    this.value = value;
    this.signedness = signedness;
    this.width = width;
  }
}

export class ConcatT extends BaseSignalLike {
  signals: SignalLike[];
  width:number;
  readonly type:string = CONCAT;

  constructor(signals:SignalLike[]) {
    super();
    this.signals = signals;
    this.width = signals.reduce((a, b) => a + b.width, 0);
  }
}

export class SliceT extends BaseSignalLike {
  width: number;
  fromBit: number;
  toBit: number;
  a: SignalLike;
  readonly type:string = SLICE;

  constructor(a:SignalLike, fromBit:number, toBit:number) {
    super();
    // TODO: Assert logical stuff like bit ranges being valid
    this.a = a;
    this.fromBit = fromBit;
    this.toBit = toBit;
    this.width = fromBit - toBit + 1;
  }

  clone():SliceT {
    return new SliceT(this.a, this.fromBit, this.toBit);
  }
}

export class WireT extends BaseSignalLike {
  width: number;
  readonly type:string = WIRE;

  constructor(width:number) {
    super();
    this.width = width;
  }

  clone() {
    return new WireT(this.width);
  }
}

export class SignalT extends BaseSignalLike {
  width: number;
  signedness: Signedness;
  defaultValue: number;
  value: SignalLikeOrValue;
  readonly type:string = SIGNAL;

  constructor(width = 1, signedness:Signedness = Signedness.Unsigned, defaultValue = 0) {
    super();

    // TODO: Domain typing for all params
    this.width = width;
    this.signedness = signedness;
    this.defaultValue = defaultValue;
    this.value = defaultValue;
  }

  clone():SignalT {
    return new SignalT(this.width, this.signedness, this.defaultValue);
  }

  setTo(b:SignalLikeOrValue):AssignmentExpression {
    return {
      a: this,
      b,
      type: ASSIGNMENT_EXPRESSION,
      width: this.width
    };
  }

  ['='](b:SignalLikeOrValue) {
    return this.setTo(b);
  }
};

export const Signal = (width = 1, signedness:Signedness = Signedness.Unsigned, defaultValue = 0) =>
  new SignalT(width, signedness, defaultValue);

export const Slice = (a:SignalLike, fromBit:number, toBit:number) =>
  new SliceT(a, fromBit, toBit);

export const Constant = (width:number = 1, value:number = 0, signedness:Signedness = Signedness.Unsigned) =>
  new ConstantT(width, value, signedness);
export const Concat = (signals:SignalLike[]) => new ConcatT(signals);


export const HIGH = Constant(1, 1);
export const LOW = Constant(1, 0);