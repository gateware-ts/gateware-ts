import { BaseBlockElement, BlockElementType } from ".";

export enum SimulationElementType {
  AdvanceTime = 'AdvanceTime'
}

export type AdvanceTimeParams = { amount: number; }
export class AdvanceTimeElement extends BaseBlockElement {
  readonly type: BlockElementType = BlockElementType.AdvanceTime;
  amount: number;

  clone() {
    return new AdvanceTimeElement({
      amount: this.amount
    });
  }

  constructor(params: AdvanceTimeParams) {
    super();
    this.amount = params.amount;
  }
}
export const advanceTime = (amount: number) => new AdvanceTimeElement({ amount });

export type SimulationElement =
  | AdvanceTimeElement;

