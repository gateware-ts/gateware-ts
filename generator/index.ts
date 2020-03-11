import { ExpressionEvaluator } from './expression-evaluation';
import { TSHDLModule } from "../hdl-module";
import { SignalT } from "../signals";
import {
  PortWiring,
  GeneratedVerilogObject
} from "../main-types";
import { TabLevel, flatten } from '../helpers';
import { SyncBlockEvaluator } from './sync-block-evaluation';
import { getRegSize, mapNamesToSignals } from './common';
import { CombLogicEvaluator } from './comb-logic-evaluation';


const toHeaderText = (type:string) => ([signalName, signal]:[string, SignalT]) => {
  return `${type} ${getRegSize(signal)}${signalName}`
};

interface CodeGeneratorOptions {};

export class CodeGenerator {
  options:CodeGeneratorOptions;
  m:TSHDLModule;

  constructor(m:TSHDLModule, options:CodeGeneratorOptions = {}) {
    this.options = options;
    this.m = m;

    // Reinitialise module
    m.reset();
    m.init();
    m.describe();
  }

  generateVerilogCodeForModule(m:TSHDLModule):GeneratedVerilogObject {
    const t = new TabLevel('  ', 1);
    const thisModuleHasSubmodules = m.getSubmodules().length > 0;

    const signalMap = m.getSignalMap();
    const namesToSignals = {
      input: mapNamesToSignals(signalMap.input),
      output: mapNamesToSignals(signalMap.output),
      internal: mapNamesToSignals(signalMap.internal),
    };

    const syncEval = new SyncBlockEvaluator(m, 1);
    const combEval = new CombLogicEvaluator(m, 1);

    const header = [
      `module ${m.moduleName}(`,
      Object
        .entries(namesToSignals.input)
        .map(toHeaderText('input'))
        .map(t.indent)
        .join(',\n') + (Object.keys(namesToSignals.output).length > 0 ? ',' : ''),
      Object
        .entries(namesToSignals.output)
        .map(toHeaderText('output'))
        .map(t.indent)
        .join(',\n'),
      ');'
    ].join('\n');

    const syncBlocks = m.getSyncBlocks().map(block => syncEval.evaluateBlock(block)).join('\n\n');

    const combLogic = m.getCombinationalLogic().map(expr => {
      return combEval.evaluate(expr);
    }).join('\n');

    const cDriven = combEval.getDrivenSignals();
    const sDriven = syncEval.getDrivenSignals();

    cDriven.forEach(cs => sDriven.forEach(ss => {
      if (cs === ss) {
        const signalName = m.getModuleSignalDescriptor(cs).name;
        throw new Error(`Driver-driver conflict on ${m.moduleName}.${signalName}. A signal cannot${
        ''} be driven by both syncronous and combinational logic.`);
      }
    }));

    const shadowedAssignments = syncEval.generateShadowedRegisterAssignments();
    const internalRegisters = syncEval.generateInternalRegisterDeclarations();
    const internalWires = syncEval.generateInternalWireDeclarations();

    const wireMap = new Map<TSHDLModule, PortWiring>();
    let wireIndex = 0;

    const inputWires = flatten(m.getSubmodules().map(sm => {
      const portWiring:PortWiring = {};
      wireMap.set(sm.m, portWiring);

      return Object.entries(sm.mapping.inputs).map(([portName, port]) => {
        const wire = `w${wireIndex++}`;
        portWiring[portName] = wire;
        return [wire, getRegSize(port)];
      });
    }));

    const globalPortWiring:PortWiring = {};
    wireMap.set(m, globalPortWiring);
    const globalOutputAssignments = [];
    const globalOutputWires = [...m.getSignalMap().output.entries()].map(([port, portName]) => {
      const wire = `w${wireIndex++}`;
      globalPortWiring[portName] = wire;
      globalOutputAssignments.push(`${t.l()}assign ${portName} = ${wire};`);
      return [wire, getRegSize(port)];
    });

    const secondaryAssignments = [];
    m.getSubmodules().forEach(sm => {
      Object.entries(sm.mapping.outputs).forEach(([portName, associatedSignals]) => {
        const firstSignal = associatedSignals[0];
        const portDescriptor = m.findAnyModuleSignalDescriptor(firstSignal);
        const drivenWire = wireMap.get(portDescriptor.m)[portDescriptor.descriptor.name];

        // Place this into the port mapping
        wireMap.get(portDescriptor.m)[portDescriptor.descriptor.name] = drivenWire;
        wireMap.get(sm.m)[portName] = drivenWire;

        // For any other inputs driven by this output, an assignment to the
        // driven wire needs to happen.

        associatedSignals.slice(1).forEach(s => {
          const portDescriptor = m.findAnyModuleSignalDescriptor(s);
          const inputWire = wireMap.get(portDescriptor.m)[portDescriptor.descriptor.name];
          secondaryAssignments.push(`${t.l()}assign ${inputWire} = ${drivenWire};`);
        });
      });
    });

    const globalInputAssignments = [];
    const tiedWiresAssignments = [];
    [...m.getSignalMap().input.entries()].forEach(([port, portName]) => {
      const connectedWires = [];
      m.getSubmodules().forEach(sm => {
        Object.entries(sm.mapping.inputs).forEach(([inputPortName, inputPort]) => {
          if (port === inputPort) {
            const wireName = wireMap.get(sm.m)[inputPortName];
            globalInputAssignments.push(
              `${t.l()}assign ${wireName} = ${portName};`
            );
            connectedWires.push(wireName);
          }
        });
      });

      if (connectedWires.length > 1) {
        // Tie all the rest of the wires to the first wire
        let firstWire = connectedWires[0];
        let otherWires = connectedWires.slice(1);
        while (otherWires.length > 0) {
          otherWires.forEach(otherWire => {
            tiedWiresAssignments.push(`${t.l()}assign ${otherWire} = ${firstWire};`)
          });
          firstWire = otherWires[0];
          otherWires = otherWires.slice(1);
        }
      }
    });

    const wireDeclarations = [
      // TODO: Be careful here that user-defined wires don't have the same names
      // as ones I generate
      ...(thisModuleHasSubmodules ? inputWires : []),
      ...(thisModuleHasSubmodules ? globalOutputWires : [])
    ].map(([w, regSize]) => `${t.l()}wire ${regSize}${w};`).concat(internalWires).join('\n');

    const allAssignments = [
      ...(thisModuleHasSubmodules ? globalOutputAssignments : []),
      ...(thisModuleHasSubmodules ? globalInputAssignments : []),
      ...(thisModuleHasSubmodules ? secondaryAssignments : []),
      ...(thisModuleHasSubmodules ? tiedWiresAssignments : []),
    ].join('\n');

    const submodules = m.getSubmodules().map(submoduleReference => {
      const out = [
        `${t.l()}${submoduleReference.m.moduleName} ${submoduleReference.submoduleName}(`
      ];
      t.push();

      out.push(
        Object.entries(wireMap.get(submoduleReference.m)).map(([portName, wire]) => {
          return `${t.l()}.${portName}(${wire})`
        }).join(',\n')
      );

      t.pop();
      out.push(`${t.l()});`);

      return out.join('\n');
    }).join('\n\n');


    return {
      code: (
        header + '\n' +
        shadowedAssignments + (shadowedAssignments ? '\n' : '') +
        internalRegisters + (internalRegisters ? '\n' : '') +
        internalWires + (internalWires ? '\n' : '') +
        wireDeclarations + (wireDeclarations ? '\n\n' : '') +
        allAssignments + (allAssignments ? '\n\n' : '') +
        submodules + (submodules ? '\n' : '') +
        combLogic + (combLogic ? '\n' : '') +
        syncBlocks + (syncBlocks ? '\n' : '') +
        'endmodule'
      ),
      submodules: m.getSubmodules().map(submoduleReference => submoduleReference.m)
    };
  }

  toVerilog() {
    const verilogModulesGenerated = [this.m.moduleName];

    const allCode = [];
    const moduleQueue = [this.m];
    while (moduleQueue.length) {
      const nextM = moduleQueue.pop();
      const generated = this.generateVerilogCodeForModule(nextM);
      allCode.push(generated.code);

      generated.submodules.forEach(m => {
        if (!verilogModulesGenerated.includes(m.moduleName)) {
          moduleQueue.push(m);
          verilogModulesGenerated.push(m.moduleName);
        }
      });
    }

    return (
      '`default_nettype none\n\n' +
      allCode.join('\n\n')
    );
  }
}
