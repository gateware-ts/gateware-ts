import { ComparisonOperation, RepeatSignal, SignedSignal } from './../signal';
import { Indent } from './indent';
import { SignalOwnershipError } from './../gw-error';
import { EvaluationError } from "../gw-error";
import { SubmoduleOutputMap } from '.';
import { GWModule, SimulationModule } from "../module";
import {
  ArithmeticOperation,
  ArithmeticOperationSignal,
  BaseSignalReference,
  BitwiseBinaryOperation,
  BitwiseBinarySignal,
  BitwiseUnaryOperation,
  BitwiseUnaryOperationSignal,
  BooleanOperation,
  BooleanOperationSignal,
  BooleanUnaryOperation,
  BooleanUnaryOperationSignal,
  ComparisonOperationSignal,
  ConcatSignal,
  ConstantSignal,
  ExtendedSignal,
  ExtensionType,
  MemoryElement,
  ProxySignalReference,
  SignalNodeType,
  SignalReference,
  SliceSignal,
  TernarySignal,
} from "../signal";

const BitwiseSymbolMap: Record<BitwiseBinaryOperation | BitwiseUnaryOperation, string> = {
  [BitwiseBinaryOperation.And]:                   '&',
  [BitwiseBinaryOperation.Or]:                    '|',
  [BitwiseBinaryOperation.Xor]:                   '^',
  [BitwiseBinaryOperation.LeftShift]:             '<<',
  [BitwiseBinaryOperation.RightShift]:            '>>',
  [BitwiseBinaryOperation.RightShiftArithmetic]:  '>>>',
  [BitwiseUnaryOperation.Inverse]:                '~',
};

const ArithmeticSymbolMap: Record<ArithmeticOperation, string> = {
  [ArithmeticOperation.Add]:      '+',
  [ArithmeticOperation.Subtract]: '-',
};

const BooleanSymbolMap: Record<BooleanOperation | BooleanUnaryOperation, string> = {
  [BooleanOperation.And]:       '&&',
  [BooleanOperation.Or]:        '||',
  [BooleanOperation.Or]:        '||',
  [BooleanUnaryOperation.Not]:  '!',
};

const ComparisonSymbolMap: Record<ComparisonOperation, string> = {
  [ComparisonOperation.Equals]: '==',
  [ComparisonOperation.NotEquals]: '!=',
  [ComparisonOperation.LessThan]: '<',
  [ComparisonOperation.LessThanOrEquality]: '<=',
  [ComparisonOperation.GreaterThan]: '>',
  [ComparisonOperation.GreaterThanOrEquality]: '>=',
};

type Module = SimulationModule | GWModule;

export class Evaluator {
  private m: Module;
  private i: Indent;
  private o: SubmoduleOutputMap;

  constructor(module: Module, indent: Indent, outputMap: SubmoduleOutputMap) {
    this.m = module;
    this.i = indent;
    this.o = outputMap;
  }

  evaluate(s: BaseSignalReference): string {
    switch (s.type) {
      // Shouldn't happen in any case
      case SignalNodeType.Base: { throw new EvaluationError('Cannot evaluate a base signal'); }

      case SignalNodeType.Signal: return this.evaluateSignal(s as SignalReference);
      case SignalNodeType.ProxySignal: return this.evaluateSignal(s as ProxySignalReference);
      case SignalNodeType.MemoryElement: return this.evaluateMemoryElement(s as MemoryElement);
      case SignalNodeType.Constant: return this.evaluateConstant(s as ConstantSignal);
      case SignalNodeType.BitwiseBinary: return this.evaluateBitwiseBinary(s as BitwiseBinarySignal);
      case SignalNodeType.ComparisonOperation: return this.evaluateComparison(s as ComparisonOperationSignal);
      case SignalNodeType.Repeat: return this.evaluateRepeat(s as RepeatSignal);
      case SignalNodeType.Slice: return this.evaluateSlice(s as SliceSignal);
      case SignalNodeType.Signed: return this.evaluateSigned(s as SignedSignal);
      case SignalNodeType.Ternary: return this.evaluateTernary(s as TernarySignal);
      case SignalNodeType.Concat: return this.evaluateConcat(s as ConcatSignal);
      case SignalNodeType.Extended: return this.evaluateExtended(s as ExtendedSignal);
      case SignalNodeType.ArithmeticOperation: return this.evaluateArithmetic(s as ArithmeticOperationSignal);
      case SignalNodeType.BooleanOperation: return this.evaluateBoolean(s as BooleanOperationSignal);
      case SignalNodeType.BooleanUnaryOperation: return this.evaluateUnaryBoolean(s as BooleanUnaryOperationSignal);
      case SignalNodeType.BitwiseUnaryOperation: return this.evaluateUnaryBitwise(s as BitwiseUnaryOperationSignal);

      default: {
        throw new Error(`Not implemented: ${s.type}`);
      }
    }
  }

