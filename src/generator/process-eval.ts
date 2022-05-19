import { MemoryElement, ProxySignalReference, SliceSignal } from './../signal';
import { SignalOwnershipError, MultiDriverConflictError, SimulationModuleError, SliceError, BidirectionalSignalError } from '../gw-error';
import { Indent } from './indent';
import { DriverMap } from ".";
import { GWModule, SimulationModule } from "../module";
import { Evaluator } from "./evaluator";
import { Edge, BlockElement, BlockElementType, Block } from '../block';
import { SwitchStatement, Assignment, IfStatement, IfElseStatement } from '../block/element';
import { SignalNodeType } from '../signal';
import { AdvanceTimeElement } from '../block/simulation';

type Module = SimulationModule | GWModule;

export enum ProcessMode {
  Synchronous   = 'Synchronous',
  Combinational = 'Combinational',
  Test          = 'Test',
};

const AssignmentSymbolTable: Record<ProcessMode, string> = {
  [ProcessMode.Synchronous]:    '<=',
  [ProcessMode.Combinational]:  '=',
  [ProcessMode.Test]:           '=',
};

export class ProcessEvaluator {
  private e: Evaluator;
  private m: Module;
  private i: Indent;
  private drivers: DriverMap;
  private driverIndex = 0;
  private mode: ProcessMode;

  constructor(mode: ProcessMode, module: Module, evaluator: Evaluator, indent: Indent, drivers: DriverMap) {
    this.drivers = drivers;
    this.e = evaluator;
    this.i = indent;
    this.m = module;
    this.mode = mode;
  }

  evaluateElement(e: BlockElement): string {
    switch (e.type) {
      case BlockElementType.Block: return this.evaluateBlock(e as Block);
      case BlockElementType.Assignment: return this.evaluateAssignment(e as Assignment);
      case BlockElementType.If: return this.evaluateIf(e as IfStatement);
      case BlockElementType.IfElse: return this.evaluateIf(e as IfElseStatement);
      case BlockElementType.Switch: return this.evaluateSwitch(e as SwitchStatement);

      case BlockElementType.AdvanceTime: return this.evaluateAdvanceTime(e as AdvanceTimeElement);

      default: {
        throw new Error(`Not implemented: ${e.type}`);
      }
    }
  }

  private evaluateSync() {
    if (this.m instanceof SimulationModule) {
      throw new Error('Cannot evaluate a sync process in a SimulationModule');
    }

    const {i} = this;

    const processesOut = this.m.description.syncProcesses.map(p => {
      let start = `${i.get()}always @(${this.evaluateEdge(p.edge)} ${p.signal.signalName}) begin\n`;

      i.push();
      const blockElements = p.elements.map(b => this.evaluateElement(b));
      i.pop();

      this.driverIndex++;

      return start + blockElements.join('\n') + '\n' + `${i.get()}end`;
    });
    return processesOut.join('\n\n');
  }

  private evaluateComb() {
    if (this.m instanceof SimulationModule) {
      throw new Error('Cannot evaluate a comb process in a SimulationModule');
    }

    const {i} = this;

    const processesOut = this.m.description.combinationalProcesses.map(p => {
      let start = `${i.get()}always @(*) begin\n`;
      i.push();
      const blockElements = p.map(b => this.evaluateElement(b));
      i.pop();

      this.driverIndex++;

      return start + blockElements.join('\n') + '\n' + `${i.get()}end`;
    });
    return processesOut.join('\n\n');
  }

  private evaluateSim() {
    if (this.m instanceof GWModule) {
      throw new Error('Cannot evaluate a simulation process in a GWModule');
    }

    const {i} = this;

    let verilog = `${i.get()}initial begin\n`;
    i.push();
    const elements = this.m.description.simulation.map(p => this.evaluateElement(p));
    let waveOutput = '';
    if (this.m.description.produceWaveOutput) {
      waveOutput += `${i.get()}$dumpfile("${this.m.moduleName}.vcd");\n`;
      waveOutput += `${i.get()}$dumpvars(0);\n\n`;
    }
    verilog += waveOutput;
    verilog += elements.join('\n') + '\n' + `${i.get()}end`;
    i.pop();

    return verilog;
  }

  evaluate() {
    switch (this.mode) {
      case ProcessMode.Synchronous: return this.evaluateSync();
      case ProcessMode.Combinational: return this.evaluateComb();
      case ProcessMode.Test: return this.evaluateSim();

      default: {
        throw new Error(`Mode not implemented: ${this.mode}`);
      }
    }
  }

  evaluateBlock(e: Block) {
    return e.elements.map(be => this.evaluateElement(be)).join('\n');
  }

  evaluateEdge(e: Edge) { return e === Edge.Positive ? 'posedge' : 'negedge'; }

  evaluateAssignment(e: Assignment) {
    if (this.mode === ProcessMode.Combinational) {
      if (this.m.getSignalType(e.lhs.signalName)) {
        throw new BidirectionalSignalError(`Cannot assign bidirectional signal "${e.lhs.signalName}" in a combinational process`);
      }
    }

    switch (e.lhs.type) {
      case SignalNodeType.Signal: return this.evaluateAssignmentSignal(e);
      case SignalNodeType.ProxySignal: return this.evaluateProxyAssignmentSignal(e);
      case SignalNodeType.MemoryElement: return this.evaluateAssignmentMemoryElement(e);

      default: {
        throw new Error(`not implemented: ${e.lhs.type}`);
      }
    }
  }

