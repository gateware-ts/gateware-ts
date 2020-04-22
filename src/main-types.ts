import { IfStatement, ElseIfStatement, IfElseBlock } from './block-expressions';
import { SignalT, ConstantT, SliceT, WireT, BaseSignalLike, ConcatT, BooleanExpression, Inverse, ExplicitSignedness, ComparrisonT, TernaryT, UnaryT } from './signals';
import { GWModule } from './gw-module';
import { VendorModule } from './vendor-module';

/**
 * Signed or Unsigned (currently unused)
 */
export enum Signedness {
  Signed,
  Unsigned
};

/**
 * Positive or negative edge of a [[SignalLike]]
 */
export enum Edge {
  Positive,
  Negative
};

/** @internal */
export enum Operation {
  Plus,
  Minus,
  Not,
  LogicalNot,
  Bit,
};

/** @internal */
export enum BooleanOperation {
  And,
  Or,
  Xor,
  LogicalAnd,
  LogicalOr,
  LeftShift,
  RightShift,
  LeftArithmeticShift,
  RightArithmeticShift,
};

/** @internal */
export enum CombinationalSignalType {
  Register,
  Wire
};

/** @internal */
export enum ComparrisonOperation {
  Equal,
  NotEqual,
  LessThan,
  GreaterThan,
  LessThanOrEqualTo,
  GreaterThanOrEqualTo,
};

/** @internal */
export enum LogicExpressionType {
  If,
  Switch,
  Case
}

/** @internal */
export interface OperationExpression {
  a: SignalLike;
  b: SignalLikeOrValue;
  op: Operation;
  type: 'operationExpression';
  width: number;
};

/** @internal */
export interface AssignmentExpression {
  a: SignalT;
  b: SignalLikeOrValue;
  type: 'assignmentExpression';
  width: number;
};

/** @internal */
export interface SwitchExpression {
  type: 'switchExpression';
  subject: SignalLike;
  cases: CaseExpression[];
}

/** @internal */
export interface SubjectiveCaseExpression {
  type: 'caseExpression';
  subject: SignalLikeOrValue;
  body: BlockExpression[];
};

/** @internal */
export interface DefaultCaseExpression {
  type: 'defaultCaseExpression';
  body: BlockExpression[];
};

/**
 * Any kind of connectable interface
 */
export type Port = SignalT | WireT;

/**
 * Anything that can be treated as if it were a [[SignalT]]
 */
export type SignalLike  = BaseSignalLike
                        | SignalT
                        | WireT
                        | SliceT
                        | ConcatT
                        | Inverse
                        | UnaryT
                        | ComparrisonT
                        | ConstantT
                        | OperationExpression
                        | TernaryT
                        | BooleanExpression
                        | ExplicitSignedness;

/**
 * Like [[SignalLike]] except allows for numbers (issues will occur if non-integers are used)
 * Likely to be removed in the future.
 */
export type SignalLikeOrValue = SignalLike | number;

export type CaseExpression = SubjectiveCaseExpression | DefaultCaseExpression;

/**
 * Logic expressions can only be used in synchronous blocks
 */
export type LogicExpression = IfStatement<BlockExpression>
                            | ElseIfStatement<BlockExpression>
                            | IfElseBlock<BlockExpression>
                            | SwitchExpression;
export type BlockExpression = LogicExpression | AssignmentExpression;

/** @internal */
export type CombinationalSwitchAssignmentExpression = {
  type: 'combinationalSwitchAssignmentExpression';
  to: Port;
  conditionalSignal: SignalLike;
  cases: [ConstantT | number, SignalLikeOrValue][];
  defaultCase: SignalLikeOrValue;
};

// TODO: In future, support generically-typed If expressions
/**
 * Various kinds of combinational assignments that can be made
 */
export type CombinationalLogic = AssignmentExpression | CombinationalSwitchAssignmentExpression;

/** @internal */
export type SyncBlock  = {
  signal: SignalT;
  edge: Edge;
  block: BlockExpression[];
}

/** @internal */
export type ModuleSignalDescriptor = {
  type: 'input' | 'internal' | 'output' | 'wire';
  signal: Port;
  name: string;
};

/** @internal */
export interface ModuleCodeElements {
  type: "moduleCodeElements";
  header: string;
  internalRegisters: string;
  internalWires: string;
  wireDeclarations: string;
  initialBlock: string;
  assignments: string;
  vendorModules: string;
  submodules: string;
  combAssigns: string;
  combAlways: string;
  syncBlocks: string;
};

/** @internal */
export interface SimulationCodeElements {
  type: "simulationCodeElements";
  timescale: string;
  header: string;
  registers: string;
  wires: string;
  submodules: string;
  everyTimescaleBlocks: string;
  simulationRunBlock: string;
  vcdBlock: string;
};

/** @internal */
export type CodeElements = ModuleCodeElements | SimulationCodeElements;

/** @internal */
export type GeneratedVerilogObject = {
  code: CodeElements;
  submodules: GWModule[];
};

export type SubmodulePortMappping = {
  inputs: { [input:string]: Port };
  outputs: { [output:string]: Port[] };
};

/** @internal */
export type PortWiring = { [portName:string]: string; };

/** @internal */
export type SubmoduleReference = {
  m: GWModule;
  mapping: SubmodulePortMappping;
  submoduleName: string;
};

/** @internal */
export type VendorModuleReference = {
  m: VendorModule<any>;
  mapping: SubmodulePortMappping;
};

/** @internal */
export type ModuleDescriptorObject = {
  m:GWModule,
  descriptor:ModuleSignalDescriptor,
};

/** @internal */
export type SignalMap = {
  input: Map<Port, string>,
  internal: Map<Port, string>,
  output: Map<Port, string>,
  wire: Map<Port, string>
};

/** @internal */
export type DrivenSignal = {
  signal: SignalT;
  name: string;
};

export type ParameterString = {
  type: 'parameterString',
  value: string;
};

/** @internal */
export type VendorSignalMap = {
  input: Map<Port, string>,
  output: Map<Port, string>,
};

/**
 * Any valid expression within a simulation
 */
export type SimulationExpression  = BlockExpression
                                  | EdgeAssertion
                                  | RepeatedEdgeAssertion
                                  | DisplayExpression
                                  | FinishExpression
                                  | IfStatement<SimulationExpression>
                                  | ElseIfStatement<SimulationExpression>
                                  | IfElseBlock<SimulationExpression>;

/** @internal */
export type IfStatementLike<BodyExprsT> = IfStatement<BodyExprsT> | ElseIfStatement<BodyExprsT>;

/** @internal */
export type BlockExpressionsAndTime = [number, BlockExpression[]];

/** @internal */
export interface EdgeAssertion {
  type: 'edgeAssertion';
  edgeType: Edge;
  signal: Port;
};

/** @internal */
export interface RepeatedEdgeAssertion {
  type: 'repeatedEdgeAssertion';
  signal: Port;
  edgeType: Edge;
  n: number;
};

/** @internal */
export interface DisplayExpression {
  type: 'displayExpression';
  messages: (string | SignalT)[];
};

/** @internal */
export interface FinishExpression {
  type: 'finishExpression';
}

/**
 * Timescales that can be used in simulations
 */
export enum TimeScale {
  Nanoseconds,
  Picoseconds,
  Milleseconds,
  Microseconds
};

/** @internal */
export type TimeScaleValue = {
  type: 'timescaleValue';
  timescale: TimeScale;
  value: number;
};
