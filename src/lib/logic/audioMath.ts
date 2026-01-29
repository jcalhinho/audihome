// Lightweight helpers for audio analysis and normalization.
export const getDbFromAnalyser = (analyser: AnalyserNode, data: Uint8Array) => {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / data.length) / 255;
  const db = 20 * Math.log10(rms || 0.0001);
  return Math.max(-80, Math.round(db * 10) / 10);
};

// Map a dB value into a 0–80 display scale with a gentle boost.
export const dbToLevel = (db: number) => {
  const norm = Math.max(0, Math.min(1, (db + 80) / 80));
  const boosted = Math.pow(norm, 0.6);
  return Math.round(boosted * 80 * 10) / 10;
};
