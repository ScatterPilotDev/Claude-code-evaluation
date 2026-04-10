import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoiceInput({ onTranscript, onEnd, language = 'en-US' } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;        // Keep listening until stopped
      recognition.interimResults = true;    // Show results as user speaks
      recognition.lang = language;

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        setInterimTranscript(interim);
        if (final) {
          onTranscript?.(final);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        onEnd?.();
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    }

    return () => {
      recognitionRef.current?.abort();
    };
  }, [language]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  };
}
