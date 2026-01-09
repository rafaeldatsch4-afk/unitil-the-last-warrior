import React from 'react';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white">
      <header className="w-full p-4 bg-slate-800 border-b border-slate-700 shadow-lg mb-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-xl md:text-2xl font-bold text-yellow-400 tracking-wider font-retro">
            UNTIL THE LAST WARRIOR
          </h1>
          <div className="text-sm text-slate-400">
            React + Phaser 3 + TypeScript
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center w-full p-2 md:p-4">
        <div className="relative rounded-xl overflow-hidden border-4 border-slate-700 shadow-2xl bg-black">
          <GameCanvas />
        </div>
      </main>

      <footer className="w-full p-4 text-center text-slate-500 text-xs">
        <p>Controls: Mouse to interact. Combat is turn-based strategy.</p>
      </footer>
    </div>
  );
};

export default App;