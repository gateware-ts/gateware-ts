import {
  IF_EXPRESSION,
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
  SimulationExpression
} from './main-types';

class GeneralIfStatement<BodyExprsT> {
  type = IF_EXPRESSION;
  subject: SignalLike;
  exprs: BodyExprsT[];
  elseClause: BodyExprsT[] | null;

  constructor(expr:SignalLike, body:BodyExprsT[]) {
    this.exprs = body;
    this.subject = expr;
    this.elseClause = null;
  }

  Else(body:BodyExprsT[]) {
    this.elseClause = body;
    return this;
  }
}

export class IfExpression extends GeneralIfStatement<BlockExpression> {}
export class SIfExpression extends GeneralIfStatement<SimulationExpression> {}

export const If = (expr:SignalLike, body:BlockExpression[]):IfExpression => new IfExpression(expr, body);
export const SIf = (expr:SignalLike, body:SimulationExpression[]) => new SIfExpression(expr, body);

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
