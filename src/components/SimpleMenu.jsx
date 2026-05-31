import React from 'react';

export default function SimpleMenu() {
  return (
    <nav className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-3">
      <ul className="flex flex-wrap gap-4 text-sm">
        <li><a href="#reader">Reader</a></li>
        <li><a href="#highlighted">Highlighted Text</a></li>
        <li><a href="#controls">Controls</a></li>
        <li><a href="#timer">Timer</a></li>
      </ul>
    </nav>
  );
}
