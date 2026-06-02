import React, { useEffect, useMemo, useRef, useState } from "react";
import SubjectNavigation from "./components/SubjectNavigation";
import {
  createContinuousSpeechRecognizer,
  getRecognitionErrorMessage,
  isPronunciationMatch,
  isSpeechRecognitionSupported,
} from "./speechRecognition";

const FALLBACK_WORD_SETS = [
  {
    id: "beginner",
    name: "Beginner",
    words: ["sun", "moon", "star", "tree", "book", "pen", "ball", "car", "house", "water"],
  },
  {
    id: "intermediate",
    name: "Intermediate",
    words: ["ability", "access", "achieve", "active", "adjust", "advice", "airport", "analysis", "arrive", "battery"],
  },
  {
    id: "advanced",
    name: "Advanced",
    words: ["aberration", "abhorrent", "abjure", "abrogate", "acclivity", "acquiesce", "adjuration", "adumbration", "aesthetic", "amalgamate"],
  },
];

const SUBJECTS = {
  physics: { file: "physics.json", label: "Physics" },
  chemistry: { file: "chemistry.json", label: "Chemistry" },
  mathematics: { file: "mathematics.json", label: "Mathematics" },
  english: { file: "english.json", label: "English" },
};

function tokenize(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function normalizeWordSetData(raw) {
  if (!raw || typeof raw !== "object") return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => {
        if (typeof item === "string") {
          return { id: `${item}-${index}`, name: item, words: [item] };
        }
        if (item && typeof item === "object") {
          const words = Array.isArray(item.words) ? item.words.filter(Boolean) : [];
          return {
            id: String(item.id || item.name || `set-${index}`),
            name: String(item.name || item.id || `Set ${index + 1}`),
            words,
          };
        }
        return null;
      })
      .filter(Boolean)
      .filter((set) => set.words.length > 0);
  }

  return Object.entries(raw)
    .map(([key, value]) => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      words: Array.isArray(value) ? value.filter(Boolean) : [],
    }))
    .filter((set) => set.words.length > 0);
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function playEndSound() {
  if (typeof window === "undefined") return;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;
    const beep = (offset, frequency) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.2);
    };

    beep(0, 880);
    beep(0.22, 660);
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // ignore
  }
}

