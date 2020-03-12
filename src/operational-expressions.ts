import { UNARY_EXPRESSION, TERNARY_EXPRESSION } from './constants';
import { SignalLike, UnaryExpression, Operation, ComparrisonExpression, SignalLikeOrValue, TernaryExpression } from './main-types';
import { Slice } from './signals';

export const Not = (s:SignalLike): UnaryExpression => ({
  a: s,
  op: Operation.Not,
  type: UNARY_EXPRESSION,
  width: s.width
});

export const Bit = (s:SignalLike, index:number) =>
  Slice(s, index, index);

export const Ternary = (comparrison:ComparrisonExpression, a:SignalLike, b:SignalLike):TernaryExpression => {
  if (a.width !== b.width) {
    throw new Error('Invalid ternary - inputs must have the same width');
  }

  return {
    a,
    b,
    comparrison,
    type: TERNARY_EXPRESSION,
    width: a.width
  };
}