import { Assignment } from './block/element';
import { SignalWidthError, ValidNumericTypeError, SliceError, ExtensionError, ConcatError, RepeatError } from './gw-error';
import { GWModule, SimulationModule } from "./module";

let globalId = 0;
const getNextId = () => globalId++;

export enum SignalNodeType {
  Base                      = 'Base',
  Slice                     = 'Slice',
  Signal                    = 'Signal',
  Concat                    = 'Concat',
  Repeat                    = 'Repeat',
  Signed                    = 'Signed',
  Ternary                   = 'Ternary',
  Constant                  = 'Constant',
  Extended                  = 'Extended',
  ProxySignal               = 'ProxySignal',
  BitwiseBinary             = 'BitwiseBinary',
  MemoryElement             = 'MemoryElement',
  ReadonlySignal            = 'ReadonlySignal',
  SliceReference            = 'SliceReference',
  BooleanOperation          = 'BooleanOperation',
  ArithmeticOperation       = 'ArithmeticOperation',
  ComparisonOperation       = 'ComparisonOperation',
  BooleanUnaryOperation     = 'BooleanUnaryOperation',
  BitwiseUnaryOperation     = 'BitwiseUnaryOperation',
}

export enum BitwiseBinaryOperation {
  And                   = 'And',
  Or                    = 'Or',
  Xor                   = 'Xor',
  LeftShift             = 'LeftShift',
  RightShift            = 'RightShift',
  RightShiftArithmetic  = 'RightShiftArithmetic',
}

export enum BooleanOperation {
  And = 'And',
  Or  = 'Or',
}

export enum ComparisonOperation {
  Equals                = 'Equals',
  NotEquals             = 'NotEquals',
  LessThan              = 'LessThan',
  GreaterThan           = 'GreaterThan',
  LessThanOrEquality    = 'LessThanOrEquality',
  GreaterThanOrEquality = 'GreaterThanOrEquality',
}

export enum ArithmeticOperation {
  Add       = 'Add',
  Subtract  = 'Subtract',
}

export enum BitwiseUnaryOperation { Inverse = 'Not' }
export enum BooleanUnaryOperation { Not = 'Not' }


type BaseSignalParams = {
  width: number;
  module: GWModule;
  id?: number;
}
export abstract class BaseSignalReference {
  readonly width: number;
  readonly module: GWModule;
  readonly type: SignalNodeType = SignalNodeType.Base;

  readonly id: number;

  constructor(params: BaseSignalParams) {
    this.width = params.width;
    this.module = params.module;
    this.id = ('id' in params) ? params.id : getNextId();
  }

  abstract toString(): string;
  abstract clone(): BaseSignalReference;

  visit(fn: (s: BaseSignalReference) => BaseSignalReference) {
    return fn(this);
  }

  repeat(times: number) {
    if (!Number.isInteger(times) || times < 1) {
      throw new RepeatError('Number of times must be postive integer > 1');
    }
    return new RepeatSignal({
      module: this.module,
      signal: this,
      width: this.width * times,
      times
    });
  }

  private bitwiseBinary(op: BitwiseBinaryOperation, rhs: BaseSignalReference) {
    if (rhs.width !== this.width) {
      throw new SignalWidthError(
        `Cannot ${op} signals of incompatible widths: ${this.width} does not match ${rhs.width}`
      );
    }

    return new BitwiseBinarySignal({
      lhs: this,
      rhs: rhs,
      module: this.module || rhs.module,
      operation: op,
      width: this.width
    });
  }

  private arithmetic(op: ArithmeticOperation, rhs: BaseSignalReference) {
    if (rhs.width !== this.width) {
      throw new SignalWidthError(
        `Cannot ${op} signals of incompatible widths: ${this.width} does not match ${rhs.width}`
      );
    }

    return new ArithmeticOperationSignal({
      lhs: this,
      rhs: rhs,
      module: this.module || rhs.module,
      operation: op,
      width: this.width + 1
    });
  }

  private boolean(op: BooleanOperation, rhs: BaseSignalReference) {
    return new BooleanOperationSignal({
      lhs: this,
      rhs: rhs,
      module: this.module || rhs.module,
      operation: op,
      width: 1
    });
  }

  private comparisonOp(op: ComparisonOperation, rhs: BaseSignalReference) {
    if (rhs.width !== this.width) {
      throw new SignalWidthError(
        `Cannot compare signals of incompatible widths: ${this.width} does not match ${rhs.width}`
      );
    }

    return new ComparisonOperationSignal({
      lhs: this,
      rhs: rhs,
      module: this.module || rhs.module,
      operation: op,
      width: 1
    });
  }

