# Redesign roadmap

1. Remove the guided-stage system (stage bar, STAGE/OPTIONS protocol, tap chips) — AI becomes a natural proactive conversation. [done in chat.server.ts + index.tsx]
2. Full UI redesign: clean & minimal — white space, crisp lines, single accent, one typeface. [styles.css + index.tsx]
3. Real-person voice: GPT Live voice session (browser WebRTC) sharing the same counselling brain via backend delegation. [live-relay.server.ts, use-live-voice.ts, live-vite-plugin.ts, server.ts, vite.config.ts]
4. Remove leftover Gemini/Vercel API-key plumbing (modal, localStorage key, env defines where obsolete). [index.tsx, vite.config.ts]
5. Update tests (parse-reply test removed with the protocol) and verify build + voice endpoint.
