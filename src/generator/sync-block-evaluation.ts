import { ExpressionEvaluator } from './expression-evaluation';
import { GWModule } from "../gw-module";
import { AssignmentExpression, BlockExpression, SwitchExpression, SubjectiveCaseExpression, SyncBlock, Edge } from '../main-types';
import { SignalT } from '../signals';
import { ASSIGNMENT_EXPRESSION, IF_EXPRESSION, SWITCH_EXPRESSION, CASE_EXPRESSION, ELSE_IF_EXPRESSION, ELSE_EXPRESSION } from '../constants';
import { IfStatement, ElseIfStatement, IfElseBlock } from '../block-expressions';
import { TabLevel } from '../helpers';
import { getRegSize } from './common';

export class SyncBlockEvaluator {
  private workingModule: GWModule;
  private expr: ExpressionEvaluator;
  private drivenSignals:SignalT[] = [];
  private t: TabLevel;

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

  generateInternalRegisterDeclarations(syncDrivenSignals:SignalT[]) {
    return this.workingModule.getInternalSignals().map(s => {
      return `${this.t.l()}${syncDrivenSignals.includes(s) ? 'reg' : 'wire'} ${getRegSize(s)}${this.workingModule.getModuleSignalDescriptor(s).name};`;
    }).join('\n')
  }

  generateInternalWireDeclarations() {
    return this.workingModule.getWires().map(w => {
      return `${this.t.l()}wire ${getRegSize(w)}${this.workingModule.getModuleSignalDescriptor(w).name};`;
    }).join('\n');
  }

  evaluate(expr:BlockExpression) {
    switch (expr.type) {
      case ASSIGNMENT_EXPRESSION: {
        return this.evaluateAssignmentExpression(expr);
      }

      case IF_EXPRESSION: {
        return this.evaluateIfExpression(expr);
      }

      case ELSE_IF_EXPRESSION: {
        return this.evaluateElseIfExpression(expr);
      }

      case ELSE_EXPRESSION: {
        return this.evaluateElseExpression(expr);
      }

      case SWITCH_EXPRESSION: {
        return this.evaluateSwitchExpression(expr as SwitchExpression);
      }
    }
  }

  evaluateBlock(s:SyncBlock) {
    const sensitivitySignalName = this.workingModule.getModuleSignalDescriptor(s.signal).name;
    let out = [
      `${this.t.l()}always @(${s.edge === Edge.Positive ? 'posedge' : 'negedge' } ${sensitivitySignalName}) begin`,
    ];

    this.t.push();
    s.block.forEach(expr => out.push(this.evaluate(expr)));
    this.t.pop();
    out.push(`${this.t.l()}end`);

    return out.join('\n');
  }

  evaluateAssignmentExpression(aExpr:AssignmentExpression) {
    let assigningRegister = this.workingModule.getModuleSignalDescriptor(aExpr.a);

    if (assigningRegister.type === 'input') {
      throw new Error('Cannot assign to an input in a synchronous block');
    }

    if (assigningRegister.type === 'output' || assigningRegister.type === 'internal') {
      // Keep track of it in the driven signals
      this.addDrivenSignal(aExpr.a);
    }

    return `${this.t.l()}${assigningRegister.name} <= ${this.expr.evaluate(aExpr.b)};`;
  }

  evaluateIfExpression(iExpr:IfStatement<BlockExpression>) {
    const out = [];

    out.push(`${this.t.l()}if (${this.expr.evaluate(iExpr.subject)}) begin`);

    this.t.push();
    iExpr.exprs.forEach(expr => out.push(this.evaluate(expr)));
    this.t.pop();

    out.push(`${this.t.l()}end`);
    return out.join('\n');
  }

  evaluateElseExpression(iExpr:IfElseBlock<BlockExpression>) {
    const out = [];

    const parentIf = iExpr.parent.type === IF_EXPRESSION
      ? this.evaluateIfExpression(iExpr.parent)
      : this.evaluateElseIfExpression(iExpr.parent);

    const elseStart = `${this.t.l()}else begin`;
    const endElse = `${this.t.l()}end`;

    out.push(parentIf, elseStart);

    this.t.push();
    iExpr.elseClause.forEach(expr => out.push(this.evaluate(expr)));
    this.t.pop();

    out.push(endElse);

    return out.join('\n');
  }

  evaluateElseIfExpression(iExpr:ElseIfStatement<BlockExpression>) {
    const out = [];

    const parentIf = iExpr.parentStatement.type === IF_EXPRESSION
      ? this.evaluateIfExpression(iExpr.parentStatement)
      : this.evaluateElseIfExpression(iExpr.parentStatement);

    const elseIf = `${this.t.l()}else if (${this.expr.evaluate(iExpr.elseSubject)}) begin`;
    const endElse = `${this.t.l()}end`;

    out.push(parentIf, elseIf);

    this.t.push();
    iExpr.elseExprs.forEach(expr => out.push(this.evaluate(expr)));
    this.t.pop();

    out.push(endElse);

    return out.join('\n');
  }

  evaluateSwitchExpression(sExpr:SwitchExpression) {
    const out = [];
    out.push(`${this.t.l()}case (${this.expr.evaluate(sExpr.subject)})`);
    this.t.push();

    out.push(
      sExpr.cases.map(expr => {
        const caseOut = [];

        if (expr.type === CASE_EXPRESSION) {
          const caseExpr = expr as SubjectiveCaseExpression;
          caseOut.push(`${this.t.l()}${this.expr.evaluate(caseExpr.subject)} : begin`);
        } else {
          caseOut.push(`${this.t.l()}default : begin`);
        }
        this.t.push();

        caseOut.push(
          expr.body.map(bodyExpr => this.evaluate(bodyExpr)).join('\n')
        );

        this.t.pop();
        caseOut.push(`${this.t.l()}end`);

        return caseOut.join('\n');
      }).join('\n\n')
    );

    this.t.pop();
    out.push(`${this.t.l()}endcase`);
    return out.join('\n');
  }
}