import("stdfaust.lib");
gain = hslider("gain", 0.5, 0, 1, 0.01);
freq = hslider("freq", 440, 20, 20000, 1);
process = os.osc(freq) * gain <: _, _;
