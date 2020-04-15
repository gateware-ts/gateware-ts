import { SignalT } from "./signals";
import { ParameterString, VendorSignalMap, ModuleSignalDescriptor } from './main-types';

/**
 * Create a string that can be passed to a [[VendorModule]] parameter.
 * @param s
 */
export const ParamString = (s:string):ParameterString => ({
  type: 'parameterString',
  value: s
});

/**
 * The class which all gateware-ts vendor modules must extend.
 * This class should never be instaniated.
 * @typeParam Params A type or interface representing the parameters this vendor module should be instantiated with
 */
export class VendorModule<Params> {
  /** @internal */
  private params:Params;
  /** @internal */
  private inputs:SignalT[] = [];
  /** @internal */
  private outputs:SignalT[] = [];
  /** @internal */
  private vendorSignalMap: VendorSignalMap;

  constructor(params:Params) {
    this.params = params;
  }

  /** @internal */
  init() {
    this.createVendorSignalMap();
  }

  /** @internal */
  getInputSignals() { return this.inputs; }
  /** @internal */
  getOutputSignals() { return this.outputs; }
  /** @internal */
  getParameterDeclarations() { return this.params; }
  /** @internal */
  getVendorSignalMap() { return this.vendorSignalMap; }

  /**
   * Create an input signal on this module
   * @param s A signal definition
   */
  input(s:SignalT):SignalT {
    this.inputs.push(s);
    return s;
  }

  /**
   * Create an output signal on this module
   * @param s A signal definition
   */
  output(s:SignalT):SignalT {
    this.outputs.push(s);
    return s;
  }

  /** @internal */
  createVendorSignalMap():void {
    const allSignals = [];

    const createVendorSignalMap = (signals:SignalT[]) => {
      const map = new Map<SignalT, string>();

      signals.forEach(signal => {
        if (allSignals.includes(signal)) {
          throw new Error('Found duplicate signal in vendor module');
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
          throw new Error(`Unable to find the name associated with a signal in vendor module.`);
        }
      });

      return map;
    }

    this.vendorSignalMap = {
      input: createVendorSignalMap(this.getInputSignals()),
      output: createVendorSignalMap(this.getOutputSignals()),
    };
  }

  /** @internal */
  getModuleSignalDescriptor(s:SignalT):ModuleSignalDescriptor {
    const inputSignal = this.vendorSignalMap.input.get(s);
    if (inputSignal) {
      return { type: 'input', name: inputSignal, signal: s };
    }

    const outputSignal = this.vendorSignalMap.output.get(s);
    if (outputSignal) {
      return { type: 'output', name: outputSignal, signal: s };
    }

    throw new Error(`Unable to find internal signal in vendor module ${this.constructor.name}`);
  }
};

