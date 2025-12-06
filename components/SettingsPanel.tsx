
import React, { useState } from 'react';
import { GameConfig, SoundScheme, Language } from '../types';
import { Settings, RefreshCw, Hexagon, Circle, Minus, Plus, RotateCw, Spline, Trash2, Volume2, VolumeX, Scaling, Shield, Layers, Zap, Dna, Disc, Maximize, Mic, MicOff, Globe } from 'lucide-react';
import { LANGUAGES, t } from '../utils/translations';

interface SettingsPanelProps {
  config: GameConfig;
  setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
  onRestart: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ config, setConfig, onRestart }) => {
  const [isOpen, setIsOpen] = useState(true);
  const text = t[config.language];

  const updateConfig = (key: keyof GameConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateSpawn = (axis: 'x' | 'y', val: number) => {
    setConfig(prev => ({
        ...prev,
        spawnPos: { ...prev.spawnPos, [axis]: val }
    }));
  };

  return (
    <div className={`absolute top-4 left-4 z-10 transition-all duration-300 ${isOpen ? 'w-80' : 'w-12'}`}>
      <div className="bg-black/60 backdrop-blur-md border border-white/20 text-white rounded-xl overflow-hidden shadow-2xl">
        
        {/* Header / Toggle */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full p-3 flex items-center justify-between hover:bg-white/10 transition-colors"
        >
           <div className="flex items-center gap-2">
             <Settings size={20} className="text-cyan-400" />
             {isOpen && <span className="font-bold tracking-wider">{text.controls}</span>}
           </div>
           {isOpen ? <Minus size={16} /> : <Plus size={16} />}
        </button>

        {/* Content */}
        {isOpen && (
          <div className="p-4 space-y-6 max-h-[80vh] overflow-y-auto">
            
            {/* Language Selector */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-400 font-bold uppercase">
                <Globe size={12} /> Language
              </div>
              <select 
                value={config.language} 
                onChange={(e) => updateConfig('language', e.target.value as Language)}
                className="w-full bg-black/40 text-sm text-white p-2 rounded border border-white/10 outline-none focus:border-cyan-500"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.label}</option>
                ))}
              </select>
            </div>

            <hr className="border-white/10" />

            {/* God Mode Section */}
             <div className="p-3 bg-gradient-to-r from-yellow-900/30 to-amber-900/10 rounded-lg border border-yellow-500/30">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-yellow-400 uppercase flex items-center gap-2">
                        <Shield size={14} /> {text.godMode}
                    </label>
                    <input 
                        type="checkbox" 
                        checked={config.isGodMode}
                        onChange={(e) => updateConfig('isGodMode', e.target.checked)}
                        className="w-4 h-4 accent-yellow-500"
                    />
                </div>
                <div className="text-[10px] text-gray-300 leading-tight">
                    {text.godModeDesc}
                    <ul className="list-disc pl-4 mt-1 space-y-1">
                        <li>{text.godModeInstr1}</li>
                        <li>{text.godModeInstr2}</li>
                        <li className="text-yellow-200 font-semibold">{text.godModeInstr3}</li>
                    </ul>
                </div>
            </div>

            <hr className="border-white/10" />

            {/* Shape Section */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2">
                <Hexagon size={12} /> {text.shapeHeader}
              </label>
              
              <div className="space-y-2">
                  <div className="flex items-center gap-2 justify-between">
                    <span className="text-sm">{text.sides}: {config.polygonSides}</span>
                    <input 
                      type="range" 
                      min="3" 
                      max="20" 
                      step="1"
                      disabled={config.isCircle && config.gapCount === 0}
                      value={config.polygonSides}
                      onChange={(e) => updateConfig('polygonSides', parseInt(e.target.value))}
                      className="w-32 accent-cyan-500"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 justify-between">
                    <span className="text-sm flex items-center gap-1"><Maximize size={12}/> {text.scale}: {config.baseScale.toFixed(1)}x</span>
                    <input 
                      type="range" 
                      min="0.2" 
                      max="1.5" 
                      step="0.1"
                      value={config.baseScale}
                      onChange={(e) => updateConfig('baseScale', parseFloat(e.target.value))}
                      className="w-32 accent-cyan-500"
                    />
                  </div>
              </div>

              {/* Nested Layers Controls */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2"><Layers size={14}/> {text.layers}: {config.polygonLayers}</span>
                    <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    step="1"
                    value={config.polygonLayers}
                    onChange={(e) => updateConfig('polygonLayers', parseInt(e.target.value))}
                    className="w-24 accent-indigo-500"
                    />
                </div>
                 <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">{text.spacing}: {config.layerSpacing}</span>
                    <input 
                    type="range" 
                    min="1" 
                    max="150" 
                    step="1"
                    value={config.layerSpacing}
                    onChange={(e) => updateConfig('layerSpacing', parseInt(e.target.value))}
                    className="w-24 accent-indigo-500"
                    />
                </div>
              </div>

              <div className="space-y-2">
                 <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2"><Spline size={14} className="text-red-400"/> {text.missingSides}: {config.gapCount}</span>
                 </div>
                 <input 
                    type="range" 
                    min="0" 
                    max={Math.max(0, config.polygonSides - 1)} 
                    step="1"
                    value={config.gapCount}
                    onChange={(e) => updateConfig('gapCount', parseInt(e.target.value))}
                    className="w-full accent-red-500"
                />
              </div>

              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg mt-2">
                <span className="text-sm flex items-center gap-2"><Circle size={14}/> {text.circularMode}</span>
                <input 
                  type="checkbox" 
                  checked={config.isCircle}
                  onChange={(e) => updateConfig('isCircle', e.target.checked)}
                  className="w-4 h-4 accent-cyan-500"
                />
              </div>
            </div>

            <hr className="border-white/10" />

            {/* Dynamics Section */}
            <div className="space-y-3">
               <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2">
                <RotateCw size={12} /> {text.dynamicsHeader}
              </label>

              {/* Mic Control */}
               <div className="p-2 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-lg border border-blue-500/20">
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-sm flex items-center gap-2 font-bold text-blue-300">
                        {config.micControlEnabled ? <Mic size={14} /> : <MicOff size={14}/>} 
                        {text.micBounce}
                    </span>
                    <input 
                      type="checkbox" 
                      checked={config.micControlEnabled}
                      onChange={(e) => updateConfig('micControlEnabled', e.target.checked)}
                      className="w-4 h-4 accent-blue-500"
                    />
                </div>
                {config.micControlEnabled && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-blue-200">
                            <span>{text.sensitivity}</span>
                            <span>{config.micSensitivity}</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" 
                            max="10" 
                            step="0.5"
                            value={config.micSensitivity}
                            onChange={(e) => updateConfig('micSensitivity', parseFloat(e.target.value))}
                            className="w-full accent-blue-500 h-1"
                        />
                         <p className="text-[9px] text-blue-300/70 mt-1">
                            {text.micDesc}
                         </p>
                    </div>
                )}
              </div>

              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg mt-2">
                <span className="text-sm flex items-center gap-2">
                    <Zap size={14} className={config.enableBallCollisions ? "text-orange-400" : ""}/> 
                    {text.ballCollisions}
                </span>
                <input 
                  type="checkbox" 
                  checked={config.enableBallCollisions}
                  onChange={(e) => updateConfig('enableBallCollisions', e.target.checked)}
                  className="w-4 h-4 accent-orange-500"
                />
              </div>

               <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg mt-2">
                <span className="text-sm flex items-center gap-2">
                    <Disc size={14} className={config.isDestructible ? "text-red-400" : ""}/> 
                    {text.destructibleWalls}
                </span>
                <input 
                  type="checkbox" 
                  checked={config.isDestructible}
                  onChange={(e) => updateConfig('isDestructible', e.target.checked)}
                  className="w-4 h-4 accent-red-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                    <span>{text.rotationSpeed}</span>
                    <span>{config.rotationSpeed.toFixed(3)}</span>
                </div>
                <input 
                    type="range" 
                    min="-0.05" 
                    max="0.05" 
                    step="0.001"
                    value={config.rotationSpeed}
                    onChange={(e) => updateConfig('rotationSpeed', parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                />
              </div>

               <div className="space-y-1">
                <div className="flex justify-between text-xs">
                    <span>{text.gravity}</span>
                    <span>{config.gravity.toFixed(3)}</span>
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max="0.2" 
                    step="0.005"
                    value={config.gravity}
                    onChange={(e) => updateConfig('gravity', parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                />
              </div>

              <div className="space-y-1 opacity-80" style={{ opacity: config.micControlEnabled ? 0.5 : 1 }}>
                <div className="flex justify-between text-xs">
                    <span>{text.elasticity}</span>
                    <span>{config.micControlEnabled ? text.micControlled : `${(config.elasticity * 100).toFixed(0)}%`}</span>
                </div>
                <input 
                    type="range" 
                    min="0.1" 
                    max="1.2" 
                    step="0.05"
                    disabled={config.micControlEnabled}
                    value={config.elasticity}
                    onChange={(e) => updateConfig('elasticity', parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                />
              </div>

              <div className="p-2 bg-white/5 rounded-lg mt-2 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                        {config.soundEnabled ? <Volume2 size={14} className="text-green-400"/> : <VolumeX size={14}/>} 
                        {text.bounceSound}
                    </span>
                    <input 
                    type="checkbox" 
                    checked={config.soundEnabled}
                    onChange={(e) => updateConfig('soundEnabled', e.target.checked)}
                    className="w-4 h-4 accent-green-500"
                    />
                </div>
                {config.soundEnabled && (
                    <select 
                        value={config.soundScheme}
                        onChange={(e) => updateConfig('soundScheme', e.target.value as SoundScheme)}
                        className="w-full bg-black/40 text-xs text-white p-1 rounded border border-white/10"
                    >
                        <option value="sine">{text.soundSine}</option>
                        <option value="triangle">{text.soundTriangle}</option>
                        <option value="square">{text.soundSquare}</option>
                        <option value="sawtooth">{text.soundSawtooth}</option>
                        <option value="synth">{text.soundSynth}</option>
                        <option value="bell">{text.soundBell}</option>
                        <option value="glitch">{text.soundGlitch}</option>
                    </select>
                )}
              </div>
            </div>

            <hr className="border-white/10" />

            {/* Balls Section */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2">
                <RefreshCw size={12} /> {text.entitiesHeader}
              </label>

              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg mb-2 border border-pink-500/20">
                <span className="text-sm flex items-center gap-2">
                    <Dna size={14} className={config.randomSpawn ? "text-pink-400" : ""}/> 
                    {text.chaosSpawn}
                </span>
                <input 
                  type="checkbox" 
                  checked={config.randomSpawn}
                  onChange={(e) => updateConfig('randomSpawn', e.target.checked)}
                  className="w-4 h-4 accent-pink-500"
                />
              </div>

               <div className="flex items-center gap-2 justify-between">
                <span className="text-sm">{text.count}: {config.ballCount}</span>
                <input 
                  type="range" 
                  min="1" 
                  max="500" 
                  step="1"
                  value={config.ballCount}
                  onChange={(e) => updateConfig('ballCount', parseInt(e.target.value))}
                  className="w-28 accent-pink-500"
                />
              </div>

              {!config.randomSpawn && (
                  <>
                    <div className="flex items-center gap-2 justify-between">
                        <span className="text-sm flex items-center gap-1"><Scaling size={12}/> {text.radius}: {config.ballSize}</span>
                        <input 
                        type="range" 
                        min="2" 
                        max="30" 
                        step="1"
                        value={config.ballSize}
                        onChange={(e) => updateConfig('ballSize', parseInt(e.target.value))}
                        className="w-28 accent-pink-500"
                        />
                    </div>

                    <div className="space-y-2 pt-2">
                        <div className="text-xs text-gray-400">{text.spawnPos}</div>
                        <div className="flex gap-2">
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] text-center mb-1">X</span>
                                <input 
                                    type="range" min="-1" max="1" step="0.1" 
                                    value={config.spawnPos.x}
                                    onChange={(e) => updateSpawn('x', parseFloat(e.target.value))}
                                    className="accent-pink-500"
                                />
                            </div>
                            <div className="flex flex-col flex-1">
                                <span className="text-[10px] text-center mb-1">Y</span>
                                <input 
                                    type="range" min="-1" max="1" step="0.1" 
                                    value={config.spawnPos.y}
                                    onChange={(e) => updateSpawn('y', parseFloat(e.target.value))}
                                    className="accent-pink-500"
                                />
                            </div>
                        </div>
                    </div>
                  </>
              )}

              <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg mt-2">
                <span className="text-sm flex items-center gap-2"><Trash2 size={14} className={config.isReductionMode ? "text-red-400" : ""}/> {text.reductionMode}</span>
                <input 
                  type="checkbox" 
                  checked={config.isReductionMode}
                  onChange={(e) => updateConfig('isReductionMode', e.target.checked)}
                  className="w-4 h-4 accent-red-500"
                />
              </div>

              <button 
                onClick={onRestart}
                className="w-full mt-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <RefreshCw size={18} /> {text.restart}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
