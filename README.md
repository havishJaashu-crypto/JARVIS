# J.A.R.V.I.S. — Personal Browser Assistant

Live site: https://havishjaashu-crypto.github.io/JARVIS/

JARVIS is a browser-first assistant interface for desktop and mobile. Its orb and optional pinch-to-rotate/zoom interaction are adapted for this project from the MIT-licensed [ULTRON Orb UI by Sagar Tamang](https://github.com/SAGAR-TAMANG/ultron-by-sagar-builds). See `THIRD_PARTY_NOTICES.md` for the license notice.

## Use the website

1. Open the live site in Chrome and allow microphone access when prompted.
2. Tap **Enable Wake Word** once. Browsers require a user gesture before microphone listening and spoken output can start.
3. Say “Jarvis” followed by a request, or tap **Tap to Speak**. Type a message if voice input is unavailable.
4. Choose English or Telugu under **Voice**. **Auto** tries English and Telugu recognition in turn; it cannot guarantee accurate mixed Telugu-English transcription.
5. Open **AI Backend Settings** and connect a deployed Worker to enable open-ended AI replies. The AI backend is optional; local commands continue to work without it.
6. Use **Memory Vault**, **Near Me**, and **Camera** when needed. Each feature requests only the permission it uses.

## Included

- Responsive JARVIS interface with an animated Three.js orb and a CSS fallback.
- Optional hand tracking: pinch one hand and move it to rotate; pinch both hands and move them apart/together to zoom.
- Browser speech recognition and spoken replies when supported by the browser and device.
- English and Telugu language selection, with best-effort Tanglish support.
- Local conversation history and a memory vault stored in this browser.
- Permission-based camera preview, location links for nearby places, and web search links.
- Optional Gemini AI backend with Telugu/Tanglish language guidance and a Cloudflare Worker proxy.
- Installable/offline-capable PWA shell.

## Connect the free-tier AI backend

The linked [public-apis list](https://github.com/public-apis/public-apis) is a directory of APIs; it does not issue API keys. This project uses a Gemini API key that you create in Google AI Studio and store as a Cloudflare Worker secret. The key is never entered into the website or committed to GitHub.

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey). Restrict it to the Gemini API.
2. Install Node.js, then clone this repository to your computer.
3. Open a terminal in the cloned repository's `backend` folder and run:
   ```sh
   npx wrangler@latest login
   npx wrangler@latest deploy
   ```
   Wrangler creates the Worker and prints its HTTPS URL.
4. Add your Gemini key as a Cloudflare secret. In the same `backend` folder, run:
   ```sh
   npx wrangler@latest secret put GEMINI_API_KEY
   ```
   Paste the key only into Wrangler's secure prompt. Do not send it in chat or put it in a website field.
5. Open the JARVIS website, choose **AI Backend Settings**, paste the Worker URL, and select **Save & Check Connection**.

The Worker uses Gemini 3.1 Flash-Lite and limits requests to 12 per IP per minute. Cloudflare Workers and Gemini API have free usage quotas, not unlimited service. Quotas and availability vary by account and can change; check the provider dashboards before relying on the service. The Worker returns a visible error when a quota or request limit is reached.

## Data and privacy

Conversation and saved memories are stored in this browser. When an AI backend is connected, questions and recent conversation context are sent through your Cloudflare Worker to Google Gemini to generate replies. Memory notes are **not** sent unless you explicitly enable **Include my saved memories in AI chats** in AI Backend Settings. Disconnect the backend to stop AI requests. Avoid sending secrets or highly sensitive personal information. The Gemini free tier may use prompts to improve Google's products; see [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [API key security guidance](https://ai.google.dev/gemini-api/docs/api-key).

The Worker accepts requests from the JARVIS website, applies request-size and per-IP limits, and does not intentionally store prompts. CORS restrictions and rate limits reduce misuse; they do not make a public endpoint private. Do not put personal API keys in client-side code.

## Limits

The AI can answer and explain many topics, but it can be wrong and does not have live web access in this version. “Search the web” and nearby-place commands open search/map links. Emotion support is conversational and cannot identify every human emotion reliably. Telugu and Tanglish output quality depends on the AI model and installed browser voices.

Voice recognition, installed voices, and background listening vary by browser and device. Background wake-word listening is best-effort and may stop when the tab is hidden or the device saves power. Speech recognition may use the browser or operating-system speech service. Three.js, MediaPipe WASM, and the hand-tracking model load from public CDNs when needed; gesture tracking runs in the browser, and camera frames are not sent to the JARVIS Worker. Clearing browser data removes local conversation history and memories.
