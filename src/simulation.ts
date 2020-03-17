import { EDGE_ASSERTION, DISPLAY_EXPRESSION, REPEATED_EDGE_ASSERTION, TIMESCALE_VALUE, FINISH_EXPRESSION } from './constants';
import { BlockExpression, Port, Edge, BlockExpressionsAndTime, SimulationExpression, DisplayExpression, RepeatedEdgeAssertion, EdgeAssertion, TimeScaleValue, TimeScale, FinishExpression, SignalLike } from './main-types';
import { SignalT } from './signals';
import { SIf } from './block-expressions';
import { Not } from './operational-expressions';

export const edge = (edge:Edge, signal:Port):EdgeAssertion => ({
  type: EDGE_ASSERTION,
  edgeType: edge,
  signal
});

export const edges = (n:number, edge:Edge, signal:Port):RepeatedEdgeAssertion => ({
  type: REPEATED_EDGE_ASSERTION,
  edgeType: edge,
  signal,
  n
});

export const display = (...messages:(string|SignalT)[]):DisplayExpression => ({
  type: DISPLAY_EXPRESSION,
  messages
});

export const finish = ():FinishExpression => ({ type: FINISH_EXPRESSION });

export const assert = (condition:SignalLike, messages:(string|SignalT)[]):SimulationExpression => (
  SIf (Not(condition), [
    display(...messages),
    finish()
  ])
)

const createTimescaleFunction = (ts:TimeScale) => (n:number):TimeScaleValue => ({
  type: TIMESCALE_VALUE,
  timescale: ts,
  value: n
});

export const timescaleToUnit = (ts:TimeScale) => {
  switch (ts) {
    case TimeScale.Nanoseconds: return 'ns';
    case TimeScale.Microseconds: return 'us';
    case TimeScale.Picoseconds: return 'ps';
    case TimeScale.Milleseconds: return 'ms';
    default: throw new Error('Unsupported timscale unit');
  }
}

export const nanoseconds = createTimescaleFunction(TimeScale.Nanoseconds);
export const picoseconds = createTimescaleFunction(TimeScale.Picoseconds);
export const microseconds = createTimescaleFunction(TimeScale.Microseconds);
export const milleseconds = createTimescaleFunction(TimeScale.Milleseconds);

export class Simulation {
  private everyTimescaleBlocks:BlockExpressionsAndTime[] = [];
  private body:SimulationExpression[];
  private vcdFile:string;

  getEveryTimescaleBlocks() { return this.everyTimescaleBlocks; }
  getRunBody() { return this.body; }
  getVcdOutputPath() { return this.vcdFile; }

  everyTimescale(t:number, block:BlockExpression[]) {
    this.everyTimescaleBlocks.push([t, block]);
  }

  outputVcdFile(path:string) {
    this.vcdFile = path;
  }

  run(block:SimulationExpression[]) {
    if (this.body) {
      throw new Error('run has already been called in this simulation.');
    }
    this.body = block;
  }
}