import React, { useState, useRef } from 'react';
import { Flashcard } from '../types';
import html2canvas from 'html2canvas';

interface FlashcardViewProps {
  cards: Flashcard[];
  onReview: (cardId: string, success: boolean) => void;
  onSpeak: (text: string) => void;
  onNavigateToSource: (noteId: string) => void;
  onClose: () => void;
}

export const FlashcardView: React.FC<FlashcardViewProps> = ({ cards, onReview, onSpeak, onNavigateToSource, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] text-center space-y-6">
        <div className="w-16 h-16 bg-[#1c1c1e] border border-white/5 rounded-full flex items-center justify-center text-xl text-zinc-500 shadow-xl">
          <i className="fas fa-layer-group"></i>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-zinc-200 tracking-tight">记忆环廊已清空</h3>
          <p className="text-xs text-zinc-500 max-w-xs leading-normal">当前阶段没有待复习的记忆卡，你可以前往“知识编织”提取新卡！</p>
        </div>
        <button onClick={onClose} className="px-6 py-2.5 bg-white text-black font-semibold rounded-xl text-xs tracking-tight hover:bg-zinc-200 transition">
          返回主控制台
        </button>
      </div>
    );
  }

  const card = cards[currentIndex];

  const handleNext = (success: boolean) => {
    onReview(card.id, success);
    setIsFlipped(false);
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const handleExportImage = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: '#000000',
      scale: 2
    });
    const link = document.createElement('a');
    link.download = `SILI_Card_${card.id}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col items-center space-y-5 py-4 h-[calc(100vh-120px)] overflow-hidden">
      <div className="w-full flex justify-between items-center px-2">
        <div className="flex items-center gap-3">
           <button onClick={onClose} className="text-zinc-400 hover:text-white transition text-xs font-semibold flex items-center gap-1">
             <i className="fas fa-chevron-left"></i> 返回
           </button>
           <span className="px-2.5 py-1 bg-[#1c1c1e] border border-white/5 rounded-full text-[10px] text-zinc-400 font-mono">
             {currentIndex + 1} of {cards.length}
           </span>
        </div>
        <div className="flex gap-4">
          <button onClick={handleExportImage} className="text-[11px] text-apple-purple font-medium hover:text-apple-purple/80 transition flex items-center gap-1.5">
            <i className="fas fa-download"></i> 导出金卡
          </button>
          <button onClick={() => onNavigateToSource(card.sourceNoteId)} className="text-[11px] text-apple-blue font-medium hover:text-apple-blue/80 transition flex items-center gap-1.5">
            <i className="fas fa-location-arrow"></i> 定位起源
          </button>
        </div>
      </div>
      
      <div ref={cardRef} className="w-full flex-1 flex flex-col bg-[#1c1c1e] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="flex-[4] flex flex-col items-center justify-center p-8 text-center bg-black/35 relative">
           <span className="text-[9px] uppercase tracking-[0.25em] text-zinc-500 mb-4 font-extrabold font-mono">问题线索 • CHALLENGE QUESTION</span>
           <h2 className="text-xl md:text-2xl font-bold text-zinc-100 max-w-lg leading-normal tracking-tight">{card.front}</h2>
           <div className="mt-4 flex flex-wrap justify-center gap-1.5">
             {card.tags.map(t => <span key={t} className="px-2 py-0.5 bg-white/5 border border-white/[0.04] rounded-md text-[9px] text-zinc-500">#{t}</span>)}
           </div>
        </div>

        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent relative">
           {!isFlipped && (
              <div className="absolute inset-0 flex items-center justify-center -translate-y-1/2">
                <button 
                  onClick={() => setIsFlipped(true)} 
                  className="px-6 py-2.5 bg-[#0a84ff] hover:bg-[#409cff] text-white rounded-full text-xs font-bold shadow-lg shadow-apple-blue/20 transition-all duration-350 active:scale-95"
                >
                  揭开深度释义
                </button>
              </div>
           )}
        </div>

        <div className={`flex-[6] flex flex-col p-8 transition-all duration-500 relative ${!isFlipped ? 'blur-lg grayscale opacity-10 pointer-events-none' : 'blur-0'}`}>
           <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/[0.03]">
              <span className="text-[9px] uppercase tracking-[0.25em] text-apple-blue font-extrabold font-mono">系统深度评析 • KNOWLEDGE CORE</span>
              {isFlipped && (
                <button onClick={() => onSpeak(card.back)} className="w-[28px] h-[28px] rounded-lg bg-apple-blue/10 hover:bg-apple-blue/20 text-apple-blue flex items-center justify-center transition border border-apple-blue/15">
                  <i className="fas fa-volume-up text-[10px]"></i>
                </button>
              )}
           </div>
           <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
              <p className="text-sm md:text-base text-zinc-350 leading-relaxed font-normal whitespace-pre-wrap">
                {isFlipped ? card.back : "••••••••••••••••"}
              </p>
           </div>
        </div>
      </div>

      <div className="w-full flex gap-3 min-h-[50px] items-center">
        {isFlipped ? (
          <>
            <button onClick={() => handleNext(false)} className="flex-1 py-3 bg-apple-red/10 border border-apple-red/25 hover:bg-apple-red/15 text-apple-red rounded-xl text-xs font-bold transition duration-200">未巩固记忆</button>
            <button onClick={() => handleNext(true)} className="flex-1 py-3 bg-apple-green/10 border border-apple-green/25 hover:bg-apple-green/15 text-apple-green rounded-xl text-xs font-bold transition duration-200">已牢固掌握</button>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs font-medium tracking-tight">在脑海中酝酿释义后，点击“揭开深度释义”</div>
        )}
      </div>
    </div>
  );
};