export default function SpeedReadingApp() {
  const [inputText, setInputText] = useState(
    "Paste text here or choose a list from the dropdown. The app will show one word at a time at the speed you choose."
  );
  const [wpm, setWpm] = useState(20);
  const [isRunning, setIsRunning] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [words, setWords] = useState([]);
  const [wordSets, setWordSets] = useState(FALLBACK_WORD_SETS);
  const [selectedWordSet, setSelectedWordSet] = useState(FALLBACK_WORD_SETS[0]?.id || "beginner");
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [activeSubject, setActiveSubject] = useState("physics");
  const [subjectLoading, setSubjectLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [lastSpokenText, setLastSpokenText] = useState("");
  const [pronunciationFeedback, setPronunciationFeedback] = useState(
    "Press Listen, say the current word, and your score will update."
  );
  const [score, setScore] = useState({ correct: 0, attempts: 0 });

  const timerRef = useRef(null);
  const countdownRef = useRef(null);
  const speechRecognizerRef = useRef(null);
  const wordsRef = useRef([]);
  const currentIndexRef = useRef(0);
  const previewScrollRef = useRef(null);
  const previewItemRefs = useRef([]);

  const intervalMs = useMemo(() => Math.max(60, Math.round(60000 / wpm)), [wpm]);
  const currentWord = words[currentIndex] || "Ready";
  const currentWordSetName = wordSets.find((set) => set.id === selectedWordSet)?.name || "Words";
  const progress = words.length ? Math.min(100, Math.round(((currentIndex + 1) / words.length) * 100)) : 0;
  const activeSubjectLabel = SUBJECTS[activeSubject]?.label || "Subject";
  const scorePercent = score.attempts ? Math.round((score.correct / score.attempts) * 100) : 0;
  const hasText = inputText.trim().length > 0 || words.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadSubjectWordSets() {
      const subject = SUBJECTS[activeSubject];
      if (!subject) return;

      setSubjectLoading(true);
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${subject.file}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Unable to load ${subject.file}`);
        const data = await response.json();
        const parsed = normalizeWordSetData(data);

        if (!cancelled && parsed.length) {
          setWordSets(parsed);
          setSelectedWordSet(parsed[0].id);
          setInputText(parsed[0].words.join(" "));
          setWords(parsed[0].words);
          setCurrentIndex(0);
          currentIndexRef.current = 0;
          wordsRef.current = parsed[0].words;
          setIsRunning(false);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        }
      } catch {
        if (!cancelled) {
          setWordSets(FALLBACK_WORD_SETS);
          setSelectedWordSet(FALLBACK_WORD_SETS[0].id);
          setInputText(FALLBACK_WORD_SETS[0].words.join(" "));
          setWords(FALLBACK_WORD_SETS[0].words);
          setCurrentIndex(0);
          currentIndexRef.current = 0;
          wordsRef.current = FALLBACK_WORD_SETS[0].words;
        }
      } finally {
        if (!cancelled) setSubjectLoading(false);
      }
    }

    loadSubjectWordSets();
    return () => {
      cancelled = true;
    };
  }, [activeSubject]);

  useEffect(() => {
    if (!isRunning || words.length === 0) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= words.length - 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsRunning(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRunning, intervalMs, words.length]);

  useEffect(() => {
    if (!isSpeaking || !currentWord || currentWord === "Ready") return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(currentWord.replace(/[^\w\s'-]/g, ""));
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";
    synth.speak(utterance);

    return () => {
      synth.cancel();
    };
  }, [currentWord, isSpeaking]);

  useEffect(() => {
    if (!timerRunning) return;

    countdownRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          setTimerRunning(false);
          setTimerDone(true);
          playEndSound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [timerRunning]);

  useEffect(() => {
    if (!timerRunning) setRemainingSeconds(timerMinutes * 60);
  }, [timerMinutes, timerRunning]);

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
    return () => {
      speechRecognizerRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    const activePreviewItem = previewItemRefs.current[currentIndex];
    const previewContainer = previewScrollRef.current;
    if (!activePreviewItem || !previewContainer || words.length === 0) return;

    const containerRect = previewContainer.getBoundingClientRect();
    const itemRect = activePreviewItem.getBoundingClientRect();
    const isVisible = itemRect.top >= containerRect.top && itemRect.bottom <= containerRect.bottom;

    if (!isVisible) {
      activePreviewItem.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [currentIndex, words.length]);

  const stopReadingInterval = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopListening = () => {
    speechRecognizerRef.current?.stop();
    speechRecognizerRef.current = null;
    setIsListening(false);
  };

  const resetPracticeScore = () => {
    setScore({ correct: 0, attempts: 0 });
    setLastSpokenText("");
    setPronunciationFeedback("Press Listen, say the current word, and your score will update.");
  };

  const speakWord = (word) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !word) return;

    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(word.replace(/[^\w\s'-]/g, ""));
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.lang = "en-US";
    synth.speak(utterance);
  };

  const syncWordsToInput = (text) => {
    const parsedWords = tokenize(text);
    setWords(parsedWords);
    wordsRef.current = parsedWords;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
  };

  const prepareWordsFromInput = () => {
    if (words.length > 0) return words;
    const parsedWords = tokenize(inputText);
    setWords(parsedWords);
    wordsRef.current = parsedWords;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    return parsedWords;
  };

  const toggleReading = () => {
    if (isRunning) {
      setIsRunning(false);
      stopReadingInterval();
      return;
    }

    const parsedWords = tokenize(inputText);
    if (parsedWords.length === 0) return;

    setWords(parsedWords);
    wordsRef.current = parsedWords;

    const nextIndex = currentIndex >= parsedWords.length ? 0 : currentIndex;
    setCurrentIndex(nextIndex);
    currentIndexRef.current = nextIndex;
    setIsRunning(true);
  };

  const restartReading = () => {
    setIsRunning(false);
    stopReadingInterval();
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    stopListening();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const loadSelectedWordSet = (setId) => {
    const selected = wordSets.find((item) => item.id === setId);
    if (!selected) return;
    setSelectedWordSet(setId);
    setInputText(selected.words.join(" "));
    setWords(selected.words);
    wordsRef.current = selected.words;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setIsRunning(false);
    stopReadingInterval();
    stopListening();
    resetPracticeScore();
  };

  const jumpToWord = (index) => {
    setCurrentIndex(index);
    currentIndexRef.current = index;
    setIsRunning(false);
    stopReadingInterval();
    stopListening();
  };

  const toggleVoice = () => {
    setIsSpeaking((prev) => {
      const next = !prev;
      if (!next && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const toggleTimer = () => {
    if (timerRunning) {
      setTimerRunning(false);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }
    if (remainingSeconds <= 0) setRemainingSeconds(timerMinutes * 60);
    setTimerDone(false);
    setTimerRunning(true);
  };

  const listenForPronunciation = () => {
    if (isListening) {
      stopListening();
      setPronunciationFeedback("Listening stopped.");
      return;
    }

    const activeWords = prepareWordsFromInput();
    if (activeWords.length === 0) {
      setPronunciationFeedback("Choose a word list or paste text before practicing.");
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setSpeechSupported(false);
      setPronunciationFeedback("Speech recognition is not supported in this browser. Try Chrome or Edge on localhost.");
      return;
    }

    setIsSpeaking(false);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    const getTargetWord = () => wordsRef.current[currentIndexRef.current] || currentWord;

    speechRecognizerRef.current = createContinuousSpeechRecognizer({
      onStart: () => {
        setIsListening(true);
        setPronunciationFeedback(`Listening for "${getTargetWord()}"...`);
      },
      onAudioStart: () => {
        setPronunciationFeedback(`Microphone is active. Say "${getTargetWord()}".`);
      },
      onSpeechStart: () => {
        setPronunciationFeedback("Speech detected...");
      },
      onResult: (alternatives) => {
        const targetWord = getTargetWord();
        const activeWordsNow = wordsRef.current;
        const spokenText = alternatives.map((item) => item.transcript).join(" ").trim();
        const matched = alternatives.some((item) => isPronunciationMatch(item.transcript, targetWord));

        setLastSpokenText(spokenText || "No speech detected");
        setScore((prev) => ({ correct: prev.correct + (matched ? 1 : 0), attempts: prev.attempts + 1 }));

        if (matched) {
          const currentWordIndex = currentIndexRef.current;
          const isLastWord = currentWordIndex >= activeWordsNow.length - 1;

          setPronunciationFeedback(isLastWord ? `Completed: ${targetWord}` : `Correct: ${targetWord}`);

          if (isLastWord) {
            setIsListening(false);
            setIsSpeaking(false);
            speechRecognizerRef.current?.stop();
            speechRecognizerRef.current = null;
            return;
          }

          setCurrentIndex((prev) => {
            const next = prev < activeWordsNow.length - 1 ? prev + 1 : prev;
            currentIndexRef.current = next;
            return next;
          });
        } else {
          setPronunciationFeedback(`Try again: expected "${targetWord}".`);
        }
      },
      onError: (error) => {
        setPronunciationFeedback(getRecognitionErrorMessage(error));
        if (["audio-capture", "network", "not-allowed", "service-not-allowed"].includes(error)) {
          setIsListening(false);
          speechRecognizerRef.current = null;
        }
      },
      onNoMatch: () => {
        setLastSpokenText("No clear match");
        setPronunciationFeedback(`I heard speech, but could not match "${getTargetWord()}". Try again.`);
      },
      onEnd: () => {
        speechRecognizerRef.current = null;
        setIsListening(false);
      },
    });

    speechRecognizerRef.current?.start();
  };

  const feedbackLink = "https://forms.gle/SLmsa3iQWudzZS8j6";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Speed Reading</p>
          <p className="mt-2 text-sm text-slate-300">
            Paste text, choose a word set from the dropdown, adjust the speed, and control playback from the UI.
          </p>
        </header>

        <SubjectNavigation activeSubject={activeSubject} setActiveSubject={setActiveSubject} />

        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300 shadow-xl">
          Current subject: <span className="font-semibold text-cyan-300">{activeSubjectLabel}</span>
          {subjectLoading ? <span className="ml-2 text-slate-400">Loading content…</span> : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section
            className={`rounded-3xl border p-5 shadow-xl transition ${
              hasText ? "border-cyan-400/60 bg-slate-900 ring-1 ring-cyan-400/30" : "border-slate-800 bg-slate-900"
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
              <label className="block text-sm font-medium text-slate-300">Choose word list</label>
              <select
                value={selectedWordSet}
                onChange={(e) => loadSelectedWordSet(e.target.value)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
              >
                {wordSets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="mb-3 block text-sm font-medium text-slate-300">Paste text</label>
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 transition focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/30">
              <textarea
                value={inputText}
                onChange={(e) => {
                  const nextText = e.target.value;
                  setInputText(nextText);
                  if (!isRunning) {
                    syncWordsToInput(nextText);
                  }
                }}
                placeholder="Paste your article, notes, or paragraph here..."
                className="h-72 w-full rounded-2xl border-0 bg-transparent p-0 text-base leading-7 text-slate-100 outline-none placeholder:text-slate-500"
              />
              <p className="mt-3 text-xs text-slate-400">
                {words.length > 0
                  ? `Loaded ${words.length} words. The panel is highlighted while content is present.`
                  : "Paste or load text to highlight this panel."}
              </p>

              <div
                ref={previewScrollRef}
                className="mt-4 max-h-44 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-3"
              >
                <div className="flex flex-wrap gap-2">
                  {words.length > 0 ? (
                    words.map((word, index) => {
                      const isSelected = index === currentIndex;
                      return (
                        <button
                          key={`preview-${word}-${index}`}
                          ref={(el) => {
                            previewItemRefs.current[index] = el;
                          }}
                          type="button"
                          onClick={() => {
                            jumpToWord(index);
                            speakWord(word);
                          }}
                          className={`rounded-full px-3 py-1 text-sm transition ${
                            isSelected
                              ? "bg-cyan-300 text-slate-950 font-semibold ring-2 ring-cyan-200"
                              : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                          }`}
                          title="Tap to hear pronunciation"
                        >
                          {word}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500">Word chips will appear here after text is loaded.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={toggleReading}
                className={`rounded-2xl px-5 py-3 font-semibold transition ${
                  isRunning
                    ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                }`}
              >
                {isRunning ? "⏸ Pause" : "▶ Start"}
              </button>
              <button
                onClick={restartReading}
                className="rounded-2xl border border-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                ↺ Restart
              </button>
              <button
                onClick={toggleVoice}
                className={`rounded-2xl px-5 py-3 font-semibold transition ${
                  isSpeaking
                    ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    : "border border-slate-700 text-slate-100 hover:bg-slate-800"
                }`}
              >
                {isSpeaking ? "Voice On" : "Voice Off"}
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
              <p className="text-sm font-medium text-slate-300">Current word set</p>
              <div className="mt-4 flex min-h-44 items-center justify-center rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center">
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-sm text-slate-300">
                      {currentWordSetName}
                    </div>
                  </div>
                  <p className="text-4xl font-bold tracking-wide text-cyan-300 md:text-6xl">{currentWord}</p>
                  <p className="mt-3 text-sm text-slate-400">
                    Word {words.length === 0 ? 0 : currentIndex + 1} of {words.length || 0}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-300">Pronunciation score</p>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-cyan-300">
                  {score.correct}/{score.attempts}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  onClick={listenForPronunciation}
                  disabled={!speechSupported}
                  className={`rounded-2xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isListening
                      ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                      : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  }`}
                >
                  {isListening ? "Stop Listening" : "Listen"}
                </button>
                <button
                  onClick={resetPracticeScore}
                  className="rounded-2xl border border-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-800"
                >
                  Reset Score
                </button>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${scorePercent}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-300">{pronunciationFeedback}</p>
              <p className="mt-2 text-xs text-slate-500">Heard: {lastSpokenText || "Nothing yet"}</p>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-slate-300">Word speed</label>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-cyan-300">
                  {wpm} WPM
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="200"
                step="5"
                value={wpm}
                onChange={(e) => setWpm(Number(e.target.value))}
                className="mt-4 w-full accent-cyan-400"
              />
              <p className="mt-2 text-sm text-slate-400">Current interval: {intervalMs} ms per word</p>
              <div className="mt-4 h-3 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all"
                  style={{ width: `${words.length ? progress : 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">Progress: {progress}%</p>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-300">Countdown timer</p>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-cyan-300">
                  {formatTime(remainingSeconds)}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={timerMinutes}
                  onChange={(e) => {
                    const next = Math.max(1, Number(e.target.value) || 1);
                    setTimerMinutes(next);
                    if (!timerRunning) setRemainingSeconds(next * 60);
                  }}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                />
                <button
                  onClick={toggleTimer}
                  className={`rounded-2xl px-5 py-3 font-semibold transition ${
                    timerRunning
                      ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                      : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  }`}
                >
                  {timerRunning ? "Stop Timer" : "Start Timer"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {timerDone ? "Timer finished." : "Set minutes, then start the timer. It will play a sound when time is up."}
              </p>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
              <p className="text-sm font-medium text-slate-300">Status</p>
              <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-sm text-slate-300">
                {isRunning
                  ? "Reading in progress. Click Pause, Restart, or adjust the speed as needed."
                  : words.length > 0
                  ? currentIndex >= words.length - 1
                    ? "Reading completed. Press Start to begin again or Restart to return to the start."
                    : "Paused. Adjust the text and press Start to continue."
                  : "Choose a word list or paste text, then press Start."}
              </div>
            </section>
          </aside>
        </div>

        <a
          href={feedbackLink}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950 shadow-lg transition hover:bg-cyan-300"
        >
          💬 Feedback
        </a>
      </div>
    </div>
  );
}
