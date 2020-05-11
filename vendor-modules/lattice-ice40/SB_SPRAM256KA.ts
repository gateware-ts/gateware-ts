import { Signal, Signedness } from "../../src/index";
import { VendorModule } from '../../src/vendor-module';

export class SB_SPRAM256KA extends VendorModule<{}> {
  DATAIN = this.input(Signal(16));
  ADDRESS = this.input(Signal(14));
  WREN = this.input(Signal());
  MASKWREN = this.input(Signal(4, Signedness.Unsigned, 0b1111));
  CHIPSELECT = this.input(Signal(1, Signedness.Unsigned, 0b1));
  CLOCK = this.input(Signal());
  STANDBY = this.input(Signal(1, Signedness.Unsigned, 0b0));
  SLEEP = this.input(Signal(1, Signedness.Unsigned, 0b0));
  POWEROFF = this.input(Signal(1, Signedness.Unsigned, 0b1));
  DATAOUT = this.output(Signal(16));

  constructor(name:string) {
    super(name, {});
  }
}
