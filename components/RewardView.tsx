import React, { useEffect } from 'react';

interface RewardViewProps {
  onBack: () => void;
  onSpeak: (text: string, type: "praise") => void;
  stats: { xp: number; level: number };
}

export const RewardView: React.FC<RewardViewProps> = ({ onBack, onSpeak, stats }) => {
  useEffect(() => {
    onSpeak("天呐！你真的太棒了！所有的题目都难不倒你，你简直就是个天才！我真的为你感到骄傲，要继续保持哦！", "praise");
  }, []);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col items-center justify-center text-center p-6 space-y-8 animate-in zoom-in duration-500 relative">
      
      {/* Dynamic Golden Ring Background */}
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-apple-yellow/5 opacity-40"></div>
        <div className="w-28 h-28 bg-[#1c1c1e] border border-white/5 rounded-full flex items-center justify-center shadow-2xl relative z-10">
          <div className="w-24 h-24 bg-gradient-to-tr from-apple-yellow to-apple-orange rounded-full flex items-center justify-center text-3xl text-black font-extrabold shadow-inner">
            <i className="fas fa-crown"></i>
          </div>
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
          完成阶段进化挑战
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed font-normal">
          你已完美解答本次单元检测，目标主题对应的神经突触已被成功编织并整合，核心算法等级已更新。
        </p>
      </div>

      <div className="flex gap-4 w-full max-w-xs justify-center">
        <div className="bg-[#1c1c1e] border border-white/5 p-4 rounded-xl text-center flex-1">
          <span className="text-apple-yellow font-bold block text-lg font-mono">+100</span>
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-extrabold">XP经验增长</span>
        </div>
        <div className="bg-[#1c1c1e] border border-white/5 p-4 rounded-xl text-center flex-1">
          <span className="text-apple-blue font-bold block text-lg font-mono">{stats.level}</span>
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-extrabold">当前等级</span>
        </div>
      </div>

      <button 
        onClick={onBack}
        className="px-8 py-3.5 bg-white text-black font-bold text-xs rounded-xl tracking-tight hover:bg-zinc-200 transition-all duration-200 active:scale-95 shadow-xl"
      >
        继续探索下一个神经元
      </button>

      {/* Decorative Golden Ambient Star Particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <i 
            key={i}
            className="fas fa-circle absolute text-apple-yellow/20 animate-bounce"
            style={{ 
              top: `${Math.random() * 80 + 10}%`, 
              left: `${Math.random() * 80 + 10}%`,
              fontSize: `${Math.random() * 6 + 4}px`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${Math.random() * 2 + 3}s`
            }}
          ></i>
        ))}
      </div>
    </div>
  );
};
