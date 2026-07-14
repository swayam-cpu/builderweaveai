## Goal

Add two capabilities to every prompt input in the app (currently the Builder page's "Describe your site" textarea, and any future prompt inputs):

1. **Mic button** — record voice, transcribe via Lovable AI, append the transcript to the prompt textarea.
2. **Image attach button** — attach one or more images used as design references sent to the AI along with the text prompt.

## Approach

### 1. Reusable `PromptInput` component (`src/components/PromptInput.tsx`)
Wraps the textarea and exposes:
- `value`, `onChange`, `placeholder`, `rows`
- Toolbar row under the textarea with:
  - Mic button (idle → recording → transcribing states)
  - Attach image button (multi-select, image/*)
  - Thumbnails of attached images with remove (×)
- Emits `attachments: string[]` (base64 data URLs) via `onAttachmentsChange`

Recording uses Web Audio API → WAV blob (per knowledge guidance, to avoid Safari mp4 / webm header issues).

### 2. Server function: transcribe audio (`src/lib/ai.functions.ts`)
- `transcribeAudio` — `createServerFn({ method: "POST" })` with `requireSupabaseAuth`
- Input: `{ audioBase64: string, mimeType: string }`
- Calls `https://ai.gateway.lovable.dev/v1/audio/transcriptions` with model `openai/gpt-4o-transcribe`, `stream: "false"` (simpler; short recordings)
- Returns `{ text: string }`

Non-streaming keeps the server function typed RPC. For longer/live UX we can upgrade to a streaming server route later; not needed for "append to prompt" flow.

### 3. Update `generateSite` server function (`src/lib/sites.functions.ts`)
- Accept optional `images: string[]` (base64 data URLs) in input.
- Send them to the chat model as multimodal `content` blocks (text + `image_url`) so the AI uses them as design reference.
- Model stays `google/gemini-2.5-flash` (supports image input).

### 4. Wire into Builder (`src/routes/_authenticated/builder.$id.tsx`)
- Replace the raw `<textarea>` with `<PromptInput>`
- Track `attachments` state
- Pass `images: attachments` when calling `generateSite`
- Clear attachments after successful generation

### 5. Toasts / errors
- Mic permission denied → toast
- Empty recording → toast, don't call API
- Image > 5MB → toast, reject
- Max 4 attachments

## Files

**New:**
- `src/components/PromptInput.tsx` — reusable input with mic + image attach
- `src/lib/ai.functions.ts` — `transcribeAudio` server function
- `src/lib/wav-encoder.ts` — small PCM→WAV helper

**Edited:**
- `src/lib/sites.functions.ts` — accept `images`, send multimodal content
- `src/routes/_authenticated/builder.$id.tsx` — use `PromptInput`, pass attachments

## Notes / trade-offs

- Non-streaming transcription (simpler; a full recording of a few seconds returns in ~1s). Can upgrade to SSE streaming later if you want live captions in the textarea.
- Images are inlined as base64 in the request (no storage bucket needed since they're design references only, not embedded in the generated site).
- Only place with a prompt today is the Builder. `PromptInput` is generic so it drops into any future prompt UI.
