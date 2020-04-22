import {
  Signedness,
  SignalLikeOrValue,
  Operation,
  AssignmentExpression,
  OperationExpression,
  ComparrisonOperation,
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
  EXPLICIT_SIGNEDNESS,
  TERNARY_EXPRESSION,
  UNARY_EXPRESSION
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
   * Treat this signal as signed
   */
  asSigned() {
    return asSigned(this);
  }

  /**
   * Treat this signal as unsigned
   */
  asUnsigned() {
    return asUnsigned(this);
  }

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
  eq(b:SignalLikeOrValue):ComparrisonT {
    return new ComparrisonT(this, b, ComparrisonOperation.Equal);
  }

  /**
   * Compare if this signal is less than another [[SignalLikeOrValue]]
   * @param b
   */
  lt(b:SignalLikeOrValue):ComparrisonT {
    return new ComparrisonT(this, b, ComparrisonOperation.LessThan);
  }

  /**
   * Compare if this signal is greater than another [[SignalLikeOrValue]]
   * @param b
   */
  gt(b:SignalLikeOrValue):ComparrisonT {
    return new ComparrisonT(this, b, ComparrisonOperation.GreaterThan);
  }

  /**
   * Compare if this signal is less than or equal to another [[SignalLikeOrValue]]
   * @param b
   */
  lte(b:SignalLikeOrValue):ComparrisonT {
    return new ComparrisonT(this, b, ComparrisonOperation.LessThanOrEqualTo);
  }

  /**
   * Compare if this signal is greater than or equal to another [[SignalLikeOrValue]]
   * @param b
   */
  gte(b:SignalLikeOrValue):ComparrisonT {
    return new ComparrisonT(this, b, ComparrisonOperation.GreaterThanOrEqualTo);
  }

  /**
   * Compare if this signal is not equal to another [[SignalLikeOrValue]]
   * @param b
   */
  neq(b:SignalLikeOrValue):ComparrisonT {
    return new ComparrisonT(this, b, ComparrisonOperation.NotEqual);
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
   * Multiplex two [[SignalLike]]s into one, using this signal to select
   * @param a
   * @param b
   */
  ternary(a:SignalLikeOrValue, b:SignalLikeOrValue) {
    return new TernaryT(this, a, b);
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

  /**
   * Alias of [[BaseSignalLike.ternary]]
   */
  ['?'](a:SignalLikeOrValue, b:SignalLikeOrValue) {
    return this.ternary(a, b);
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
 * Type representing the comparrison of  two [[SignalLike]]s. Always returns a one-bit wide signal.
 * Should not be instantiated directly, instead use [[BaseSignalLike.eq]], [[BaseSignalLike.lt]], etc
 */
export class ComparrisonT extends BaseSignalLike {
  width: 1;
  a: SignalLike;
  b: SignalLikeOrValue;
  comparrisonOp: ComparrisonOperation;
  signal: SignalLike;
  readonly type:string = COMPARRISON_EXPRESSION;

  constructor(a:SignalLike, b:SignalLikeOrValue, comparrisonOp: ComparrisonOperation) {
    super();
    this.a = a;
    this.b = b;
    this.comparrisonOp = comparrisonOp;
  }
};

/**
 * Type representing the multiplexing of two [[SignalLike]]s into one, using the comparrison signal to select
 * Should not be instantiated directly, instead use [[Ternary]] or [[BaseSignalLike.ternary]]
 */
export class TernaryT extends BaseSignalLike {
  width: number;
  a: SignalLikeOrValue;
  b: SignalLikeOrValue;
  comparrison: SignalLike;
  readonly type:string = TERNARY_EXPRESSION;

  constructor(comparrison: SignalLike, a: SignalLikeOrValue, b: SignalLikeOrValue) {
    super();
    this.comparrison = comparrison;
    this.a = a;
    this.b = b;
  }
};

/**
 * Type representing a unary operation on a [[SignalLike]]
 * Should not be instantiated directly, instead use [[LogicalNot]]
 */
export class UnaryT extends BaseSignalLike {
  width: number;
  a: SignalLike;
  op: Operation;
  readonly type:string = UNARY_EXPRESSION;

  constructor(a: SignalLike, op:Operation) {
    super();
    this.op = op;
    this.a = a;
  }
};

/**
 * Like [[Not]] but always returns a 1-bit wide [[SignalLike]]
 * @param s The [[SignalLike]] whose bits should be flipped
 */
export const LogicalNot = (s:SignalLike) => new UnaryT(s, Operation.LogicalNot);

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
 * Multiplex two [[SignalLike]]s into one, using the comparrison to select
 * @param comparrison Selector that in the 0 case selects a, and in the 1 case selects b
 * @param a
 * @param b
 */
export const Ternary = (comparrison:SignalLike, a:SignalLike, b:SignalLike) => {
  return new TernaryT(comparrison, a, b);
};

/**
 * Bitwise invert all the bits in a [[SignalLike]]
 * @param s The [[SignalLike]] whose bits should be flipped
 */
export const Not = (s:SignalLike) => new Inverse(s);

/**
 * A constant logic-level HIGH signal
 */
export const HIGH = Constant(1, 1);

/**
 * A constant logic-level LOW signal
 */
export const LOW = Constant(1, 0);