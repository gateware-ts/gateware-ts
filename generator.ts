import { IfExpression } from './block-expressions';
import { JSHDLModule } from "./hdl-module";
import { SignalT, ConstantT, SliceT, WireT } from "./signals";
import {
  Edge,
  AssignmentExpression,
  InternallyShadowedRegister,
  BlockExpression,
  SignalLikeOrValue,
  ModuleSignalDescriptor,
  UnaryExpression,
  Operation,
  ComparrisonExpression,
  ComparrisonOperation,
  OperationExpression,
  SignalLike,
  SwitchExpression,
  SubjectiveCaseExpression,
  TernaryExpression,
  Port,
  SignalMap,
  GeneratedVerilogObject
} from "./main-types";
import {
  ASSIGNMENT_EXPRESSION,
  SIGNAL,
  CONSTANT,
  UNARY_EXPRESSION,
  COMPARRISON_EXPRESSION,
  OPERATION_EXPRESSION,
  IF_EXPRESSION,
  SLICE,
  SWITCH_EXPRESSION,
  CASE_EXPRESSION,
  TERNARY_EXPRESSION,
  WIRE
} from './constants';
import { TabLevel, flatten } from './helpers';

export const mapNamesToSignals = (map:Map<Port, string>) => {
  return [...map.entries()].reduce<{ [name:string]: Port }>((acc, [signal, name]) => {
    acc[name] = signal;
    return acc;
  }, {});
};

export const createModuleSignalDescriptorGetter = (signalMap:SignalMap) => (s:SignalT):ModuleSignalDescriptor => {
  const inputSignal = signalMap.input.get(s);
  if (inputSignal) {
    return { type: 'input', name: inputSignal, signal: s };
  }

  const internalSignal = signalMap.internal.get(s);
  if (internalSignal) {
    return { type: 'internal', name: internalSignal, signal: s };
  }

  const outputSignal = signalMap.output.get(s);
  if (outputSignal) {
    return { type: 'output', name: outputSignal, signal: s };
  }

  throw new Error(`Unable to find signal ${s}`);
}

const getRegSize = (s:Port) => s.width > 1 ? `[${s.width-1}:0] ` : '';

const parenthize = (s:SignalLike, fn:(s:SignalLikeOrValue) => string):string =>
  (s.type === SIGNAL || s.type === WIRE) ? fn(s) : `(${fn(s)})`;

const createEvaluateSignalLikeOrValueFn = (getModuleSignalDescriptor:(s: Port) => ModuleSignalDescriptor) => {
  return function evaluateSignalLikeOrValue(expr:SignalLikeOrValue):string {
    if (typeof expr === 'number') {
      return expr.toString();
    }

    switch (expr.type) {
      case SIGNAL: return getModuleSignalDescriptor((expr as SignalT)).name;
      case WIRE: return getModuleSignalDescriptor((expr as WireT)).name;

      case CONSTANT: {
        const constExpr = expr as ConstantT;
        return `${constExpr.width}'b${constExpr.value.toString(2).padStart(constExpr.width, '0')}`;
      };

      case UNARY_EXPRESSION: {
        const unaryExpr = expr as UnaryExpression;
        switch (unaryExpr.op) {
          case Operation.Not: {
            return `~${parenthize(unaryExpr.a, evaluateSignalLikeOrValue)}`;
          }

          default: {
            throw new Error(`Unrecognised unary operation`);
          }
        }
      }

      case TERNARY_EXPRESSION: {
        const tExpr = expr as TernaryExpression;
        return `${evaluateSignalLikeOrValue(tExpr.comparrison)} ? ${evaluateSignalLikeOrValue(tExpr.a)} : ${evaluateSignalLikeOrValue(tExpr.b)}`;
      }

      case COMPARRISON_EXPRESSION: {
        const compExpr = expr as ComparrisonExpression;
        let op:string;

        if (compExpr.comparrisonOp === ComparrisonOperation.Equal)
          op = '==';
        else if (compExpr.comparrisonOp === ComparrisonOperation.GreaterThan)
          op = '>';
        else if (compExpr.comparrisonOp === ComparrisonOperation.GreaterThanOrEqualTo)
          op = '>=';
        else if (compExpr.comparrisonOp === ComparrisonOperation.LessThan)
          op = '<';
        else if (compExpr.comparrisonOp === ComparrisonOperation.LessThanOrEqualTo)
          op = '<=';
        else if (compExpr.comparrisonOp === ComparrisonOperation.NotEqual)
          op = '!=';
        else
          throw new Error(`Unrecognised comparrison operation`);

        return `${parenthize(compExpr.a, evaluateSignalLikeOrValue)} ${op} ${evaluateSignalLikeOrValue(compExpr.b)}`;
      }

      case OPERATION_EXPRESSION: {
        const opExpr = expr as OperationExpression;

        let op:string;
        if (opExpr.op === Operation.Plus)
          op = '+';
        else if (opExpr.op === Operation.Minus)
          op = '-';
        else
          throw new Error('Unrecognised binary operation');

        return `${parenthize(opExpr.a, evaluateSignalLikeOrValue)} ${op} ${evaluateSignalLikeOrValue(opExpr.b)}`;
      }

      case SLICE: {
        const sliceExpr = expr as SliceT;
        return (sliceExpr.fromBit === sliceExpr.toBit)
          ? `${parenthize(sliceExpr.a, evaluateSignalLikeOrValue)}[${sliceExpr.fromBit}]`
          : `${parenthize(sliceExpr.a, evaluateSignalLikeOrValue)}[${sliceExpr.fromBit}:${sliceExpr.toBit}]`;
      }

      default: {
        debugger;
        throw new Error('Unrecognised expression type');
      }
    }
  };
};

