import {
  IF_EXPRESSION,
  ELSE_EXPRESSION,
  ELSE_IF_EXPRESSION,
  SWITCH_EXPRESSION,
  CASE_EXPRESSION,
  DEFAULT_CASE_EXPRESSION
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
  IfStatementLike
} from './main-types';


export interface IfElseBlock<BodyExprsT> {
  type: 'elseExpression';
  parent: IfStatementLike<BodyExprsT>;
  elseClause: BodyExprsT[];
};

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

export const If = (expr:SignalLike, body:BlockExpression[]):IfStatement<BlockExpression> => new IfStatement<BlockExpression>(expr, body);
export const SIf = (expr:SignalLike, body:SimulationExpression[]):IfStatement<SimulationExpression> => new IfStatement<SimulationExpression>(expr, body);

export const Switch = (s:SignalLike, cases:CaseExpression[]):SwitchExpression => ({
  type: SWITCH_EXPRESSION,
  subject: s,
  cases
});

export const Case = (s:SignalLikeOrValue, body:BlockExpression[]):SubjectiveCaseExpression => ({
  type: CASE_EXPRESSION,
  subject: s,
  body
});

export const Default = (body:BlockExpression[]):DefaultCaseExpression => ({ body, type: DEFAULT_CASE_EXPRESSION });
