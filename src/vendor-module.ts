import { SignalT } from "./signals";
import { ParameterString, VendorSignalMap, ModuleSignalDescriptor } from './main-types';

export const ParamString = (s:string):ParameterString => ({
  type: 'parameterString',
  value: s
});

export class VendorModule<Params> {
  private params:Params;
  private inputs:SignalT[] = [];
  private outputs:SignalT[] = [];
  private vendorSignalMap: VendorSignalMap;

  constructor(params:Params) {
    this.params = params;
  }

  init() {
    this.createVendorSignalMap();
  }

  getInputSignals() { return this.inputs; }
  getOutputSignals() { return this.outputs; }
  getParameterDeclarations() { return this.params; }
  getVendorSignalMap() { return this.vendorSignalMap; }

  input(s:SignalT):SignalT {
    this.inputs.push(s);
    return s;
  }

  output(s:SignalT):SignalT {
    this.outputs.push(s);
    return s;
  }

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