const createEvaluateFn = (
  getModuleSignalDescriptor:(s: SignalT) => ModuleSignalDescriptor,
  internalShadowedRegistersMap: Map<SignalT, InternallyShadowedRegister>,
  assignmentToken:string,
  evaluateSignalLikeOrValue:(expr:SignalLikeOrValue) => string
) => {
  return function evaluate(expr:BlockExpression, t:TabLevel):string {
    const out = [];

    switch (expr.type) {
      case ASSIGNMENT_EXPRESSION: {
        const aExpr = expr as AssignmentExpression;
        let internallyShadowedRegister = internalShadowedRegistersMap.get(aExpr.a);
        let assigningRegister = getModuleSignalDescriptor(aExpr.a);

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
          internalShadowedRegistersMap.set(shadowed.originalSignal, shadowed);
          internallyShadowedRegister = shadowed;
        }

        if (internallyShadowedRegister) {
          out.push(`${t.l()}${internallyShadowedRegister.name} ${assignmentToken} ${evaluateSignalLikeOrValue(aExpr.b)};`);
        } else {
          out.push(`${t.l()}${assigningRegister.name} ${assignmentToken} ${evaluateSignalLikeOrValue(aExpr.b)};`);
        }

        break;
      }

      case IF_EXPRESSION: {
        const iExpr = expr as IfExpression;

        out.push(`${t.l()}if (${evaluateSignalLikeOrValue(iExpr.subject)}) begin`);
        t.push();
        iExpr.exprs.forEach(expr => {
          out.push(evaluate(expr, t));
        });
        t.pop();

        if (iExpr.elseClause && iExpr.elseClause.length) {
          out.push(`${t.l()}end else begin`);
          t.push();
          iExpr.elseClause.forEach(expr => {
            out.push(evaluate(expr, t));
          });
          t.pop();
        }

        out.push(`${t.l()}end`);
        break;
      }

      case SWITCH_EXPRESSION: {
        const sExpr = expr as SwitchExpression;

        out.push(`${t.l()}case (${evaluateSignalLikeOrValue(sExpr.subject)})`);
        t.push();

        out.push(
          sExpr.cases.map(expr => {
            const caseOut = [];

            if (expr.type === CASE_EXPRESSION) {
              const caseExpr = expr as SubjectiveCaseExpression;
              caseOut.push(`${t.l()}${evaluateSignalLikeOrValue(caseExpr.subject)} : begin`);
            } else {
              caseOut.push(`${t.l()}default : begin`);
            }
            t.push();

            caseOut.push(
              expr.body.map(bodyExpr => evaluate(bodyExpr, t)).join('\n')
            );

            t.pop();
            caseOut.push(`${t.l()}end`);

            return caseOut.join('\n');
          }).join('\n\n')
        );

        t.pop();
        out.push(`${t.l()}endcase`);
        break;
      }
    }

    return out.join('\n');
  }
};

