'use client';

import {useEffect, useState} from 'react';
import {ArrowUpRight, ArrowLeft, ArrowRight, Box, Activity, ShieldCheck, Pause, Play} from 'lucide-react';

const scenes = [
  {line: 'Stay ahead.', title: 'Inventory intelligence', description: 'Know what you have, what is running low, and where your next move matters.', view: 'inventory', icon: Box},
  {line: 'See the shift.', title: 'Demand forecasting', description: 'Turn historical sales into a clearer view of demand. Plan with signals you can explain.', view: 'forecasting', icon: Activity},
  {line: 'Be ready.', title: 'Disruption planning', description: 'A late shipment. A sudden surge. Explore the impact before it reaches your shelves.', view: 'simulator', icon: ShieldCheck},
];

export default function HomeHero() {
  const [index, setIndex] = useState(0);
  const [letters, setLetters] = useState(scenes[0].line.length);
  const [erasing, setErasing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const scene = scenes[index];

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const full = letters === scene.line.length;
    const timer = window.setTimeout(() => {
      if (!erasing && full) setErasing(true);
      else if (erasing && letters === 0) {
        setIndex(value => (value + 1) % scenes.length);
        setErasing(false);
      } else setLetters(value => value + (erasing ? -1 : 1));
    }, !erasing && full ? 3600 : erasing ? 45 : 95);
    return () => window.clearTimeout(timer);
  }, [index, letters, erasing, paused, reduced, scene.line.length]);

  function select(next: number) {
    const value = (next + scenes.length) % scenes.length;
    setIndex(value);
    setLetters(scenes[value].line.length);
    setErasing(false);
  }

  return <section className={`cinema-hero${paused || reduced ? ' motion-paused' : ''}`} aria-label="SupplyLens introduction">
    <div className="cinema-photo" aria-hidden="true"/>
    <div className="cinema-shade" aria-hidden="true"/>
    <div className="cinema-inner">
      <div className="cinema-copy">
        <div className="eyebrow"><span className="pulse"/> CLARITY AT EVERY LINK.</div>
        <h1>See the signals.<br/>Keep moving.<br/><span className="cinema-type" aria-hidden="true">{reduced ? scene.line : scene.line.slice(0, letters)}<i/></span><span className="hero-sr-only">Stay ahead with inventory intelligence, demand forecasting, and disruption planning.</span></h1>
        {!reduced && <button className="motion-toggle" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? <Play size={12}/> : <Pause size={12}/>} {paused ? 'Resume animation' : 'Pause animation'}</button>}
        <p className="cinema-description">{scene.description}</p>
        <div className="cinema-actions"><a className="button lime" href={`/workspace?view=${scene.view}`}>Explore the workspace <ArrowUpRight size={19}/></a><a className="button cinema-outline" href="/about">Meet SupplyLens <ArrowRight size={18}/></a></div>
      </div>
      <div className="cinema-controls"><span><b>0{index + 1}</b> / 03</span><span className="cinema-caption">A CLEARER VIEW. A BETTER NEXT MOVE.</span><div><button aria-label="Previous highlight" onClick={() => select(index - 1)}><ArrowLeft size={17}/></button><button aria-label="Next highlight" onClick={() => select(index + 1)}><ArrowRight size={17}/></button></div></div>
      <div className="cinema-tabs" aria-label="Explore SupplyLens highlights">{scenes.map((item, i) => {const Icon = item.icon;return <button key={item.view} aria-pressed={i === index} className={i === index ? 'active' : ''} onClick={() => select(i)}><Icon size={22}/><span><small>0{i + 1}</small><strong>{item.title}</strong></span><ArrowUpRight size={17}/></button>})}</div>
      <a className="cinema-credit" href="https://unsplash.com/photos/BQSsGu0he24" target="_blank" rel="noreferrer">Photography · Patryk Jasiński / Unsplash</a>
    </div>
  </section>;
}
