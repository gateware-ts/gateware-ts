import { BitwiseUnaryOperationSignal, BooleanUnaryOperationSignal, SignalReference } from '../signal';
import { partialHash } from '../util';
import { Block, BlockElement, BlockElementType } from '../block/index';
import {
  ArithmeticOperationSignal,
  BaseSignalReference,
  BitwiseBinarySignal,
  BooleanOperationSignal,
  ConcatSignal,
  ExtendedSignal,
  RepeatSignal,
  SignalNodeType,
  SignedSignal,
  SliceSignal,
  TernarySignal,
} from "../signal";
import { Assignment, IfElseStatement, IfStatement, SwitchStatement } from '../block/element';
import { EvaluationError } from '../gw-error';
import { GWModule, SimulationModule } from '../module';
import { GeneratedSliceMap, GeneratedSliceSource } from '.';

type Module = GWModule | SimulationModule;

class TransformCtx {
  m: Module;
  currentBlock: BlockElement[];
  position: number;
  slices: GeneratedSliceMap;

  constructor(m: Module, currentBlock: BlockElement[], slices: GeneratedSliceMap) {
    this.m = m;
    this.currentBlock = currentBlock;
    this.position = 0;
    this.slices = slices;
  }

  fork(block: BlockElement[]) {
    return new TransformCtx(this.m, block, this.slices);
  }

  incrementPosition() {
    this.position++;
  }

  insertInto(statement: BlockElement) {
    this.currentBlock.splice(this.position++, 0, statement);
  }

  traverse() {
    while (true) {
      if (this.position >= this.currentBlock.length) {
        return;
      }
      visitElement(this.currentBlock[this.position], this);
    }
  }
}

const simpleRoots: SignalNodeType[] = [
  SignalNodeType.Signal,
  SignalNodeType.ProxySignal,
  SignalNodeType.ReadonlySignal
];

function visitSignal(s: BaseSignalReference, ctx: TransformCtx): void {
  switch (s.type) {
    // Shouldn't happen in any case
    case SignalNodeType.Base: { throw new EvaluationError('Cannot evaluate a base signal'); }

    case SignalNodeType.Slice: {
      const slice = s as SliceSignal;

      visitSignal(slice.root, ctx);

      if (!simpleRoots.includes(slice.root.type)) {
        const sliceHash = partialHash(slice.toString());
        const internalSignalName = `generatedSlice${sliceHash}`;

        let signal: SignalReference;

        if (!(internalSignalName in ctx.slices)) {
          signal = ctx.m.addInternal(internalSignalName, slice.root.width);
          ctx.slices[internalSignalName] = {
            name: internalSignalName,
            signal: slice.root,
            width: slice.root.width
          };
        } else {
          signal = ctx.m.internal[internalSignalName];
        }

        slice.root = signal;
      }

      return;
    }

    case SignalNodeType.Signal: return;
    case SignalNodeType.ProxySignal: return;
    case SignalNodeType.MemoryElement: return;
    case SignalNodeType.Constant: return;
    case SignalNodeType.BitwiseBinary: {
      const b = s as BitwiseBinarySignal;
      visitSignal(b.lhs, ctx);
      visitSignal(b.rhs, ctx);
      return;
    }
    case SignalNodeType.ComparisonOperation: case SignalNodeType.BitwiseBinary: {
      const b = s as BitwiseBinarySignal;
      visitSignal(b.lhs, ctx);
      visitSignal(b.rhs, ctx);
      return;
    }
    case SignalNodeType.Repeat: {
      visitSignal((s as RepeatSignal).signal, ctx);
      return;
    }
    case SignalNodeType.Signed: return visitSignal((s as SignedSignal).signal, ctx);
    case SignalNodeType.Ternary: {
      const t = s as TernarySignal;
      visitSignal(t.signal, ctx);
      visitSignal(t.ifTrue, ctx);
      visitSignal(t.ifFalse, ctx);
      return;
    }
    case SignalNodeType.Concat: return (s as ConcatSignal).signals.forEach(cs => visitSignal(cs, ctx));
    case SignalNodeType.Extended: return visitSignal((s as ExtendedSignal), ctx);
    case SignalNodeType.ArithmeticOperation: {
      const a = s as ArithmeticOperationSignal;
      visitSignal(a.lhs, ctx);
      visitSignal(a.rhs, ctx);
      return;
    }
    case SignalNodeType.BooleanOperation: {
      const b = s as BooleanOperationSignal;
      visitSignal(b.lhs, ctx);
      visitSignal(b.rhs, ctx);
      return;
    }
    case SignalNodeType.BooleanUnaryOperation: return visitSignal((s as BooleanUnaryOperationSignal).signal, ctx);
    case SignalNodeType.BitwiseUnaryOperation: return visitSignal((s as BitwiseUnaryOperationSignal).signal, ctx);

    default: {
      throw new Error(`Not implemented: ${s.type}`);
    }
  }
}

function visitElement(e: BlockElement, ctx: TransformCtx): void {
  switch (e.type) {
    case BlockElementType.Block: {
      const eb = (e as Block);
      ctx.fork((eb as Block).elements).traverse();
      break;
    }
    case BlockElementType.Assignment: {
      const a = e as Assignment;
      visitSignal(a.rhs, ctx);
      break;
    }
    case BlockElementType.If: {
      const i = e as IfStatement;
      visitSignal(i.condition, ctx);
      ctx.fork(i.body).traverse();
      i.elseIfs.forEach(elseIf => {
        visitSignal(elseIf.condition, ctx);
        ctx.fork(elseIf.body).traverse();
      });

      break;
    }
    case BlockElementType.IfElse: {
      const i = e as IfElseStatement;
      visitSignal(i.condition, ctx);
      ctx.fork(i.body).traverse();
      i.elseIfs.forEach(elseIf => {
        visitSignal(elseIf.condition, ctx);
        ctx.fork(elseIf.body).traverse();
      });
      ctx.fork(i.elseBody).traverse();

      break;
    }
    case BlockElementType.Switch: {
      const s = e as SwitchStatement;

      visitSignal(s.conditionalSignal, ctx);
      s.cases.forEach(c => {
        visitSignal(c.value, ctx);
        ctx.fork(c.body).traverse();
      });
      if (s.defaultCase) {
        ctx.fork(s.defaultCase).traverse();
      }

      break;
    }

    case BlockElementType.AdvanceTime: break;

    default: {
      throw new Error(`Not implemented: ${e.type}`);
    }
  }

  ctx.incrementPosition();
}

export const sliceTransform = (blockElements: BlockElement[], m: Module, slices: GeneratedSliceMap) => {
  const ctx = new TransformCtx(m, blockElements, slices);
  ctx.traverse();
}