export const toVerilog = (m:JSHDLModule) => {
  // Reset module before describing in case describe was previously called somehow
  m.reset();
  m.init();
  m.describe();

  const verilogModulesGenerated = [m.moduleName];

  const toHeaderText = (type:string, t:TabLevel) => ([signalName, signal]:[string, SignalT]) => {
    return `${t.l()}${type} ${getRegSize(signal)}${signalName}`
  };

  const generateVerilogCodeForModule = (m:JSHDLModule, isTopLevelModule:boolean):GeneratedVerilogObject => {
    const t = new TabLevel('  ', 1);

    const signalMap = m.getSignalMap();
    const namesToSignals = {
      input: mapNamesToSignals(signalMap.input),
      output: mapNamesToSignals(signalMap.output),
      internal: mapNamesToSignals(signalMap.internal),
    };

    const internalShadowedRegistersMap = new Map<SignalT, InternallyShadowedRegister>();

    const boundGetModuleSignalDescriptor = m.getModuleSignalDescriptor.bind(m);
    const evaluateSignalLikeOrValue = createEvaluateSignalLikeOrValueFn(boundGetModuleSignalDescriptor);
    const evaluateSync = createEvaluateFn(
      boundGetModuleSignalDescriptor,
      internalShadowedRegistersMap,
      '<=',
      evaluateSignalLikeOrValue
    );

    // TODO: Redo this - provide way of doing non sequential comb logic
    const evaluateComb = createEvaluateFn(
      boundGetModuleSignalDescriptor,
      internalShadowedRegistersMap,
      '=',
      evaluateSignalLikeOrValue
    );

    const header = [
      `module ${m.moduleName}(`,
      Object
        .entries(namesToSignals.input)
        .map(toHeaderText('input', t))
        .join(',\n') + (Object.keys(namesToSignals.output).length > 0 ? ',' : ''),
      Object
        .entries(namesToSignals.output)
        .map(toHeaderText('output', t))
        .join(',\n'),
      ');'
    ].join('\n');

    const syncBlocks = m.getSyncBlocks().map(block => {
      let out = [
        `${t.l()}always @(${block.edge === Edge.Positive ? 'posedge' : 'negedge' } ${m.getModuleSignalDescriptor(block.signal).name}) begin`,
      ];

      t.push();
      block.block.forEach(expr => out.push(evaluateSync(expr, t)));
      t.pop();
      out.push(`${t.l()}end`);

      return out.join('\n');
    }).join('\n\n');

    const continuousAssignments = m.getContinuousAssignments().map(assignmentExpr => {
      const signalDescriptor = m.getModuleSignalDescriptor(assignmentExpr.a);
      if (!['output', 'internal', 'wire'].includes(signalDescriptor.type)) {
        throw new Error(`Cannot continuously assign to an input (${m.moduleName}.${signalDescriptor.name}).`);
      }
      return `${t.l()}assign ${signalDescriptor.name} = ${evaluateSignalLikeOrValue(assignmentExpr.b)};`;
    });

    const combBlocks = m.getCombinationalBlocks().map(block => {
      let out = [
        `${t.l()}always @(*) begin`,
      ];

      t.push();
      block.forEach(expr => out.push(evaluateComb(expr, t)));
      t.pop();
      out.push(`${t.l()}end`);

      return out.join('\n');
    }).join('\n\n');

    const shadowedAssignments = [...internalShadowedRegistersMap.values()].map(isr => {
      return [
        `${t.l()}reg ${getRegSize(isr.originalSignal)}${isr.name} = ${isr.signal.defaultValue};`,
        `${t.l()}assign ${isr.originalName} = ${isr.name};`
      ].join('\n');
    }).join('\n');

    const internalRegisters = m.getInternalSignals().map(s => {
      return `${t.l()}reg ${getRegSize(s)}${m.getModuleSignalDescriptor(s).name} = ${s.defaultValue};`;
    }).join('\n');

    const internalWires = m.getWires().map(w => {
      return `${t.l()}wire ${getRegSize(w)}${m.getModuleSignalDescriptor(w).name};`;
    });

    type PortWiring = { [portName:string]: string; };

    const wireMap = new Map<JSHDLModule, PortWiring>();
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

    // Not sure about this solution. might be more correct to check if a module has submodules
    const wireDeclarations = [
      // TODO: Be careful here that user-defined wires don't have the same names
      // as ones I generate
      ...(isTopLevelModule ? inputWires : []),
      ...(isTopLevelModule ? globalOutputWires : [])
    ].map(([w, regSize]) => `${t.l()}wire ${regSize}${w};`).concat(internalWires).join('\n');

    const allAssignments = [
      ...(isTopLevelModule ? globalOutputAssignments : []),
      ...(isTopLevelModule ? globalInputAssignments : []),
      ...(isTopLevelModule ? secondaryAssignments : []),
      ...(isTopLevelModule ? tiedWiresAssignments : []),
      ...continuousAssignments
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
        syncBlocks + (syncBlocks ? '\n' : '') +
        combBlocks + (combBlocks ? '\n' : '') +
        'endmodule'
      ),
      submodules: m.getSubmodules().map(submoduleReference => submoduleReference.m)
    };
  }

  const allCode = [];
  const moduleQueue = [m];
  let firstModule = true;
  while (moduleQueue.length) {
    const nextM = moduleQueue.pop();
    const generated = generateVerilogCodeForModule(nextM, firstModule);
    allCode.push(generated.code);

    generated.submodules.forEach(m => {
      if (!verilogModulesGenerated.includes(m.moduleName)) {
        moduleQueue.push(m);
        verilogModulesGenerated.push(m.moduleName);
      }
    });
    firstModule = false;
  }

  return '`default_nettype none\n\n' + allCode.join('\n\n');
};
