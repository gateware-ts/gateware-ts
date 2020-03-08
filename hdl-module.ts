import { SyncBlock, CombinationalBlock, BlockExpression, Edge, SignalLikeOrValue, AssignmentExpression, ModuleSignalDescriptor, Port, SubmoduleReference, SignalMap, ParentModuleSignalDescriptorObject, SubmodulePortMappping } from './main-types';
import { SignalT, WireT } from './signals';
import { ASSIGNMENT_EXPRESSION } from './constants';
import { mapNamesToSignals } from './generator';

export abstract class JSHDLModule {
  abstract describe():void;
  moduleName:string;

  private inputs: SignalT[] = [];
  private outputs: SignalT[] = [];
  private internals: SignalT[] = [];
  private submodules: SubmoduleReference[] = [];
  private assignments: AssignmentExpression[] = [];
  private wires: WireT[] = [];

  private syncBlocks: SyncBlock[] = [];
  private combinationalBlocks: CombinationalBlock[] = [];
  private signalMap: SignalMap;

  getInputSignals() { return this.inputs; }
  getOutputSignals() { return this.outputs; }
  getInternalSignals() { return this.internals; }
  getSyncBlocks() { return this.syncBlocks; }
  getCombinationalBlocks() { return this.combinationalBlocks; }
  getSubmodules() { return this.submodules; }
  getContinuousAssignments() { return this.assignments; }
  getSignalMap() { return this.signalMap; }
  getWires() { return this.wires; }

  constructor(name?:string) {
    this.moduleName = name || this.constructor.name;
  }

  init() {
    this.createSignalMap();
  }

  reset() {
    this.submodules = [];
    this.assignments = [];
    this.syncBlocks = [];
    this.combinationalBlocks = [];
    return this;
  }

  clone<T>():T {
    // @ts-ignore: An abstract class by definition doesn't know what
    // it's concrete class will be, but there will be one.
    return new this.constructor() as T;
  }

  input(s:SignalT) : SignalT {
    // TODO: Assert the same signal is not registered more than once
    this.inputs.push(s);
    return s;
  }

  wire(width:number = 1) : WireT {
    // TODO: Assert the same signal is not registered more than once
    const w = new WireT(width);
    this.wires.push(w);
    return w;
  }

  output(s:SignalT) : SignalT {
    this.outputs.push(s);
    return s;
  }

  internal(s:SignalT) : SignalT {
    this.internals.push(s);
    return s;
  }

  syncBlock(signal:SignalT, edge:Edge, block:BlockExpression[]):void {
    this.syncBlocks.push({signal, edge, block});
  }

  combinationalBlock(block:BlockExpression[]):void {
    this.combinationalBlocks.push(block);
  }

  assignContinuous(signal:SignalT, value:SignalLikeOrValue):void {
    // TODO: Assert that this is indeed sensible
    this.assignments.push({
      type: ASSIGNMENT_EXPRESSION,
      a: signal,
      b: value,
      width: signal.width
    });
  }

  createSignalMap():void {
    const allSignals = [];

    const createSignalMap = (signals:Port[], namePrefix:string) => {
      const map = new Map<Port, string>();

      signals.forEach(signal => {
        if (allSignals.includes(signal)) {
          throw new Error('Found duplicate signal');
        } else {
          allSignals.push(signal);
        }

        const foundSignalName = Object.entries(this).some(([potentionalSignalName, value]) => {
          if (signal === value) {
            map.set(signal, potentionalSignalName);
            return true;
          }
        });

        if (!foundSignalName) {
          // TODO: Not sure about this...maybe it should just be an error if a signal is not
          // properly tied to the object
          map.set(signal, `${namePrefix}_${Math.random().toString(36).slice(2)}`);
        }
      });

      return map;
    }

    this.signalMap = {
      input: createSignalMap(this.getInputSignals(), 'input'),
      output: createSignalMap(this.getOutputSignals(), 'output'),
      internal: createSignalMap(this.getInternalSignals(), 'internal'),
      wire: createSignalMap(this.getWires(), 'wire')
    };
  }

