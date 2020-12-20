import { SignalLike, Ternary, LOW, Not, HIGH } from "../../src/index";

export const BitChoice = (selector:SignalLike, zeroOption:SignalLike, oneOption:SignalLike) => {
  if (selector.width !== 1) {
    throw new Error('Cannot create a BitChoice on selector whose width is not 1');
  }
  return Ternary(selector, oneOption, zeroOption);
};

export const and = (signals: SignalLike[]) => signals.reduce((a, b) => a ['&'] (b), HIGH);
export const nand = (signals: SignalLike[]) => Not(signals.reduce((a, b) => a ['&'] (b), LOW));
