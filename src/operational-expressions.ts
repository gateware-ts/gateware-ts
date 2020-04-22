import { COMBINATIONAL_SWITCH_ASSIGNMENT_EXPRESSION } from './constants';
import { SignalLike, SignalLikeOrValue, Port, CombinationalSwitchAssignmentExpression } from './main-types';
import { Slice, Inverse, ConstantT } from './signals';

/**
 * Bitwise invert all the bits in a [[SignalLike]]
 * @param s The [[SignalLike]] whose bits should be flipped
 */
export const Not = (s:SignalLike) => new Inverse(s);


/**
 * Isolate a single bit from a [[SignalLike]]
 * @param s
 * @param index the index to isolate
 */
export const Bit = (s:SignalLike, index:number) =>
  Slice(s, index, index);

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
