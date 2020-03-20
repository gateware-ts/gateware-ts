`default_nettype none

`timescale 1us/10ns

module OneShotDebouncerTB;
  reg clk = 0;
  reg trigger = 0;
  reg [7:0] counter = 0;
  wire out;

  OneShotDebouncer osd (
    .clk(clk),
    .in(trigger),
    .o(out)
  );

  always #1 begin
    clk = ~clk;
    if (clk == 1) begin
      counter = counter + 1;
    end
  end

  initial begin
    repeat(1) @(posedge clk);
    if (~(out == 1'b0)) begin
      $display("Test failed - sending an output pulse before triggered");
      $finish();
    end
    trigger = 1'b1;
    repeat(127) @(posedge clk);
    if (~(out == 1'b0)) begin
      $display("Test failed - output went high too early!");
      $finish();
    end
    repeat(2) @(posedge clk);
    trigger = 1'b0;
    repeat(1) @(posedge clk);
    if (~(out == 1'b1)) begin
      $display("Test failed - output not high when it should be");
      $finish();
    end
    repeat(1) @(posedge clk);
    if (~(out == 1'b0)) begin
      $display("Test failed - output was high for longer than one clock cycle");
      $finish();
    end
    $display("Test passed!");
    $finish;
  end
  initial begin
    $dumpfile("one-shot-debouncer.vcd");
    $dumpvars(0);
  end
endmodule

module OneShotDebouncer(
  input clk,
  input in,
  output reg o
);
  reg [7:0] counter = 0;
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
        else if ((counter[7]) == 1'b0) begin
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
        else if ((counter[7]) == 0) begin
          counter <= counter + 1;
        end
        else begin
          state <= 0;
        end
      end
    endcase
  end
endmodule