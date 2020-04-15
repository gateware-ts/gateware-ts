/**
 * @internal
 * @packageDocumentation
 */
import { Port } from "../main-types";

export const mapNamesToSignals = (map:Map<Port, string>) => {
  return [...map.entries()].reduce<{ [name:string]: Port }>((acc, [signal, name]) => {
    acc[name] = signal;
    return acc;
  }, {});
};

export const getRegSize = (s:Port) => s.width > 1 ? `[${s.width-1}:0] ` : '';
