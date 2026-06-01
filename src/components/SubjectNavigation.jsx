import React from "react";

export default function SubjectNavigation({ activeSubject, setActiveSubject }) {
  const subjects = ["Physics", "Chemistry", "Mathematics", "English"];

  return (
    <nav className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 shadow-xl">
      <div className="flex flex-wrap gap-3">
        {subjects.map((subject) => (
          <button
            key={subject}
            onClick={() => setActiveSubject(subject.toLowerCase())}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
              activeSubject === subject.toLowerCase()
                ? "bg-cyan-400 text-slate-950"
                : "border border-slate-700 text-slate-200 hover:bg-slate-800"
            }`}
          >
            {subject}
          </button>
        ))}
      </div>
    </nav>
  );
}