  slice(msb: number, lsb: number) {
    if (msb < lsb) {
      throw new SliceError(`LSB can not be greater than MSB in slice (MSB=${msb}, LSB=${lsb})`);
    }

    if (msb > this.width - 1) {
      throw new SliceError(`MSB out of range (MSB=${msb}, width=${this.width})`);
    }

    if (lsb < 0) {
      throw new SliceError(`LSB cannot be less than 0`);
    }

    const width = msb === lsb ? 1 : (msb - lsb) + 1;

    return new SliceSignal({
      module: this.module,
      root: this,
      width,
      lsb,
      msb
    });
  }

  bit(index: number) {
    if (index > this.width - 1) {
      throw new SliceError(`Index out of range (Index=${index}, width=${this.width})`);
    }

    return new SliceSignal({
      module: this.module,
      root: this,
      width: 1,
      lsb: index,
      msb: index
    });
  }

  inverse() {
    return new BitwiseUnaryOperationSignal({
      module: this.module,
      width: this.width,
      operation: BitwiseUnaryOperation.Inverse,
      signal: this
    });
  }
  ['~']() { return this.inverse(); }

  not() {
    return new BooleanUnaryOperationSignal({
      module: this.module,
      width: 1,
      operation: BooleanUnaryOperation.Not,
      signal: this
    });
  }
  ['!']() { return this.not(); }

  equals(rhs: BaseSignalReference) { return this.comparisonOp(ComparisonOperation.Equals, rhs); }
  ['=='](rhs: BaseSignalReference) { return this.equals(rhs); }

  notEquals(rhs: BaseSignalReference) { return this.comparisonOp(ComparisonOperation.NotEquals, rhs); }
  ['!='](rhs: BaseSignalReference) { return this.notEquals(rhs); }

  lessThan(rhs: BaseSignalReference) { return this.comparisonOp(ComparisonOperation.LessThan, rhs); }
  ['<'](rhs: BaseSignalReference) { return this.lessThan(rhs); }

  lessThanOrEquals(rhs: BaseSignalReference) { return this.comparisonOp(ComparisonOperation.LessThanOrEquality, rhs); }
  ['<='](rhs: BaseSignalReference) { return this.lessThanOrEquals(rhs); }

  greaterThan(rhs: BaseSignalReference) { return this.comparisonOp(ComparisonOperation.GreaterThan, rhs); }
  ['>'](rhs: BaseSignalReference) { return this.greaterThan(rhs); }

  greaterThanOrEquals(rhs: BaseSignalReference) { return this.comparisonOp(ComparisonOperation.GreaterThanOrEquality, rhs); }
  ['>='](rhs: BaseSignalReference) { return this.greaterThanOrEquals(rhs); }

  logicalAnd(rhs: BaseSignalReference) { return this.boolean(BooleanOperation.And, rhs); }
  ['&&'](rhs: BaseSignalReference) { return this.logicalAnd(rhs); }

  logicalOr(rhs: BaseSignalReference) { return this.boolean(BooleanOperation.Or, rhs); }
  ['||'](rhs: BaseSignalReference) { return this.logicalOr(rhs); }

  add(rhs: BaseSignalReference) { return this.arithmetic(ArithmeticOperation.Add, rhs); }
  ['+'](rhs: BaseSignalReference) { return this.add(rhs); }

  sub(rhs: BaseSignalReference) { return this.arithmetic(ArithmeticOperation.Subtract, rhs); }
  ['-'](rhs: BaseSignalReference) { return this.sub(rhs); }

  and(rhs: BaseSignalReference) { return this.bitwiseBinary(BitwiseBinaryOperation.And, rhs); }
  ['&'](rhs: BaseSignalReference) { return this.and(rhs); }

  or(rhs: BaseSignalReference) { return this.bitwiseBinary(BitwiseBinaryOperation.Or, rhs); }
  ['|'](rhs: BaseSignalReference) { return this.or(rhs); }

  xor(rhs: BaseSignalReference) { return this.bitwiseBinary(BitwiseBinaryOperation.Xor, rhs); }
  ['^'](rhs: BaseSignalReference) { return this.xor(rhs); }

  leftShift(amount: BaseSignalReference) { return this.bitwiseBinary(BitwiseBinaryOperation.LeftShift, amount); }
  ['<<'](amount: BaseSignalReference) { return this.leftShift(amount); }

