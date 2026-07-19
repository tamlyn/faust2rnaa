// Exercises every FAUST widget type the generator has to handle, including a
// bargraph (a DSP output, which must not become an AudioParam).
import("stdfaust.lib");

gain = hslider("gain", 0.5, 0, 1, 0.01);
depth = vslider("depth", 0.2, 0, 1, 0.01);
mode = nentry("mode", 1, 0, 4, 1);
bypass = checkbox("bypass");
go = button("go!");

process = _ * gain * depth * (mode / 4) * (1 - bypass) + go
  <: attach(_, abs : hbargraph("level", 0, 1)), _;
