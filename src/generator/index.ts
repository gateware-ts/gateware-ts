import { SignalArrayT } from './../signals';
import * as path from 'path';
import { writeFile } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

import { MODULE_CODE_ELEMENTS, SIMULATION_CODE_ELEMENTS, ASSIGNMENT_EXPRESSION, SIGNAL_ARRAY } from './../constants';
import {
  CodeElements,
  SimulationCodeElements,
  ModuleCodeElements,
  CombinationalSignalType,
  Port,
  UnsliceableExpressionMap,
  PortOrSignalArray
} from './../main-types';
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
import { ExpressionEvaluator } from './expression-evaluation';

type ModuleName = string;
type WireName = string;
type PortToWire = Map<Port, [WireName, ModuleName]>;

/** @internal */
const codeElementsToString = (ce:CodeElements) => {
  if (ce.type === MODULE_CODE_ELEMENTS) {
    return (
      ce.header + '\n' +
      ce.internalRegisters + (ce.internalRegisters ? '\n' : '') +
      ce.internalWires + (ce.internalWires ? '\n' : '') +
      ce.wireDeclarations + (ce.wireDeclarations ? '\n\n' : '') +
      ce.initialBlock + (ce.initialBlock ? '\n\n' : '') +
      ce.assignments + (ce.assignments ? '\n\n' : '') +
      ce.vendorModules + (ce.vendorModules ? '\n\n' : '') +
      ce.submodules + (ce.submodules ? '\n' : '') +
      ce.combAssigns + (ce.combAssigns ? '\n' : '') +
      ce.combAlways + (ce.combAlways ? '\n' : '') +
      ce.syncBlocks + (ce.syncBlocks ? '\n' : '') +
      'endmodule'
    );
  } else if (ce.type === SIMULATION_CODE_ELEMENTS) {
    return (
      ce.timescale + '\n\n' +
      ce.header + '\n' +
      ce.registers + '\n' +
      ce.wires + '\n\n' +
      ce.alwaysStarBlock + '\n\n' +
      ce.submodules + '\n\n' +
      ce.everyTimescaleBlocks + '\n\n' +
      ce.simulationRunBlock + '\n' +
      ce.vcdBlock + '\n' +
      'endmodule'
    );
  }
};

/** @internal */
const isSyncDriven = (s:PortOrSignalArray, syncDrivenSignals:PortOrSignalArray[]):boolean => syncDrivenSignals.includes(s);

/** @internal */
const isCombinationalRegister = (s:PortOrSignalArray, signalTypes:Map<PortOrSignalArray, CombinationalSignalType>):boolean => {
  return signalTypes.get(s) === CombinationalSignalType.Register;
}

/** @internal */
const writeFileP = promisify(writeFile);
/** @internal */
const execP = promisify(exec);
/** @internal */
const cleanupFiles = (filenames:string[]) => exec(`rm ${filenames.join(' ')}`);

export enum DeviceTypes {
  lp384 = 'lp384',
  lp1k = 'lp1k',
  lp4k = 'lp4k',
  lp8k = 'lp8k',
  hx1k = 'hx1k',
  hx4k = 'hx4k',
  hx8k = 'hx8k',
  up3k = 'up3k',
  up5k = 'up5k',
  u1k = 'u1k',
  u2k = 'u2k',
  u4k = 'u4k',
};

interface SimulationOptions {
  enabled: boolean;
  timescale: TimeScaleValue[]
};

interface CodeGeneratorOptions {
  simulation?: SimulationOptions;
  pcfPath?: string;
  deviceType?: DeviceTypes;
};

/**
 * Class for generating verilog, bitstreams, and running simulations
 */
export class CodeGenerator {
  /** @internal */
  options:CodeGeneratorOptions;
  /**
   * the working module
   */
  m:GWModule;

  /**
   * Creates a new CodeGenerator
   * @param m top level module
   * @param options configuration options
   */
  constructor(m:GWModule, options:CodeGeneratorOptions = {}) {
    this.options = options || {};
    this.m = m;

    // Reinitialise module
    m.reset();
    m.init();
    m.describe();
  }

