import { IfExpression } from './block-expressions';
import { SignalT, ConstantT, SliceT, WireT, BaseSignalLike, ConcatT } from './signals';
import { TSHDLModule } from './hdl-module';

export enum Signedness {
  Signed,
  Unsigned
};

export enum Edge {
  Positive,
  Negative
};

export enum Operation {
  Plus,
  Minus,
  Not,
  Bit,
};

export enum BooleanOperation {
  And,
  Or,
  Xor,
  LeftShift,
  RightShift,
  LeftArithmeticShift,
  RightArithmeticShift,
};

export enum ComparrisonOperation {
  Equal,
  NotEqual,
  LessThan,
  GreaterThan,
  LessThanOrEqualTo,
  GreaterThanOrEqualTo,
};

export enum LogicExpressionType {
  If,
  Switch,
  Case
}

export interface BooleanExpression {
  a: SignalLike;
  b: SignalLikeOrValue;
  op: BooleanOperation;
  type: 'booleanExpression';
  width: number;
};

export interface ComparrisonExpression {
  a: SignalLike;
  b: SignalLikeOrValue;
  comparrisonOp: ComparrisonOperation;
  type: 'comparrisonExpression';
  width: 1;
};

export interface OperationExpression {
  a: SignalLike;
  b: SignalLikeOrValue;
  op: Operation;
  type: 'operationExpression';
  width: number;
};

export interface AssignmentExpression {
  a: SignalT;
  b: SignalLikeOrValue;
  type: 'assignmentExpression';
  width: number;
};

export interface UnaryExpression {
  a: SignalLike;
  op: Operation;
  type: 'unaryExpression';
  width: number;
}

export interface TernaryExpression {
  a: SignalLikeOrValue;
  b: SignalLikeOrValue;
  comparrison: ComparrisonExpression;
  type: 'ternaryExpression';
  width: number;
}

export interface SwitchExpression {
  type: 'switchExpression';
  subject: SignalLike;
  cases: CaseExpression[];
}

export interface SubjectiveCaseExpression {
  type: 'caseExpression';
  subject: SignalLikeOrValue;
  body: BlockExpression[];
};

export interface DefaultCaseExpression {
  type: 'defaultCaseExpression';
  body: BlockExpression[];
};

export type Port = SignalT | WireT;
export type SignalLike  = BaseSignalLike
                        | SignalT
                        | WireT
                        | SliceT
                        | ConcatT
                        | UnaryExpression
                        | ComparrisonExpression
                        | ConstantT
                        | OperationExpression
                        | TernaryExpression
                        | BooleanExpression;

export type SignalLikeOrValue = SignalLike | number;
export type Slicable = SignalT | SliceT | UnaryExpression | ConstantT | OperationExpression;
export type CaseExpression = SubjectiveCaseExpression | DefaultCaseExpression;
export type LogicExpression = IfExpression | SwitchExpression;
export type BlockExpression = LogicExpression | AssignmentExpression;

// TODO: In future, support generically-typed Switch and If expressions
// e.g. Switch<'combinational'> vs Switch<'sync'>
// not sure if this is possible
export type CombinationalLogic = AssignmentExpression;


export type SyncBlock  = {
  signal: SignalT;
  edge: Edge;
  block: BlockExpression[];
}

export type InternallyShadowedRegister = {
  signal: SignalT;
  originalSignal: SignalT;
  name: string;
  originalName: string;
};

export type ModuleSignalDescriptor = {
  type: 'input' | 'internal' | 'output' | 'wire';
  signal: Port;
  name: string;
};

export type GeneratedVerilogObject = {
  code:string;
  submodules: TSHDLModule[];
};

export type SubmodulePortMappping = {
  inputs: { [input:string]: Port };
  outputs: { [output:string]: Port[] };
};

export type PortWiring = { [portName:string]: string; };

export type SubmoduleReference = {
  m: TSHDLModule;
  mapping: SubmodulePortMappping;
  submoduleName: string;
};

// TODO: This type is pretty weird... twake a second look to see if the code using it
// can be refactored to be less weird
export type ParentModuleSignalDescriptorObject = {
  m:TSHDLModule,
  descriptor:ModuleSignalDescriptor,
  submoduleRef?:SubmoduleReference;
};

export type SignalMap = {
  input: Map<Port, string>,
  internal: Map<Port, string>,
  output: Map<Port, string>,
  wire: Map<Port, string>
};

export type DrivenSignal = {
  signal: SignalT;
  name: string;
};