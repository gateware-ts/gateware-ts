import { SignalOwnershipError, SimulationModuleError, SubmoduleError } from './gw-error';
import { Edge, BlockElement } from './block';
import { SignalReference, Memory, ReadonlySignalReference, ProxySignalReference } from "./signal";
import { arrayDiff } from './util';

enum ModuleSignalType {
  Input     = 'Input',
  Internal  = 'Internal',
  Output    = 'Output',
}

type SyncProcess = {
  edge: Edge;
  signal: SignalReference;
  elements: BlockElement[]
}

type Submodule = {
  instance: GWModule;
  inputs: Record<string, SignalReference>;
}

type ModuleDescription = {
  syncProcesses: SyncProcess[];
  combinationalProcesses: Array<BlockElement[]>;
  submodules: Record<string, Submodule>;
}

export abstract class GWModule {
  input: Record<string, SignalReference> = {};
  internal: Record<string, SignalReference> = {};
  output: Record<string, SignalReference> = {};
  memories: Record<string, Memory> = {};
  private signals: Record<string, SignalReference> = {};

  description: ModuleDescription = this.clearDescription();

  readonly moduleName: string;

  constructor(moduleName: string) {
    this.moduleName = moduleName;
  }

  clearDescription() {
    this.description = {
      combinationalProcesses: [],
      syncProcesses: [],
      submodules: {}
    };
    return this.description;
  }

  synchronousProcess(edge: Edge, signal: SignalReference, elements: BlockElement[]) {
    if (signal.module !== this) {
      throw new SignalOwnershipError(`Signal ${signal.signalName} is not owned by module ${this.moduleName}`);
    }
    this.description.syncProcesses.push({ edge, signal, elements });
  }

  combinationalProcess(elements: BlockElement[]) {
    this.description.combinationalProcesses.push(elements);
  }

  private addSignal(type: ModuleSignalType, name: string, width: number) {
    if (name in this.signals) {
      const methodName = `add${type[0].toUpperCase()}${type.slice(1)}`;
      throw new Error(`${methodName}: Signal "${name}" already exists on module "${this.moduleName}"`);
    }

    const signal = new SignalReference({
      module: this,
      signalName: name,
      width,
    });

    this.signals[name] = signal;

    switch (type) {
      case ModuleSignalType.Input: { this.input[name] = signal; break; }
      case ModuleSignalType.Internal: { this.internal[name] = signal; break; }
      case ModuleSignalType.Output: { this.output[name] = signal; break; }
    }

    return signal;
  }

  addInput(name: string, width: number) { return this.addSignal(ModuleSignalType.Input, name, width); }
  addInternal(name: string, width: number) { return this.addSignal(ModuleSignalType.Internal, name, width); }
  addOutput(name: string, width: number) { return this.addSignal(ModuleSignalType.Output, name, width); }

  addMemory(name: string, width: number, depth: number) {
    if (name in this.memories) {
      throw new Error(`addMemory: Memory "${name}" already exists on module "${this.moduleName}"`);
    }
    if (name in this.signals) {
      throw new Error(`addMemory: A signal with name "${name}" already exists on module "${this.moduleName}"`);
    }

    const memory = new Memory({
      module: this,
      memoryName: name,
      width,
      depth
    });

    this.memories[name] = memory;

    return memory;
  }

  getSignal(name: string) {
    if (!(name in this.signals)) {
      throw new Error(`getSignal: Signal "${name}" doesn't exist on module "${this.moduleName}"`);
    }
    return this.signals[name];
  }

  getMemory(name: string) {
    if (!(name in this.memories)) {
      throw new Error(`getMemory: Memory "${name}" doesn't exist on module "${this.moduleName}"`);
    }
    return this.memories[name];
  }

  addSubmodule(instance: GWModule, name: string, inputs: Submodule['inputs']) {
    if (name in this.description.submodules) {
      throw new SubmoduleError(`Submodule called "${name}" already declared in module ${this.moduleName}`);
    }

    const mappedInputNames = Object.keys(inputs);
    const inputNames = Object.keys(instance.input);

    const unknownInputs = arrayDiff(mappedInputNames, inputNames);
    const unmappedInputs = arrayDiff(inputNames, mappedInputNames);

    if (unknownInputs.length) {
      throw new SubmoduleError(
        `Unknown inputs provided for submodule ${instance.moduleName} (${name}): ${unknownInputs.join(', ')}`
      );
    }

    if (unmappedInputs.length) {
      throw new SubmoduleError(
        `Required inputs not mapped for submodule ${instance.moduleName} (${name}): ${unmappedInputs.join(', ')}`
      );
    }

    this.description.submodules[name] = { instance, inputs };
  }

  abstract describe(): void;
}

export enum TimeUnit {
  Picosecond = 'ps',
  Nanosecond = 'ns',
  Second = 's',
}

export type Time = [number, TimeUnit];
export type TimeScale = { unit: Time; precision: Time; };


type TestModuleDescription = {
  simulation: Array<BlockElement>;
  timescale: TimeScale;
  produceWaveOutput: boolean;
}

export abstract class SimulationModule {
  moduleName: string;
  moduleUnderTest: GWModule;
  description: TestModuleDescription;

  input: Record<string, ProxySignalReference> = {};
  output: Record<string, ReadonlySignalReference> = {};
  internal: Record<string, ProxySignalReference> = {};

  constructor(name: string, moduleUnderTest: GWModule) {
    this.moduleName = name;
    this.moduleUnderTest = moduleUnderTest;
    this.description = this.resetDescription();

    // Create signals for controlling the MUT inputs
    for (const inputName of Object.keys(moduleUnderTest.input)) {
      this.input[inputName] = new ProxySignalReference({
        module: this.moduleUnderTest,
        width: moduleUnderTest.input[inputName].width,
        signalName: moduleUnderTest.input[inputName].signalName,
        testModule: this
      });
    }

    // Create read-only reference signals for the MUT outputs
    for (const outputName of Object.keys(moduleUnderTest.output)) {
      this.output[outputName] = new ReadonlySignalReference({
        module: this.moduleUnderTest,
        width: moduleUnderTest.output[outputName].width,
        signalName: moduleUnderTest.output[outputName].signalName,
        testModule: this
      });
    }
  }

  addInternal(name: string, width: number) {
    if (name in this.internal) {
      throw new Error(`addInternal: Signal "${name}" already exists on module "${this.moduleName}"`);
    }

    const signal = new ProxySignalReference({
      module: this.moduleUnderTest,
      signalName: name,
      width,
      testModule: this
    });

    this.internal[name] = signal;

    return signal;
  }

  resetDescription() {
    this.description = {
      simulation: [],
      timescale: {
        unit: [1, TimeUnit.Nanosecond],
        precision: [1, TimeUnit.Nanosecond]
      },
      produceWaveOutput: true,
    };
    return this.description;
  }

  setTimescale(unit: Time, precision: Time) {
    this.description.timescale = { unit, precision };
  }

  disableWaveOutput() {
    this.description.produceWaveOutput = false;
  }

  simulationProcess(body: Array<BlockElement>) {
    this.description.simulation.push(...body);
  }

  getInput(name: string) {
    if (!(name in this.input)) {
      throw new SimulationModuleError(`No drivable input signal ${name} on simulation module ${this.moduleName}`);
    }
    return this.input[name];
  }

  getOutput(name: string) {
    if (!(name in this.output)) {
      throw new SimulationModuleError(`No readable output signal ${name} on simulation module ${this.moduleName}`);
    }
    return this.output[name];
  }

  abstract describe(): void;
}
