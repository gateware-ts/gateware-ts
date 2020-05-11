import { ParameterString } from '../../src/main-types';
import { ConstantT, Signal } from "../../src/index";
import { VendorModule } from '../../src/vendor-module';

interface SB_PLL40_PAD_Parameters {
  DIVR?: ConstantT;
  FEEDBACK_PATH?: ParameterString;
  DIVF?: ConstantT;
  DIVQ?: ConstantT;
  FILTER_RANGE?: ConstantT;
  DELAY_ADJUSTMENT_MODE_FEEDBACK?: ParameterString;
  FDA_FEEDBACK?: ConstantT;
  DELAY_ADJUSTMENT_MODE_RELATIVE?: ConstantT;
  FDA_RELATIVE?: ConstantT;
  SHIFTREG_DIV_MODE?: ConstantT;
  PLLOUT_SELECT?: ParameterString;
  ENABLE_ICEGATE?: ConstantT;
}

export class SB_PLL40_PAD extends VendorModule<SB_PLL40_PAD_Parameters> {
  PACKAGEPIN = this.input(Signal());
  RESET = this.input(Signal());
  BYPASS = this.input(Signal());
  EXTFEEDBACK = this.input(Signal());
  LATCHINPUTVALUE = this.input(Signal());
  DYNAMICDELAY = this.input(Signal(8));
  SDI = this.input(Signal());
  SCLK = this.input(Signal());

  PLLOUTCORE = this.output(Signal());
  LOCK = this.output(Signal());
  PLLOUTGLOBAL = this.output(Signal());

  constructor(name:string, params:SB_PLL40_PAD_Parameters) {
    super(name, params);
  }
}
