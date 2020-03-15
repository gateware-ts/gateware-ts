import { ExpressionEvaluator } from './expression-evaluation';
import { GWModule } from "../gw-module";
import { AssignmentExpression, CombinationalLogic } from '../main-types';
import { ASSIGNMENT_EXPRESSION } from '../constants';
import { TabLevel } from '../helpers';
import { SignalT } from '../signals';

export class CombLogicEvaluator {
  private workingModule: GWModule;
  private expr: ExpressionEvaluator;
  private t: TabLevel;
  private drivenSignals:SignalT[] = [];

  getDrivenSignals() { return this.drivenSignals; }

  constructor(m:GWModule, indentLevel:number = 1) {
    this.t = new TabLevel('  ', indentLevel);
    this.workingModule = m;
    this.expr = new ExpressionEvaluator(m);
    this.evaluate = this.evaluate.bind(this);
  }

  private addDrivenSignal(driven:SignalT) {
    if (!this.drivenSignals.includes(driven)) {
      this.drivenSignals.push(driven);
    }
  }

  setWorkingModule(m:GWModule) {
    this.workingModule = m;
    this.expr.setWorkingModule(m);
  }

  evaluate(expr:CombinationalLogic) {
    switch (expr.type) {
      case ASSIGNMENT_EXPRESSION: {
        return this.evaluateAssignmentExpression(expr as AssignmentExpression);
      }
    }
  }

  evaluateAssignmentExpression(expr:AssignmentExpression) {
    const assigningRegister = this.workingModule.getModuleSignalDescriptor(expr.a);

    if (assigningRegister.type === 'input') {
      throw new Error('Cannot assign to an input in combinational logic.');
    }

    this.addDrivenSignal(expr.a);

    return `${this.t.l()}assign ${assigningRegister.name} = ${this.expr.evaluate(expr.b)};`;
  }
}