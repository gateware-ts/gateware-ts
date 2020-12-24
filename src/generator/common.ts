/**
 * @internal
 * @packageDocumentation
 */
import { PortOrSignalArray } from "../main-types";

export const mapNamesToSignals = (map:Map<PortOrSignalArray, string>) => {
  return [...map.entries()].reduce<{ [name:string]: PortOrSignalArray }>((acc, [signal, name]) => {
    acc[name] = signal;
    return acc;
  }, {});
};

export const getRegSize = (s:PortOrSignalArray) => s.width > 1 ? `[${s.width-1}:0] ` : '';
