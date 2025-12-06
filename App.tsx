
import React, { useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { SettingsPanel } from './components/SettingsPanel';
import { GameConfig, INITIAL_CONFIG } from './types';
import { Pause, Play } from 'lucide-react';
import { t } from './utils/translations';

export default function App() {
  const [config, setConfig] = useState<GameConfig>(INITIAL_CONFIG);
  const [paused, setPaused] = useState(false);
  const [restartTrigger, setRestartTrigger] = useState(0);

  const handleRestart = () => {
    setRestartTrigger(prev => prev + 1);
  };
  
  const text = t[config.language];

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans touch-none">
      <GameCanvas 
        config={config} 
        paused={paused}
        restartTrigger={restartTrigger}
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
      <div className="absolute top-6 right-20 pointer-events-none opacity-80 select-none hidden md:block pr-4">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-purple-600 drop-shadow-lg tracking-tighter">
          {text.title}
        </h1>
        <p className="text-right text-xs text-gray-500 font-mono mt-1">{text.subtitle}</p>
      </div>
    </div>
  );
}
