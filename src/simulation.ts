import { EDGE_ASSERTION, DISPLAY_EXPRESSION, REPEATED_EDGE_ASSERTION, TIMESCALE_VALUE, FINISH_EXPRESSION } from './constants';
import { BlockStatement, Port, Edge, BlockExpressionsAndTime, SimulationExpression, DisplayExpression, RepeatedEdgeAssertion, EdgeAssertion, TimeScaleValue, TimeScale, FinishExpression, SignalLike } from './main-types';
import { SignalT, Not } from './signals';
import { SIf } from './block-statements';

/**
 * Assert a positive or negative edge on a given [[Port]]
 * Only used during simulation.
 * @param edge Positive or Negative edge
 * @param signal the port
 */
export const edge = (edge:Edge, signal:Port):EdgeAssertion => ({
  type: EDGE_ASSERTION,
  edgeType: edge,
  signal
});

/**
 * Assert multiple sequential positive or negative edges on a given [[Port]]
 * Only used during simulation.
 * @param n The number of edges
 * @param edge Positive or Negative edge
 * @param signal the port
 */
export const edges = (n:number, edge:Edge, signal:Port):RepeatedEdgeAssertion => ({
  type: REPEATED_EDGE_ASSERTION,
  edgeType: edge,
  signal,
  n
});

/**
 * Display a message during simulation
 * Only used during simulation.
 * @param messages can be [[SignalT]]s or strings
 */
export const display = (...messages:(string|SignalT)[]):DisplayExpression => ({
  type: DISPLAY_EXPRESSION,
  messages
});

/**
 * Finish the simulation. The simulation will end whenever one of these is reached.
 * Only used during simulation.
 */
export const finish = ():FinishExpression => ({ type: FINISH_EXPRESSION });

/**
 * Assert a condition that will cause the simulation to exit if violated
 * Only used during simulation.
 * @param condition 
 * @param messages a message to display if the condition is violated (see [[display]])
 */
export const assert = (condition:SignalLike, messages:(string|SignalT)[]):SimulationExpression => (
  SIf (Not(condition), [
    display(...messages),
    finish()
  ])
)

/** @internal */
const createTimescaleFunction = (ts:TimeScale) => (n:number):TimeScaleValue => ({
  type: TIMESCALE_VALUE,
  timescale: ts,
  value: n
});

/** @internal */
export const timescaleToUnit = (ts:TimeScale) => {
  switch (ts) {
    case TimeScale.Nanoseconds: return 'ns';
    case TimeScale.Microseconds: return 'us';
    case TimeScale.Picoseconds: return 'ps';
    case TimeScale.Milleseconds: return 'ms';
    default: throw new Error('Unsupported timscale unit');
  }
}

/**
 * Time represented in nanoseconds
 * @param n
 */
export const nanoseconds = createTimescaleFunction(TimeScale.Nanoseconds);
/**
 * Time represented in picoseconds
 * @param n
 */
export const picoseconds = createTimescaleFunction(TimeScale.Picoseconds);
/**
 * Time represented in microseconds
 * @param n
 */
export const microseconds = createTimescaleFunction(TimeScale.Microseconds);
/**
 * Time represented in milleseconds
 * @param n
 */
export const milleseconds = createTimescaleFunction(TimeScale.Milleseconds);


/**
 * Class for describing the events within a simulation. Part of every [[GWModule]].
 * Should not be instantiated.
 */
export class Simulation {
  /** @internal */
  private everyTimescaleBlocks:BlockExpressionsAndTime[] = [];
  /** @internal */
  private body:SimulationExpression[];
  /** @internal */
  private vcdFile:string;

  /** @internal */
  getEveryTimescaleBlocks() { return this.everyTimescaleBlocks; }
  /** @internal */
  getRunBody() { return this.body; }
  /** @internal */
  getVcdOutputPath() { return this.vcdFile; }

  /**
   * Run a block of logic every `t` units of the [[TimeScale]] provided to this simulation
   * @param t 
   * @param block 
   */
  everyTimescale(t:number, block:BlockStatement[]) {
    this.everyTimescaleBlocks.push([t, block]);
  }

  /**
   * Create a VCD waveform file when running this simulation
   * @param path 
   */
  outputVcdFile(path:string) {
    this.vcdFile = path;
  }

  /**
   * The run block, where the events of the simulation are described.
   * @param block
   */
  run(block:SimulationExpression[]) {
    if (this.body) {
      throw new Error('run has already been called in this simulation.');
    }
    this.body = block;
  }
}