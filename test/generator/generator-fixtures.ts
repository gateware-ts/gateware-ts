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
      "  wire w0;",
      "  wire w1;",
      "  wire w2;",
      "  wire w3;",
      "  wire w4;",
      "  wire w5;",
      "  wire w6;",
      "  wire w7;",
      "",
      "",
      "  assign LED1 = w4;",
      "  assign LED2 = w5;",
      "  assign LED3 = w6;",
      "  assign LED4 = w7;",
      "  assign w0 = CLK;",
      "  assign w2 = CLK;",
      "  assign w1 = BTN1;",
      "  assign w3 = BTN2;",
      "  assign w5 = w4;",
      "  assign w7 = w6;",
      "  assign w2 = w0;",
      "",
      "  Child1 c1(",
      "    .clk(w0),",
      "    .childInput(w1),",
      "    .childOutput(w4)",
      "  );",
      "",
      "  Child2 c2(",
      "    .clk(w2),",
      "    .childInput(w3),",
      "    .childOutput(w6)",
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
});
