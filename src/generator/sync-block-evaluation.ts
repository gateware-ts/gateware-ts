import { ExpressionEvaluator } from './expression-evaluation';
import { TSHDLModule } from "../hdl-module";
import { AssignmentExpression, InternallyShadowedRegister, BlockExpression, SwitchExpression, SubjectiveCaseExpression, SyncBlock, Edge } from '../main-types';
import { SignalT } from '../signals';
import { ASSIGNMENT_EXPRESSION, IF_EXPRESSION, SWITCH_EXPRESSION, CASE_EXPRESSION } from '../constants';
import { IfExpression } from '../block-expressions';
import { TabLevel } from '../helpers';
import { getRegSize } from './common';

export class SyncBlockEvaluator {
  private workingModule: TSHDLModule;
  private expr: ExpressionEvaluator;
  private internalShadowedRegistersMap: Map<SignalT, InternallyShadowedRegister>;
  private drivenSignals:SignalT[] = [];
  private t: TabLevel;

  getDrivenSignals() { return this.drivenSignals; }

  constructor(m?:TSHDLModule, indentLevel:number = 1) {
    this.t = new TabLevel('  ', indentLevel);
    this.internalShadowedRegistersMap = new Map();
    this.expr = new ExpressionEvaluator();

    if (m) {
      this.workingModule = m;
      this.expr.setWorkingModule(m);
    }

    this.evaluate = this.evaluate.bind(this);
  }

  private addDrivenSignal(driven:SignalT) {
    if (!this.drivenSignals.includes(driven)) {
      this.drivenSignals.push(driven);
    }
  }

  setWorkingModule(m:TSHDLModule) {
    this.workingModule = m;
    this.expr.setWorkingModule(m);
  }

  generateShadowedRegisterAssignments() {
    return [...this.internalShadowedRegistersMap.values()].map(isr => {
      return [
        `${this.t.l()}reg ${getRegSize(isr.originalSignal)}${isr.name} = ${isr.signal.defaultValue};`,
        `${this.t.l()}assign ${isr.originalName} = ${isr.name};`
      ].join('\n');
    }).join('\n');
  }

  generateInternalRegisterDeclarations() {
    return this.workingModule.getInternalSignals().map(s => {
      return `${this.t.l()}reg ${getRegSize(s)}${this.workingModule.getModuleSignalDescriptor(s).name} = ${s.defaultValue};`;
    }).join('\n')
  }

  generateInternalWireDeclarations() {
    return this.workingModule.getWires().map(w => {
      return `${this.t.l()}wire ${getRegSize(w)}${this.workingModule.getModuleSignalDescriptor(w).name};`;
    });
  }

  evaluate(expr:BlockExpression) {
    switch (expr.type) {
      case ASSIGNMENT_EXPRESSION: {
        return this.evaluateAssignmentExpression(expr as AssignmentExpression);
      }

      case IF_EXPRESSION: {
        return this.evaluateIfExpression(expr as IfExpression);
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
    let internallyShadowedRegister = this.internalShadowedRegistersMap.get(aExpr.a);
    let assigningRegister = this.workingModule.getModuleSignalDescriptor(aExpr.a);

    if (assigningRegister.type === 'input') {
      throw new Error('Cannot assign to an input in a synchronous block');
    }

    if (!internallyShadowedRegister && assigningRegister.type === 'output') {
      // create a shadowed representation
      const shadowed: InternallyShadowedRegister = {
        signal: assigningRegister.signal.clone() as SignalT,
        originalSignal: assigningRegister.signal as SignalT,
        originalName: assigningRegister.name,
        name: `_${assigningRegister.name}`
      };

      // Keep track of it in the shadow map
      this.internalShadowedRegistersMap.set(shadowed.originalSignal, shadowed);
      internallyShadowedRegister = shadowed;

      // Keep track of it in the driven signals
      this.addDrivenSignal(aExpr.a);
    }

    return (internallyShadowedRegister)
      ? `${this.t.l()}${internallyShadowedRegister.name} <= ${this.expr.evaluate(aExpr.b)};`
      : `${this.t.l()}${assigningRegister.name} <= ${this.expr.evaluate(aExpr.b)};`;
  }

  evaluateIfExpression(iExpr:IfExpression) {
    const out = [];

    out.push(`${this.t.l()}if (${this.expr.evaluate(iExpr.subject)}) begin`);

    this.t.push();
    iExpr.exprs.forEach(expr => out.push(this.evaluate(expr)));
    this.t.pop();

    if (iExpr.elseClause && iExpr.elseClause.length) {
      out.push(`${this.t.l()}end else begin`);
      this.t.push();
      iExpr.elseClause.forEach(expr => out.push(this.evaluate(expr)));
      this.t.pop();
    }

    out.push(`${this.t.l()}end`);
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