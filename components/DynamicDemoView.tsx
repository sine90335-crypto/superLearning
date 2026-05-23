import React, { useState } from 'react';
import { DemoStep } from '../types';

interface DynamicDemoViewProps {
  steps: DemoStep[];
  onSpeak: (text: string) => void;
  onClose: () => void;
}

export const DynamicDemoView: React.FC<DynamicDemoViewProps> = ({ steps, onSpeak, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      onSpeak(steps[next].description);
    } else {
      onClose();
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 flex flex-col h-[calc(100vh-120px)] justify-between">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">知识模拟演练 • LOGIC RUNTIME</h2>
          <p className="text-[11px] text-zinc-500">正在为您推演、重组并强化该概念的关系通路...</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition"><i className="fas fa-times text-lg"></i></button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Step Visualization Area */}
        <div className="w-full min-h-[220px] bg-[#1c1c1e] border border-white/5 rounded-2xl mb-6 flex flex-col items-center justify-center p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-[-20%] left-[-10%] w-[200px] h-[200px] bg-apple-purple/5 rounded-full blur-[80px] pointer-events-none"></div>
          
          <div className="z-10 text-center animate-in fade-in zoom-in duration-300">
             <div className="w-12 h-12 bg-black border border-white/10 rounded-xl flex items-center justify-center text-white text-xs font-mono font-bold mb-4 mx-auto shadow-lg">
               S - {String(currentStep + 1).padStart(2, '0')}
             </div>
             <h3 className="text-base font-bold text-white mb-2.5 tracking-tight">{step.title}</h3>
             <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">{step.description}</p>
             {step.visualHighlight && (
               <div className="mt-4 text-apple-purple bg-apple-purple/5 border border-apple-purple/10 px-3.5 py-1.5 rounded-lg text-[10px] inline-flex items-center gap-1.5">
                 <i className="fas fa-lightbulb"></i> 核心洞察: {step.visualHighlight}
               </div>
             )}
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="w-full flex justify-between gap-1.5 mb-6">
          {steps.map((_, idx) => (
            <div 
              key={idx}
              className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${
                idx <= currentStep ? 'bg-apple-purple shadow-[0_0_8px_rgba(191,90,242,0.6)]' : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>

        <div className="flex gap-3 w-full max-w-sm">
          <button 
            disabled={currentStep === 0}
            onClick={() => { setCurrentStep(s => s - 1); onSpeak(steps[currentStep-1].description); }}
            className="flex-1 py-3 bg-[#2c2c2e] hover:bg-[#323236] disabled:opacity-30 rounded-xl text-xs font-bold transition text-zinc-300"
          >
            上一步
          </button>
          <button 
            onClick={handleNext}
            className="flex-1 py-3 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-bold transition shadow-md"
          >
            {currentStep === steps.length - 1 ? '演练完成' : '下一步'}
          </button>
        </div>
      </div>
      
      <div className="mt-6 flex items-center justify-center gap-3 py-3.5 bg-white/5 rounded-xl border border-white/5">
        <div className="w-7 h-7 rounded-lg bg-black border border-white/5 flex items-center justify-center text-white text-[11px]">
          <i className="fas fa-robot text-apple-purple text-[10px]"></i>
        </div>
        <p className="text-[11px] text-zinc-400">“逻辑验证完成。已在你的前额叶与突触之间构建完美的反射路径。”</p>
      </div>
    </div>
  );
};