  private evaluateProxyAssignmentSignal(e: Assignment) {
    if (!(this.m instanceof SimulationModule)) {
      throw new SimulationModuleError('Cannot evaluate a Proxy Signal Reference outside of a Simulation context');
    }

    if ((e.lhs as ProxySignalReference).testModule !== this.m) {
      throw new SignalOwnershipError(`Cannot assign non-owned signal "${e.lhs.signalName}" in module "${this.m.moduleName}"`);
    }

    return `${this.i.get()}${this.e.evaluate(e.lhs)} = ${this.e.evaluate(e.rhs)};`;
  }

  private evaluateAssignmentSignal(e: Assignment) {
    if (e.lhs.module !== this.m) {
      throw new SignalOwnershipError(
        `Cannot assign non-owned signal "${e.lhs.signalName}" in module "${this.m.moduleName}"`
      );
    }

    const isTesting = this.mode === ProcessMode.Test;

    if (!isTesting) {
      const isCombinational = this.mode === ProcessMode.Combinational;
      const isSynchronous = this.mode === ProcessMode.Synchronous;

      const {signalName} = e.lhs;
      if (signalName in this.drivers.sync) {
        if (isCombinational || this.drivers.sync[signalName] !== this.driverIndex) {
          throw new MultiDriverConflictError(`Signal ${signalName} is already driven from another synchronous process.`);
        }
      } else if (signalName in this.drivers.comb) {
        if (isSynchronous) {
          throw new MultiDriverConflictError(`Signal ${signalName} is already driven from a combinational process.`);
        }
      } else {
        if (isSynchronous) {
          this.drivers.sync[signalName] = this.driverIndex;
        } else {
          this.drivers.comb[signalName] = this.driverIndex;
        }
      }
    }

    const symbol = AssignmentSymbolTable[this.mode];

    return `${this.i.get()}${this.e.evaluate(e.lhs)} ${symbol} ${this.e.evaluate(e.rhs)};`;
  }

  private evaluateAssignmentMemoryElement(e: Assignment) {
    const lhs = e.lhs as MemoryElement;

    if (lhs.module !== this.m) {
      throw new SignalOwnershipError(
        `Cannot assign non-owned memory "${lhs.memory.memoryName}" in module "${this.m.moduleName}"`
      );
    }

    const isTesting = this.mode === ProcessMode.Test;
    if (!isTesting) {
      const isCombinational = this.mode === ProcessMode.Combinational;
      const isSynchronous = this.mode === ProcessMode.Synchronous;

      const signalName = lhs.memory.memoryName;
      if (signalName in this.drivers.sync) {
        if (isCombinational || this.drivers.sync[signalName] !== this.driverIndex) {
          throw new MultiDriverConflictError(`Memory ${signalName} is already driven from another synchronous process.`);
        }
      } else if (signalName in this.drivers.comb) {
        if (isSynchronous) {
          throw new MultiDriverConflictError(`Memory ${signalName} is already driven from a combinational process.`);
        }
      } else {
        if (isSynchronous) {
          this.drivers.sync[signalName] = this.driverIndex;
        } else {
          this.drivers.comb[signalName] = this.driverIndex;
        }
      }
    }

    const symbol = AssignmentSymbolTable[this.mode];

    return `${this.i.get()}${lhs.memory.memoryName}[${this.e.evaluate(lhs.index)}] ${symbol} ${this.e.evaluate(e.rhs)};`;
  }

  evaluateIf(e: IfStatement | IfElseStatement) {
    const {i} = this;
    let verilog = `${i.get()}if (${this.e.evaluate(e.condition)}) begin\n`;
    i.push();
    for (let element of e.body) {
      verilog += this.evaluateElement(element) + '\n';
    }
    i.pop();
    verilog += `${i.get()}end`;

    if (e.elseIfs.length > 0) {
      for (let elseIf of e.elseIfs) {
        verilog += ` else if (${this.e.evaluate(elseIf.condition)}) begin\n`;
        i.push();
        for (let element of elseIf.body) {
          verilog += this.evaluateElement(element) + '\n';
        }
        i.pop();
        verilog += `${i.get()}end`;
      }
    }

    if ('elseBody' in e && e.elseBody.length > 0) {
      verilog += ` else begin\n`;
      i.push();
      for (let element of e.elseBody) {
        verilog += this.evaluateElement(element) + '\n';
      }
      i.pop();
      verilog += `${i.get()}end`;
    }

    return verilog;
  }

  evaluateSwitch(e: SwitchStatement) {
    const {i} = this;
    let verilog = `${i.get()}case(${this.e.evaluate(e.conditionalSignal)})\n`;
    i.push();

    for (let c of e.cases) {
      verilog += `${i.get()}${this.e.evaluate(c.value)}: begin`;

      // When this is an empty block;
      if (c.body.length === 0) {
        verilog += ' end\n';
        continue;
      }

      i.push();

      const elements = c.body.map(el => this.evaluateElement(el)).join('\n');
      i.pop();
      verilog += `\n${elements}\n${i.get()}end\n`;
    }

    if (e.defaultCase) {
      verilog += `${i.get()}default: begin`;

      // When this is an empty block
      if (e.defaultCase.length === 0) {
        verilog += ' end\n';
      } else {
        i.push();
        const elements = e.defaultCase.map(el => this.evaluateElement(el)).join('\n');
        i.pop();
        verilog += `\n${elements}\n${i.get()}end\n`;
      }

    }

    i.pop();
    verilog += `${i.get()}endcase`;

    return verilog;
  }

  evaluateAdvanceTime(e: AdvanceTimeElement) {
    if (this.mode !== ProcessMode.Test) return '';
    return `${this.i.get()}#${e.amount};`
  }
}