  /**
   * Compiles [[CodeGenerator.m]] to verilog as if it were a simulation, creating an associated
   * VCD wave file if provided
   * Cleans up all associated files after simulating, except the VCD
   * @param projectName the name of the project (generated files will use this name)
   * @param vcdFile the name of VCD wave file to generate
   */
  async runSimulation(projectName:string, vcdFile?:string, cleanupIntermediateFiles = true) {
    try {
      if (vcdFile) {
        this.m.simulation.outputVcdFile(vcdFile);
      }

      await this.writeVerilogToFile(`${projectName}-tb`);
      const iverilogCommand = `iverilog -o ${projectName}.vpp ${projectName}-tb.v`;
      await execP(iverilogCommand);

      const vvpCommand = `vvp ${projectName}.vpp`;
      await execP(vvpCommand).then(({stdout}) => {
        process.stdout.write(stdout);
      });
    } catch (ex) {
      if (cleanupIntermediateFiles) {
        await cleanupFiles([
          `${projectName}-tb.v`,
          `${projectName}.vpp`
        ]);
      }
      throw ex;
    }

    process.stdout.write('gateware-ts: Finished running simulation. Cleaning up...');
    if (cleanupIntermediateFiles) {
      await cleanupFiles([
        `${projectName}-tb.v`,
        `${projectName}.vpp`
      ]);
    }

    process.exit(0);
  }

  /**
   * Compiles [[CodeGenerator.m]] to verilog and writes it to a file
   * @param projectName the name of the project (generated files will use this name)
   */
  async writeVerilogToFile(projectName:string) {
    const filename = /\.v$/.test(projectName)
      ? projectName
      : projectName + '.v';
    const verilog = this.toVerilog();
    await writeFileP(`${filename}`, verilog);
    process.stdout.write(`Wrote verilog to ${filename}\n`);
  }

  /**
   * Compiles [[CodeGenerator.m]] to verilog, performs synthesis, routing, and creates a bitstream
   * @param projectName the name of the project (generated files will use this name)
   * @param cleanupIntermediateFiles if true, the files generated during compilation, synthesis, and routing will be removed
   */
  async buildBitstream(projectName:string, cleanupIntermediateFiles:boolean = true) {
    try {
      const verilog = this.toVerilog();
      await writeFileP(`${projectName}.v`, verilog);
      process.stdout.write(`Wrote verilog (${projectName}.v)\n`);

      const yosysCommand = `yosys -q -p 'synth_ice40 -top ${this.m.moduleName} -json ${projectName}.json' ${projectName}.v`;
      await execP(yosysCommand);
      process.stdout.write(`Completed synthesis.\n`);

      const constraintsFile = this.options.pcfPath
        ? path.join(process.cwd(), this.options.pcfPath)
        : path.join(__dirname, '../../board-constraints/icebreaker.pcf');

      const deviceTypeArgument = this.options.deviceType
        ? `--${this.options.deviceType}`
        : `--up5k`;

      const nextpnrCommand = `nextpnr-ice40 ${deviceTypeArgument} --json ${projectName}.json --pcf ${constraintsFile} --asc ${projectName}.asc`;
      await execP(nextpnrCommand);
      process.stdout.write(`Completed place and route.\n`);

      const icepackCommand = `icepack ${projectName}.asc ${projectName}.bin`;
      await execP(icepackCommand);
      process.stdout.write(`Built bitstream.\n`);

      if (cleanupIntermediateFiles) {
        process.stdout.write(`Cleaning up intermediate files.\n`);
        await cleanupFiles([
          `${projectName}.v`,
          `${projectName}.json`,
          `${projectName}.asc`
        ]);
      }
      process.stdout.write(`Done!\n`);
    } catch (ex) {
      if (cleanupIntermediateFiles) {
        await cleanupFiles([
          `${projectName}.v`,
          `${projectName}.json`,
          `${projectName}.asc`
        ]);
      }

      console.error(ex);
      process.exit(1);
    }
  }

