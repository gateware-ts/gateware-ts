import { MODULE_CODE_ELEMENTS } from '../../src/constants';
import * as mocha from 'mocha';
import * as chai from 'chai';
import { Signal } from '../../src/signals';
import { CodeGenerator } from '../../src/generator/index';
import { GWModule, Edge, Signedness } from '../../src/index';

const expect = chai.expect;

describe('generation', () => {
  it('should error if a module has submodules and synchronous logic', () => {
    class Dummy extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      describe() {
      }
    }
    
    class UUT extends GWModule {
      in = this.input(Signal());
      in2 = this.input(Signal());
      o = this.output(Signal());
      o2 = this.output(Signal());

      describe() {
        const sm = new Dummy();
        this.addSubmodule(sm, 'sm', {
          inputs: {
            in: this.in
          },
          outputs: {
            o: [this.o]
          }
        });

        this.syncBlock(this.in, Edge.Positive, [
          this.o2 ['='] (this.in2)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    expect(() => cg.toVerilog()).to.throw(
      `Module "UUT" is a parent module, but also contains combinational and/or synchronous logic.`
    );
  });


  it('should error if a module has submodules and combinational logic', () => {
    class Dummy extends GWModule {
      in = this.input(Signal());
      o = this.output(Signal());

      describe() {
      }
    }

    class UUT extends GWModule {
      in = this.input(Signal());
      in2 = this.input(Signal());
      o = this.output(Signal());
      o2 = this.output(Signal());

      describe() {
        const sm = new Dummy();
        this.addSubmodule(sm, 'sm', {
          inputs: {
            in: this.in
          },
          outputs: {
            o: [this.o]
          }
        });

        this.combinationalLogic([
          this.o2 ['='] (this.in2)
        ]);
      }
    }

    const m = new UUT();
    const cg = new CodeGenerator(m);
    expect(() => cg.toVerilog()).to.throw(
      `Module "UUT" is a parent module, but also contains combinational and/or synchronous logic.`
    );
  });
});
