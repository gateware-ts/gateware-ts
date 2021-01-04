/**
 * @internal
 * @packageDocumentation
 */
import { ExpressionEvaluator } from './expression-evaluation';
import { GWModule } from "../gw-module";
import { AssignmentStatement, CombinationalLogic, PortOrSignalArray, SignalLikeOrValue, UnsliceableExpressionMap } from '../main-types';
import { ASSIGNMENT_EXPRESSION, COMBINATIONAL_SWITCH_ASSIGNMENT_STATEMENT } from '../constants';
import { TabLevel } from '../helpers';
import { CombinationalSwitchAssignmentStatement, Port, CombinationalSignalType } from './../main-types';
import { BinaryT, BooleanExpressionT, ComparrisonT, ConcatT, ConstantT, ExplicitSignednessT, Inverse, SignalArrayMemberReference, SignalT, SliceT, TernaryT, UnaryT, WireT, SignalArrayT } from '../signals';

export class CombLogicEvaluator {
  private workingModule: GWModule;
  private expr: ExpressionEvaluator;
  private t: TabLevel;
  private drivenSignals:PortOrSignalArray[] = [];
  private signalTypes:Map<PortOrSignalArray, CombinationalSignalType> = new Map();

  getDrivenSignals() { return this.drivenSignals; }
  getSignalTypes() { return this.signalTypes; }

  constructor(m:GWModule, uem:UnsliceableExpressionMap, indentLevel:number = 1) {
    this.t = new TabLevel('  ', indentLevel);
    this.workingModule = m;
    this.expr = new ExpressionEvaluator(m, uem);
    this.evaluate = this.evaluate.bind(this);
  }

  private addDrivenSignal(driven:PortOrSignalArray) {
    if (!this.drivenSignals.includes(driven)) {
      this.drivenSignals.push(driven);
    }
  }

  private assignSignalType(s:PortOrSignalArray, type:CombinationalSignalType) {
    const signalType = this.signalTypes.get(s);
    if (typeof signalType === 'undefined') {
      this.signalTypes.set(s, type);
    } else {
      if (signalType !== type) {
        const moduleName = this.workingModule.moduleName;
        const signalName = this.workingModule.getModuleSignalDescriptor(s).name;
        throw new Error(`Combinational Drive Type Error: Cannot drive ${moduleName}.${signalName} as both a register and a wire.`);
      }
    }
  }

  setWorkingModule(m:GWModule) {
    this.workingModule = m;
    this.expr.setWorkingModule(m);
  }

  evaluate(expr:CombinationalLogic) {
    switch (expr.type) {
      case ASSIGNMENT_EXPRESSION: {
        return this.evaluateAssignmentExpression(expr as AssignmentStatement);
      }

      case COMBINATIONAL_SWITCH_ASSIGNMENT_STATEMENT: {
        return this.evaluateSwitchAssignmentExpression(expr as CombinationalSwitchAssignmentStatement);
      }
    }
  }

  validatePrimitiveOwnership(s:PortOrSignalArray | SignalArrayMemberReference) {
    if (s.owner !== this.workingModule) {
      throw new Error(`Cannot evaluate signal not owned by this module [module=${this.workingModule.moduleName}, logic=Combinational]`);
    }
  }

  validateSignalOwnership(s:SignalLikeOrValue) {
    if (typeof s === 'number') return;
    if (s instanceof ConstantT) return;

    if (s instanceof SignalArrayMemberReference) {
      return this.validatePrimitiveOwnership(s.owner as SignalArrayT);
    }

    if (s instanceof SignalT || s instanceof WireT) {
      return this.validatePrimitiveOwnership(s);
    }

    if (s instanceof ConcatT) {
      return s.signals.forEach(cs => this.validateSignalOwnership(cs));
    }

    if (s instanceof SliceT || s instanceof Inverse || s instanceof UnaryT) {
      return this.validateSignalOwnership(s.a);
    }

    if (s instanceof ComparrisonT || s instanceof BinaryT || s instanceof BooleanExpressionT) {
      return this.validateSignalOwnership(s.a) || this.validateSignalOwnership(s.b);
    }

    if (s instanceof TernaryT) {
      return (
        this.validateSignalOwnership(s.a)
        || this.validateSignalOwnership(s.b)
        || this.validateSignalOwnership(s.comparrison)
      );
    }

    if (s instanceof ExplicitSignednessT) {
      return this.validateSignalOwnership(s.signal);
    }

    if (s.owner !== this.workingModule) {
      throw new Error(`Cannot evaluate signal not owned by this module [module=${this.workingModule.moduleName}]`);
    }
  }

  evaluateAssignmentExpression(expr:AssignmentStatement) {
    this.validateSignalOwnership(expr.a);
    this.validateSignalOwnership(expr.b);

    const assigningRegister = (expr.a instanceof SignalArrayMemberReference)
      ? this.workingModule.getModuleSignalDescriptor((expr.a as SignalArrayMemberReference).parent)
      : this.workingModule.getModuleSignalDescriptor(expr.a);

    if (assigningRegister.type === 'input') {
      throw new Error('Cannot assign to an input in combinational logic.');
    }

    if (assigningRegister.type === 'internal') {
      if (expr.a instanceof SignalArrayMemberReference) {
        // We need to mark the the whole register as combinational
        this.addDrivenSignal(expr.a.parent);
        this.assignSignalType(expr.a.parent, CombinationalSignalType.Wire);

        return `${this.t.l()}assign ${assigningRegister.name}[${this.expr.evaluate(expr.a.index)}] = ${this.expr.evaluate(expr.b)};`;
      }
    }

    this.addDrivenSignal(expr.a as SignalT);
    this.assignSignalType(expr.a as SignalT, CombinationalSignalType.Wire);

    return `${this.t.l()}assign ${assigningRegister.name} = ${this.expr.evaluate(expr.b)};`;
  }

  evaluateSwitchAssignmentExpression(expr:CombinationalSwitchAssignmentStatement) {
    this.validateSignalOwnership(expr.conditionalSignal);
    this.validateSignalOwnership(expr.defaultCase);
    expr.cases.forEach(([_, rhs]) => this.validateSignalOwnership(rhs));

    const assigningRegister = this.workingModule.getModuleSignalDescriptor(expr.to);
    if (assigningRegister.type === 'input') {
      throw new Error('Cannot assign to an input in combinational logic.');
    }
    this.addDrivenSignal(expr.to);
    this.assignSignalType(expr.to, CombinationalSignalType.Register);

    const out = [];

    // The outer code will wrap this in an always @(*) block
    this.t.push();
    out.push(`${this.t.l()}case (${this.expr.evaluate(expr.conditionalSignal)})`);
    this.t.push();

    expr.cases.forEach(([testCase, outputSignal]) => {
      out.push(`${this.t.l()}${this.expr.evaluate(testCase)} : begin`);
      out.push(`${this.t.l(1)}${this.expr.evaluate(expr.to)} = ${this.expr.evaluate(outputSignal)};`);
      out.push(`${this.t.l()}end`);
    });

    out.push(`${this.t.l()}default : begin`);
    out.push(`${this.t.l(1)}${this.expr.evaluate(expr.to)} = ${this.expr.evaluate(expr.defaultCase)};`);
    out.push(`${this.t.l()}end`);

    this.t.pop();
    out.push(`${this.t.l()}endcase`);
    this.t.pop();

    return out.join('\n');
  }
};
