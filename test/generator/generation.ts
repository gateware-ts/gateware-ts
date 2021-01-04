import { MODULE_CODE_ELEMENTS } from '../../src/constants';
import * as mocha from 'mocha';
import * as chai from 'chai';
import { Signal, Constant } from '../../src/signals';
import { CodeGenerator } from '../../src/generator/index';
import { GWModule, Edge } from '../../src/index';
import { SB_SPRAM256KA } from '../../vendor-modules/lattice-ice40/SB_SPRAM256KA';

const expect = chai.expect;

class Submodule extends GWModule {
  clk = this.input(Signal());
  in = this.input(Signal());
  in2 = this.input(Signal());
  o = this.output(Signal());

  describe() {
    this.combinationalLogic([
      this.o ['='] (this.in)
    ])
  }
}

describe('generation', () => {
  it('should allow constants in submodules', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      in = this.input(Signal());
      o = this.output(Signal());

      describe() {
        const sm = new Submodule();
        this.addSubmodule(sm, 'sm', {
          inputs: {
            clk: this.clk,
            in: this.in,
            in2: Constant(1, 0b0)
          },
          outputs: {
            o: [this.o]
          }
        });
      }
    }

    const uut = new UUT();
    const cg = new CodeGenerator(uut);
    const result = cg.generateVerilogCodeForModule(uut, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.submodules).to.equal([
      '  Submodule sm(',
      `    .in2(1'b0),`,
      `    .clk(clk),`,
      `    .in(in),`,
      `    .o(sm_o_wire)`,
      '  );',
    ].join('\n'));
  });

  it('should allow constants in vendor modules', () => {
    class UUT extends GWModule {
      clk = this.input(Signal());
      address = this.input(Signal(14));
      dataIn = this.input(Signal(16));
      writeEn = this.input(Signal());
      dataOut = this.output(Signal(16));

      describe() {
        const vm = new SB_SPRAM256KA('ram');
        this.addVendorModule(vm, 'vm', {
          inputs: {
            DATAIN: this.dataIn,
            ADDRESS: this.address,
            WREN: this.writeEn,
            MASKWREN: Constant(4, 0b1111),
            CHIPSELECT: Constant(1, 0b1),
            CLOCK: this.clk,
            STANDBY: Constant(1, 0b1),
            SLEEP: Constant(1, 0b1),
            POWEROFF: Constant(1, 0b1),
          },
          outputs: {
            DATAOUT: [this.dataOut]
          }
        });
      }
    }

    const uut = new UUT();
    const cg = new CodeGenerator(uut);
    const result = cg.generateVerilogCodeForModule(uut, false);

    if (result.code.type !== MODULE_CODE_ELEMENTS) {
      throw new Error('Wrong module type generated');
    }

    expect(result.code.vendorModules).to.equal([
      '  SB_SPRAM256KA ram (',
      `    .MASKWREN(4'b1111),`,
      `    .CHIPSELECT(1'b1),`,
      `    .STANDBY(1'b1),`,
      `    .SLEEP(1'b1),`,
      `    .POWEROFF(1'b1),`,
      `    .DATAIN(dataIn),`,
      `    .ADDRESS(address),`,
      `    .WREN(writeEn),`,
      `    .CLOCK(clk),`,
      `    .DATAOUT(vm_DATAOUT_wire)`,
      '  );',
    ].join('\n'));
  });
});
