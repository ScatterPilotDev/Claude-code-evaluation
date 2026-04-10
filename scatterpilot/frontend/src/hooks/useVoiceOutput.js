import { useState, useCallback, useRef } from 'react';

export function useVoiceOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef(null);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback((text) => {
    if (!isSupported || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;       // Normal speed
    utterance.pitch = 1.0;      // Normal pitch
    utterance.volume = 1.0;

    // Prefer a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Samantha') ||           // macOS/iOS
      v.name.includes('Google US English') ||  // Chrome
      v.name.includes('Microsoft') ||
      (v.lang === 'en-US' && v.localService)
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, isSupported };
}
