import {
  SyncBlock,
  BlockExpression,
  Edge,
  ModuleSignalDescriptor,
  Port,
  SubmoduleReference,
  SignalMap,
  ModuleDescriptorObject,
  SubmodulePortMappping,
  CombinationalLogic
} from './main-types';
import { SignalT, WireT } from './signals';
import { mapNamesToSignals } from './generator/common';

export abstract class GWModule {
  abstract describe():void;
  moduleName:string;

  private inputs: SignalT[] = [];
  private outputs: SignalT[] = [];
  private internals: SignalT[] = [];
  private submodules: SubmoduleReference[] = [];
  private wires: WireT[] = [];

  private syncBlocks: SyncBlock[] = [];
  private combinational: CombinationalLogic[] = [];
  private signalMap: SignalMap;

  getInputSignals() { return this.inputs; }
  getOutputSignals() { return this.outputs; }
  getInternalSignals() { return this.internals; }
  getSyncBlocks() { return this.syncBlocks; }
  getCombinationalLogic() { return this.combinational; }
  getSubmodules() { return this.submodules; }
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
    this.syncBlocks = [];
    this.combinational = [];
    return this;
  }

  clone<T>():T {
    // @ts-ignore: An abstract class by definition doesn't know what
    // it's concrete class will be, but there will be one.
    return new this.constructor() as T;
  }

  private checkIfSignalWasPreviouslyAdded(s:SignalT) {
    try {
      this.getModuleSignalDescriptor(s);
      return true;
    } catch (ex) {
      return false;
    }
  }

  input(s:SignalT) : SignalT {
    if (this.checkIfSignalWasPreviouslyAdded(s)) {
      throw new Error(`Cannot register the same signal more than once`);
    }

    this.inputs.push(s);
    return s;
  }

  wire(width:number = 1) : WireT {
    const w = new WireT(width);
    this.wires.push(w);
    return w;
  }

  output(s:SignalT) : SignalT {
    if (this.checkIfSignalWasPreviouslyAdded(s)) {
      throw new Error(`Cannot register the same signal more than once`);
    }

    this.outputs.push(s);
    return s;
  }

  internal(s:SignalT) : SignalT {
    if (this.checkIfSignalWasPreviouslyAdded(s)) {
      throw new Error(`Cannot register the same signal more than once`);
    }

    this.internals.push(s);
    return s;
  }

  syncBlock(signal:SignalT, edge:Edge, block:BlockExpression[]):void {
    this.syncBlocks.push({signal, edge, block});
  }

  combinationalLogic(logic:CombinationalLogic[]):void {
    this.combinational.push(...logic);
  }

  createSignalMap():void {
    const allSignals = [];

    const createSignalMap = (signals:Port[]) => {
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
          throw new Error(`Unable to find the name associated with a signal.`);
        }
      });

      return map;
    }

    this.signalMap = {
      input: createSignalMap(this.getInputSignals()),
      output: createSignalMap(this.getOutputSignals()),
      internal: createSignalMap(this.getInternalSignals()),
      wire: createSignalMap(this.getWires())
    };
  }

  // TODO: Rename all things that should be called port*
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

  findAnyModuleSignalDescriptor(s:Port):ModuleDescriptorObject {
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
      return { m:sm.m, descriptor};
    }

    throw new Error(`Unable to find signal ${s} in this module or any of it's submodules.`);
  }

  // TODO: Throw if not all ports are mapped. Allow for an explicit NO_CONNECT, but don't silently fail
  // TODO: If I reset before I call init/describe, then I should be able to use the same instance
  // of a module multiple times. Combined with an automatic name detection like for the signals, this
  // would make working with submodules quite a bit easier
  addSubmodule(m:GWModule, submoduleName:string, signalMapping:SubmodulePortMappping):void {
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
