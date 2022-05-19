import { BaseBlockElement, BlockElement, BlockElementType } from ".";
import { SignalWidthError, SwitchError } from "../gw-error";
import { BaseSignalReference, SignalReference } from "../signal";

export class Assignment extends BaseBlockElement {
  readonly type: BlockElementType = BlockElementType.Assignment;
  lhs: SignalReference;
  rhs: BaseSignalReference;

  constructor(lhs: SignalReference, rhs: BaseSignalReference) {
    super();
    if (lhs.width !== rhs.width) {
      throw new SignalWidthError(
        `Cannot assign signal "${lhs.module.moduleName}.${lhs.signalName}": Value width ${rhs.width} does not match ${lhs.width}`
      );
    }

    this.lhs = lhs;
    this.rhs = rhs;
  }

  clone() {
    return new Assignment(this.lhs.clone(), this.rhs.clone());
  }
}

type ConditionPlusBody = {
  condition: BaseSignalReference;
  body: BlockElement[];
}

type IfParams = ConditionPlusBody & { elseIfs: ConditionPlusBody[] }
export class IfStatement extends BaseBlockElement {
  readonly type: BlockElementType = BlockElementType.If;
  condition: BaseSignalReference;
  body: BlockElement[];
  elseIfs: ConditionPlusBody[];

  clone() {
    return new IfStatement({
      condition: this.condition.clone(),
      body: this.body.map(el => el.clone()),
      elseIfs: this.elseIfs.map(cpb => ({
        condition: cpb.condition.clone(),
        body: cpb.body.map(el => el.clone())
      }))
    });
  }

  constructor(params: IfParams) {
    super();
    this.condition = params.condition;
    this.body = params.body;
    this.elseIfs = params.elseIfs;
  }

  ElseIf(condition: BaseSignalReference, body: BlockElement[]) {
    return new IfStatement({
      condition: this.condition,
      body: this.body,
      elseIfs: [
        ...this.elseIfs,
        { condition, body }
      ]
    });
  }

  Else(body: BlockElement[]) {
    return new IfElseStatement({
      condition: this.condition,
      body: this.body,
      elseIfs: [...this.elseIfs],
      elseBody: body
    });
  }
}

type IfElseParams = IfParams & { elseBody: BlockElement[] }
export class IfElseStatement extends BaseBlockElement {
  readonly type: BlockElementType = BlockElementType.IfElse;
  condition: BaseSignalReference;
  body: BlockElement[];
  elseIfs: ConditionPlusBody[];
  elseBody: BlockElement[];

  clone() {
    return new IfElseStatement({
      condition: this.condition.clone(),
      body: this.body.map(el => el.clone()),
      elseIfs: this.elseIfs.map(cpb => ({
        condition: cpb.condition.clone(),
        body: cpb.body.map(el => el.clone())
      })),
      elseBody: this.elseBody.map(el => el.clone())
    });
  }

  constructor(params: IfElseParams) {
    super();
    this.condition = params.condition;
    this.body = params.body;
    this.elseIfs = params.elseIfs;
    this.elseBody = params.elseBody;
  }
}

export const If = (condition: BaseSignalReference, body: BlockElement[]) =>
  new IfStatement({ condition, body, elseIfs: [] });

export type CaseInstanceParams = {
  value: BaseSignalReference;
  body: BlockElement[];
}
export class CaseInstance {
  value: BaseSignalReference;
  body: BlockElement[];

  clone() {
    return new CaseInstance({
      value: this.value.clone(),
      body: this.body.map(el => el.clone())
    })
  }

  constructor(params: CaseInstanceParams) {
    this.value = params.value;
    this.body = params.body;
  }
}

export const Case = (value: BaseSignalReference, body: BlockElement[]) => new CaseInstance({ value, body });

export type SwitchStatementParams = {
  conditionalSignal: BaseSignalReference;
  cases: CaseInstance[];
  defaultCase?: BlockElement[];
}
export class SwitchStatement extends BaseBlockElement {
  readonly type: BlockElementType = BlockElementType.Switch;
  conditionalSignal: BaseSignalReference;
  cases: CaseInstance[];
  defaultCase?: BlockElement[];

  clone() {
    return new SwitchStatement({
      cases: this.cases.map(c => c.clone()),
      conditionalSignal: this.conditionalSignal.clone(),
      defaultCase: this.defaultCase ? this.defaultCase.map(el => el.clone()) : undefined
    })
  }

  constructor(params: SwitchStatementParams) {
    super();
    this.conditionalSignal = params.conditionalSignal;
    this.cases = params.cases;
    this.defaultCase = params.defaultCase;

    for (let i = 0; i < this.cases.length; i++) {
      const caseWidth = this.cases[i].value.width;
      if (caseWidth !== this.conditionalSignal.width) {
        throw new SignalWidthError(
          `Invalid width for case value at index ${i} (Case=${caseWidth}, Switch condition=${this.conditionalSignal.width})`
        );
      }
    }

    if (!this.defaultCase) {
      const numExhaustiveCases = 2**this.conditionalSignal.width;
      if (this.cases.length !== numExhaustiveCases) {
        throw new SwitchError(
          `Switch statements must be exhaustive when no default case is provided.`
          + `(Cases required=${numExhaustiveCases}, Cases provided=${this.cases.length})`
        );
      }
    }
  }
}

export const Switch = (conditionalSignal: BaseSignalReference, cases: CaseInstance[], defaultCase?: BlockElement[]) =>
  new SwitchStatement({ conditionalSignal, cases, defaultCase });
