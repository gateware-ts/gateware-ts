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
}

export class IfExpression extends GeneralIfStatement<BlockExpression> {
  Else(body:BlockExpression[]) {
    const forked = new IfExpression(this.subject, this.exprs);
    forked.elseClause = body;
    return forked;
  }

  ElseIf(expr:SignalLike, body:BlockExpression[]) {
    return If (this.subject, this.exprs) .Else ([
      If (expr, body)
    ]);
  }
}
export class SIfExpression extends GeneralIfStatement<SimulationExpression> {
  Else(body:SimulationExpression[]) {
    const forked = new SIfExpression(this.subject, this.exprs);
    forked.elseClause = body;
    return forked;
  }

  ElseIf(expr:SignalLike, body:SimulationExpression[]) {
    return SIf (this.subject, this.exprs) .Else ([
      SIf (expr, body)
    ]);
  }
}

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
