import {
  IF_EXPRESSION,
  SWITCH_EXPRESSION,
  CASE_EXPRESSION,
  DEFAULT_CASE_EXPRESSION
} from './constants';
import {
  ComparrisonExpression,
  BlockExpression,
  SignalLike,
  CaseExpression,
  SwitchExpression,
  SubjectiveCaseExpression,
  DefaultCaseExpression,
  SignalLikeOrValue
} from './main-types';

export class IfExpression {
  type = IF_EXPRESSION;
  subject: SignalLike;
  exprs: BlockExpression[];
  elseClause: BlockExpression[] | null;

  constructor(expr:ComparrisonExpression, body:BlockExpression[]) {
    this.exprs = body;
    this.subject = expr;
    this.elseClause = null;
  }

  Else(body:BlockExpression[]) {
    this.elseClause = body;
    return this;
  }
}

export const If = (expr:ComparrisonExpression, body:BlockExpression[]):IfExpression => new IfExpression(expr, body);

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