  rightShift(amount: BaseSignalReference) { return this.bitwiseBinary(BitwiseBinaryOperation.RightShift, amount); }
  ['>>'](amount: BaseSignalReference) { return this.rightShift(amount); }

  rightShiftArithmetic(amount: BaseSignalReference) { return this.bitwiseBinary(BitwiseBinaryOperation.RightShiftArithmetic, amount); }
  ['>>>'](amount: BaseSignalReference) { return this.rightShiftArithmetic(amount); }

  ternary(ifTrue: BaseSignalReference, ifFalse: BaseSignalReference) {
    if (ifTrue.width !== ifFalse.width) {
      throw new SignalWidthError(`Ternary branches must be of the same width (T=${ifTrue.width}, F=${ifFalse.width})`);
    }

    return new TernarySignal({
      module: this.module,
      width: ifTrue.width,
      signal: this,
      ifTrue,
      ifFalse
    });
  }
  ['?'](ifTrue: BaseSignalReference, ifFalse: BaseSignalReference) { return this.ternary(ifTrue, ifFalse); }

  concat(signals: BaseSignalReference[]) {
    const totalWidth = signals.reduce((acc, s) => acc + s.width, this.width);
    return new ConcatSignal({
      module: this.module,
      width: totalWidth,
      signals: [this, ...signals]
    });
  }
  ['++'](signal: BaseSignalReference) { return this.concat([signal]); }
}

type SignalReferenceParams = BaseSignalParams & {
  signalName: string;
}
export class SignalReference extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.Signal;
  readonly signalName: string;
  readonly isExtendable = true;

  clone() {
    return new SignalReference({
      module: this.module,
      signalName: this.signalName,
      width: this.width,
      id: this.id
    });
  }

  constructor(params: SignalReferenceParams) {
    super(params);
    this.type = SignalNodeType.Signal;
    this.signalName = params.signalName;
  }

  toString() {
    return `Signal<${this.signalName}, ${this.width}>`;
  }

  setTo(value: BaseSignalReference) { return new Assignment(this, value); }
  ['='](value: BaseSignalReference) { return this.setTo(value); }

  extend(toWidth: number) {
    if (toWidth <= this.width) {
      throw new ExtensionError(`Cannot extend from ${this.width} bits to ${toWidth}`);
    }

    return new ExtendedSignal({
      module: this.module,
      width: toWidth,
      signal: this,
      extensionType: ExtensionType.Zero
    });
  }

  signExtend(toWidth: number) {
    if (toWidth <= this.width) {
      throw new ExtensionError(`Cannot sign-extend from ${this.width} bits to ${toWidth}`);
    }

    return new ExtendedSignal({
      module: this.module,
      width: toWidth,
      signal: this,
      extensionType: ExtensionType.Sign
    });
  }
}

type ConstantSignalParams = {
  width: number;
  value: bigint;
  id?: number;
}
export class ConstantSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.Constant;
  readonly value: bigint;

  clone() {
    return new ConstantSignal({
      width: this.width,
      value: this.value,
      id: this.id
    });
  }

  constructor(params: ConstantSignalParams) {
    super({
      module: null,
      width: params.width,
      id: params.id
    });

    if (params.value < 0n) {
      throw new ValidNumericTypeError(`Value must be an unsigned integer (got ${params.value.toString()})`);
    }

    // TODO: Nice way to check that the value fits in the bit width with BigInts
    this.value = params.value;
  }

  toString() {
    return `Constant<${this.width}>`;
  }

  static of(params: ConstantSignalParams) { return new ConstantSignal(params); }
}

export const Constant = (width: number, value: bigint) => new ConstantSignal({ width, value });

type BitwiseBinaryParams = BaseSignalParams & {
  lhs: BaseSignalReference;
  rhs: BaseSignalReference;
  operation: BitwiseBinaryOperation;
}
export class BitwiseBinarySignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.BitwiseBinary;
  lhs: BaseSignalReference;
  rhs: BaseSignalReference;
  operation: BitwiseBinaryOperation;

  clone() {
    return new BitwiseBinarySignal({
      lhs: this.lhs.clone(),
      rhs: this.rhs.clone(),
      operation: this.operation,
      id: this.id,
      module: this.module,
      width: this.width
    });
  }

  constructor(params: BitwiseBinaryParams) {
    super(params);
    this.lhs = params.lhs;
    this.rhs = params.rhs;
    this.operation = params.operation;
  }

  toString() {
    return `Bitwise<${this.lhs.toString()}, ${this.operation}, ${this.rhs.toString()}>`;
  }
}

