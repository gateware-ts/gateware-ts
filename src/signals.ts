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
  INVERSE,
  WIRE,
  BOOLEAN_EXPRESSION,
  EXPLICIT_SIGNEDNESS
} from "./constants";
import { Bit } from "./operational-expressions";

/**
 * Base class for all [[SignalLike]]s.
 * Should never be instaniated.
 */
export abstract class BaseSignalLike {
  type:string;
  width:number;

  /**
   * Zero-extend this signal to a given bit width
   * @param toWidth
   */
  zeroExtend(toWidth:number) {
    if (this.width > toWidth) {
      throw new Error(`Can't zero extend signal from ${this.width} bits to ${toWidth} bits`);
    }
    if (Math.round(toWidth) !== toWidth) {
      throw new Error(`Non integer number of bits specified (${toWidth})`);
    }
    const bitDiff = toWidth - this.width;
    return new ConcatT([ Constant(bitDiff, 0), this ]);
  }

  /**
   * Sign-extend this signal to a given bit width
   * @param toWidth
   */
  signExtend(toWidth:number) {
    if (this.width > toWidth) {
      throw new Error(`Can't zero extend signal from ${this.width} bits to ${toWidth} bits`);
    }
    if (Math.round(toWidth) !== toWidth) {
      throw new Error(`Non integer number of bits specified (${toWidth})`);
    }
    const bitDiff = toWidth - this.width;
    const extension = Array.from({ length: bitDiff }, () => this.bit(this.width - 1));
    return new ConcatT([ ...extension, this ]);
  }

  /**
   * Create a slice from this signal (inclusive)
   * @param fromBit the starting bit
   * @param toBit the ending bit
   */
  slice(fromBit:number, toBit:number):SliceT {
    return Slice(this, fromBit, toBit);
  }

  /**
   * Concat one or more [[SignalLike]]s with this signal
   * @param signals All the [[SignalLike]]s that should be concatenated
   */
  concat(signals:SignalLike[]):ConcatT {
    return new ConcatT([this, ...signals]);
  }

  /**
   * Compare if this signal is equal to another [[SignalLikeOrValue]]
   * @param b
   */
  eq(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.Equal,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  /**
   * Compare if this signal is less than another [[SignalLikeOrValue]]
   * @param b
   */
  lt(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.LessThan,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  /**
   * Compare if this signal is greater than another [[SignalLikeOrValue]]
   * @param b
   */
  gt(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.GreaterThan,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  /**
   * Compare if this signal is less than or equal to another [[SignalLikeOrValue]]
   * @param b
   */
  lte(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.LessThanOrEqualTo,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  /**
   * Compare if this signal is greater than or equal to another [[SignalLikeOrValue]]
   * @param b
   */
  gte(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.GreaterThanOrEqualTo,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  /**
   * Compare if this signal is not equal to another [[SignalLikeOrValue]]
   * @param b
   */
  neq(b:SignalLikeOrValue):ComparrisonExpression {
    return {
      a: this,
      b,
      comparrisonOp: ComparrisonOperation.NotEqual,
      type:COMPARRISON_EXPRESSION,
      width: 1
    };
  }

  /**
   * Describe adding another [[SignalLikeOrValue]] to this signal
   * @param b 
   */
  plus(b:SignalLikeOrValue):OperationExpression {
    return {
      a: this,
      b,
      op: Operation.Plus,
      type: OPERATION_EXPRESSION,
      width: this.width
    };
  }

  /**
   * Describe subtracting this signal from another [[SignalLikeOrValue]]
   * @param b 
   */
  minus(b:SignalLikeOrValue):OperationExpression {
    return {
      a: this,
      b,
      op: Operation.Minus,
      type: OPERATION_EXPRESSION,
      width: this.width
    };
  }

  /**
   * Bitwise and of this signal and another [[SignalLikeOrValue]]
   * @param b
   */
  and(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.And, this.width);
  }

  /**
   * Logical and of this signal and another [[SignalLikeOrValue]] (produces a 1-bit wide signal)
   * @param b
   */
  andLogical(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.LogicalAnd, 1);
  }

  /**
   * Bitwise or of this signal and another [[SignalLikeOrValue]]
   * @param b
   */
  orLogical(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.LogicalOr, 1);
  }

  /**
   * Logical or of this signal and another [[SignalLikeOrValue]] (produces a 1-bit wide signal)
   * @param b
   */
  or(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.Or, this.width);
  }

  /**
   * Bitwise xor of this signal and another [[SignalLikeOrValue]]
   * @param b
   */
  xor(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.Xor, this.width);
  }

