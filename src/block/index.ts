export enum Edge { Positive = 'Positive', Negative = 'Negative' }

export enum BlockElementType {
  Base        = 'Base',
  If          = 'If',
  Block       = 'Block',
  IfElse      = 'IfElse',
  Switch      = 'Switch',
  Assignment  = 'Assignment',
  AdvanceTime = 'AdvanceTime',
}

export abstract class BaseBlockElement {
  readonly type: BlockElementType = BlockElementType.Base;
  abstract clone(): BaseBlockElement;
}

export class Block extends BaseBlockElement {
  readonly type: BlockElementType = BlockElementType.Block;
  elements: BlockElement[];
  constructor(elements: BlockElement[]) {
    super();
    this.elements = elements;
  }

  clone() {
    return new Block(this.elements.map(el => el.clone()));
  }
}

export type BlockElement = BaseBlockElement;