type SliceParams = BaseSignalParams & {
  root: BaseSignalReference;
  msb: number;
  lsb: number;
}
export class SliceSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.Slice;
  root: BaseSignalReference;
  msb: number;
  lsb: number;

  clone() {
    return new SliceSignal({
      id: this.id,
      lsb: this.lsb,
      msb: this.msb,
      root: this.root.clone(),
      module: this.module,
      width: this.width
    });
  }

  constructor(params: SliceParams) {
    super(params);
    this.root = params.root;
    this.msb = params.msb;
    this.lsb = params.lsb;
  }

  toString() {
    return `Slice<${this.root.toString()}, ${this.msb}, ${this.lsb}>`;
  }
}


type TernaryParams = BaseSignalParams & {
  signal: BaseSignalReference;
  ifTrue: BaseSignalReference;
  ifFalse: BaseSignalReference;
}
export class TernarySignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.Ternary;
  signal: BaseSignalReference;
  ifTrue: BaseSignalReference;
  ifFalse: BaseSignalReference;

  clone() {
    return new TernarySignal({
      ifFalse: this.ifFalse.clone(),
      ifTrue: this.ifTrue.clone(),
      signal: this.signal.clone(),
      module: this.module,
      width: this.width,
      id: this.id
    })
  }

  constructor(params: TernaryParams) {
    super(params);
    this.signal = params.signal;
    this.ifTrue = params.ifTrue;
    this.ifFalse = params.ifFalse;
  }

  toString() {
    return `Ternary<${this.signal.toString()}, ${this.ifTrue.toString()}, ${this.ifFalse.toString()}>`;
  }
}

type ConcatParams = BaseSignalParams & {
  signals: BaseSignalReference[];
}
export class ConcatSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.Concat;
  signals: BaseSignalReference[];

  clone() {
    return new ConcatSignal({
      module: this.module,
      signals: this.signals.map(s => s.clone()),
      width: this.width,
      id: this.id
    });
  }

  constructor(params: ConcatParams) {
    super(params);
    this.signals = params.signals;
  }

  toString() {
    return `Concat<${this.signals.map(s => s.toString()).join(', ')}>`;
  }
}

export type MemoryParams = {
  width: number;
  depth: number;
  memoryName: string;
  module: GWModule;
}
export class Memory {
  width: number;
  depth: number;
  memoryName: string;
  module: GWModule;

  clone() {
    return new Memory({
      depth: this.depth,
      memoryName: this.memoryName,
      module: this.module,
      width: this.width
    });
  }

  constructor(params: MemoryParams) {
    this.width = params.width;
    this.depth = params.depth;
    this.memoryName = params.memoryName;
    this.module = params.module;
  }

  at(index: BaseSignalReference) {
    return new MemoryElement({
      width: this.width,
      signalName: `${this.memoryName}_element`,
      module: this.module,
      memory: this,
      index
    });
  }
}

export type MemoryElementParams = SignalReferenceParams & {
  memory: Memory;
  index: BaseSignalReference;
}
export class MemoryElement extends SignalReference {
  readonly type: SignalNodeType = SignalNodeType.MemoryElement;
  memory: Memory;
  index: BaseSignalReference;

  clone() {
    return new MemoryElement({
      index: this.index,
      memory: this.memory,
      module: this.module,
      signalName: this.signalName,
      width: this.width,
      id: this.id
    })
  }

  constructor(params: MemoryElementParams) {
    super(params);
    this.memory = params.memory;
    this.index = params.index;
  }

  toString() {
    return `MemoryElement<${this.signalName}, ${this.index}>`;
  }
}

export type Extendable = SignalReference | ProxySignalReference | ReadonlySignalReference;
export enum ExtensionType { Sign = 'Sign', Zero = 'Zero' }
export type ExetendedSignalParams = BaseSignalParams & {
  extensionType: ExtensionType;
  signal: Extendable;
}
export class ExtendedSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.Extended;
  extensionType: ExtensionType;
  signal: Extendable;

  clone() {
    return new ExtendedSignal({
      extensionType: this.extensionType,
      module: this.module,
      signal: this.signal.clone(),
      width: this.width,
      id: this.id
    });
  }

  constructor(params: ExetendedSignalParams) {
    super(params);
    this.extensionType = params.extensionType;
    this.signal = params.signal;
  }

  toString() {
    return `Extended<${this.extensionType}, ${this.signal.toString()}>`;
  }
}

