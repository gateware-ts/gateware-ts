import { Simulation } from './simulation';
import { VendorModule } from './vendor-module';
import {
  SyncBlock,
  BlockStatement,
  Edge,
  ModuleSignalDescriptor,
  Port,
  SubmoduleReference,
  SignalMap,
  ModuleDescriptorObject,
  SubmodulePortMappping,
  CombinationalLogic,
  VendorModuleReference
} from './main-types';
import { SignalT, WireT } from './signals';
import { mapNamesToSignals } from './generator/common';

/**
 * The class which all gateware-ts hardware modules must extend.
 * This class should never be instaniated.
 */
export abstract class GWModule {
  /**
   * The describe method needs to contain all the synchronous, combinational,
   * and simulation logic - as well as the inclusion of submodules. In short,
   * it needs to "describe" your module.
   */
  abstract describe():void;

  /**
   * The name of this module, used in code generation
   */
  moduleName:string;

  /** @internal */
  private inputs: SignalT[] = [];
  /** @internal */
  private outputs: SignalT[] = [];
  /** @internal */
  private internals: SignalT[] = [];
  /** @internal */
  private submodules: SubmoduleReference[] = [];
  /** @internal */
  private vendorModules: VendorModuleReference[] = [];
  /** @internal */
  private wires: WireT[] = [];
  /** @internal */
  private syncBlocks: SyncBlock[] = [];
  /** @internal */
  private combinational: CombinationalLogic[] = [];
  /** @internal */
  private signalMap: SignalMap;

  /**
   * Contains and controls this modules simulation logic
  */
  simulation:Simulation;

  /** @internal */
  getInputSignals() { return this.inputs; }
  /** @internal */
  getOutputSignals() { return this.outputs; }
  /** @internal */
  getInternalSignals() { return this.internals; }
  /** @internal */
  getSyncBlocks() { return this.syncBlocks; }
  /** @internal */
  getCombinationalLogic() { return this.combinational; }
  /** @internal */
  getSubmodules() { return this.submodules; }
  /** @internal */
  getVendorModules() { return this.vendorModules; }
  /** @internal */
  getSignalMap() { return this.signalMap; }
  /** @internal */
  getWires() { return this.wires; }

  constructor(name?:string) {
    this.moduleName = name || this.constructor.name;
    this.simulation = new Simulation();
  }

  /** @internal */
  init() {
    this.createSignalMap();
  }

  /**
   * Reset a module after it's been processed by a code generator.
   * Very unlikely to be needed by an end-user
  */
  reset() {
    this.submodules = [];
    this.syncBlocks = [];
    this.combinational = [];
    return this;
  }

  /** @internal */
  clone<T>():T {
    // @ts-ignore: An abstract class by definition doesn't know what
    // it's concrete class will be, but there will be one.
    return new this.constructor() as T;
  }

  /** @internal */
  private checkIfSignalWasPreviouslyAdded(s:SignalT) {
    if (this.signalMap) {
      try {
        this.getModuleSignalDescriptor(s);
        return true;
      } catch (ex) {
        return false;
      }
    } else {
      return this.inputs.includes(s) || this.outputs.includes(s) || this.internals.includes(s);
    }
  }

  /**
   * Create an input signal on this module
   * @param s A signal definition
   */
  input(s:SignalT) : SignalT {
    if (this.checkIfSignalWasPreviouslyAdded(s)) {
      throw new Error(`Cannot register the same signal more than once`);
    }

    this.inputs.push(s);
    return s;
  }

  /**
   * Create an input signal on this module with a given name
   * @param name The name for this signal
   * @param s A signal definition
   */
  createInput(name:string, s:SignalT) : SignalT {
    if (this.checkIfSignalWasPreviouslyAdded(s)) {
      throw new Error(`Cannot register the same signal more than once`);
    }

    if (typeof this[name] !== 'undefined') {
      throw new Error(`${this.moduleName}.${name} already exists`);
    }

    this[name] = s;
    this.inputs.push(s);
    return s;
  }

  /**
   * Create a wire on this module.
   * @param width Bit width of this wire
   */
  wire(width:number = 1) : WireT {
    const w = new WireT(width);
    this.wires.push(w);
    return w;
  }

  /**
   * Create an output signal on this module
   * @param s A signal definition
   */
  output(s:SignalT) : SignalT {
    if (this.checkIfSignalWasPreviouslyAdded(s)) {
      throw new Error(`Cannot register the same signal more than once`);
    }

    this.outputs.push(s);
    return s;
  }

