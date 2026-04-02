
import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : "https://ais-pre-iytho52txukdfcih5ijyfy-111697529157.us-west1.run.app";

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Until The Last Warrior',
          text: 'Jogue este incrível jogo de luta inspirado em DBZ comigo!',
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  if (!isPlaying) {
    return (
      <div className="min-h-[100dvh] w-full flex flex-col bg-slate-900 text-white font-sans relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-900/40 via-slate-900 to-black z-0"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 z-0"></div>
        
        {/* Header */}
        <header className="w-full p-6 flex justify-between items-center z-10 border-b border-white/10 bg-black/50 backdrop-blur-sm">
          <div className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">
            UTLW
          </div>
          <button 
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-sm font-semibold"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
            {copied ? 'Link Copiado!' : 'Compartilhar'}
          </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 text-center">
          <div className="max-w-3xl mx-auto flex flex-col items-center">
            <div className="inline-block px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-sm font-bold tracking-widest mb-6 uppercase">
              Versão Remasterizada
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight tracking-tighter" style={{ fontFamily: "'Press Start 2P', cursive", textShadow: '4px 4px 0px #c4410b' }}>
              UNTIL THE<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-500" style={{ textShadow: 'none', filter: 'drop-shadow(4px 4px 0px #c4410b)' }}>
                LAST WARRIOR
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-2xl leading-relaxed">
              Um jogo de luta frenético inspirado nos clássicos dos 16-bits. 
              Escolha seu guerreiro, eleve seu ki e lute até o fim!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button 
                onClick={() => setIsPlaying(true)}
                className="group relative px-8 py-4 bg-gradient-to-b from-orange-400 to-red-600 text-white font-black text-xl rounded-lg shadow-[0_0_40px_rgba(248,91,26,0.4)] hover:shadow-[0_0_60px_rgba(248,91,26,0.6)] hover:-translate-y-1 transition-all active:scale-95 overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                <span className="relative flex items-center justify-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  JOGAR AGORA
                </span>
              </button>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full p-6 text-center text-slate-500 text-sm z-10 border-t border-white/5 bg-black/30">
          <p>Criado no Google AI Studio. Compartilhe o link com seus amigos para jogarem no celular ou PC.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-black text-white overflow-hidden">
      <main className="flex-1 flex items-center justify-center w-full p-0 relative overflow-hidden">
        {/* Rotate Device Overlay */}
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center landscape:hidden md:hidden">
          <div className="w-32 h-32 mb-8 animate-bounce">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 w-full h-full">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <path d="M12 18h.01" />
              <path d="M16.5 9.4L19 12l-2.5 2.6" />
              <path d="M19 12H9" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 tracking-wide font-retro leading-tight">GIRE O<br/>CELULAR</h2>
          <p className="text-slate-300 text-lg mb-8 max-w-xs">Para a melhor experiência e resolução, jogue com a tela deitada.</p>
          <button 
            onClick={() => {
              if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(e => console.log(e));
              }
            }}
            className="px-8 py-4 bg-yellow-500 text-black font-bold rounded-full shadow-lg hover:bg-yellow-400 active:scale-95 transition-all text-lg"
          >
            TELA CHEIA
          </button>
        </div>

        <div className="relative overflow-hidden bg-[#071026] flex items-center justify-center w-full h-full">
          <GameCanvas />
          
          {/* Back to Site Button */}
          <button 
            onClick={() => setIsPlaying(false)}
            className="absolute top-4 left-4 z-40 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
            title="Voltar ao site"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
};

export default App;
