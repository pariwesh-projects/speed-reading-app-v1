export function cleanWord(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9'-]/g, "")
    .trim();
}

export function isPronunciationMatch(spokenText, targetWord) {
  const target = cleanWord(targetWord);
  const spokenWords = String(spokenText || "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(cleanWord)
    .filter(Boolean);

  return Boolean(target && spokenWords.includes(target));
}

export function getRecognitionErrorMessage(error) {
  switch (error) {
    case "audio-capture":
      return "Microphone was not found. Check that your mic is connected and selected.";
    case "network":
      return "Speech recognition service could not connect. Check your internet connection and try Chrome or Edge.";
    case "no-speech":
      return "I did not hear anything. Keep listening on and say the word clearly.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission was blocked. Allow microphone access for localhost.";
    case "aborted":
      return "Listening stopped.";
    default:
      return `Speech was not recognized (${error || "unknown error"}). Try again.`;
  }
}

export function isSpeechRecognitionSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createContinuousSpeechRecognizer({
  lang = "en-US",
  onAudioStart,
  onEnd,
  onError,
  onNoMatch,
  onResult,
  onSpeechStart,
  onStart,
} = {}) {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) return null;

  let recognition = null;
  let shouldListen = false;
  let stopping = false;
  let restartTimer = null;

  const clearRestart = () => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const startRecognition = () => {
    if (!shouldListen || recognition) return;

    recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.continuous = true;

    recognition.onstart = () => {
      onStart?.();
    };

    recognition.onaudiostart = () => {
      onAudioStart?.();
    };

    recognition.onspeechstart = () => {
      onSpeechStart?.();
    };

    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (!event.results[index].isFinal) continue;
        onResult?.(Array.from(event.results[index]));
      }
    };

    recognition.onerror = (event) => {
      onError?.(event.error);

      if (["audio-capture", "network", "not-allowed", "service-not-allowed"].includes(event.error)) {
        shouldListen = false;
      }
    };

    recognition.onnomatch = () => {
      onNoMatch?.();
    };

    recognition.onend = () => {
      recognition = null;

      if (shouldListen && !stopping) {
        clearRestart();
        restartTimer = setTimeout(startRecognition, 250);
        return;
      }

      onEnd?.();
    };

    try {
      recognition.start();
    } catch (error) {
      recognition = null;
      onError?.(error?.name || "start-failed");
    }
  };

  return {
    start() {
      shouldListen = true;
      stopping = false;
      clearRestart();
      startRecognition();
    },
    stop() {
      shouldListen = false;
      stopping = true;
      clearRestart();

      if (recognition) {
        recognition.abort();
        recognition = null;
      }

      onEnd?.();
    },
  };
}
