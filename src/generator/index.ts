import { sliceTransform } from './slice-transform';
import { BaseSignalReference, ConstantSignal, SignalReference } from './../signal';
import { arrayDiff, partialHash, whenNotEmpty } from './../util';
import { ProcessEvaluator, ProcessMode } from './process-eval';
import { Indent } from './indent';
import { GWModule, SimulationModule } from "../module";
import { MissingPortError, UndrivenSignalError } from '../gw-error';
import { Evaluator } from './evaluator';

type GeneratedModules = Map<GWModule, boolean>;
export type DriverMap = {
  sync: Record<string, number>;
  comb: Record<string, number>;
}
export type SubmoduleOutputMap = Map<SignalReference, string>;

export type GeneratedSliceSource = {
  name: string;
  width: number;
  signal: BaseSignalReference;
};
export type GeneratedSliceMap = Record<string, GeneratedSliceSource>;

const verilogWidth = (n: number) => n === 1 ? '' : `[${n-1}:0]`;

const useSliceTransform = true;

const generateVerilogForModule = (m: GWModule, generatedModules: GeneratedModules) => {
  // Skip generating code for this module if it has already been done
  if (generatedModules.get(m)) return '';

  m.clearDescription();
  m.describe();
  generatedModules.set(m, true);

  // Generated wire assigns
  const generatedSliceSources: GeneratedSliceMap = {};

  if (useSliceTransform) {
    m.description.syncProcesses.forEach(syncProcess => {
      sliceTransform(syncProcess.elements, m, generatedSliceSources);
    });

    m.description.combinationalProcesses.forEach(combProcess => {
      sliceTransform(combProcess, m, generatedSliceSources);
    });
  }

  const i = new Indent();
  let verilog = '';

  // Populate the submodule output map
  const submoduleOutputMap: SubmoduleOutputMap = new Map();
  for (let [instanceName, submodule] of Object.entries(m.description.submodules)) {
    for (let [outputName, outputSignal] of Object.entries(submodule.instance.output)) {
      // (Reproducibly) avoid naming collisions by hashing the submodule name + output
      let wireName = `${instanceName}_${outputName}`;
      wireName += `_${partialHash(wireName)}`;
      submoduleOutputMap.set(outputSignal, wireName);
    }
  }

  // Keep track of which kind of process drives each signal
  const drivers: DriverMap = { sync: {}, comb: {} };
  const evaluator = new Evaluator(m, i, submoduleOutputMap);
  const syncEval = new ProcessEvaluator(ProcessMode.Synchronous, m, evaluator, i, drivers);
  const combEval = new ProcessEvaluator(ProcessMode.Combinational, m, evaluator, i, drivers);

  // Generate verilog for processes
  i.push();
  const syncBlocks = syncEval.evaluate();
  const combBlocks = combEval.evaluate();
  i.pop();

  // Understand if all outputs of this module are being driven
  const outputSignalNames = Object.keys(m.output);
  const bidirectionalSignalNames = Object.keys(m.bidirectional);
  const drivenSignals = [...Object.keys(drivers.comb), ...Object.keys(drivers.sync)];
  const nonDrivenOutputs = arrayDiff(outputSignalNames, drivenSignals);

  if (nonDrivenOutputs.length > 0) {
    throw new UndrivenSignalError(`${m.moduleName}: The following outputs are not driven by any process: ${nonDrivenOutputs.join(', ')}`);
  }

  if (outputSignalNames.length <= 0 && bidirectionalSignalNames.length <= 0) {
    throw new MissingPortError(`${m.moduleName} contains no output or bidirectional signals.`);
  }

  // Generate module declaration
  verilog += `module ${m.moduleName} (\n`;
  i.push();

  const inputSignalNames = Object.keys(m.input);
  const moduleInputStrings = inputSignalNames.map(name => {
    const signal = m.getSignal(name);
    return `${i.get()}input ${verilogWidth(signal.width)} ${name}`;
  });

  const moduleOutputStrings = outputSignalNames.map(name => {
    const signal = m.getSignal(name);
    const regPart = 'reg';
    return `${i.get()}output ${regPart} ${verilogWidth(signal.width)} ${name}`;
  });

  const moduleBidirectionalStrings = bidirectionalSignalNames.map(name => {
    const signal = m.getSignal(name);
    const regPart = 'reg';
    return `${i.get()}inout ${regPart} ${verilogWidth(signal.width)} ${name}`;
  });

  verilog += moduleInputStrings.join(',\n') + ',\n';
  verilog += moduleBidirectionalStrings.join(',\n') + whenNotEmpty(moduleBidirectionalStrings, ',');
  verilog += '\n' + moduleOutputStrings.join(',\n');

  i.pop();
  verilog += `\n);\n`;

  // Declare internal signals
  i.push();
  const internalSignalNames = Object.keys(m.internal);
  const moduleInternalStrings = internalSignalNames.map(name => {
    const signal = m.getSignal(name);
    const regPart = name in generatedSliceSources ? 'wire' : 'reg';
    return `${i.get()}${regPart} ${verilogWidth(signal.width)} ${name};`;
  });
  i.pop();

  // Declare memories
  i.push();
  const memoryNames = Object.keys(m.memories);
  const moduleMemoryStrings = memoryNames.map(name => {
    const memory = m.getMemory(name);
    const regPart = 'reg';
    return `${i.get()}${regPart} ${verilogWidth(memory.width)} ${name} ${verilogWidth(memory.depth)};`;
  });
  i.pop();

  // Generated slice source assigns
  i.push();
  const sliceAssignStrings = Object.values(generatedSliceSources).map(s => {
    return `${i.get()}assign ${s.name} = ${evaluator.evaluate(s.signal)};`;
  });
  i.pop();

  // Vendor module output wires
  i.push();
  const vmOutputWires: Array<string> = [];
  Object.values(m.description.vendorModules).forEach(vm => {
    Object.values(vm.outputSignals).forEach(outputSignal => {
      vmOutputWires.push(
        `${i.get()}wire ${verilogWidth(outputSignal.width)} ${outputSignal.toWireName()};`
      );
    });
  });
  i.pop();

  // Vendor module instantiations
  i.push();
  const vmModuleStrings: Array<string> = [];

  for (let [instanceName, vendorModule] of Object.entries(m.description.vendorModules)) {
    let vmVerilog = `${i.get()}${vendorModule.moduleName} `;
    if (Object.keys(vendorModule.params).length > 0) {
      const parameterStrings: Array<string> = [];

      vmVerilog += '#(\n';
      i.push();
      for (let [paramName, paramValue] of Object.entries(vendorModule.params)) {
        const paramValueStr = paramValue instanceof ConstantSignal
          ? evaluator.evaluateConstant(paramValue)
          : `"${paramValue.value}"`;

          parameterStrings.push(`${i.get()}.${paramName}(${paramValueStr})`);
      }
      i.pop();
      vmVerilog += parameterStrings.join(',\n') + '\n';
      vmVerilog += `${i.get()}) `;
    }

    vmVerilog += instanceName + ' (\n';
    i.push();
    const argStrings: Array<string> = [];
    for (let [inputName, inputSignal] of Object.entries(vendorModule.inputs)) {
      argStrings.push(`${i.get()}.${inputName}(${evaluator.evaluate(inputSignal)})`);
    }
    for (let [outputName, outputSignal] of Object.entries(vendorModule.outputSignals)) {
      argStrings.push(`${i.get()}.${outputName}(${outputSignal.toWireName()})`);
    }
    i.pop();
    vmVerilog += argStrings.join(',\n') + '\n';
    vmVerilog += `${i.get()});`;

    vmModuleStrings.push(vmVerilog);
  }
  i.pop();


  // Add submodule instantiations
  let submoduleDeclarations = '';
  i.push();
  for (let [instanceName, submodule] of Object.entries(m.description.submodules)) {
    let smVerilog = `${i.get()}${submodule.instance.moduleName} ${instanceName}(\n`;
    i.push();

    for (let [inputName, signal] of Object.entries(submodule.inputs)) {
      smVerilog += `${i.get()}.${inputName}(${evaluator.evaluateSignal(signal)}),\n`;
    }

    const smOutputNamesSignals = Object.entries(submodule.instance.output);
    for (let idx = 0; idx < smOutputNamesSignals.length; idx++) {
      const [outputName, signal] = smOutputNamesSignals[idx];
      // Sigh. If only every language allowed trailing commas...
      const commaPart = idx < smOutputNamesSignals.length - 1 ? ',' : '';
      smVerilog += `${i.get()}.${outputName}(${submoduleOutputMap.get(signal)})${commaPart}\n`;
    }

    i.pop();
    smVerilog += `${i.get()});\n`;

    submoduleDeclarations += smVerilog;
  }
  i.pop();

  i.push();
  const smOutputWires: Array<string> = [];
  for (let [signal, name] of submoduleOutputMap.entries()) {
    smOutputWires.push(`${i.get()}wire ${verilogWidth(signal.width)} ${name};`);
  }
  i.pop();

  verilog += moduleInternalStrings.join('\n') + whenNotEmpty(moduleInternalStrings, '\n');
  verilog += smOutputWires.join('\n') + whenNotEmpty(smOutputWires, '\n\n');
  verilog += vmOutputWires.join('\n') + whenNotEmpty(vmOutputWires, '\n\n');
  verilog += moduleMemoryStrings.join('\n') + whenNotEmpty(moduleMemoryStrings, '\n\n');
  verilog += sliceAssignStrings.join('\n') + whenNotEmpty(sliceAssignStrings, '\n\n');
  verilog += vmModuleStrings.join('\n') + whenNotEmpty(vmModuleStrings, '\n\n');
  verilog += submoduleDeclarations;
  verilog += combBlocks + whenNotEmpty(syncBlocks, '\n\n');
  verilog += syncBlocks;

  verilog += '\nendmodule';

  const submoduleDefinitions = Object.values(m.description.submodules).map(submodule =>
    generateVerilogForModule(submodule.instance, generatedModules)
  );

  verilog += whenNotEmpty(submoduleDefinitions, '\n\n' + submoduleDefinitions.join('\n\n')) ;

  return verilog;
}

