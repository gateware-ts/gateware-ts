
import {
  Signedness,
  SignalLikeOrValue,
  Operation,
  AssignmentExpression,
  OperationExpression,
  ComparrisonOperation,
  ComparrisonExpression,
  SignalLike
} from "./main-types";
import {
  ASSIGNMENT_EXPRESSION,
  OPERATION_EXPRESSION,
  COMPARRISON_EXPRESSION,
  SIGNAL,
  CONSTANT,
  SLICE,
  WIRE
} from "./constants";

// TODO: Base class, with operations like shifts

export class ConstantT {
  value:number;
  signedness:Signedness;
  width:number;
  readonly type:string = CONSTANT;

  constructor(width:number, value:number, signedness:Signedness) {
    this.value = value;
    this.signedness = signedness;
    this.width = width;
  }
}

export class SliceT {
  width: number;
  fromBit: number;
  toBit: number;
  a: SignalLike;
  readonly type:string = SLICE;

  constructor(a:SignalLike, fromBit:number, toBit:number) {
    // TODO: Assert logical stuff like bit ranges being valid
    this.a = a;
    this.fromBit = fromBit;
    this.toBit = toBit;
    this.width = fromBit - toBit + 1;
  }

  clone():SliceT {
    return new SliceT(this.a, this.fromBit, this.toBit);
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
}

export class WireT {
  width: number;
  readonly type:string = WIRE;

  constructor(width:number) {
    this.width = width;
  }

  clone() {
    return new WireT(this.width);
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

  slice(fromBit:number, toBit:number):SliceT {
    return Slice(this, fromBit, toBit);
  }
}

export class SignalT {
  width: number;
  signedness: Signedness;
  defaultValue: number;
  value: SignalLikeOrValue;
  readonly type:string = SIGNAL;

  constructor(width = 1, signedness:Signedness = Signedness.Unsigned, defaultValue = 0) {
    // TODO: Domain typing for all params
    this.width = width;
    this.signedness = signedness;
    this.defaultValue = defaultValue;
    this.value = defaultValue;
  }

  slice(fromBit:number, toBit:number):SliceT {
    return Slice(this, fromBit, toBit);
  }

  clone():SignalT {
    return new SignalT(this.width, this.signedness, this.defaultValue);
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

  setTo(b:SignalLikeOrValue):AssignmentExpression {
    return {
      a: this,
      b,
      type: ASSIGNMENT_EXPRESSION,
      width: this.width
    };
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