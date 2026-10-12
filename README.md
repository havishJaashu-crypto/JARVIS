# J.A.R.V.I.S. — Personal Browser Assistant

Live site: https://havishjaashu-crypto.github.io/JARVIS/

A zero-cost, browser-first JARVIS interface for desktop and mobile. Add the site to your Android home screen from Chrome if you want it to feel more like an app.

## Use it

1. Open the live site in Chrome and allow microphone access when prompted.
2. Tap **Enable Wake Word** once. Browsers require a user gesture before microphone listening and spoken output can start.
3. Say “Jarvis” followed by a request, or tap **Tap to Speak**. Type a message whenever voice input is unavailable.
4. Choose English or Telugu under **Voice**. **Auto** tries English and Telugu recognition in turn; it cannot guarantee accurate mixed Telugu-English transcription.
5. Use **Memory Vault**, **Open Camera**, and **Near Me** when needed. Each feature asks for its own browser permission.

## Included

- Animated JARVIS orb and responsive browser interface.
- Speech recognition and spoken replies when supported by the browser and device.
- English and Telugu language selection, with best-effort Tanglish support.
- Local conversation history and a memory vault stored in this browser.
- Permission-based camera preview and location links for nearby places.
- Installable/offline-capable PWA shell.

## Limits and privacy

This is a static website and does not connect to a hosted AI model. It handles a small set of built-in commands; for other questions it offers a web-search link. It does not provide unrestricted device control.

Speech recognition support, installed voices, and background listening vary by browser and device. Background wake-word listening is best-effort and may stop when the tab is hidden or the device saves power. Speech recognition may use the browser or operating system speech service. Camera and location are only accessed after you choose those features and grant permission. Conversation and memories are kept in this browser's local storage; clearing browser data removes them.