export const toVerilog = (topModule: GWModule) => {
  const generatedModules: GeneratedModules = new Map();
  return `\`default_nettype none\n\n${generateVerilogForModule(topModule, generatedModules)}`;
}

export const toSimulation = (simulationModule: SimulationModule) => {
  const {moduleUnderTest} = simulationModule;
  moduleUnderTest.describe();
  simulationModule.describe();
  const mainCode = toVerilog(moduleUnderTest);

  const i = new Indent();
  const e = new Evaluator(simulationModule, i, new Map());
  const evaluator = new ProcessEvaluator(ProcessMode.Test, simulationModule, e, i, {comb: {}, sync: {}});

  const mutSignals = [...Object.keys(moduleUnderTest.input), ...Object.keys(moduleUnderTest.output)];

  const generatedSliceSources: GeneratedSliceMap = {};

  if (useSliceTransform) {
    sliceTransform(simulationModule.description.simulation, simulationModule, generatedSliceSources);
  }

  let verilog = '';
  const ts = simulationModule.description.timescale;
  verilog = `\`timescale ${ts.unit.join('')}/${ts.precision.join('')}\n${mainCode}\n\n`;

  verilog += `module ${simulationModule.moduleName};\n`
  i.push();

  const inputDelcatations = Object.entries(moduleUnderTest.input).map(([signalName, signal]) => {
    return `${i.get()}reg ${verilogWidth(signal.width)} ${signalName};`
  });
  const internalDelcatations = Object.entries(simulationModule.internal).map(([signalName, signal]) => {
    return `${i.get()}reg ${verilogWidth(signal.width)} ${signalName};`
  });
  const outputDelcatations = Object.entries(moduleUnderTest.output).map(([signalName, signal]) => {
    return `${i.get()}wire ${verilogWidth(signal.width)} ${signalName};`
  });

  verilog += inputDelcatations.join('\n') + '\n';
  verilog += internalDelcatations.join('\n') + '\n';
  verilog += outputDelcatations.join('\n') + '\n\n';

  verilog += `${i.get()}${moduleUnderTest.moduleName} mut(\n`;
  i.push();
  verilog += mutSignals.map(signalName =>
    `${i.get()}.${signalName}(${signalName})`
  ).join(',\n') + '\n';
  i.pop();
  verilog += `${i.get()});\n\n`;

  verilog += evaluator.evaluate();
  verilog += `\nendmodule`;

  return verilog;
}
