import { VendorSignalError } from "./gw-error";
import { ConstantSignal, SignalReference, VendorOutputReference } from "./signal";

export type SignalWidth = number;

export type StringParam = { type: 'StringParam', value: string };
export type VendorInputs = Record<string, SignalReference | ConstantSignal>;
export type VendorOutputs = Record<string, SignalWidth>;

export const stringParam = (value: string): StringParam => ({ type: 'StringParam', value });

export type VendorModuleParams = {
  moduleName: string;
  instanceName: string;
  params: Record<string, ConstantSignal | StringParam>;
  inputs: VendorInputs;
  outputs: VendorOutputs;
}

export class VendorModule {
  readonly moduleName: string;
  readonly instanceName: string;
  readonly params: VendorModuleParams['params'];
  readonly inputs: VendorModuleParams['inputs'];
  readonly outputs: VendorModuleParams['outputs'];

  readonly outputSignals: Record<string, VendorOutputReference> = {};

  constructor(params: VendorModuleParams) {
    this.moduleName = params.moduleName;
    this.instanceName = params.instanceName;
    this.params = params.params;
    this.inputs = params.inputs;
    this.outputs = params.outputs;

    // Generate these once to ensure that all references are the same
    Object.entries(this.outputs).forEach(([signalName, width]) => {
      this.outputSignals[signalName] = new VendorOutputReference({
        vendorInstance: this,
        signalName,
        width,
      });
    });
  }

  getModuleIdentifier() {
    return `${this.moduleName}_${this.instanceName}`;
  }

  getOutput(name: string) {
    if (!(name in this.outputSignals)) {
      throw new VendorSignalError(`Output signal "${name}" not present in vendor module "${this.moduleName}"`);
    }
    return this.outputSignals[name];
  }
}