  /**
   * Bitwise left shift of this signal by another [[SignalLikeOrValue]]
   * @param b
   */
  shiftLeft(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.LeftShift, this.width);
  }

  /**
   * Bitwise right shift of this signal by another [[SignalLikeOrValue]]
   * @param b
   */
  shiftRight(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.RightShift, this.width);
  }

  /**
   * Arithmetic left shift of this signal by another [[SignalLikeOrValue]]
   * @param b
   */
  shiftLeftA(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.LeftArithmeticShift, this.width);
  }

  /**
   * Arithmetic right shift of this signal by another [[SignalLikeOrValue]]
   * @param b
   */
  shiftRightA(b:SignalLikeOrValue):BooleanExpression {
    return new BooleanExpression(this, b, BooleanOperation.RightArithmeticShift, this.width);
  }

  /**
 * Isolate a single bit from this signal
 * @param index the index to isolate
 */
  bit(index:number) {
    return Bit(this, index);
  }

  /**
   * Alias of [[BaseSignalLike.plus]]
   */
  ['+'](b:SignalLikeOrValue) {
    return this.plus(b);
  }

  /**
   * Alias of [[BaseSignalLike.minus]]
   */
  ['-'](b:SignalLikeOrValue) {
    return this.minus(b);
  }

  /**
   * Alias of [[BaseSignalLike.and]]
   */
  ['&'](b:SignalLikeOrValue) {
    return this.and(b);
  }

  /**
   * Alias of [[BaseSignalLike.logicalAnd]]
   */
  ['&&'](b:SignalLikeOrValue) {
    return this.andLogical(b);
  }

  /**
   * Alias of [[BaseSignalLike.or]]
   */
  ['|'](b:SignalLikeOrValue) {
    return this.or(b);
  }

  /**
   * Alias of [[BaseSignalLike.logicalOr]]
   */
  ['||'](b:SignalLikeOrValue) {
    return this.orLogical(b);
  }

  /**
   * Alias of [[BaseSignalLike.xor]]
   */
  ['^'](b:SignalLikeOrValue) {
    return this.xor(b);
  }

  /**
   * Alias of [[BaseSignalLike.shiftLeftA]]
   */
  ['<<<'](b:SignalLikeOrValue) {
    return this.shiftLeftA(b);
  }

  /**
   * Alias of [[BaseSignalLike.shiftRightA]]
   */
  ['>>>'](b:SignalLikeOrValue) {
    return this.shiftRightA(b);
  }

  /**
   * Alias of [[BaseSignalLike.shiftLeft]]
   */
  ['<<'](b:SignalLikeOrValue) {
    return this.shiftLeft(b);
  }

  /**
   * Alias of [[BaseSignalLike.shiftRight]]
   */
  ['>>'](b:SignalLikeOrValue) {
    return this.shiftRight(b);
  }

  /**
   * Alias of [[BaseSignalLike.concat]]
   */
  ['++'](signals:SignalLike[]) {
    return this.concat(signals);
  }

  /**
   * Alias of [[BaseSignalLike.eq]]
   */
  ['=='](b:SignalLikeOrValue) {
    return this.eq(b);
  }

  /**
   * Alias of [[BaseSignalLike.neq]]
   */
  ['!='](b:SignalLikeOrValue) {
    return this.neq(b);
  }

  /**
   * Alias of [[BaseSignalLike.lt]]
   */
  ['<'](b:SignalLikeOrValue) {
    return this.lt(b);
  }

  /**
   * Alias of [[BaseSignalLike.gt]]
   */
  ['>'](b:SignalLikeOrValue) {
    return this.gt(b);
  }

  /**
   * Alias of [[BaseSignalLike.lte]]
   */
  ['<='](b:SignalLikeOrValue) {
    return this.lte(b);
  }

  /**
   * Alias of [[BaseSignalLike.gte]]
   */
  ['>='](b:SignalLikeOrValue) {
    return this.gte(b);
  }
}

/**
 * [[SignalLike]] representing the inversion of another [[SignalLike]].
 * Should not be instantiated directly, instead use [[Not]]
 */
