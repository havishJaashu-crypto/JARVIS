# J.A.R.V.I.S. — Personal Browser Assistant

Live site: https://havishjaashu-crypto.github.io/JARVIS/

JARVIS is a zero-cost, browser-first assistant interface for desktop and mobile. Its orb and optional pinch-to-rotate/zoom interaction are adapted for this project from the MIT-licensed [ULTRON Orb UI by Sagar Tamang](https://github.com/SAGAR-TAMANG/ultron-by-sagar-builds). See `THIRD_PARTY_NOTICES.md` for the required license notice.

## Use it

1. Open the live site in Chrome and allow microphone access when prompted.
2. Tap **Enable Wake Word** once. Browsers require a user gesture before microphone listening and spoken output can start.
3. Say “Jarvis” followed by a request, or tap **Tap to Speak**. Type a message if voice input is unavailable.
4. Choose English or Telugu under **Voice**. **Auto** tries English and Telugu recognition in turn; it cannot guarantee accurate mixed Telugu-English transcription.
5. Drag or touch the orb to rotate it. Open **Camera** and explicitly enable hand gestures to control rotation and zoom with pinches.
6. Use **Memory Vault** and **Near Me** when needed. Each feature requests only the permission it uses.

## Included

- Responsive JARVIS interface with an animated Three.js orb and a CSS fallback.
- Optional hand tracking: pinch one hand and move it to rotate; pinch both hands and move them apart/together to zoom.
- Browser speech recognition and spoken replies when supported by the browser and device.
- English and Telugu language selection, with best-effort Tanglish support.
- Local conversation history and a memory vault stored in this browser.
- Permission-based camera preview, location links for nearby places, and web search links.
- Installable/offline-capable PWA shell.

## Limits and privacy

This is a static website and is not connected to a hosted AI model. It handles a small set of built-in commands; for other questions it offers a web-search link. It does not provide unrestricted device control, open-ended teaching, or guaranteed emotion recognition.

Voice recognition, installed voices, and background listening vary by browser and device. Background wake-word listening is best-effort and may stop when the tab is hidden or the device saves power. Speech recognition may use the browser or operating-system speech service. Three.js, MediaPipe WASM, and the hand-tracking model load from public CDNs when needed; gesture tracking runs in the browser, and camera frames are not sent to a JARVIS server. Conversation and memories are kept in browser local storage; clearing browser data removes them.
