import { t, type Lang } from "$lib/logic/i18n";

// Helpers for zone selection + attenuation/volume math.
export type Zone = { id: string; selected: boolean };

export type Kpi = {
  label: string;
  value: string | number;
  status: boolean;
  showDot: boolean;
};

export const computeSelectedZoneStats = (
  zones: Zone[],
  attenuationDb: Record<string, number>,
  zoneVolume: Record<string, number>,
) => {
  const selected = zones.filter((z) => z.selected);
  const activeCount = selected.length;
  const appliedAtt = activeCount
    ? Math.min(...selected.map((z) => attenuationDb[z.id] ?? 0))
    : 0;
  const minZoneVol = activeCount
    ? Math.min(...selected.map((z) => zoneVolume[z.id] ?? 1))
    : 1;

  return { activeCount, appliedAtt, minZoneVol };
};

export const computeGainValue = (
  zones: Zone[],
  attenuationDb: Record<string, number>,
  zoneVolume: Record<string, number>,
) => {
  const { appliedAtt, minZoneVol } = computeSelectedZoneStats(
    zones,
    attenuationDb,
    zoneVolume,
  );
  const linear = Math.pow(10, appliedAtt / 20);
  return minZoneVol * linear;
};

export const buildKpis = (
  lang: Lang,
  activeZones: number,
  appliedAtt: number,
  isPlaying: boolean,
  volume: number,
): Kpi[] => [
  {
    label: t(lang, "kpiActiveZones"),
    value: activeZones,
    status: activeZones > 0,
    showDot: true,
  },
  {
    label: t(lang, "kpiAttenuation"),
    value: `${appliedAtt} dB`,
    status: appliedAtt < 0,
    showDot: true,
  },
  {
    label: t(lang, "kpiStream"),
    value: isPlaying ? t(lang, "kpiStreamPlaying") : t(lang, "kpiStreamPaused"),
    status: isPlaying,
    showDot: true,
  },
  {
    label: t(lang, "kpiVolume"),
    value: `${Math.round(volume * 100)}%`,
    status: true,
    showDot: false,
  },
];
