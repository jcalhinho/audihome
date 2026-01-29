import { describe, expect, it } from "vitest";
import { buildKpis, computeGainValue, computeSelectedZoneStats } from "./zoneAudio";

type Zone = { id: string; selected: boolean };

const zones: Zone[] = [
  { id: "salon", selected: true },
  { id: "bureau", selected: false },
  { id: "cuisine", selected: true },
];

const attenuationDb = {
  salon: 0,
  bureau: -6,
  cuisine: -12,
};

const zoneVolume = {
  salon: 1,
  bureau: 0.5,
  cuisine: 0.7,
};

describe("zoneAudio", () => {
  it("computes selected zone stats", () => {
    const stats = computeSelectedZoneStats(zones, attenuationDb, zoneVolume);
    expect(stats.activeCount).toBe(2);
    expect(stats.appliedAtt).toBe(-12);
    expect(stats.minZoneVol).toBe(0.7);
  });

  it("computes gain value from min attenuation + volume", () => {
    const gain = computeGainValue(zones, attenuationDb, zoneVolume);
    // -12 dB is about 0.251, then * 0.7
    expect(gain).toBeCloseTo(0.176, 2);
  });

  it("defaults to unity gain when no zones are selected", () => {
    const none = zones.map((z) => ({ ...z, selected: false }));
    const gain = computeGainValue(none, attenuationDb, zoneVolume);
    expect(gain).toBe(1);
  });

  it("builds KPI labels with correct statuses", () => {
    const kpis = buildKpis("fr", 2, -6, true, 0.5);
    expect(kpis[0]).toMatchObject({ label: "Zones actives", status: true });
    expect(kpis[1]).toMatchObject({ label: "Atténuation", status: true });
    expect(kpis[2]).toMatchObject({ label: "Flux", status: true });
    expect(kpis[3]?.value).toBe("50%");
    expect(kpis[3]?.showDot).toBe(false);
  });
});