  evaluateSignal(s: SignalReference) {
    const ownedBySimulation = this.m instanceof SimulationModule && s.module === this.m.moduleUnderTest;
    const ownedByModule = this.m === s.module;
    if (ownedByModule || ownedBySimulation) return s.signalName;

    const mappedOutput = this.o.get(s);
    if (mappedOutput) return mappedOutput;

    throw new SignalOwnershipError(
      `Cannot evaluate non-owned reference signal ${s.module.moduleName}.${s.signalName} from module ${this.m.moduleName}.\n`
      + `Did you forget to add ${s.module.moduleName} as a submodule?`
    );
  }

  evaluateProxySignal(s: ProxySignalReference) {
    const ownedBySimulation = this.m instanceof SimulationModule && s.module === this.m.moduleUnderTest;
    if (ownedBySimulation) return s.signalName;

    throw new SignalOwnershipError(
      `Cannot evaluate non-owned reference signal ${s.module.moduleName}.${s.signalName} from Simulation module ${this.m.moduleName}.\n`
    );
  }

  evaluateConstant(s: ConstantSignal) { return `${s.width}'h${s.value.toString(16)}`; }

  evaluateBitwiseBinary(s: BitwiseBinarySignal) {
    const symbol = BitwiseSymbolMap[s.operation];
    return `(${this.evaluate(s.lhs)} ${symbol} ${this.evaluate(s.rhs)})`;
  }

  evaluateSlice(s: SliceSignal) {
    const sliceIndex = s.msb === s.lsb ? `[${s.msb}]` : `[${s.msb}:${s.lsb}]`;
    return `${this.evaluate(s.root)}${sliceIndex}`;
  }

  evaluateTernary(s: TernarySignal) {
    return `(${this.evaluate(s.signal)} ? ${this.evaluate(s.ifTrue)} : ${this.evaluate(s.ifFalse)})`;
  }

  evaluateConcat(s: ConcatSignal) {
    const collapseConcats = (signals: BaseSignalReference[]): BaseSignalReference[] => {
      return signals.flatMap(s =>
        s.type === SignalNodeType.Concat
        ? collapseConcats((s as ConcatSignal).signals)
        : s
      );
    }
    return `({ ${collapseConcats(s.signals).map(signal => this.evaluate(signal)).join(', ')} })`;
  }

  evaluateMemoryElement(s: MemoryElement) {
    if (s.module === this.m) return `${s.memory.memoryName}[${this.evaluate(s.index)}]`;
    throw new SignalOwnershipError(
      `Cannot evaluate non-owned reference memory ${s.module.moduleName}.${s.memory.memoryName} from module ${this.m.moduleName}.`
    );
  }

  evaluateExtended(s: ExtendedSignal) {
    const diff = s.width - s.signal.width;
    if (s.extensionType === ExtensionType.Zero) {
      return `({ ${diff}'b0, ${this.evaluate(s.signal)} })`;
    } else {
      const evaluated = this.evaluate(s.signal);
      return `({ ${diff}{${evaluated}[${s.signal.width-1}]}, ${evaluated} })`;
    }
  }

  evaluateArithmetic(s: ArithmeticOperationSignal) {
    const symbol = ArithmeticSymbolMap[s.operation];
    return `(${this.evaluate(s.lhs)} ${symbol} ${this.evaluate(s.rhs)})`;
  }

  evaluateBoolean(s: BooleanOperationSignal) {
    const symbol = BooleanSymbolMap[s.operation];
    return `(${this.evaluate(s.lhs)} ${symbol} ${this.evaluate(s.rhs)})`;
  }

  evaluateUnaryBoolean(s: BooleanUnaryOperationSignal) {
    const symbol = BooleanSymbolMap[s.operation];
    return `${symbol}${this.evaluate(s.signal)}`;
  }

  evaluateUnaryBitwise(s: BitwiseUnaryOperationSignal) {
    const symbol = BitwiseSymbolMap[s.operation];
    return `${symbol}${this.evaluate(s.signal)}`;
  }

  evaluateComparison(s: ComparisonOperationSignal) {
    const symbol = ComparisonSymbolMap[s.operation];
    return `(${this.evaluate(s.lhs)} ${symbol} ${this.evaluate(s.rhs)})`;
  }

  evaluateRepeat(s: RepeatSignal) {
    return `{ ${s.times}{${this.evaluate(s.signal)}} }`;
  }

  evaluateSigned(s: SignedSignal) {
    return `$signed(${this.evaluate(s.signal)})`;
  }
}
