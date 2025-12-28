
import React, { useState, useEffect } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { SettingsPanel } from './components/SettingsPanel';
import { GameConfig, INITIAL_CONFIG } from './types';
import { Pause, Play, Github } from 'lucide-react';
import { t } from './utils/translations';

export default function App() {
  const [config, setConfig] = useState<GameConfig>(INITIAL_CONFIG);
  const [paused, setPaused] = useState(false);
  const [restartTrigger, setRestartTrigger] = useState(0);
  const [collisionCount, setCollisionCount] = useState(0);

  // Handle URL redirects
  useEffect(() => {
    const path = window.location.pathname;
    // Check if the user is visiting /sources or /sources/
    if (path === '/sources' || path === '/sources/') {
      window.location.replace('https://github.com/MomoLawson/Cosmic-Bounce');
    }
  }, []);

  const handleRestart = () => {
    setRestartTrigger(prev => prev + 1);
    setCollisionCount(0);
  };
  
  const text = t[config.language];

  return (
    <div className="relative w-screen h-[100dvh] bg-black overflow-hidden font-sans touch-none">
      <GameCanvas 
        config={config} 
        paused={paused}
        restartTrigger={restartTrigger}
        setTotalCollisions={setCollisionCount}
      />
      <SettingsPanel 
        config={config} 
        setConfig={setConfig} 
        onRestart={handleRestart} 
      />
      
      {/* Top Right Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
         {/* Pause Button */}
         <button 
           onClick={() => setPaused(!paused)}
           className="bg-white/10 backdrop-blur-md p-3 rounded-full hover:bg-white/20 transition-all text-white border border-white/20 active:scale-95 shadow-lg"
           title={paused ? "Resume Simulation" : "Pause Simulation"}
         >
           {paused ? <Play size={24} fill="white" /> : <Pause size={24} fill="white" />}
         </button>
      </div>
      
      {/* Overlay Title */}
      <div className="absolute top-6 right-20 pointer-events-none opacity-80 select-none hidden md:block pr-4 text-right">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-purple-600 drop-shadow-lg tracking-tighter">
          {text.title}
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-1 mb-2">{text.subtitle}</p>
        <p className="text-lg font-bold text-cyan-200 drop-shadow-md font-mono">
            {text.collisionCount}: <span className="text-white">{collisionCount}</span>
        </p>
      </div>

      {/* GitHub Link */}
      <a 
        href="https://github.com/MomoLawson/Cosmic-Bounce"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-4 left-4 z-50 p-2 text-white/30 hover:text-white transition-all hover:scale-110"
        title="View on GitHub"
      >
        <Github size={24} />
      </a>
    </div>
  );
}
