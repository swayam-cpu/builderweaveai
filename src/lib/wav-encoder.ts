// Encode Float32 PCM chunks to a mono 16-bit WAV Blob at 16kHz.
export function encodeWav(chunks: Float32Array[], inputSampleRate: number, outSampleRate = 16000): Blob {
  // Concatenate
  let total = 0;
  for (const c of chunks) total += c.length;
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }

  // Downsample
  const ratio = inputSampleRate / outSampleRate;
  const outLength = Math.floor(merged.length / ratio);
  const downsampled = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const idx = i * ratio;
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, merged.length - 1);
    const frac = idx - lo;
    downsampled[i] = merged[lo] * (1 - frac) + merged[hi] * frac;
  }

  // Encode 16-bit PCM
  const buffer = new ArrayBuffer(44 + downsampled.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  const byteRate = outSampleRate * 2;
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + downsampled.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outSampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, downsampled.length * 2, true);
  let o = 44;
  for (let i = 0; i < downsampled.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, downsampled[i]));
    view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(binary);
}
