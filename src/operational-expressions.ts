import { UNARY_EXPRESSION, TERNARY_EXPRESSION, COMBINATIONAL_SWITCH_ASSIGNMENT_EXPRESSION } from './constants';
import { SignalLike, UnaryExpression, Operation, SignalLikeOrValue, TernaryExpression, Port, CombinationalSwitchAssignmentExpression } from './main-types';
import { Slice, Inverse, ConstantT, ComparrisonT } from './signals';

/**
 * Bitwise invert all the bits in a [[SignalLike]]
 * @param s The [[SignalLike]] whose bits should be flipped
 */
export const Not = (s:SignalLike) => new Inverse(s);

/**
 * Like [[Not]] but always returns a 1-bit wide [[SignalLike]]
 * @param s The [[SignalLike]] whose bits should be flipped
 */
export const LogicalNot = (s:SignalLike): UnaryExpression => ({
  a: s,
  op: Operation.LogicalNot,
  type: UNARY_EXPRESSION,
  width: 1
});

/**
 * Isolate a single bit from a [[SignalLike]]
 * @param s
 * @param index the index to isolate
 */
export const Bit = (s:SignalLike, index:number) =>
  Slice(s, index, index);

/**
 * Multiplex two [[SignalLike]]s into one, using the comparrison to select
 * @param comparrison Selector that in the 0 case selects a, and in the 1 case selects b
 * @param a
 * @param b
 */
export const Ternary = (comparrison:ComparrisonT, a:SignalLike, b:SignalLike):TernaryExpression => {
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

/**
 * Combinational assignment to [[Port]] `to`, where based on the value of `conditionalSignal`, a case is selected as the output
 * @param to The [[Port]] to assign to
 * @param conditionalSignal The [[SignalLike]] whose value will decide the output
 * @param cases An array of pairs (array with two elements), where the first element is the comparrison value, and the output is the value
 * @param defaultCase A value to take on if no cases are used
 */
export const CombinationalSwitchAssignment = (to:Port, conditionalSignal:SignalLike, cases: [ConstantT | number, SignalLikeOrValue][], defaultCase:SignalLikeOrValue = 1): CombinationalSwitchAssignmentExpression => {
  return {
    type: COMBINATIONAL_SWITCH_ASSIGNMENT_EXPRESSION,
    to,
    conditionalSignal,
    cases,
    defaultCase
  };
};
