`default_nettype none

module top(
  input CLK,
  input BTN1,
  input BTN2,
  input BTN3,
  output LED2,
  output LED3,
  output LED4,
  output LED5
);

  wire w0;
  wire w1;
  wire w2;
  wire w3;
  wire w4;
  wire w5;
  wire w6;
  wire w7;
  wire w8;
  wire w9;
  wire w10;
  wire w11;
  wire w12;
  wire w13;

  assign LED2 = w10;
  assign LED3 = w11;
  assign LED4 = w12;
  assign LED5 = w13;
  assign w0 = CLK;
  assign w2 = CLK;
  assign w4 = CLK;
  assign w6 = CLK;
  assign w1 = BTN1;
  assign w5 = BTN2;
  assign w3 = BTN3;
  assign w2 = w0;
  assign w4 = w0;
  assign w6 = w0;
  assign w4 = w2;
  assign w6 = w2;
  assign w6 = w4;

  OneShotDebouncer nextDebounced(
    .clk(w0),
    .in(w1),
    .o(w8)
  );

  OneShotDebouncer prevDebounced(
    .clk(w2),
    .in(w3),
    .o(w9)
  );

  OneShotDebouncer rstDebounced(
    .clk(w4),
    .in(w5),
    .o(w7)
  );

  LedCycle ledCycle(
    .clk(w6),
    .rst(w7),
    .next(w8),
    .prev(w9),
    .l1(w10),
    .l2(w12),
    .l3(w11),
    .l4(w13)
  );
endmodule

module LedCycle(
  input clk,
  input rst,
  input next,
  input prev,
  output l1,
  output l2,
  output l3,
  output l4
);
  reg [1:0] ledToOutput = 0;

  assign l1 = ledToOutput == 0;
  assign l2 = ledToOutput == 1;
  assign l3 = ledToOutput == 2;
  assign l4 = ledToOutput == 3;
  always @(posedge clk) begin
    if (rst == 1'b1) begin
      ledToOutput <= 2'b00;
    end
    else if (next == 1'b1) begin
      ledToOutput <= ledToOutput + 1;
    end
    else if (prev == 1'b1) begin
      ledToOutput <= ledToOutput - 1;
    end
  end
endmodule

module OneShotDebouncer(
  input clk,
  input in,
  output reg o
);
  reg [16:0] counter = 0;
  reg [2:0] state = 0;

  initial begin
    o = 0;
  end

  always @(posedge clk) begin
    case (state)
      0 : begin
        if (in == 1'b1) begin
          state <= 1;
          o <= 1'b0;
        end
      end

      1 : begin
        if (in == 1'b0) begin
          counter <= 0;
          state <= 0;
        end
        else if ((counter[16]) == 1'b0) begin
          counter <= counter + 1;
        end
        else begin
          o <= 1'b1;
          state <= 2;
        end
      end

      2 : begin
        o <= 1'b0;
        state <= 3;
      end

      3 : begin
        if (in == 1'b1) begin
          counter <= 0;
        end
        else if ((counter[16]) == 0) begin
          counter <= counter + 1;
        end
        else begin
          state <= 0;
        end
      end
    endcase
  end
endmodule