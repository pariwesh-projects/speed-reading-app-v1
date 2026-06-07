import React, { useMemo, useState } from 'react';

export default function MemoryGame() {
  const [moves] = useState(0);
  const cards = useMemo(() => [], []);
  return (
    <div className='rounded-3xl border border-slate-800 bg-slate-900 p-6'>
      <h2 className='text-2xl font-bold'>Memory Game</h2>
      <p>Colorful addition and subtraction matching game.</p>
      <p>Moves: {moves}</p>
      <div>{cards.length} cards</div>
    </div>
  );
}