  /** @internal */
  generateVerilogCodeForModule(m:GWModule, thisIsASimulation:boolean):GeneratedVerilogObject {
    const t = new TabLevel('  ', 1);

    const mSubmodules = m.getSubmodules();
    const mVendorModules = m.getVendorModules();
    const allChildModules = [...mSubmodules, ...mVendorModules];

    const thisModuleHasSubmodules = (mSubmodules.length + mVendorModules.length) > 0;

    const syncLogic = m.getSyncBlocks();
    const combLogic = m.getCombinationalLogic();

    const signalMap = m.getSignalMap();
    const namesToSignals = {
      input: mapNamesToSignals(signalMap.input),
      output: mapNamesToSignals(signalMap.output),
      internal: mapNamesToSignals(signalMap.internal),
    };

    const unsliceableExpressionMap:UnsliceableExpressionMap = [];

    const syncEval = new SyncBlockEvaluator(m, unsliceableExpressionMap, 1);
    const combEval = new CombLogicEvaluator(m, unsliceableExpressionMap, 1);
    const simEval = new SimulationEvaluator(m, unsliceableExpressionMap, 1);
    const exprEval = new ExpressionEvaluator(m, unsliceableExpressionMap);
    const paramEval = new ParameterEvaluator();

    if (thisIsASimulation) {
      if (syncLogic.length) {
        console.warn([
          'Warning: Synchronous logic detected in the top level simulation module.',
          'This logic will have no effect. Use GWModule.simulation.run() instead.'
        ].join(' '))
      }
      if (combLogic.length) {
        console.warn([
          'Warning: Combinational logic detected in the top level simulation module.',
          'This logic will have no effect. Use GWModule.simulation.run() instead.'
        ].join(' '))
      }

      const everyTimescaleBlocks = simEval.getEveryTimescaleBlocks();
      const simulationRunBlock = simEval.getRunBlock();
      const unsliceableWires = unsliceableExpressionMap.map(([signal, name]) => {
        return `${t.l()}wire ${getRegSize(signal as Port)}${name};`;
      }).join('\n');
      const header = `module ${this.m.moduleName};`;
      const registers = simEval.getRegisterBlock();
      const wires = simEval.getWireBlock() + '\n' + unsliceableWires;
      const submodules = simEval.getSubmodules();
      const vcdBlock = simEval.getVcdBlock();

      const alwaysStarBlock = [
        `${t.l()}always @(*) begin`,
        ...unsliceableExpressionMap.map(([_, name, code]) =>  {
          return `${t.l(1)}assign ${name} = ${code};`;
        }),
        `${t.l()}end`,
      ].join('\n');


      const ts = this.options.simulation.timescale;
      const timescale = `\`timescale ${''
      }${ts[0].value}${timescaleToUnit(ts[0].timescale)}${''
      }/${ts[1].value}${timescaleToUnit(ts[1].timescale)}`;

      const code:SimulationCodeElements = {
        type: SIMULATION_CODE_ELEMENTS,
        timescale,
        header,
        registers,
        wires,
        alwaysStarBlock,
        submodules,
        everyTimescaleBlocks,
        simulationRunBlock,
        vcdBlock
      };

      return {
        code,
        submodules: m.getSubmodules().map(submoduleReference => submoduleReference.m)
      };
    }

    const syncBlocks = syncLogic.map(block => syncEval.evaluateBlock(block)).join('\n\n');

    let combAssigns = '';
    let combAlways = `${t.l()}always @(*) begin\n`;
    combLogic.forEach(expr => {
      const code = combEval.evaluate(expr);
      if (expr.type === ASSIGNMENT_EXPRESSION) {
        combAssigns += `${code}\n`;
      } else {
        combAlways += `${code}\n`;
      }
    });

    const unsliceableWires = unsliceableExpressionMap.map(([signal, name]) => {
      return `${t.l()}wire ${getRegSize(signal as Port)}${name};`;
    }).join('\n');
    combAssigns = unsliceableExpressionMap.map(([_, name, value]) => {
      return `${t.l()}assign ${name} = ${value};\n`;
    }).join('\n') + combAssigns;

    combAlways += `${t.l()}end`;
    combAssigns = combAssigns.trimEnd();

    if (combAlways === `${t.l()}always @(*) begin\n${t.l()}end`) {
      combAlways = '';
    }

    const cDriven = combEval.getDrivenSignals();
    const sDriven = [
      ...syncEval.getDrivenSignals(),
      // If an output or internal has a default value, it implies it must be a register
      ...m.getInternalSignals().filter(s => {
        if (s instanceof SignalArrayT) {
          return false;
        }
        return (s as SignalT).hasDefaultValue;
      }),
      ...m.getOutputSignals().filter(s => s.hasDefaultValue)
    ];
    const cSignalTypes = combEval.getSignalTypes();

    cDriven.forEach(cs => sDriven.forEach(ss => {
      if (cs === ss) {
        const signalName = m.getModuleSignalDescriptor(cs).name;
        throw new Error(`Driver-driver conflict on ${m.moduleName}.${signalName}. A signal cannot${
        ''} be driven by both syncronous and combinational logic.`);
      }
    }));

    const nIns = Object.keys(namesToSignals.input).length;
    const nOuts = Object.keys(namesToSignals.output).length;
    const headerParts = [`module ${m.moduleName}(`];
    let header;

    if (nIns + nOuts === 0) {
      headerParts[0] += ');';
    } else {
      if (nIns > 0) {
        headerParts.push(
          Object
          .entries(namesToSignals.input)
          .map(([signalName, s]) => `input ${getRegSize(s)}${signalName}`)
          .map(t.indent)
          .join(',\n') + (nOuts > 0 ? ',' : '')
        );
      }
      if (nOuts > 0) {
        headerParts.push(
          Object
          .entries(namesToSignals.output)
          .map(([signalName, s]) => {
            const typeInformation = isSyncDriven(s as SignalT, sDriven) || isCombinationalRegister(s as SignalT, cSignalTypes)
              ? 'reg '
              : '';
            return `output ${typeInformation}${getRegSize(s)}${signalName}`;
          })
          .map(t.indent)
          .join(',\n')
        );
      }
      headerParts.push(');');
    }

    header = headerParts.join('\n');

    const outputsAndInternals = [...signalMap.output.entries(), ...signalMap.internal.entries()];
    const initialRegisterAssignments = outputsAndInternals.reduce<string[]>((acc, [port, portName]) => {
      if (isSyncDriven(port as SignalT, sDriven)
          && port.type !== SIGNAL_ARRAY
          && (port as SignalT).hasDefaultValue) {
        acc.push(`${t.l(1)}${portName} = ${(port as SignalT).defaultValue};`);
      }
      return acc;
    }, []);
    const initialBlock = initialRegisterAssignments.length ? [
      `${t.l()}initial begin`,
      initialRegisterAssignments.join('\n'),
      `${t.l()}end`
    ].join('\n') : '';

    const internalRegisters = syncEval.generateInternalRegisterDeclarations(sDriven);
    const internalWires = syncEval.generateInternalWireDeclarations();

    const portWireMap: PortToWire = new Map();
    allChildModules.forEach(sm => {
      const submoduleName = sm.submoduleName;
      sm.m.getOutputSignals().forEach(oPort => {
        const desc = sm.m.getModuleSignalDescriptor(oPort);
        const wireName = `${submoduleName}_${desc.name}_wire`;

        // Add to the map, which will be used to check if an Signal should actually be
        // replaced with it's wire instead
        if (portWireMap.has(oPort)) {
          throw new Error(`${submoduleName}.${desc.name} has already been mapped to an output wire`);
        }
        portWireMap.set(oPort, [wireName, desc.name]);
      });
    });

    const submoduleOutputWireDeclarations = [...portWireMap.entries()].map(([port, [wireName, _]]) => (
      [wireName, getRegSize(port)]
    ));


    // Generate an assign for every output going to the parent module
    const parentOutputAssignments = [];
    allChildModules.forEach(sm => {
      Object.entries(sm.mapping.outputs).forEach(([submoduleOutputName, writtenPorts]) => {
        // Loop over every port, check if it belongs to the parent
        writtenPorts.forEach(writtenPort => {
          if (m.isOwnWritable(writtenPort)) {
            const desc = m.getModuleSignalDescriptor(writtenPort);
            const [wireName] = portWireMap.get(sm.m[submoduleOutputName]);

            const errorBase = `Cannot drive ${m.moduleName}.${desc.name} from submodule output ${sm.submoduleName}.${submoduleOutputName} `;
            if (sDriven.includes(writtenPort)) {
              throw new Error(`${errorBase} because it is already driven by the synchronous logic of ${m.moduleName}`);
            }
            if (cDriven.includes(writtenPort)) {
              throw new Error(`${errorBase} because it is already driven by the combinational logic of ${m.moduleName}`);
            }

            parentOutputAssignments.push(
              `${t.l()}assign ${desc.name} = ${wireName};`
            );
          }
        });
      });
    });

    const wireDeclarations = [
      // TODO: Be careful here that user-defined wires don't clash with generated names
      ...(thisModuleHasSubmodules ? submoduleOutputWireDeclarations : []),
    ].map(([w, regSize]) => `${t.l()}wire ${regSize}${w};`)
    .concat(internalWires).join('\n')
    + unsliceableWires;

    const allAssignments = [
      ...parentOutputAssignments
    ].join('\n');

    const submodules = mSubmodules.map(submoduleReference => {
      const out = [
        `${t.l()}${submoduleReference.m.moduleName} ${submoduleReference.submoduleName}(`
      ];
      t.push();

      // Iterate over the inputs of this submodule. If the Port they refer to is a constant,
      // push the declaration into the constantInputs.
      // If it's in the portWireMap, use the wireName instead
      // Otherwise (for now), it must be a parent module signal, and can be wired directly
      const constantInputs = [];
      const nonConstantInputs = [];
      Object.entries(submoduleReference.mapping.inputs).forEach(([name, port]) => {
        if (port instanceof ConstantT) {
          constantInputs.push(`${t.l()}.${name}(${exprEval.evaluate(port)})`);
          return;
        }

        if (port instanceof SignalT) {
          if (portWireMap.has(port)) {
            const [wireName] = portWireMap.get(port);
            nonConstantInputs.push(`${t.l()}.${name}(${wireName})`);
          } else {
            nonConstantInputs.push(`${t.l()}.${name}(${exprEval.evaluate(port)})`);
          }
          return;
        }

        throw new Error(`${submoduleReference.submoduleName}.${name} is neither ConstantT or SignalT`);
      });

      // Map the outputs to the autogenerated wires
      const wireOutputs = [];
      submoduleReference.m.getOutputSignals().forEach(port => {
        const [wireName, portName] = portWireMap.get(port);
        wireOutputs.push(`${t.l()}.${portName}(${wireName})`);
      });

      // Push the strings for all ports
      out.push(
        constantInputs
        .concat(nonConstantInputs)
        .concat(wireOutputs)
        .join(',\n')
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
        out.push(`${t.l()}) ${vendorModuleReference.m.moduleName} (`);
        t.push();
      } else {
        out[0] += ` ${vendorModuleReference.m.moduleName} (`;
        t.push();
      }

      // Find any inputs that were specified as constants
      const constantInputs = [];
      const nonConstantInputs = [];
      Object.entries(vendorModuleReference.mapping.inputs).forEach(([name, port]) => {
        if (port instanceof ConstantT) {
          constantInputs.push(`${t.l()}.${name}(${exprEval.evaluate(port)})`);
          return;
        }

        if (port instanceof SignalT) {
          if (portWireMap.has(port)) {
            const [wireName] = portWireMap.get(port);
            nonConstantInputs.push(`${t.l()}.${name}(${wireName})`);
          } else {
            nonConstantInputs.push(`${t.l()}.${name}(${exprEval.evaluate(port)})`);
          }
          return;
        }

        throw new Error(`${vendorModuleReference.submoduleName}.${name} is neither ConstantT or SignalT`);
      });

      // Map the outputs to the autogenerated wires
      const wireOutputs = [];
      vendorModuleReference.m.getOutputSignals().forEach(port => {
        const [wireName, portName] = portWireMap.get(port);
        wireOutputs.push(`${t.l()}.${portName}(${wireName})`);
      });

      out.push(
        constantInputs
        .concat(nonConstantInputs)
        .concat(wireOutputs)
        .join(',\n')
      );

      t.pop();
      out.push(`${t.l()});`);
      return out.join('\n');
    }).join('\n\n');

    const moduleCode:ModuleCodeElements = {
      type: MODULE_CODE_ELEMENTS,
      header,
      internalRegisters,
      internalWires,
      wireDeclarations,
      initialBlock,
      assignments: allAssignments,
      vendorModules,
      submodules,
      combAlways,
      combAssigns,
      syncBlocks
    }

    return {
      code: moduleCode,
      submodules: m.getSubmodules().map(submoduleReference => submoduleReference.m)
    };
  }

  /**
   * Compiles [[CodeGenerator.m]] to verilog
   */
  toVerilog() {
    const verilogModulesGenerated = [this.m.moduleName];

    const thisIsASimulation = this.options.simulation && this.options.simulation.enabled;
    let thisIsTheTopLevelModule = true;

    const allCode:string[] = [];
    const moduleQueue = [this.m];
    while (moduleQueue.length) {
      const nextM = moduleQueue.pop();
      // TODO: Might just be better to split this out into a separate method
      const generated = this.generateVerilogCodeForModule(nextM, thisIsASimulation && thisIsTheTopLevelModule);
      allCode.push(codeElementsToString(generated.code));

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
