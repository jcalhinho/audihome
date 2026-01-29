import { describe, expect, it } from "vitest";
import { buildChartOptions } from "./chartOptions";

describe("chartOptions", () => {
  it("builds a line chart config with two series", () => {
    const fakeEcharts = {
      graphic: {
        LinearGradient: class {
          constructor(
            x: number,
            y: number,
            x2: number,
            y2: number,
            colorStops: { offset: number; color: string }[]
          ) {}
        },
      },
    } as const;

    const options = buildChartOptions(
      fakeEcharts,
      ["00:00:01", "00:00:02"],
      [10, 12],
      [5, 7],
      { stream: "Stream", mic: "Mic" }
    );

    expect(options.legend).toBeTruthy();
    expect(options.xAxis).toBeTruthy();
    expect(options.yAxis).toBeTruthy();
    const series = Array.isArray(options.series) ? options.series : [];
    expect(series.length).toBe(2);
    expect(series[0]?.data).toEqual([10, 12]);
    expect(series[1]?.data).toEqual([5, 7]);
  });
});
