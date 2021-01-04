import * as mocha from 'mocha';
import * as chai from 'chai';
import { CodeGenerator } from './../../src/generator/index';
import {Parent} from '../../test-fixtures/submodules';

const expect = chai.expect;

// TODO: These tests aren't ideal - but allow for testing the codegen in a coarser way
describe('generatorFixtures', () => {
  it('should generate the correct wiring code for modules with submodules', () => {
    const pm = new Parent();
    const cg = new CodeGenerator(pm);

    const verilog = cg.toVerilog();
    expect(verilog).to.equal([
      "`default_nettype none",
      "",
      "module Parent(",
      "  input CLK,",
      "  input BTN1,",
      "  input BTN2,",
      "  output LED1,",
      "  output LED2,",
      "  output LED3,",
      "  output LED4",
      ");",
      "  wire c1_childOutput_wire;",
      "  wire c2_childOutput_wire;",
      "",
      "",
      "  assign LED1 = c1_childOutput_wire;",
      "  assign LED2 = c1_childOutput_wire;",
      "  assign LED3 = c2_childOutput_wire;",
      "  assign LED4 = c2_childOutput_wire;",
      "",
      "  Child1 c1(",
      "    .clk(CLK),",
      "    .childInput(BTN1),",
      "    .childOutput(c1_childOutput_wire)",
      "  );",
      "",
      "  Child2 c2(",
      "    .clk(CLK),",
      "    .childInput(BTN2),",
      "    .childOutput(c2_childOutput_wire)",
      "  );",
      "endmodule",
      "",
      "module Child2(",
      "  input clk,",
      "  input childInput,",
      "  output childOutput",
      ");",
      "  assign childOutput = ~(childInput & (1'b1));",
      "endmodule",
      "",
      "module Child1(",
      "  input clk,",
      "  input childInput,",
      "  output childOutput",
      ");",
      "  assign childOutput = childInput ^ (1'b1);",
      "endmodule",
    ].join('\n'));
  });

  it('should generate the correct wiring code for modules with multiple levels of submodules');
  it('should generate the correct wiring code for modules with submodules and logic');
});
