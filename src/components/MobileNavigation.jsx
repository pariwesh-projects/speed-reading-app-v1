import React, { useMemo, useState } from "react";
import { classNavigation } from "../navigationData";

function buildSelectionLabel(classLabel, streamLabel, subjectLabel) {
  return [classLabel, streamLabel, subjectLabel].filter(Boolean).join(" → ");
}

function NavigationContent({
  selectedClass,
  selectedStream,
  selectedLabel,
  onBack,
  onHome,
  onOpenClass,
  onOpenStream,
  onSelectSubject,
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-300">
        <span className="block text-xs uppercase tracking-[0.2em] text-slate-500">Selected</span>
        <span className="mt-1 block leading-6 text-slate-100">{selectedLabel}</span>
      </div>

      <div className="flex items-center gap-3">
        {(selectedClass || selectedStream) ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            ← Back
          </button>
        ) : null}
        {selectedClass ? (
          <button
            type="button"
            onClick={onHome}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200"
          >
            Home
          </button>
        ) : null}
      </div>

      {!selectedClass ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {classNavigation.map((classItem) => (
            <button
              key={classItem.id}
              type="button"
              onClick={() => onOpenClass(classItem)}
              className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-left transition hover:border-cyan-400"
            >
              <span className="block text-base font-semibold">{classItem.label}</span>
              <span className="mt-1 block text-sm text-slate-400">
                {classItem.subjects
                  ? `${classItem.subjects.length} subjects`
                  : `${classItem.streams?.length || 0} streams`}
              </span>
            </button>
          ))}
        </div>
      ) : selectedClass.streams ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Choose a stream</p>
          <div className="grid gap-3 md:grid-cols-3">
            {selectedClass.streams.map((stream) => (
              <button
                key={stream.id}
                type="button"
                onClick={() => onOpenStream(stream)}
                className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 text-left transition hover:border-cyan-400"
              >
                <span className="block text-base font-semibold">{stream.label}</span>
                <span className="mt-1 block text-sm text-slate-400">{stream.subjects.join(" • ")}</span>
              </button>
            ))}
          </div>

          {selectedStream ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-sm font-medium text-slate-300">Subjects in {selectedStream.label}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {selectedStream.subjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => onSelectSubject(subject)}
                    className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm transition hover:border-cyan-400"
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {selectedClass.subjects.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() => onSelectSubject(subject)}
              className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-left text-sm transition hover:border-cyan-400"
            >
              {subject}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState("Browse classes and subjects");

  const selectedClass = useMemo(
    () => classNavigation.find((item) => item.id === selectedClassId) || null,
    [selectedClassId]
  );

  const selectedStream = useMemo(() => {
    if (!selectedClass?.streams || !selectedStreamId) return null;
    return selectedClass.streams.find((item) => item.id === selectedStreamId) || null;
  }, [selectedClass, selectedStreamId]);

  const closeDrawer = () => setIsOpen(false);

  const openClass = (classItem) => {
    setSelectedClassId(classItem.id);
    setSelectedStreamId(null);
    setSelectedLabel(classItem.label);
  };

  const openStream = (streamItem) => {
    if (!selectedClass) return;
    setSelectedStreamId(streamItem.id);
    setSelectedLabel(buildSelectionLabel(selectedClass.label, streamItem.label, "Subjects"));
  };

  const selectSubject = (subject) => {
    if (!selectedClass) return;

    const label = buildSelectionLabel(selectedClass.label, selectedStream?.label || null, subject);
    setSelectedLabel(label);
    setIsOpen(false);
  };

  const resetDepth = () => {
    setSelectedStreamId(null);
    setSelectedClassId(null);
    setSelectedLabel("Browse classes and subjects");
  };

  const handleBack = () => {
    if (selectedStreamId) {
      setSelectedStreamId(null);
      return;
    }
    resetDepth();
  };

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed left-4 top-4 z-[60] rounded-full border border-slate-700 bg-slate-900/95 px-4 py-3 text-sm font-semibold text-slate-100 shadow-lg backdrop-blur"
          aria-label="Open mobile navigation"
        >
          ☰ Menu
        </button>

        {isOpen ? (
          <div className="fixed inset-0 z-[70]">
            <button
              type="button"
              onClick={closeDrawer}
              className="absolute inset-0 bg-black/60"
              aria-label="Close mobile navigation overlay"
            />

            <div className="absolute left-0 top-0 h-full w-[88vw] max-w-sm overflow-y-auto border-r border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Navigation</p>
                  <h2 className="mt-1 text-lg font-semibold">Classes and subjects</h2>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4">
                <NavigationContent
                  selectedClass={selectedClass}
                  selectedStream={selectedStream}
                  selectedLabel={selectedLabel}
                  onBack={handleBack}
                  onHome={resetDepth}
                  onOpenClass={openClass}
                  onOpenStream={openStream}
                  onSelectSubject={selectSubject}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="hidden lg:block">
        <div className="mx-auto max-w-6xl px-4 pb-2 pt-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/10 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Navigation</p>
                <h2 className="mt-1 text-xl font-semibold text-slate-100">Classes and subjects</h2>
              </div>
              <button
                type="button"
                onClick={resetDepth}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-400"
              >
                Reset
              </button>
            </div>

            <div className="mt-4">
              <NavigationContent
                selectedClass={selectedClass}
                selectedStream={selectedStream}
                selectedLabel={selectedLabel}
                onBack={handleBack}
                onHome={resetDepth}
                onOpenClass={openClass}
                onOpenStream={openStream}
                onSelectSubject={selectSubject}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
