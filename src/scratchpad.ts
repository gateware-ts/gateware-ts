import { Block, BlockElement, Edge } from "./block";
import { If } from "./block/element";
import { advanceTime } from "./block/simulation";
import { toSimulation, toVerilog } from "./generator";
import { GWModule, SimulationModule } from "./module";
import { Constant } from "./signal";

class X extends GWModule {
  clk = this.addInput('clk', 1);
  rs1Addr = this.addInput('rs1Addr', 5);
  rs1Value = this.addInput('rs1Value', 32);
  rs1WE = this.addInput('rs1WE', 1);
  rs1 = this.addOutput('rs1', 32);
  rs2Addr = this.addInput('rs2Addr', 5);
  rs2Value = this.addInput('rs2Value', 32);
  rs2WE = this.addInput('rs2WE', 1);
  rs2 = this.addOutput('rs2', 32);

  regFile = this.addMemory('regFile', 32, 32);

  registerReads() {
    const {rs1Addr, rs2Addr, rs1, rs2, regFile} = this;
    const zero5 = Constant(5, 0n);
    const zero32 = Constant(32, 0n);

    return [
      rs1 ['='] (rs1Addr ['=='] (zero5) ['?'] (zero32, regFile.at(rs1Addr))),
      rs2 ['='] (rs2Addr ['=='] (zero5) ['?'] (zero32, regFile.at(rs2Addr))),
    ]
  }

  registerWrites() {
    const {rs1Addr, rs2Addr, rs1WE, rs2WE, regFile} = this;
    return [
      If (rs1WE, [
        regFile.at(rs1Addr) ['='] (this.rs1Value)
      ]),
      If (rs2WE, [
        regFile.at(rs2Addr) ['='] (this.rs2Value)
      ]),
    ];
  }

  describe() {
    this.synchronousProcess(Edge.Positive, this.clk, [
      ...this.registerReads(),
      ...this.registerWrites(),
    ])
  }
}

const HIGH = Constant(1, 1n);
const LOW = Constant(1, 0n);
class TB extends SimulationModule {
  clk = this.getInput('clk');
  rs1Addr = this.getInput('rs1Addr');
  rs1Value = this.getInput('rs1Value');
  rs1WE = this.getInput('rs1WE');
  rs1 = this.getOutput('rs1');
  rs2Addr = this.getInput('rs2Addr');
  rs2Value = this.getInput('rs2Value');
  rs2WE = this.getInput('rs2WE');
  rs2 = this.getOutput('rs2');

  describe() {
    const {clk, rs1Addr, rs1Value, rs1WE, rs2Addr, rs2Value, rs2WE} = this;

    const risingEdge = new Block([ advanceTime(1), clk ['='] (HIGH) ]);
    const fallingEdge = new Block([ advanceTime(1), clk ['='] (LOW) ]);

    const const32 = (n: number) => Constant(32, BigInt(n));

    const onClockTick = (elements: BlockElement[]) => new Block([
      risingEdge,
      new Block(elements),
      fallingEdge
    ]);

    const setDefaultValue = (rsAddr: number, defaultValue: number = 0) => onClockTick([
      rs1Addr ['='] (Constant(5, BigInt(rsAddr))),
      rs2Addr ['='] (Constant(5, BigInt(rsAddr + 0x10))),
      rs1Value ['='] (const32(defaultValue)),
      rs2Value ['='] (const32(defaultValue)),
    ]);

    this.simulationProcess([
      rs1WE ['='] (Constant(1, BigInt(1))),
      rs2WE ['='] (Constant(1, BigInt(1))),

      new Block(Array.from({ length: 0x10 }, (_, i) => setDefaultValue(i))),

      onClockTick([
        rs1WE ['='] (Constant(1, BigInt(0))),
        rs1Addr ['='] (Constant(5, BigInt(0x01))),
        rs2Addr ['='] (Constant(5, BigInt(0x02))),
        rs1Value ['='] (const32(0xdeadbeef)),
        rs2Value ['='] (const32(0x80808080)),
      ]),


      onClockTick([
        rs2WE ['='] (Constant(1, BigInt(0))),
      ]),

      onClockTick([]),
      onClockTick([]),
      onClockTick([]),
      onClockTick([]),
      onClockTick([]),
    ]);
  };
}

const x = new X('X');
const tb = new TB('test_bench', x);

console.log(toSimulation(tb));
