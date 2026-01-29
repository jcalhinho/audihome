import type { EChartsCoreOption } from "echarts/core";

type EChartsLike = {
  graphic: {
    LinearGradient: new (
      x: number,
      y: number,
      x2: number,
      y2: number,
      colorStops: { offset: number; color: string }[],
    ) => unknown;
  };
};

const hexToRgba = (hex: string, opacity: number) => {
  const sanitized = hex.replace("#", "");
  if (sanitized.length !== 6) return `rgba(0,0,0,${opacity})`;
  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const buildChartOptions = (
  echarts: EChartsLike,
  timeLabels: string[],
  streamDbHistory: number[],
  micDbHistory: number[],
  labels: { stream: string; mic: string },
): EChartsCoreOption => {
  const fluxColor = "#0ea5e9";
  const micColor = "#36ce9e";

  return {
    backgroundColor: "transparent",
    legend: {
      top: 6,
      left: "center",
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: "#4a5568", fontSize: 10 },
    },
    xAxis: {
      type: "category",
      data: timeLabels,
      boundaryGap: false,
      axisLabel: { color: "#4a5568", fontSize: 10 },
      axisLine: { lineStyle: { color: "rgba(15,23,42,0.18)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 80,
      splitLine: {
        show: true,
        lineStyle: { color: "rgba(15,23,42,0.12)", type: "dashed" },
      },
      axisLabel: { color: "#4a5568", fontSize: 10, formatter: "{value} dB" },
      axisLine: { lineStyle: { color: "rgba(15,23,42,0.18)" } },
      axisTick: { show: false },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(255,255,255,0.98)",
      borderWidth: 1,
      borderColor: "rgba(15,23,42,0.08)",
      textStyle: { color: "#0f172a", fontSize: 12 },
      extraCssText:
        "border-radius:12px;box-shadow:0 10px 30px rgba(15,23,42,0.12);",
    },
    grid: { left: 10, right: 10, top: 34, bottom: 22 },
    series: [
      {
        type: "line",
        name: labels.stream,
        data: streamDbHistory,
        smooth: true,
        symbolSize: 6,
        showSymbol: false,
        lineStyle: {
          color: fluxColor,
          width: 2.5,
          shadowBlur: 10,
          shadowColor: hexToRgba(fluxColor, 0.4),
          shadowOffsetY: 6,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexToRgba(fluxColor, 0.28) },
            { offset: 1, color: hexToRgba(fluxColor, 0.08) },
          ]),
        },
      },
      {
        type: "line",
        name: labels.mic,
        data: micDbHistory,
        smooth: true,
        symbolSize: 6,
        showSymbol: false,
        lineStyle: {
          color: micColor,
          width: 2,
          shadowBlur: 10,
          shadowColor: hexToRgba(micColor, 0.35),
          shadowOffsetY: 6,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: hexToRgba(micColor, 0.25) },
            { offset: 1, color: hexToRgba(micColor, 0.06) },
          ]),
        },
      },
    ],
  };
};
