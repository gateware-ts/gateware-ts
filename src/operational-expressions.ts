import { COMBINATIONAL_SWITCH_ASSIGNMENT_EXPRESSION } from './constants';
import { SignalLike, SignalLikeOrValue, Port, CombinationalSwitchAssignmentExpression } from './main-types';
import { ConstantT } from './signals';

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
