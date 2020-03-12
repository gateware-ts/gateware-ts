
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
  BooleanExpression
} from "./main-types";
import {
  ASSIGNMENT_EXPRESSION,
  OPERATION_EXPRESSION,
  COMPARRISON_EXPRESSION,
  SIGNAL,
  CONSTANT,
  SLICE,
  WIRE,
  BOOLEAN_EXPRESSION
} from "./constants";

// TODO: Base class, with operations like shifts

export abstract class BaseSignalLike {
  type:string;
  width:number;

  slice(fromBit:number, toBit:number):SliceT {
    return Slice(this, fromBit, toBit);
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
    return {
      a: this,
      b,
      op: BooleanOperation.And,
      type: BOOLEAN_EXPRESSION,
      width: this.width
    };
  }

  or(b:SignalLikeOrValue):BooleanExpression {
    return {
      a: this,
      b,
      op: BooleanOperation.Or,
      type: BOOLEAN_EXPRESSION,
      width: this.width
    };
  }

  xor(b:SignalLikeOrValue):BooleanExpression {
    return {
      a: this,
      b,
      op: BooleanOperation.Xor,
      type: BOOLEAN_EXPRESSION,
      width: this.width
    };
  }

  shiftLeft(b:SignalLikeOrValue):BooleanExpression {
    return {
      a: this,
      b,
      op: BooleanOperation.LeftShift,
      type: BOOLEAN_EXPRESSION,
      width: this.width
    };
  }

  shiftRight(b:SignalLikeOrValue):BooleanExpression {
    return {
      a: this,
      b,
      op: BooleanOperation.RightShift,
      type: BOOLEAN_EXPRESSION,
      width: this.width
    };
  }

  shiftLeftA(b:SignalLikeOrValue):BooleanExpression {
    return {
      a: this,
      b,
      op: BooleanOperation.LeftArithmeticShift,
      type: BOOLEAN_EXPRESSION,
      width: this.width
    };
  }

  shiftRightA(b:SignalLikeOrValue):BooleanExpression {
    return {
      a: this,
      b,
      op: BooleanOperation.RightArithmeticShift,
      type: BOOLEAN_EXPRESSION,
      width: this.width
    };
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

  ['|'](b:SignalLikeOrValue) {
    return this.or(b);
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
}

export class ConstantT extends BaseSignalLike {
  value:number;
  signedness:Signedness;
  width:number;
  readonly type:string = CONSTANT;

  constructor(width:number, value:number, signedness:Signedness) {
    super();
    this.value = value;
    this.signedness = signedness;
    this.width = width;
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

export const HIGH = Constant(1, 1);
export const LOW = Constant(1, 0);