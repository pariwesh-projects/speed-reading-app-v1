import React, { useEffect, useMemo, useRef, useState } from "react";

const HINT_MAP = {};

function getHint(word) {
  const normalized = word.toLowerCase().replace(/[^a-z0-9]/g, "");
  return HINT_MAP[normalized] || { emoji: "🔎", label: "Hint" };
}

function tokenize(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

export default function SpeedReadingApp() {
  const [inputText, setInputText] = useState(
    "Paste text here and press Start. The app will show one word at a time at the speed you choose."
  );
  const [wpm, setWpm] = useState(120);
  const [isRunning, setIsRunning] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [words, setWords] = useState([]);

  const timerRef = useRef(null);

  const intervalMs = useMemo(() => Math.max(60, Math.round(60000 / wpm)), [wpm]);
  const currentWord = words[currentIndex] || "Ready";
  const currentHint = getHint(currentWord);
  const progress = words.length ? Math.min(100, Math.round(((currentIndex + 1) / words.length) * 100)) : 0;

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
    }

    if (parsedWords.length === 0) return;

    if (currentIndex >= parsedWords.length - 1) {
      setCurrentIndex(0);
    }

    setIsRunning(true);
  };

  const jumpToWord = (index) => {
    setCurrentIndex(index);
    setIsRunning(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Fun with Speed Reading</p>
          <p className="mt-3 max-w-2xl text-slate-300">
            Paste any text, adjust the reading speed, and control playback from the UI.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
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
                className={`rounded-2xl px-5 py-3 font-semibold transition ${isRunning
                    ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                    : "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                  }`}
              >
                {isRunning ? "⏸ Pause" : "▶ Start"}
              </button>
              <button
                onClick={() => setIsSpeaking((prev) => !prev)}
                className={`rounded-2xl px-5 py-3 font-semibold transition ${isSpeaking
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
              <p className="text-sm font-medium text-slate-300">Current word</p>
              <div className="mt-4 flex min-h-44 items-center justify-center rounded-3xl border border-slate-800 bg-slate-950 p-6 text-center">
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-4xl shadow-lg">
                      {currentHint.emoji}
                    </div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{currentHint.label}</p>
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

            <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-xl">
              <p className="text-sm font-medium text-slate-300">Status</p>
              <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-sm text-slate-300">
                {isRunning
                  ? "Reading in progress. Click Pause, or click any word below to jump there."
                  : words.length > 0
                    ? currentIndex >= words.length - 1
                      ? "Reading completed. Click any word below or press Start to begin again."
                      : "Paused. Click any word below to jump, then press Start to continue."
                    : "Paste text and press Start."}
              </div>
            </section>
          </aside>
        </div>

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
                      className={`rounded-lg px-1.5 py-0.5 transition focus:outline-none focus:ring-2 focus:ring-cyan-400 ${active
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
      </div>
      <a
        href="https://forms.gle/SLmsa3iQWudzZS8j6"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 rounded-full bg-cyan-400 px-5 py-3 font-semibold text-slate-950 shadow-lg hover:bg-cyan-300 transition"
      >
        💬 Feedback
      </a>
    </div>
  );
}