  getModuleSignalDescriptor(s:Port):ModuleSignalDescriptor {
    const inputSignal = this.signalMap.input.get(s);
    if (inputSignal) {
      return { type: 'input', name: inputSignal, signal: s };
    }

    const internalSignal = this.signalMap.internal.get(s);
    if (internalSignal) {
      return { type: 'internal', name: internalSignal, signal: s };
    }

    const outputSignal = this.signalMap.output.get(s);
    if (outputSignal) {
      return { type: 'output', name: outputSignal, signal: s };
    }

    const wireSignal = this.signalMap.wire.get(s);
    if (wireSignal) {
      return { type: 'wire', name: wireSignal, signal: s };
    }

    throw new Error(`Unable to find internal signal ${s}`);
  }

  getSubmoduleSignalDescriptor(s:Port):ModuleSignalDescriptor {
    let descriptor:ModuleSignalDescriptor;

    this.submodules.some(submodule => {
      try {
        descriptor = submodule.m.getModuleSignalDescriptor(s);
        return true;
      } catch (ex) {}
    });

    if (!descriptor) {
      throw new Error(`Unable to find submodule signal ${s}`);
    }

    return descriptor;
  }

  findAnyModuleSignalDescriptor(s:Port):ParentModuleSignalDescriptorObject {
    // Try to find the signal within the parent
    try {
      return {m:this, descriptor: this.getModuleSignalDescriptor(s)};
    } catch (ex) {}

    // Try to find the signal within any submodule
    let descriptor:ModuleSignalDescriptor;
    let sm:SubmoduleReference;

    this.submodules.some(submodule => {
      try {
        descriptor = submodule.m.getModuleSignalDescriptor(s);
        sm = submodule;
        return true;
      } catch (ex) {}
    });

    if (descriptor) {
      return {m:sm.m, descriptor, submoduleRef: sm};
    }

    throw new Error(`Unable to find signal ${s} in this module or any of it's submodules.`);
  }

  addSubmodule(m:JSHDLModule, submoduleName:string, signalMapping:SubmodulePortMappping):void {
    // TODO: Make this way less ugly somehow
    m.init();
    m.describe();

    const signalNameMap = m.getSignalMap();
    const nameSignalMap = {
      ...mapNamesToSignals(signalNameMap.input),
      ...mapNamesToSignals(signalNameMap.output),
      ...mapNamesToSignals(signalNameMap.wire),
    };

    Object.entries(signalMapping.inputs).forEach(([name, port]) => {
      // Assert that we can link this signal
      if (name in nameSignalMap) {
        const descriptor = m.getModuleSignalDescriptor(m[name]);
        // Assert that the signals are the same width
        if (nameSignalMap[name].width !== port.width) {
          throw new Error(`Width mismatch between ${this.moduleName}.${descriptor.name} and ${m.moduleName}.${name}`);
        }

        // Assert that the target signal is indeed an input
        if (descriptor.type !== 'input') {
          throw new Error(`${descriptor.name} is not an input of module ${this.moduleName}.`);
        }
      } else {
        throw new Error(`Submodule error: No such port ${m.moduleName}.${name}`);
      }
    });

    Object.entries(signalMapping.outputs).forEach(([name, ports]) => {
      ports.forEach(port => {
        // Assert that we can link this signal
        if (name in nameSignalMap) {
          const descriptor = m.getModuleSignalDescriptor(m[name]);
          // Assert that the signals are the same width
          if (nameSignalMap[name].width !== port.width) {
            throw new Error(`Width mismatch between ${this.moduleName}.${descriptor.name} and ${m.moduleName}.${name}`);
          }

          // Assert that the target signal is indeed an input
          if (descriptor.type !== 'output') {
            throw new Error(`${descriptor.name} is not an output of module ${this.moduleName}.`);
          }
        } else {
          throw new Error(`Submodule error: No such port ${m.moduleName}.${name}`);
        }
      })
    });

    this.submodules.push({
      m,
      submoduleName,
      mapping: signalMapping
    });
  }
}
