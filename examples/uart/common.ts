import {
  Signal,
  Signedness,
  SignalT
} from "../../src/index";

const BAUD_RATE = 115200;
const ICEBREAKER_CLOCK_SPEED = 12000000; // 12MHz
export const CLOCK_CYCLES_PER_BIT = Math.round(ICEBREAKER_CLOCK_SPEED / BAUD_RATE);
export const CLOCK_CYCLES_TILL_MID = Math.round(CLOCK_CYCLES_PER_BIT / 2);

export const minimumBitsToFit = n => Math.ceil(Math.log2(n));
export const uSignal = (width = 1, defaultValue = 0) => Signal(width, Signedness.Unsigned, defaultValue);
export const inc = (s:SignalT) => s.setTo(s.plus(1));