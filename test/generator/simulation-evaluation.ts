import { SIMULATION_CODE_ELEMENTS } from './../../src/constants';
import { nanoseconds, picoseconds, edge, edges, assert } from './../../src/simulation';
import { SIf } from '../../src/block-statements';
import { Edge, SimulationCodeElements, UnsliceableExpressionMap } from './../../src/main-types';
import { Signal, Ternary, Constant } from './../../src/signals';
import * as mocha from 'mocha';
import * as chai from 'chai';
import { SimulationEvaluator } from '../../src/generator/simulation-evaluation';
import { GWModule, display, finish, CodeGenerator, Not } from '../../src/index';

const expect = chai.expect;

class DummyUUT extends GWModule {
  describe() {}
}

const simulationOpts = {
  simulation: {
    enabled: true,
    timescale: [ nanoseconds(1), picoseconds(10) ]
  }
};

class DummyModule extends GWModule {
  someInput = this.input(Signal());
  someInput2 = this.input(Signal());
  someInternal = this.internal(Signal());
  someOutput = this.output(Signal());

  describe() {
    this.combinationalLogic([
      this.someOutput ['='] (Ternary(this.someInput ['=='] (this.someInput2),
        Constant(1, 0),
        Constant(1, 1),
      ))
    ]);
  }
};