  /**
   * Create an output signal on this module with a given name
   * @param name The name for this signal
   * @param s A signal definition
   */
  createOutput(name:string, s:SignalT) : SignalT {
    if (this.checkIfSignalWasPreviouslyAdded(s)) {
      throw new Error(`Cannot register the same signal more than once`);
    }

    if (typeof this[name] !== 'undefined') {
      throw new Error(`${this.moduleName}.${name} already exists`);
    }

    this[name] = s;
    this.outputs.push(s);
    return s;
  }

  /**
   * Create an internal signal on this module
   * @param s A signal definition
   */
  internal(s:SignalT) : SignalT {
    if (this.checkIfSignalWasPreviouslyAdded(s)) {
      throw new Error(`Cannot register the same signal more than once`);
    }

    this.internals.push(s);
    return s;
  }

  /**
   * Create an internal signal on this module with a given name
   * @param name The name for this signal
   * @param s A signal definition
   */
  createInternal(name:string, s:SignalT) : SignalT {
    if (this.checkIfSignalWasPreviouslyAdded(s)) {
      throw new Error(`Cannot register the same signal more than once`);
    }

    if (typeof this[name] !== 'undefined') {
      throw new Error(`${this.moduleName}.${name} already exists`);
    }

    this[name] = s;
    this.internals.push(s);
    return s;
  }

  /**
   * Create a block of logic that is synchronous to a signal edge
   * @param signal The signal to synchronise to (usually a clock)
   * @param edge Either a positive or negative edge (can be hardware dependant)
   * @param block A block of expressions
   */
  syncBlock(signal:SignalT, edge:Edge, block:BlockStatement[]):void {
    this.syncBlocks.push({signal, edge, block});
  }

  /**
   * Create a block of logic that is purely combinational
   * @param logic A block of expressions (only assignments)
   */
  combinationalLogic(logic:CombinationalLogic[]):void {
    this.combinational.push(...logic);
  }

  /** @internal */
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
  /** @internal */
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

  /** @internal */
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

  /** @internal */
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
  /**
   * Add a submodule to this module
   * @param m The module to add
   * @param submoduleName The internal name this module is given
   * @param signalMapping A mapping for this modules inputs and outputs
   */
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

  /**
   * Add a vendor specific module (IP) to this module
   * @param m The vendor module to add
   * @param signalMapping A mapping for this modules inputs and outputs
   */
  addVendorModule(m:VendorModule<any>, signalMapping:SubmodulePortMappping):void {
    m.init();
    const signalMap = m.getVendorSignalMap();
    const nameSignalMap = {
      ...mapNamesToSignals(signalMap.input),
      ...mapNamesToSignals(signalMap.output),
    };

    Object.entries(signalMapping.inputs).forEach(([name, port]) => {
      // Assert that we can link this signal
      if (name in nameSignalMap) {
        const descriptor = m.getModuleSignalDescriptor(m[name]);
        // Assert that the signals are the same width
        if (nameSignalMap[name].width !== port.width) {
          throw new Error(`Width mismatch between ${this.moduleName}.${descriptor.name} and ${m.constructor.name}.${name}`);
        }

        // Assert that the target signal is indeed an input
        if (descriptor.type !== 'input') {
          throw new Error(`${descriptor.name} is not an input of module ${this.moduleName}.`);
        }
      } else {
        throw new Error(`Vendor module error: No such port ${m.constructor.name}.${name}`);
      }
    });

    Object.entries(signalMapping.outputs).forEach(([name, ports]) => {
      ports.forEach(port => {
        // Assert that we can link this signal
        if (name in nameSignalMap) {
          const descriptor = m.getModuleSignalDescriptor(m[name]);
          // Assert that the signals are the same width
          if (nameSignalMap[name].width !== port.width) {
            throw new Error(`Width mismatch between ${this.moduleName}.${descriptor.name} and ${m.constructor.name}.${name}`);
          }

          // Assert that the target signal is indeed an input
          if (descriptor.type !== 'output') {
            throw new Error(`${descriptor.name} is not an output of module ${this.moduleName}.`);
          }
        } else {
          throw new Error(`Vendor module error: No such port ${m.constructor.name}.${name}`);
        }
      })
    });

    this.vendorModules.push({ m, mapping: signalMapping });
  }
}
