import { useRef, useState } from "react";
import { Mic, Square, ImagePlus, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { transcribeAudio } from "@/lib/ai.functions";
import { encodeWav, blobToBase64 } from "@/lib/wav-encoder";
import { toast } from "sonner";

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Props = {
  value: string;
  onChange: (v: string) => void;
  attachments: string[];
  onAttachmentsChange: (a: string[]) => void;
  placeholder?: string;
  rows?: number;
};

export function PromptInput({ value, onChange, attachments, onAttachmentsChange, placeholder, rows = 8 }: Props) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const transcribeFn = useServerFn(transcribeAudio);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const proc = ctx.createScriptProcessor(4096, 1, 1);
      chunksRef.current = [];
      proc.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(proc);
      proc.connect(ctx.destination);
      processorRef.current = proc;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    const ctx = ctxRef.current;
    const stream = streamRef.current;
    const proc = processorRef.current;
    const source = sourceRef.current;
    try {
      proc?.disconnect();
      source?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      const sampleRate = ctx?.sampleRate ?? 48000;
      await ctx?.close();
      const wav = encodeWav(chunksRef.current, sampleRate);
      chunksRef.current = [];
      if (wav.size < 2048) { toast.error("That recording was empty — please try again."); return; }
      setTranscribing(true);
      const base64 = await blobToBase64(wav);
      const { text } = await transcribeFn({ data: { audioBase64: base64, mimeType: "audio/wav" } });
      if (!text) { toast.error("Couldn't hear anything — please try again."); return; }
      onChange(value ? `${value.trim()} ${text}` : text);
      toast.success("Transcribed");
    } catch (e: any) {
      toast.error(e.message ?? "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = [...attachments];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_IMAGES) { toast.error(`Max ${MAX_IMAGES} images`); break; }
      if (!f.type.startsWith("image/")) { toast.error("Only images allowed"); continue; }
      if (f.size > MAX_IMAGE_BYTES) { toast.error(`${f.name} is over 5MB`); continue; }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
      });
      next.push(dataUrl);
    }
    onAttachmentsChange(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAt = (i: number) => onAttachmentsChange(attachments.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm font-sans resize-none outline-none focus:ring-2 focus:ring-ring"
      />

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((src, i) => (
            <div key={i} className="relative h-14 w-14 rounded-md overflow-hidden border border-border">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-0.5 right-0.5 rounded-full bg-background/80 p-0.5 hover:bg-background"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={transcribing}
          className={`inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-card disabled:opacity-50 ${recording ? "text-destructive border-destructive/50" : ""}`}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {transcribing ? "Transcribing…" : recording ? "Stop" : "Speak"}
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-card"
          aria-label="Attach image"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          Attach image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onPickFiles(e.target.files)}
        />
        <span className="ml-auto text-[10px] text-muted-foreground">
          {attachments.length}/{MAX_IMAGES} images
        </span>
      </div>
    </div>
  );
}