describe('simulationEvaluation', () => {
  it('should correctly generate an empty vcd block', () => {
    const uem:UnsliceableExpressionMap = [];
    const se = new SimulationEvaluator(new DummyUUT(), uem);
    expect(se.getVcdBlock()).to.equal('');
  });

  it('should correctly generate a vcd block', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());

      describe() {
        this.simulation.run([
          // Do nothing
        ]);
      }
    }

    const m = new UUT();
    m.simulation.outputVcdFile('out.vcd');
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.vcdBlock).to.eq([
      '  initial begin',
      '    $dumpfile("out.vcd");',
      '    $dumpvars(0);',
      '  end',
    ].join('\n'));
  });

  it('should throw an error if a simulation is generated without a run block', () => {
    const m = new DummyUUT();
    const cg = new CodeGenerator(m, simulationOpts);
    expect(() => {
      cg.generateVerilogCodeForModule(m, true);
    }).to.throw('Simulation must contain a run block (created with this.simulation.run())');
  });

  it('should correctly generate assert expressions', () => {
    const uem:UnsliceableExpressionMap = [];
    const se = new SimulationEvaluator(new DummyUUT(), uem);
    const expr = assert(Constant(1, 1) ['=='] (3), [ '1 is not equal to 3!' ]);

    expect(se.evaluate(expr)).to.equal([
      "  if (~((1'b1) == 3)) begin",
      '    $display("1 is not equal to 3!");',
      '    $finish();',
      '  end'
    ].join('\n'));
  });

  it('should correctly generate display expressions', () => {
    const uem:UnsliceableExpressionMap = [];
    const se = new SimulationEvaluator(new DummyUUT(), uem);
    const expr = display('This is a message');

    expect(se.evaluate(expr)).to.equal(
      '  $display("This is a message");'
    );
  });

  it('should correctly generate display expressions', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());

      describe() {
        this.simulation.run([
          display('clk is: ', this.clk)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.simulationRunBlock).to.eq([
      '  initial begin',
      '    $display("clk is: ", clk);',
      '    $finish;',
      '  end',
    ].join('\n'));
  });

  it('should correctly generate finish expressions', () => {
    const uem:UnsliceableExpressionMap = [];
    const se = new SimulationEvaluator(new DummyUUT(), uem);
    const expr = finish();

    expect(se.evaluate(expr)).to.equal(
      '  $finish();'
    );
  });

  it('should correctly generate manual assignments', () => {
    class UUT extends GWModule {
      in = this.input(Signal(2));
      o = this.output(Signal(2));
      describe() {
        this.simulation.run([
          this.in ['='] (1)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.simulationRunBlock).to.eq([
      '  initial begin',
      '    in = 1;',
      '    $finish;',
      '  end',
    ].join('\n'));
  });

  it('should correctly every timescale blocks', () => {
    class UUT extends GWModule {
      clk = this.internal(Signal());
      describe() {
        this.simulation.everyTimescale(5, [
          this.clk ['='] (Not(this.clk))
        ]);

        this.simulation.run([
          // Do nothing
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.everyTimescaleBlocks).to.eq([
      '  always #5 begin',
      '    clk = ~clk;',
      '  end'
    ].join('\n'));
  });

  it('should correctly generate simulation if statements (if expression)', () => {
    class UUT extends GWModule {
      in = this.input(Signal(2));
      o = this.output(Signal(2));
      describe() {
        this.simulation.run([
          SIf (this.in ['=='] (0b00), [
            display('o was 0'),
            this.in ['='] (0)
          ])
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.simulationRunBlock).to.eq([
      '  initial begin',
      '    if (in == 0) begin',
      '      $display("o was 0");',
      '      in = 0;',
      '    end',
      '    $finish;',
      '  end',
    ].join('\n'));
  });

  it('should correctly generate simulation if statements (if-elseif expression)', () => {
    class UUT extends GWModule {
      in = this.input(Signal(2));
      o = this.output(Signal(2));
      describe() {
        this.simulation.run([
          SIf (this.in ['=='] (0b00), [
            display('o was 0'),
            this.in ['='] (0)
          ])
          .ElseIf(this.in ['=='] (0b01), [
            display('o was 1'),
            this.in ['='] (1)
          ])
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.simulationRunBlock).to.eq([
      '  initial begin',
      '    if (in == 0) begin',
      '      $display("o was 0");',
      '      in = 0;',
      '    end',
      '    else if (in == 1) begin',
      '      $display("o was 1");',
      '      in = 1;',
      '    end',
      '    $finish;',
      '  end',
    ].join('\n'));
  });

  it('should correctly generate simulation if statements (if-else expression)', () => {
    class UUT extends GWModule {
      in = this.input(Signal(2));
      o = this.output(Signal(2));
      describe() {
        this.simulation.run([
          SIf (this.in ['=='] (0b00), [
            display('o was something'),
            this.in ['='] (0),
          ])
          .ElseIf (this.in ['=='] (0b01), [
            display('o was something'),
            this.in ['='] (1),
          ])
          .ElseIf (this.in ['=='] (0b10), [
            display('o was something'),
            this.in ['='] (0),
          ])
          .Else([
            display('o was something'),
            this.in ['='] (1),
          ]),

          SIf (this.in ['=='] (0b11), [
            display('o was something'),
            this.in ['='] (0),
          ])
          .Else([
            display('o was something'),
            this.in ['='] (1),
          ]),
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.simulationRunBlock).to.eq([
      '  initial begin',
      '    if (in == 0) begin',
      '      $display("o was something");',
      '      in = 0;',
      '    end',
      '    else if (in == 1) begin',
      '      $display("o was something");',
      '      in = 1;',
      '    end',
      '    else if (in == 2) begin',
      '      $display("o was something");',
      '      in = 0;',
      '    end',
      '    else begin',
      '      $display("o was something");',
      '      in = 1;',
      '    end',
      '    if (in == 3) begin',
      '      $display("o was something");',
      '      in = 0;',
      '    end',
      '    else begin',
      '      $display("o was something");',
      '      in = 1;',
      '    end',
      '    $finish;',
      '  end',
    ].join('\n'));
  });

  it('should correctly generate input/output/internal signals', () => {
    class UUT extends GWModule {
      in = this.input(Signal(2));
      int = this.internal(Signal(2));
      o = this.output(Signal(2));

      describe() {
        this.simulation.run([
          // Do nothing
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.registers).to.eq([
      '  reg [1:0] in = 0;',
      '  reg [1:0] int = 0;',
    ].join('\n'));
    expect(code.wires).to.eq([
      '  wire [1:0] o;',
      ''
    ].join('\n'));

    expect(code.simulationRunBlock).to.eq([
      '  initial begin',
      '    $finish;',
      '  end',
    ].join('\n'));
  });

  it('should correctly generate submodules', () => {
    class UUT extends GWModule {
      in = this.input(Signal());
      in2 = this.input(Signal());
      o = this.output(Signal());

      describe() {
        const sm = new DummyModule();
        this.addSubmodule(sm, 'dm', {
          inputs: {
            someInput: this.in,
            someInput2: this.in2,
          },
          outputs: {
            someOutput: [this.o]
          }
        })

        this.simulation.run([
          // Do nothing
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.submodules).to.eq([
      '  DummyModule dm (',
      '    .someInput(in),',
      '    .someInput2(in2),',
      '    .someOutput(o)',
      '  );',
    ].join('\n'));
  });

  it('should correctly generate edge assertions', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());

      describe() {
        this.simulation.run([
          edge(Edge.Positive, this.clk),
          edges(10, Edge.Negative, this.clk)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const code = cg.generateVerilogCodeForModule(m, true).code as SimulationCodeElements;

    expect(code.simulationRunBlock).to.eq([
      '  initial begin',
      '    @(posedge clk);',
      '    repeat(10) @(negedge clk);',
      '    $finish;',
      '  end',
    ].join('\n'));
  });

  it('should correctly generate slices of sub-expressions', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal(10));
      in2 = this.input(Signal(10));
      o = this.output(Signal());
      o2 = this.output(Signal());
      o3 = this.output(Signal());

      describe() {
        this.simulation.run([
          this.o ['='] (this.in ['&'] (this.in2) .slice(5, 0)),
          this.o2 ['='] (this.in ['|'] (this.in2) .slice(5, 0)),
          this.o3 ['='] (this.in ['&'] (this.in2) .slice(5, 0)),
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m, simulationOpts);
    const result = cg.generateVerilogCodeForModule(m, true);

    if (result.code.type !== SIMULATION_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.simulationRunBlock).to.eq([
      '  initial begin',
      '    o = gwGeneratedSlice0[5:0];',
      '    o2 = gwGeneratedSlice1[5:0];',
      '    o3 = gwGeneratedSlice0[5:0];',
      '    $finish;',
      '  end',
    ].join('\n'));

    expect(result.code.wires).to.eq([
      '  wire o;',
      '  wire o2;',
      '  wire o3;',
      '  wire [9:0] gwGeneratedSlice0;',
      '  wire [9:0] gwGeneratedSlice1;'
    ].join('\n'));

    expect(result.code.alwaysStarBlock).to.eq([
      '  always @(*) begin',
      '    assign gwGeneratedSlice0 = in & in2;',
      '    assign gwGeneratedSlice1 = in | in2;',
      '  end',
    ].join('\n'));
  });
});