type ArithmeticOperationParams = BaseSignalParams & {
  lhs: BaseSignalReference;
  rhs: BaseSignalReference;
  operation: ArithmeticOperation;
}
export class ArithmeticOperationSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.ArithmeticOperation;
  lhs: BaseSignalReference;
  rhs: BaseSignalReference;
  operation: ArithmeticOperation;

  clone() {
    return new ArithmeticOperationSignal({
      lhs: this.lhs.clone(),
      rhs: this.rhs.clone(),
      module: this.module,
      operation: this.operation,
      width: this.width,
      id: this.id
    })
  }

  constructor(params: ArithmeticOperationParams) {
    super(params);
    this.lhs = params.lhs;
    this.rhs = params.rhs;
    this.operation = params.operation;
  }

  toString() {
    return `Arithmetic<${this.lhs.toString()}, ${this.operation}, ${this.rhs.toString()}>`;
  }
}

type BooleanOperationParams = BaseSignalParams & {
  lhs: BaseSignalReference;
  rhs: BaseSignalReference;
  operation: BooleanOperation;
}
export class BooleanOperationSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.BooleanOperation;
  lhs: BaseSignalReference;
  rhs: BaseSignalReference;
  operation: BooleanOperation;

  clone() {
    return new BooleanOperationSignal({
      lhs: this.lhs.clone(),
      module: this.module,
      operation: this.operation,
      rhs: this.rhs.clone(),
      width: this.width,
      id: this.id
    });
  }

  constructor(params: BooleanOperationParams) {
    super(params);
    this.lhs = params.lhs;
    this.rhs = params.rhs;
    this.operation = params.operation;
  }

  toString() {
    return `Boolean<${this.lhs.toString()}, ${this.operation}, ${this.rhs.toString()}>`;
  }
}

type BooleanUnaryOperationParams = BaseSignalParams & {
  signal: BaseSignalReference;
  operation: BooleanUnaryOperation;
}
export class BooleanUnaryOperationSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.BooleanUnaryOperation;
  signal: BaseSignalReference;
  operation: BooleanUnaryOperation;

  clone() {
    return new BooleanUnaryOperationSignal({
      module: this.module,
      operation: this.operation,
      signal: this.signal.clone(),
      width: this.width,
      id: this.id
    });
  }

  constructor(params: BooleanUnaryOperationParams) {
    super(params);
    this.signal = params.signal;
    this.operation = params.operation;
  }

  toString() {
    return `BooleanUnary<${this.operation}, ${this.signal.toString()}}>`;
  }
}

type BitwiseUnaryOperationParams = BaseSignalParams & {
  signal: BaseSignalReference;
  operation: BitwiseUnaryOperation;
}
export class BitwiseUnaryOperationSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.BitwiseUnaryOperation;
  signal: BaseSignalReference;
  operation: BitwiseUnaryOperation;

  clone() {
    return new BitwiseUnaryOperationSignal({
      module: this.module,
      operation: this.operation,
      signal: this.signal.clone(),
      width: this.width,
      id: this.id
    });
  }

  constructor(params: BitwiseUnaryOperationParams) {
    super(params);
    this.signal = params.signal;
    this.operation = params.operation;
  }

  toString() {
    return `BitwiseUnary<${this.operation}, ${this.signal.toString()}}>`;
  }
}

export type ProxySignalParams = SignalReferenceParams & { testModule: SimulationModule };
export class ProxySignalReference extends SignalReference {
  readonly type: SignalNodeType = SignalNodeType.ProxySignal;
  testModule: SimulationModule;

  clone() {
    return new ProxySignalReference({
      module: this.module,
      signalName: this.signalName,
      testModule: this.testModule,
      width: this.width,
      id: this.id
    });
  }

  constructor(params: ProxySignalParams) {
    super(params);
    this.testModule = params.testModule;
  }

  toString() {
    return `ProxySignal<${this.signalName}, ${this.width}>`;
  }
}

