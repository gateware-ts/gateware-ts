import * as path from 'path';
import { writeFile } from 'fs';
import { exec } from 'child_process';

import { TabLevel, flatten } from '../helpers';
import { GWModule } from "../gw-module";
import { SignalT, ConstantT } from "../signals";
import { getRegSize, mapNamesToSignals } from './common';
import { VendorModule } from "../vendor-module";
import { timescaleToUnit } from '../simulation';
import { SyncBlockEvaluator } from './sync-block-evaluation';
import { CombLogicEvaluator } from './comb-logic-evaluation';
import { ParameterEvaluator } from './parameter-evaluation';
import { SimulationEvaluator } from './simulation-evaluation';
import {
  PortWiring,
  GeneratedVerilogObject,
  ParameterString,
  TimeScaleValue
} from "../main-types";

const isSyncDriven = (s:SignalT, syncDrivenSignals:SignalT[]):boolean => syncDrivenSignals.includes(s);

interface SimulationOptions {
  enabled: boolean;
  timescale: [ TimeScaleValue, TimeScaleValue ]
};

interface CodeGeneratorOptions {
  simulation?: SimulationOptions;
};

export class CodeGenerator {
  options:CodeGeneratorOptions;
  m:GWModule;

  constructor(m:GWModule, options:CodeGeneratorOptions = {}) {
    this.options = options || {};
    this.m = m;

    // Reinitialise module
    m.reset();
    m.init();
    m.describe();
  }

  writeVerilogToFile(projectName:string) {
    const filename = /\.v$/.test(projectName)
      ? projectName
      : projectName + '.v';
    const verilog = this.toVerilog();

    writeFile(`${filename}`, verilog, err => {
      if (err) {
        process.stderr.write(err.message + '\n');
        process.exit(1);
      }
      process.stdout.write(`Wrote verilog to ${filename}\n`);
    });
  }

  buildBitstream(projectName:string) {
    const verilog = this.toVerilog();

    writeFile(`${projectName}.v`, verilog, err => {
      if (err) {
        process.stderr.write(err.message + '\n');
        process.exit(1);
      }
      process.stdout.write(`Wrote verilog (${projectName}.v)\n`);

      const yosysCommand = `yosys -q -p 'synth_ice40 -top ${this.m.moduleName} -json ${projectName}.json' ${projectName}.v`;
      exec(yosysCommand, (err, _, stderr) => {
        if (err) {
          process.stderr.write(`Failed to synthsize with command: ${yosysCommand}\n`);
          process.stderr.write(stderr);
          exec(`rm ${projectName}.v`, () => {
            process.exit(1);
          });
          process.exit(1);
        }
        process.stdout.write(`Completed synthesis.\n`);

        const constraintsFile = path.join(__dirname, '../../board-constraints/icebreaker.pcf');
        const nextpnrCommand = `nextpnr-ice40 --up5k --json ${projectName}.json --pcf ${constraintsFile} --asc ${projectName}.asc`;
        exec(nextpnrCommand, (err, _, stderr) => {
          if (err) {
            process.stderr.write(`Failed to perform place and routing with command: ${nextpnrCommand}\n`);
            process.stderr.write(stderr);
            exec(`rm ${projectName}.json ${projectName}.v`, () => {
              process.exit(1);
            });
            process.exit(1);
          }
          process.stdout.write(`Completed place and route.\n`);

          const icepackCommand = `icepack ${projectName}.asc ${projectName}.bin`;
          exec(icepackCommand, (err, _, stderr) => {
            if (err) {
              process.stderr.write(`Failed to create a bitstream with command: ${icepackCommand}\n`);
              process.stderr.write(stderr);
              exec(`rm ${projectName}.json ${projectName}.asc ${projectName}.v`, () => {
                process.exit(1);
              });
            }
            process.stdout.write(`Wrote a bitstream to ${projectName}.bin.\n`);
            process.stdout.write(`Cleaning up...\n`);

            exec(`rm ${projectName}.json ${projectName}.asc ${projectName}.v`, () => {
              process.stdout.write(`Done!\n`);
            });
          })
        });
      })
    });
  }