export class Inverse extends BaseSignalLike {
  readonly type:string = INVERSE;
  a:SignalLike;

  constructor(a:SignalLike) {
    super();
    this.a = a;
    this.width = a.width;
  }
}

/**
 * [[SignalLike]] representing an operation on two [[SignalLike]]s.
 * Should not be instantiated directly, instead use methods like [[BaseSignalLike.and]], [[BaseSignalLike.or]], etc
 */
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

/**
 * [[SignalLike]] representing a constant value
 * Should not be instantiated directly, instead use [[Constant]]
 */
export class ConstantT extends BaseSignalLike {
  value:number;
  signedness:Signedness;
  readonly type:string = CONSTANT;

  constructor(width:number, value:number, signedness:Signedness) {
    super();

    const max = (2**width)-1;
    if (value > max) {
      throw new Error(`Cannot create constant of width ${width} and value ${value} (Max possible value ${max})`);
    }

    this.value = value;
    this.signedness = signedness;
    this.width = width;
  }
}

/**
 * [[SignalLike]] representing the concatenation of multiple [[SignalLike]]s
 * Should not be instantiated directly, instead use [[Concat]], or [[BaseSignalLike.concat]]
 */
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

/**
 * [[SignalLike]] representing the a subset of continuous bits inside another [[SignalLike]]
 * Should not be instantiated directly, instead use [[Slice]], [[Bit]], or [[BaseSignalLike.slice]] / [[BaseSignalLike.bit]]
 */
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

/**
 * [[SignalLike]] representing a wire inside a net.
 */
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

/**
 * Basic signal type.
 * Should not be instantiated directly, instead use [[Signal]]
 */
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

  /**
   * Assign this signals value to another [[SignalLikeOrValue]]
   * @param b 
   */
  setTo(b:SignalLikeOrValue):AssignmentExpression {
    return {
      a: this,
      b,
      type: ASSIGNMENT_EXPRESSION,
      width: this.width
    };
  }

  /**
   * Alias of [[SignalT.setTo]]
   */
  ['='](b:SignalLikeOrValue) {
    return this.setTo(b);
  }
};

/**
 * Type representing some [[SignalLike]] being treated as explicitly Signed or Unsigned.
 * Should not be instantiated directly, instead use [[asSigned]] or [[asUnsigned]]
 */
export class ExplicitSignedness extends BaseSignalLike {
  width: number;
  signedness: Signedness;
  signal: SignalLike;
  readonly type:string = EXPLICIT_SIGNEDNESS;

  constructor(signal:SignalLike, signedness:Signedness) {
    super();
    this.width = signal.width;
    this.signedness = signedness;
    this.signal = signal;
  }
};

/**
 * Treat the given signal as signed
 * @param signal
 */
export const asSigned = (signal:SignalLike) => new ExplicitSignedness(signal, Signedness.Signed);

/**
 * Treat the given signal as unsigned
 * @param signal
 */
export const asUnsigned = (signal:SignalLike) => new ExplicitSignedness(signal, Signedness.Unsigned);


/**
 * Create a signal
 * @param width bit width
 * @param signedness signed or unsigned
 * @param defaultValue the value this signal holds by default (0 if unspecifed)
 */
export const Signal = (width = 1, signedness:Signedness = Signedness.Unsigned, defaultValue = 0) =>
  new SignalT(width, signedness, defaultValue);

/**
 * Create a slice (inclusive)
 * @param a the signal to slice from
 * @param fromBit the starting bit
 * @param toBit the ending bit
 */
export const Slice = (a:SignalLike, fromBit:number, toBit:number) =>
  new SliceT(a, fromBit, toBit);

/**
 * Create a constant
 * @param width bit width
 * @param value
 * @param signedness signed or unsigned
 */
export const Constant = (width:number = 1, value:number = 0, signedness:Signedness = Signedness.Unsigned) =>
  new ConstantT(width, value, signedness);

/**
 * Create a concatenation of signals
 * @param signals All the [[SignalLike]]s that should be concatenated
 */
export const Concat = (signals:SignalLike[]) => new ConcatT(signals);

/**
 * A constant logic-level HIGH signal
 */
export const HIGH = Constant(1, 1);

/**
 * A constant logic-level LOW signal
 */
export const LOW = Constant(1, 0);