import { Signal, Constant } from '../src/signals';
import { GWModule, Not } from "../src/index";

class Child1 extends GWModule {
  clk = this.input(Signal());
  childInput = this.input(Signal());
  childOutput = this.output(Signal());

  describe() {
    this.combinationalLogic([
      this.childOutput ['='] (this.childInput ['^'] (Constant(1, 1)))
    ]);
  }
};

class Child2 extends GWModule {
  clk = this.input(Signal());
  childInput = this.input(Signal());
  childOutput = this.output(Signal());

  describe() {
    this.combinationalLogic([
      this.childOutput ['='] (Not(this.childInput ['&'] (Constant(1, 1))))
    ]);
  }
};


export class Parent extends GWModule {
  CLK = this.input(Signal());
  BTN1 = this.input(Signal());
  BTN2 = this.input(Signal());
  LED1 = this.output(Signal());
  LED2 = this.output(Signal());
  LED3 = this.output(Signal());
  LED4 = this.output(Signal());

  describe() {
    const c1 = new Child1();
    const c2 = new Child2();

    this.addSubmodule(c1, 'c1', {
      inputs: {
        clk: this.CLK,
        childInput: this.BTN1
      },
      outputs: {
        childOutput: [
          this.LED1,
          this.LED2
        ]
      }
    });

    this.addSubmodule(c2, 'c2', {
      inputs: {
        clk: this.CLK,
        childInput: this.BTN2
      },
      outputs: {
        childOutput: [
          this.LED3,
          this.LED4
        ]
      }
    });
  }
};
