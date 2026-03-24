
import React from 'react';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
  return (
    <div className="h-screen w-full flex flex-col bg-slate-900 text-white overflow-hidden">
      <header className="w-full p-4 bg-slate-800 border-b border-slate-700 shadow-lg shrink-0">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
          <h1 className="text-xl md:text-2xl font-bold text-yellow-400 tracking-wider font-retro">
            UNTIL THE LAST WARRIOR
          </h1>
          <div className="text-xs md:text-sm text-slate-400 font-mono">
            React + Phaser 3 + TypeScript
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center w-full p-4 relative overflow-hidden">
        <div className="relative rounded-xl overflow-hidden border-4 border-slate-700 shadow-2xl bg-black flex items-center justify-center" style={{ width: '100%', height: '100%', maxWidth: '1920px', maxHeight: '1080px', aspectRatio: '16/9' }}>
          <GameCanvas />
        </div>
      </main>
    </div>
  );
};

export default App;
