/**
 * Contains expressions which can be used in synchronous logic
 * @packageDocumentation
 */

import {
  IF_STATEMENT,
  ELSE_STATEMENT,
  ELSE_IF_STATEMENT,
  SWITCH_STATEMENT,
  CASE_STATEMENT,
  DEFAULT_CASE_STATEMENT,
  COMBINATIONAL_SWITCH_ASSIGNMENT_STATEMENT
} from './constants';
import {
  BlockStatement,
  SignalLike,
  CaseExpression,
  SwitchStatement,
  SubjectiveCaseStatement,
  DefaultCaseStatement,
  SignalLikeOrValue,
  SimulationExpression,
  IfStatementLike,
  Port,
  CombinationalSwitchAssignmentStatement,
  SimulationSignalLike
} from './main-types';
import { ConstantT } from './signals';

/**
 * Should not be used directly, instead use [[If]] or [[SIf]]
*/
export interface IfElseBlock<SubjectType, BodyStatementsT> {
  type: 'elseStatement';
  parent: IfStatementLike<SubjectType, BodyStatementsT>;
  elseClause: BodyStatementsT[];
};

/**
 * Should not be used directly, instead use [[If]] or [[SIf]]
*/
export class ElseIfStatement<SubjectType, BodyStatementsT> {
  readonly type = ELSE_IF_STATEMENT;
  parentStatement: IfStatementLike<SubjectType, BodyStatementsT>;

  elseSubject: SubjectType;
  elseExprs: BodyStatementsT[];

  constructor(parent:IfStatement<SubjectType, BodyStatementsT> | ElseIfStatement<SubjectType, BodyStatementsT>, expr:SubjectType, body:BodyStatementsT[]) {
    this.parentStatement = parent;
    this.elseSubject = expr;
    this.elseExprs = body;
  }

  Else(exprs:BodyStatementsT[]):IfElseBlock<SubjectType, BodyStatementsT> {
    return ({
      type: ELSE_STATEMENT,
      parent: this,
      elseClause: exprs
    });
  }

  ElseIf(expr:SubjectType, body:BodyStatementsT[]) {
    return new ElseIfStatement<SubjectType, BodyStatementsT>(this, expr, body);
  }
}

/**
 * Should not be used directly, instead use [[If]] or [[SIf]]
*/
export class IfStatement<SubjectType, BodyStatementsT> {
  readonly type = IF_STATEMENT;
  subject: SubjectType;
  exprs: BodyStatementsT[];

  constructor(expr:SubjectType, body:BodyStatementsT[]) {
    this.exprs = body;
    this.subject = expr;
  }

  Else(exprs:BodyStatementsT[]):IfElseBlock<SubjectType, BodyStatementsT> {
    return ({
      type: ELSE_STATEMENT,
      parent: this,
      elseClause: exprs
    });
  }

  ElseIf(expr:SubjectType, body:BodyStatementsT[]) {
    return new ElseIfStatement<SubjectType, BodyStatementsT>(this, expr, body);
  }
}

/**
 * Conditionally run some logic
 * @param expr Expression to check
 * @param body Body of expressions to run if the expr condition is true
 */
export const If = (expr:SignalLike, body:BlockStatement[]) =>
  new IfStatement<SignalLike, BlockStatement>(expr, body);

/**
 * Conditionally run some logic, including simulation only expressions
 * @param expr Expression to check
 * @param body Body of expressions to run if the expr condition is true
 */
export const SIf = (expr:SimulationSignalLike, body:SimulationExpression[]) =>
  new IfStatement<SimulationSignalLike, SimulationExpression>(expr, body);

/**
 * Choose which logic to run based on the value at a signal
 * @param s The conditional signal
 * @param cases Cases for particular values
 */
export const Switch = (s:SignalLike, cases:CaseExpression[]):SwitchStatement => ({
  type: SWITCH_STATEMENT,
  subject: s,
  cases
});

/**
 * A block of logic associated with a specific possiblity
 * @param s The associated value
 * @param body Body of expressions to run in this case
 */
export const Case = (s:SignalLikeOrValue, body:BlockStatement[]):SubjectiveCaseStatement => ({
  type: CASE_STATEMENT,
  subject: s,
  body
});

/**
 * The default block of logic in a [[Switch]] Expression
 * @param body Body of expressions to run in this case
 */
export const Default = (body:BlockStatement[]):DefaultCaseStatement => ({ body, type: DEFAULT_CASE_STATEMENT });

/**
 * Combinational assignment to [[Port]] `to`, where based on the value of `conditionalSignal`, a case is selected as the output
 * @param to The [[Port]] to assign to
 * @param conditionalSignal The [[SignalLike]] whose value will decide the output
 * @param cases An array of pairs (array with two elements), where the first element is the comparrison value, and the output is the value
 * @param defaultCase A value to take on if no cases are used
 */
export const CombinationalSwitchAssignment = (to:Port, conditionalSignal:SignalLike, cases: [ConstantT | number, SignalLikeOrValue][], defaultCase:SignalLikeOrValue = 1):CombinationalSwitchAssignmentStatement => {
  return {
    type: COMBINATIONAL_SWITCH_ASSIGNMENT_STATEMENT,
    to,
    conditionalSignal,
    cases,
    defaultCase
  };
};