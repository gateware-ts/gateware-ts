import {
  Signedness,
  SignalLikeOrValue,
  Operation,
  AssignmentStatement,
  ComparrisonOperation,
  SignalLike,
  BooleanOperation,
} from "./main-types";
import {
  ASSIGNMENT_EXPRESSION,
  BINARY_EXPRESSION,
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
  UNARY_EXPRESSION,
  SUBMODULE_PATH_EXPRESSION
} from "./constants";

/**
 * Base class for all [[SignalLike]]s.
 * Should never be instaniated.
 */
export abstract class BaseSignalLike {
  type:string;
  width:number;

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  abstract isEqual(s:BaseSignalLike);

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
  plus(b:SignalLikeOrValue):BinaryT {
    return new BinaryT(this, b, Operation.Plus);
  }

  /**
   * Describe subtracting this signal from another [[SignalLikeOrValue]]
   * @param b
   */
  minus(b:SignalLikeOrValue):BinaryT {
    return new BinaryT(this, b, Operation.Minus);
  }

  /**
   * Bitwise and of this signal and another [[SignalLikeOrValue]]
   * @param b
   */
  and(b:SignalLikeOrValue):BooleanExpressionT {
    return new BooleanExpressionT(this, b, BooleanOperation.And, this.width);
  }

  /**
   * Logical and of this signal and another [[SignalLikeOrValue]] (produces a 1-bit wide signal)
   * @param b
   */
  andLogical(b:SignalLikeOrValue):BooleanExpressionT {
    return new BooleanExpressionT(this, b, BooleanOperation.LogicalAnd, 1);
  }

  /**
   * Bitwise or of this signal and another [[SignalLikeOrValue]]
   * @param b
   */
  orLogical(b:SignalLikeOrValue):BooleanExpressionT {
    return new BooleanExpressionT(this, b, BooleanOperation.LogicalOr, 1);
  }

  /**
   * Logical or of this signal and another [[SignalLikeOrValue]] (produces a 1-bit wide signal)
   * @param b
   */
  or(b:SignalLikeOrValue):BooleanExpressionT {
    return new BooleanExpressionT(this, b, BooleanOperation.Or, this.width);
  }

  /**
   * Bitwise xor of this signal and another [[SignalLikeOrValue]]
   * @param b
   */
  xor(b:SignalLikeOrValue):BooleanExpressionT {
    return new BooleanExpressionT(this, b, BooleanOperation.Xor, this.width);
  }

  /**
   * Bitwise left shift of this signal by another [[SignalLikeOrValue]]
   * @param b
   */
  shiftLeft(b:SignalLikeOrValue):BooleanExpressionT {
    return new BooleanExpressionT(this, b, BooleanOperation.LeftShift, this.width);
  }

  /**
   * Bitwise right shift of this signal by another [[SignalLikeOrValue]]
   * @param b
   */
  shiftRight(b:SignalLikeOrValue):BooleanExpressionT {
    return new BooleanExpressionT(this, b, BooleanOperation.RightShift, this.width);
  }

  /**
   * Arithmetic left shift of this signal by another [[SignalLikeOrValue]]
   * @param b
   */
  shiftLeftA(b:SignalLikeOrValue):BooleanExpressionT {
    return new BooleanExpressionT(this, b, BooleanOperation.LeftArithmeticShift, this.width);
  }