export type ReadonlySignalParams = SignalReferenceParams & { testModule: SimulationModule };
export class ReadonlySignalReference extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.ReadonlySignal;
  readonly signalName: string;
  readonly isExtendable = true;
  testModule: SimulationModule;

  clone() {
    return new ReadonlySignalReference({
      module: this.module,
      signalName: this.signalName,
      testModule: this.testModule,
      width: this.width,
      id: this.id
    });
  }

  constructor(params: ReadonlySignalParams) {
    super(params);
    this.signalName = params.signalName;
    this.testModule = params.testModule;
  }

  slice(msb: number, lsb: number): SliceSignal {
    if (msb < lsb) {
      throw new SliceError(`LSB can not be greater than MSB in slice (MSB=${msb}, LSB=${lsb})`);
    }

    if (msb > this.width - 1) {
      throw new SliceError(`MSB out of range (MSB=${msb}, width=${this.width})`);
    }

    if (lsb < 0) {
      throw new SliceError(`LSB cannot be less than 0`);
    }

    const width = msb === lsb ? 1 : (msb - lsb) + 1;

    return new SliceSignal({
      module: this.module,
      root: this,
      width,
      lsb,
      msb
    });
  }

  bit(index: number): SliceSignal {
    if (index > this.width - 1) {
      throw new SliceError(`Index out of range (Index=${index}, width=${this.width})`);
    }

    return new SliceSignal({
      module: this.module,
      root: this,
      width: 1,
      lsb: index,
      msb: index
    });
  }

  extend(toWidth: number) {
    if (toWidth <= this.width) {
      throw new ExtensionError(`Cannot extend from ${this.width} bits to ${toWidth}`);
    }

    return new ExtendedSignal({
      module: this.module,
      width: toWidth,
      signal: this,
      extensionType: ExtensionType.Zero
    });
  }

  signExtend(toWidth: number) {
    if (toWidth <= this.width) {
      throw new ExtensionError(`Cannot sign-extend from ${this.width} bits to ${toWidth}`);
    }

    return new ExtendedSignal({
      module: this.module,
      width: toWidth,
      signal: this,
      extensionType: ExtensionType.Sign
    });
  }

  toString() {
    return `ReadonlySignal<${this.signalName}, ${this.width}>`;
  }
}

type ComparisonOperationParams = BaseSignalParams & {
  lhs: BaseSignalReference;
  rhs: BaseSignalReference;
  operation: ComparisonOperation;
}
export class ComparisonOperationSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.ComparisonOperation;
  lhs: BaseSignalReference;
  rhs: BaseSignalReference;
  operation: ComparisonOperation;

  clone() {
    return new ComparisonOperationSignal({
      lhs: this.lhs.clone(),
      module: this.module,
      operation: this.operation,
      rhs: this.rhs.clone(),
      width: this.width,
      id: this.id
    });
  }

  constructor(params: ComparisonOperationParams) {
    super(params);
    this.lhs = params.lhs;
    this.rhs = params.rhs;
    this.operation = params.operation;
  }

  toString() {
    return `Comparison<${this.lhs.toString()}, ${this.operation}, ${this.rhs.toString()}>`;
  }
}

type RepeatParams = BaseSignalParams & {
  signal: BaseSignalReference;
  times: number;
}
export class RepeatSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.Repeat;
  signal: BaseSignalReference;
  times: number;

  clone() {
    return new RepeatSignal({
      module: this.module,
      signal: this.signal.clone(),
      times: this.times,
      width: this.width,
      id: this.id
    });
  }

  constructor(params: RepeatParams) {
    super(params);
    this.signal = params.signal;
    this.times = params.times;
  }

  toString() {
    return `Repeat<${this.signal.toString()}, ${this.times}>`;
  }
}

type SignedParams = BaseSignalParams & { signal: BaseSignalReference }
export class SignedSignal extends BaseSignalReference {
  readonly type: SignalNodeType = SignalNodeType.Signed;
  signal: BaseSignalReference;

  clone() {
    return new SignedSignal({
      module: this.module,
      signal: this.signal.clone(),
      width: this.width,
      id: this.id
    });
  }

  constructor(params: SignedParams) {
    super(params);
    this.signal = params.signal;
  }

  toString() {
    return `Signed<${this.signal.toString()}>`;
  }
}

export const Repeat = (s: BaseSignalReference, times: number) => s.repeat(times);
export const Not = (s: BaseSignalReference) => s.not();
export const Inverse = (s: BaseSignalReference) => s.inverse();
export const Concat = (signals: BaseSignalReference[]) => {
  if (signals.length < 2) {
    throw new ConcatError(`Concat requires at least two signals`);
  }
  return signals[0].concat(signals.slice(1));
}
export const Signed = (s: BaseSignalReference) => new SignedSignal({ module: s.module, width: s.width, signal: s });
