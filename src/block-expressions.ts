/**
 * Contains expressions which can be used in synchronous logic
 * @packageDocumentation
 */

import {
  IF_EXPRESSION,
  ELSE_EXPRESSION,
  ELSE_IF_EXPRESSION,
  SWITCH_EXPRESSION,
  CASE_EXPRESSION,
  DEFAULT_CASE_EXPRESSION,
  COMBINATIONAL_SWITCH_ASSIGNMENT_EXPRESSION
} from './constants';
import {
  BlockExpression,
  SignalLike,
  CaseExpression,
  SwitchExpression,
  SubjectiveCaseExpression,
  DefaultCaseExpression,
  SignalLikeOrValue,
  SimulationExpression,
  IfStatementLike,
  Port,
  CombinationalSwitchAssignmentExpression
} from './main-types';
import { ConstantT } from './signals';

/**
 * Should not be used directly, instead use [[If]] or [[SIf]]
*/
export interface IfElseBlock<BodyExprsT> {
  type: 'elseExpression';
  parent: IfStatementLike<BodyExprsT>;
  elseClause: BodyExprsT[];
};

/**
 * Should not be used directly, instead use [[If]] or [[SIf]]
*/
export class ElseIfStatement<BodyExprsT> {
  readonly type = ELSE_IF_EXPRESSION;
  parentStatement: IfStatementLike<BodyExprsT>;

  elseSubject: SignalLike;
  elseExprs: BodyExprsT[];

  constructor(parent:IfStatement<BodyExprsT> | ElseIfStatement<BodyExprsT>, expr:SignalLike, body:BodyExprsT[]) {
    this.parentStatement = parent;
    this.elseSubject = expr;
    this.elseExprs = body;
  }

  Else(exprs:BodyExprsT[]):IfElseBlock<BodyExprsT> {
    return ({
      type: ELSE_EXPRESSION,
      parent: this,
      elseClause: exprs
    });
  }

  ElseIf(expr:SignalLike, body:BodyExprsT[]) {
    return new ElseIfStatement<BodyExprsT>(this, expr, body);
  }
}

/**
 * Should not be used directly, instead use [[If]] or [[SIf]]
*/
export class IfStatement<BodyExprsT> {
  readonly type = IF_EXPRESSION;
  subject: SignalLike;
  exprs: BodyExprsT[];

  constructor(expr:SignalLike, body:BodyExprsT[]) {
    this.exprs = body;
    this.subject = expr;
  }

  Else(exprs:BodyExprsT[]):IfElseBlock<BodyExprsT> {
    return ({
      type: ELSE_EXPRESSION,
      parent: this,
      elseClause: exprs
    });
  }

  ElseIf(expr:SignalLike, body:BodyExprsT[]) {
    return new ElseIfStatement<BodyExprsT>(this, expr, body);
  }
}

/**
 * Conditionally run some logic
 * @param expr Expression to check
 * @param body Body of expressions to run if the expr condition is true
 */
export const If = (expr:SignalLike, body:BlockExpression[]):IfStatement<BlockExpression> => new IfStatement<BlockExpression>(expr, body);

/**
 * Conditionally run some logic, including simulation only expressions
 * @param expr Expression to check
 * @param body Body of expressions to run if the expr condition is true
 */
export const SIf = (expr:SignalLike, body:SimulationExpression[]):IfStatement<SimulationExpression> => new IfStatement<SimulationExpression>(expr, body);

/**
 * Choose which logic to run based on the value at a signal
 * @param s The conditional signal
 * @param cases Cases for particular values
 */
export const Switch = (s:SignalLike, cases:CaseExpression[]):SwitchExpression => ({
  type: SWITCH_EXPRESSION,
  subject: s,
  cases
});

/**
 * A block of logic associated with a specific possiblity
 * @param s The associated value
 * @param body Body of expressions to run in this case
 */
export const Case = (s:SignalLikeOrValue, body:BlockExpression[]):SubjectiveCaseExpression => ({
  type: CASE_EXPRESSION,
  subject: s,
  body
});

/**
 * The default block of logic in a [[Switch]] Expression
 * @param body Body of expressions to run in this case
 */
export const Default = (body:BlockExpression[]):DefaultCaseExpression => ({ body, type: DEFAULT_CASE_EXPRESSION });

/**
 * Combinational assignment to [[Port]] `to`, where based on the value of `conditionalSignal`, a case is selected as the output
 * @param to The [[Port]] to assign to
 * @param conditionalSignal The [[SignalLike]] whose value will decide the output
 * @param cases An array of pairs (array with two elements), where the first element is the comparrison value, and the output is the value
 * @param defaultCase A value to take on if no cases are used
 */
export const CombinationalSwitchAssignment = (to:Port, conditionalSignal:SignalLike, cases: [ConstantT | number, SignalLikeOrValue][], defaultCase:SignalLikeOrValue = 1):CombinationalSwitchAssignmentExpression => {
  return {
    type: COMBINATIONAL_SWITCH_ASSIGNMENT_EXPRESSION,
    to,
    conditionalSignal,
    cases,
    defaultCase
  };
};