import { describe, expect, it } from "vitest";
import { dbToLevel, getDbFromAnalyser } from "./audioMath";

describe("audioMath", () => {
  it("maps -80 dB to 0 and 0 dB to 80", () => {
    expect(dbToLevel(-80)).toBe(0);
    expect(dbToLevel(0)).toBe(80);
  });

  it("computes dB from a silent buffer", () => {
    const data = new Uint8Array(64);
    const db = getDbFromAnalyser({} as AnalyserNode, data);
    expect(db).toBe(-80);
  });

  it("computes dB near 0 for full scale buffer", () => {
    const data = new Uint8Array(64).fill(255);
    const db = getDbFromAnalyser({} as AnalyserNode, data);
    expect(db).toBe(0);
  });
});
