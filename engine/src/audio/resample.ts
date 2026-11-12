/**
 * Resample mono audio. Downsampling averages each output sample's input span (a simple
 * anti-alias box filter); upsampling interpolates linearly. Pure, no browser APIs.
 */
export function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input.slice();
  const outLength = Math.floor((input.length * toRate) / fromRate + 1e-9);
  const out = new Float32Array(outLength);
  const ratio = fromRate / toRate;

  if (ratio > 1) {
    for (let i = 0; i < outLength; i++) {
      const start = i * ratio;
      const end = Math.min(input.length, start + ratio);
      let sum = 0;
      let weight = 0;
      for (let j = Math.floor(start); j < Math.ceil(end); j++) {
        const w = Math.min(j + 1, end) - Math.max(j, start);
        sum += input[j] * w;
        weight += w;
      }
      out[i] = weight > 0 ? sum / weight : 0;
    }
    return out;
  }

  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const j = Math.floor(pos);
    const frac = pos - j;
    const a = input[j] ?? 0;
    const b = input[j + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}
