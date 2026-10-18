import { useCallback, useEffect, useRef, useState } from "react";

// Browser speech: recognition (mic -> text) and synthesis (text -> voice).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = any;

export function useVoice(lang: string) {
  const [supported, setSupported] = useState({ listen: false, speak: false });
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recRef = useRef<AnyRec>(null);

  useEffect(() => {
    const w = window as AnyRec;
    setSupported({
      listen: !!(w.SpeechRecognition || w.webkitSpeechRecognition),
      speak: "speechSynthesis" in window,
    });
    return () => {
      recRef.current?.abort?.();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const listen = useCallback(
    (onFinal: (text: string) => void, onInterim?: (text: string) => void) => {
      const w = window as AnyRec;
      const Rec = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!Rec) return;
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      recRef.current?.abort?.();
      const rec = new Rec();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      let finalText = "";
      rec.onresult = (e: AnyRec) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t;
          else interim += t;
        }
        onInterim?.((finalText + interim).trim());
      };
      rec.onend = () => {
        setListening(false);
        recRef.current = null;
        if (finalText.trim()) onFinal(finalText.trim());
      };
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      rec.start();
    },
    [lang],
  );

  const stopListening = useCallback(() => recRef.current?.stop?.(), []);

  const speak = useCallback(
    (text: string, onDone?: () => void) => {
      if (!("speechSynthesis" in window)) return onDone?.();
      const clean = text
        .replace(/```[\s\S]*?```/g, "")
        .replace(/[#*_`>|]/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/₹/g, " rupees ");
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = lang;
      const v = window.speechSynthesis.getVoices().find((x) => x.lang === lang);
      if (v) u.voice = v;
      u.rate = 1;
      u.onend = () => {
        setSpeaking(false);
        onDone?.();
      };
      u.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(u);
    },
    [lang],
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { supported, listening, speaking, listen, stopListening, speak, stopSpeaking };
}
