/**
 * @internal
 * @packageDocumentation
 */
import { ExpressionEvaluator } from './expression-evaluation';
import { GWModule } from "../gw-module";
import { AssignmentStatement, BlockStatement, SwitchStatement, SubjectiveCaseStatement, SyncBlock, Edge, UnsliceableExpressionMap, SignalLike, PortOrSignalArray } from '../main-types';
import { SignalArrayMemberReference, SignalArrayT, SignalT } from '../signals';
import { ASSIGNMENT_EXPRESSION, IF_STATEMENT, SWITCH_STATEMENT, CASE_STATEMENT, ELSE_IF_STATEMENT, ELSE_STATEMENT } from '../constants';
import { IfStatement, ElseIfStatement, IfElseBlock } from '../block-statements';
import { TabLevel } from '../helpers';
import { getRegSize } from './common';

export class SyncBlockEvaluator {
  private workingModule: GWModule;
  private expr: ExpressionEvaluator;
  private drivenSignals:PortOrSignalArray[] = [];
  private t: TabLevel;

  getDrivenSignals() { return this.drivenSignals; }

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

  setWorkingModule(m:GWModule) {
    this.workingModule = m;
    this.expr.setWorkingModule(m);
  }

  generateInternalRegisterDeclarations(syncDrivenSignals:PortOrSignalArray[]) {
    return this.workingModule.getInternalSignals().map(s => {
      const arrayBrackets = (s instanceof SignalArrayT) ? ` [0:${s.depth-1}]` : '';
      const type = syncDrivenSignals.includes(s) ? 'reg' : 'wire';
      const size = getRegSize(s);
      const name = this.workingModule.getModuleSignalDescriptor(s).name;

      return `${this.t.l()}${type} ${size}${name}${arrayBrackets};`;
    }).join('\n')
  }

  generateInternalWireDeclarations() {
    return this.workingModule.getWires().map(w => {
      return `${this.t.l()}wire ${getRegSize(w)}${this.workingModule.getModuleSignalDescriptor(w).name};`;
    }).join('\n');
  }

  evaluate(expr:BlockStatement) {
    switch (expr.type) {
      case ASSIGNMENT_EXPRESSION: {
        return this.evaluateAssignmentExpression(expr);
      }

      case IF_STATEMENT: {
        return this.evaluateIfStatement(expr);
      }

      case ELSE_IF_STATEMENT: {
        return this.evaluateElseIfStatement(expr);
      }

      case ELSE_STATEMENT: {
        return this.evaluateElseStatement(expr);
      }

      case SWITCH_STATEMENT: {
        return this.evaluateSwitchStatement(expr as SwitchStatement);
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

  evaluateAssignmentExpression(aExpr:AssignmentStatement) {
    const assigningRegister = (aExpr.a instanceof SignalArrayMemberReference)
      ? this.workingModule.getModuleSignalDescriptor((aExpr.a as SignalArrayMemberReference).parent)
      : this.workingModule.getModuleSignalDescriptor(aExpr.a);

    if (assigningRegister.type === 'input') {
      throw new Error('Cannot assign to an input in a synchronous block');
    }

    // Check for Signal Arrays
    if (assigningRegister.type === 'internal') {
      if (aExpr.a instanceof SignalArrayMemberReference) {
        // We need to mark the the whole register as combinational
        this.addDrivenSignal(aExpr.a.parent);

        return `${this.t.l()}${assigningRegister.name}[${this.expr.evaluate(aExpr.a.index)}] <= ${this.expr.evaluate(aExpr.b)};`;
      }
    }

    if (assigningRegister.type === 'output' || assigningRegister.type === 'internal') {
      // Keep track of it in the driven signals
      this.addDrivenSignal(aExpr.a as SignalT);
    }

    return `${this.t.l()}${assigningRegister.name} <= ${this.expr.evaluate(aExpr.b)};`;
  }

  evaluateIfStatement(iExpr:IfStatement<SignalLike, BlockStatement>) {
    const out = [];

    out.push(`${this.t.l()}if (${this.expr.evaluate(iExpr.subject)}) begin`);

    this.t.push();
    iExpr.exprs.forEach(expr => out.push(this.evaluate(expr)));
    this.t.pop();

    out.push(`${this.t.l()}end`);
    return out.join('\n');
  }

  evaluateElseStatement(iExpr:IfElseBlock<SignalLike, BlockStatement>) {
    const out = [];

    const parentIf = iExpr.parent.type === IF_STATEMENT
      ? this.evaluateIfStatement(iExpr.parent)
      : this.evaluateElseIfStatement(iExpr.parent);

    const elseStart = `${this.t.l()}else begin`;
    const endElse = `${this.t.l()}end`;

    out.push(parentIf, elseStart);

    this.t.push();
    iExpr.elseClause.forEach(expr => out.push(this.evaluate(expr)));
    this.t.pop();

    out.push(endElse);

    return out.join('\n');
  }

  evaluateElseIfStatement(iExpr:ElseIfStatement<SignalLike, BlockStatement>) {
    const out = [];

    const parentIf = iExpr.parentStatement.type === IF_STATEMENT
      ? this.evaluateIfStatement(iExpr.parentStatement)
      : this.evaluateElseIfStatement(iExpr.parentStatement);

    const elseIf = `${this.t.l()}else if (${this.expr.evaluate(iExpr.elseSubject)}) begin`;
    const endElse = `${this.t.l()}end`;

    out.push(parentIf, elseIf);

    this.t.push();
    iExpr.elseExprs.forEach(expr => out.push(this.evaluate(expr)));
    this.t.pop();

    out.push(endElse);

    return out.join('\n');
  }

  evaluateSwitchStatement(sExpr:SwitchStatement) {
    const out = [];
    out.push(`${this.t.l()}case (${this.expr.evaluate(sExpr.subject)})`);
    this.t.push();

    out.push(
      sExpr.cases.map(expr => {
        const caseOut = [];

        if (expr.type === CASE_STATEMENT) {
          const caseExpr = expr as SubjectiveCaseStatement;
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