  /**
   * Arithmetic right shift of this signal by another [[SignalLikeOrValue]]
   * @param b
   */
  shiftRightA(b:SignalLikeOrValue):BooleanExpressionT {
    return new BooleanExpressionT(this, b, BooleanOperation.RightArithmeticShift, this.width);
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

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }
    return this.a.isEqual((s as Inverse).a);
  };

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
export class BooleanExpressionT extends BaseSignalLike {
  readonly type:string = BOOLEAN_EXPRESSION;
  a:SignalLike;
  b:SignalLikeOrValue;
  op:BooleanOperation;
  width:number;

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }

    const bEqual = typeof this.b === 'number' || typeof (s as BooleanExpressionT).b === 'number'
      ? this.b === (s as BooleanExpressionT).b
      : this.b.isEqual((s as BooleanExpressionT).b as BaseSignalLike);

    return this.op === (s as BooleanExpressionT).op
      && this.a.isEqual((s as BooleanExpressionT).a)
      && bEqual;
  };

  constructor(a:SignalLike, b:SignalLikeOrValue, op:BooleanOperation, width:number) {
    super();
    this.a = a;
    this.b = b;
    this.op = op;
    this.width  = width;
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

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }

    return this.value === (s as ConstantT).value
      && this.signedness === (s as ConstantT).signedness;
  };

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

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }

    if (this.signals.length !== (s as ConcatT).signals.length) {
      return false;
    }

    return this.signals.reduce((trueness, signal, i) => {
      return trueness && signal.isEqual((s as ConcatT).signals[i]);
    }, this.width === s.width);
  };

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

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }

    return this.a.isEqual((s as SliceT).a)
      && this.width === s.width
      && this.fromBit === (s as SliceT).fromBit
      && this.toBit === (s as SliceT).toBit;
  };

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

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    return this === s;
  };

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

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    return this === s;
  };

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
  setTo(b:SignalLikeOrValue):AssignmentStatement {
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
export class ExplicitSignednessT extends BaseSignalLike {
  width: number;
  signedness: Signedness;
  signal: SignalLike;
  readonly type:string = EXPLICIT_SIGNEDNESS;

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }

    return this.signal.isEqual((s as ExplicitSignednessT).signal)
      && this.width === s.width
      && this.signedness === (s as ExplicitSignednessT).signedness;
  };

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
  readonly type:string = COMPARRISON_EXPRESSION;

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }

    const bEqual = typeof this.b === 'number' || typeof (s as ComparrisonT).b === 'number'
      ? this.b === (s as ComparrisonT).b
      : this.b.isEqual((s as ComparrisonT).b as BaseSignalLike);

    return this.comparrisonOp === (s as ComparrisonT).comparrisonOp
      && this.a.isEqual((s as ComparrisonT).a)
      && bEqual;
  };

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

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }

    const aEqual = typeof this.a === 'number' || typeof (s as TernaryT).a === 'number'
      ? this.a === (s as TernaryT).a
      : this.a.isEqual((s as TernaryT).a as BaseSignalLike);

    const bEqual = typeof this.b === 'number' || typeof (s as TernaryT).b === 'number'
      ? this.b === (s as TernaryT).b
      : this.b.isEqual((s as TernaryT).b as BaseSignalLike);

    return this.width === s.width
      && this.comparrison === (s as TernaryT).comparrison
      && aEqual
      && bEqual;
  };

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

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }

    return this.width === s.width
      && this.op === (s as UnaryT).op
      && this.a.isEqual((s as UnaryT).a as BaseSignalLike);
  };

  constructor(a: SignalLike, op:Operation) {
    super();
    this.op = op;
    this.a = a;
  }
};

/**
 * Type representing a binary operation on two [[SignalLike]]s
 * Should not be instantiated directly, instead use [[BaseSignalLike.plus]], [[BaseSignalLike.minus]], etc
 */
export class BinaryT extends BaseSignalLike {
  width: number;
  a: SignalLike;
  b: SignalLikeOrValue;
  op: Operation;
  readonly type:string = BINARY_EXPRESSION;

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }

    const bEqual = typeof this.b === 'number' || typeof (s as BinaryT).b === 'number'
      ? this.b === (s as BinaryT).b
      : this.b.isEqual((s as BinaryT).b as BaseSignalLike);

    return this.width === s.width
      && this.op === (s as BinaryT).op
      && this.a.isEqual((s as BinaryT).a as BaseSignalLike)
      && bEqual;
  };

  constructor(a: SignalLike, b:SignalLikeOrValue, op:Operation) {
    super();
    this.width = a.width;
    this.op = op;
    this.a = a;
    this.b = b;
  }
};

/**
 * Type representing a path into a signal deeply nested in submodules. Only available in simulation.
 * Error prone because it relies on string, and therefore cannot perform any type checking.
 * Should not be instantiated directly.
 */
export class SubmodulePathT extends BaseSignalLike {
  width: number;
  path: string;
  readonly type:string = SUBMODULE_PATH_EXPRESSION;

  /**
   * Compare two [[SignalLike]]s
   * @param s Signal to compare with
   */
  isEqual(s:BaseSignalLike) {
    if (this.type !== s.type) {
      return false;
    }
    return this.path === (s as SubmodulePathT).path;
  };

  constructor(path:string) {
    super();
    // This might be a source of problems in the future (or now)
    this.width = 0;
    this.path = path;
  }
};

export const SubmodulePath = (path:string) => new SubmodulePathT(path);

/**
 * Like [[Not]] but always returns a 1-bit wide [[SignalLike]]
 * @param s The [[SignalLike]] whose bits should be flipped
 */
export const LogicalNot = (s:SignalLike) => new UnaryT(s, Operation.LogicalNot);

/**
 * Treat the given signal as signed
 * @param signal
 */
export const asSigned = (signal:SignalLike) => new ExplicitSignednessT(signal, Signedness.Signed);

/**
 * Treat the given signal as unsigned
 * @param signal
 */
export const asUnsigned = (signal:SignalLike) => new ExplicitSignednessT(signal, Signedness.Unsigned);


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
 * Isolate a single bit from a [[SignalLike]]
 * @param s
 * @param index the index to isolate
 */
export const Bit = (s:SignalLike, index:number) =>
  Slice(s, index, index);

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