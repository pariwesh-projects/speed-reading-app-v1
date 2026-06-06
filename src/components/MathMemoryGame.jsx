import React, { useMemo, useState } from 'react';

function generateTiles(){
 const pairs=[];
 for(let i=1;i<=6;i++){
  const a=i+1,b=i;
  const ops=[`${a}+${b}`,`${a*b}`,`${a+b}`];
  pairs.push({q:`${a} + ${b}`,a:String(a+b)});
 }
 const tiles=pairs.flatMap(p=>[{id:`q-${p.q}`,value:p.q,match:p.a},{id:`a-${p.a}-${Math.random()}`,value:p.a,match:p.q}]);
 return tiles.sort(()=>Math.random()-0.5);
}
export default function MathMemoryGame(){
 const [tiles,setTiles]=useState(()=>generateTiles());
 const [selected,setSelected]=useState([]);
 const [matched,setMatched]=useState([]);
 const click=(tile)=>{
 if(selected.length===2||matched.includes(tile.id)) return;
 const next=[...selected,tile];
 setSelected(next);
 if(next.length===2){
  const ok=next[0].value===next[1].match||next[1].value===next[0].match;
  setTimeout(()=>{
   if(ok) setMatched(m=>[...m,next[0].id,next[1].id]);
   setSelected([]);
  },500);
 }
 };
 return <div className='grid grid-cols-4 gap-3'>{tiles.map(t=><button key={t.id} onClick={()=>click(t)} className='rounded-xl border p-4 min-h-20'>{selected.find(s=>s.id===t.id)||matched.includes(t.id)?t.value:'?'}</button>)}</div>;
}
