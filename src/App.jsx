import React, { useEffect, useMemo, useRef, useState } from "react";
import MobileNavigation from "./components/MobileNavigation";

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
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function playEndSound() {
  if (typeof window === "undefined") return;

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;

    const beep = (startOffset, frequency) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + 0.18);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + startOffset);
      oscillator.stop(now + startOffset + 0.2);
    };

    beep(0, 880);
    beep(0.22, 660);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Ignore audio failures silently.
  }
}

export default function SpeedReadingApp() {
  const [inputText, setInputText] = useState(
    "Paste text here or choose a list from the dropdown. The app will show one word at a time at the speed you choose."
  );
  const [wpm, setWpm] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [words, setWords] = useState([]);
  const [wordSets, setWordSets] = useState(FALLBACK_WORD_SETS);
  const [selectedWordSet, setSelectedWordSet] = useState(FALLBACK_WORD_SETS[0]?.id || "beginner");
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDone, setTimerDone] = useState(false);

  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  const intervalMs = useMemo(() => Math.max(60, Math.round(60000 / wpm)), [wpm]);
  const currentWord = words[currentIndex] || "Ready";
  const currentWordSetName = wordSets.find((set) => set.id === selectedWordSet)?.name || "Words";
  const progress = words.length ? Math.min(100, Math.round(((currentIndex + 1) / words.length) * 100)) : 0;

  useEffect(() => {
    let cancelled = false;

    async function loadWordSets() {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}words.json`, {
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json();
        const parsed = normalizeWordSetData(data);

        if (!cancelled && parsed.length) {
          setWordSets(parsed);
          setSelectedWordSet(parsed[0].id);
          setInputText(parsed[0].words.join(" "));
          setWords(parsed[0].words);
          setCurrentIndex(0);
        }
      } catch {
        // Keep fallback sets if file is unavailable.
      }
    }

    loadWordSets();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!timerRunning) {
      setRemainingSeconds(timerMinutes * 60);
    }
  }, [timerMinutes, timerRunning]);

  const startOrResumeReading = () => {
    if (isRunning) {
      setIsRunning(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let parsedWords = words;
    if (parsedWords.length === 0) {
      parsedWords = tokenize(inputText);
      setWords(parsedWords);
      setCurrentIndex(0);
    }

    if (parsedWords.length === 0) return;

    if (currentIndex >= parsedWords.length) {
      setCurrentIndex(0);
    }

    setIsRunning(true);
  };

  const resetReading = () => {
    setIsRunning(false);
    setIsSpeaking(false);
    setInputText("");
    setWords([]);
    setCurrentIndex(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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
    setCurrentIndex(0);
    setIsRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const jumpToWord = (index) => {
    setCurrentIndex(index);
    setIsRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
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

    if (remainingSeconds <= 0) {
      setRemainingSeconds(timerMinutes * 60);
    }

    setTimerDone(false);
    setTimerRunning(true);
  };

  const feedbackLink = "https://forms.gle/SLmsa3iQWudzZS8j6";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <MobileNavigation />
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Speed Reading</p>
            Paste text, choose a word set from the dropdown, adjust the speed, and control playback from the UI.
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
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
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your article, notes, or paragraph here..."
              className="h-72 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-base leading-7 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400"
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={startOrResumeReading}
                className={`rounded-2xl px-5 py-3 font-semibold transition ${
                  isRunning
                    ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                }`}
              >
                {isRunning ? "⏸ Pause" : "▶ Start"}
              </button>
              <button
                onClick={resetReading}
                className="rounded-2xl border border-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                ↺ Reset
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
          
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-100">Highlighted text</h2>
            <p className="text-sm text-slate-400">Click any word to jump to it</p>
          </div>
          <div className="mt-4 max-h-[26rem] overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 leading-8 text-base">
            {words.length === 0 ? (
              <p className="text-slate-500">Your pasted text will appear here with the current word highlighted.</p>
            ) : (
              <div className="flex flex-wrap gap-x-2 gap-y-3">
                {words.map((word, index) => {
                  const active = index === currentIndex;
                  const done = index < currentIndex;
                  return (
                    <button
                      key={`${word}-${index}`}
                      onClick={() => jumpToWord(index)}
                      className={`rounded-lg px-1.5 py-0.5 transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
                        active
                          ? "bg-cyan-400 text-slate-950 font-bold shadow-lg"
                          : done
                          ? "text-slate-400 hover:bg-slate-800"
                          : "text-slate-200 hover:bg-slate-800"
                      }`}
                      title="Jump to this word"
                    >
                      {word}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

<section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
              <p className="text-sm font-medium text-slate-300">Current word set</p>
              <div className="mt-4 flex min-h-44 items-center justify-center rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center">
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-sm text-slate-300">
                      {currentWordSetName}
                    </div>
                  </div>
                  <p className="text-4xl md:text-6xl font-bold tracking-wide text-cyan-300">
                    {currentWord}
                  </p>
                  <p className="mt-3 text-sm text-slate-400">
                    Word {words.length === 0 ? 0 : currentIndex + 1} of {words.length || 0}
                  </p>
                </div>
              </div>
            </section>
          <aside className="space-y-6">
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
              <p className="mt-2 text-sm text-slate-400">
                Current interval: {intervalMs} ms per word
              </p>
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
                    if (!timerRunning) {
                      setRemainingSeconds(next * 60);
                    }
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
                  ? "Reading in progress. Click Pause, Reset, or click any word below to jump there."
                  : words.length > 0
                  ? currentIndex >= words.length - 1
                    ? "Reading completed. Click any word below or press Start to begin again."
                    : "Paused. Click any word below to jump, then press Start to continue."
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