  generateVerilogCodeForModule(m:GWModule, thisIsASimulation:boolean):GeneratedVerilogObject {
    const t = new TabLevel('  ', 1);

    const mSubmodules = m.getSubmodules();
    const mVendorModules = m.getVendorModules();
    const allChildModules = [...mSubmodules, ...mVendorModules];

    const thisModuleHasSubmodules = (mSubmodules.length + mVendorModules.length) > 0;

    const signalMap = m.getSignalMap();
    const namesToSignals = {
      input: mapNamesToSignals(signalMap.input),
      output: mapNamesToSignals(signalMap.output),
      internal: mapNamesToSignals(signalMap.internal),
    };

    const syncEval = new SyncBlockEvaluator(m, 1);
    const combEval = new CombLogicEvaluator(m, 1);
    const simEval = new SimulationEvaluator(m, 1);
    const paramEval = new ParameterEvaluator();

    if (thisIsASimulation) {
      const everyTimescaleBlocks = simEval.getEveryTimescaleBlocks();
      const simulationRunBlock = simEval.getRunBlock();
      const header = `module ${this.m.moduleName};`;
      const registers = simEval.getRegisterBlock();
      const wires = simEval.getWireBlock();
      const submodules = simEval.getSubmodules();
      const vcdBlock = simEval.getVcdBlock();

      const timescale = this.options.simulation.timescale;
      const code = (
        `\`timescale ${''
        }${timescale[0].value}${timescaleToUnit(timescale[0].timescale)}${''
        }/${timescale[1].value}${timescaleToUnit(timescale[1].timescale)}` + '\n\n' +
        header + '\n' +
        registers + '\n' +
        wires + '\n\n' +
        submodules + '\n\n' +
        everyTimescaleBlocks + '\n\n' +
        simulationRunBlock + '\n' +
        vcdBlock + '\n' +
        'endmodule'
      );

      return {
        code,
        submodules: m.getSubmodules().map(submoduleReference => submoduleReference.m)
      };
    }

    const syncBlocks = m.getSyncBlocks().map(block => syncEval.evaluateBlock(block)).join('\n\n');
    const combLogic = m.getCombinationalLogic().map(expr => combEval.evaluate(expr)).join('\n');

    const cDriven = combEval.getDrivenSignals();
    const sDriven = syncEval.getDrivenSignals();

    cDriven.forEach(cs => sDriven.forEach(ss => {
      if (cs === ss) {
        const signalName = m.getModuleSignalDescriptor(cs).name;
        throw new Error(`Driver-driver conflict on ${m.moduleName}.${signalName}. A signal cannot${
        ''} be driven by both syncronous and combinational logic.`);
      }
    }));

    const header = [
      `module ${m.moduleName}(`,
        Object
        .entries(namesToSignals.input)
        .map(([signalName, s]) => `input ${getRegSize(s)}${signalName}`)
        .map(t.indent)
        .join(',\n') + (Object.keys(namesToSignals.output).length > 0 ? ',' : ''),
        Object
        .entries(namesToSignals.output)
        .map(([signalName, s]) => `output ${isSyncDriven(s as SignalT, sDriven) ? 'reg ' : ''}${getRegSize(s)}${signalName}`)
        .map(t.indent)
        .join(',\n'),
      ');'
    ].join('\n');

    const initialRegisterAssignments = [...signalMap.output.entries()].reduce<string[]>((acc, [port, portName]) => {
      if (isSyncDriven(port as SignalT, sDriven)) {
        acc.push(`${t.l(1)}${portName} = ${(port as SignalT).defaultValue};`);
      }
      return acc;
    }, []);
    const initialBlock = initialRegisterAssignments.length ? [
      `${t.l()}initial begin`,
      initialRegisterAssignments.join('\n'),
      `${t.l()}end`
    ].join('\n') : '';

    const internalRegisters = syncEval.generateInternalRegisterDeclarations();
    const internalWires = syncEval.generateInternalWireDeclarations();

    const wireMap = new Map<GWModule | VendorModule<any>, PortWiring>();
    let wireIndex = 0;

    const inputWires = flatten(allChildModules.map(sm => {
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
    const globalOutputWires = [...signalMap.output.entries()].map(([port, portName]) => {
      const wire = `w${wireIndex++}`;
      globalPortWiring[portName] = wire;
      globalOutputAssignments.push(`${t.l()}assign ${portName} = ${wire};`);
      return [wire, getRegSize(port)];
    });

    const secondaryAssignments = [];
    allChildModules.forEach(sm => {
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
    [...signalMap.input.entries()].forEach(([port, portName]) => {
      const connectedWires = [];
      allChildModules.forEach(sm => {
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

    const submodules = mSubmodules.map(submoduleReference => {
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

    const vendorModules = mVendorModules.map(vendorModuleReference => {
      const out = [
        `${t.l()}${vendorModuleReference.m.constructor.name}`
      ];

      const pd = vendorModuleReference.m.getParameterDeclarations();
      if (Object.keys(pd).length) {
        out[0] += ' #(';
        t.push();

        out.push(
          Object.entries(pd).map(([paramName, paramValue]:[string, ConstantT | ParameterString]) => {
            return `${t.l()}.${paramName}(${paramEval.evaluate(paramValue)})`
          }).join(',\n')
        );

        t.pop();
        out.push(`${t.l()}) (`);
        t.push();
      } else {
        out[0] += ' (';
        t.push();
      }

      out.push(
        Object.entries(wireMap.get(vendorModuleReference.m)).map(([portName, wire]) => {
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
        internalRegisters + (internalRegisters ? '\n' : '') +
        internalWires + (internalWires ? '\n' : '') +
        wireDeclarations + (wireDeclarations ? '\n\n' : '') +
        initialBlock + (initialBlock ? '\n\n' : '') +
        allAssignments + (allAssignments ? '\n\n' : '') +
        vendorModules + (vendorModules ? '\n\n' : '') +
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

    const thisIsASimulation = this.options.simulation?.enabled;
    let thisIsTheTopLevelModule = true;

    const allCode = [];
    const moduleQueue = [this.m];
    while (moduleQueue.length) {
      const nextM = moduleQueue.pop();
      // TODO: Might just be better to split this out into a separate method
      const generated = this.generateVerilogCodeForModule(nextM, thisIsASimulation && thisIsTheTopLevelModule);
      allCode.push(generated.code);

      generated.submodules.forEach(m => {
        if (!verilogModulesGenerated.includes(m.moduleName)) {
          moduleQueue.push(m);
          verilogModulesGenerated.push(m.moduleName);
        }
      });

      thisIsTheTopLevelModule = false;
    }

    return (
      '`default_nettype none\n\n' +
      allCode.join('\n\n')
    );
  }
}
