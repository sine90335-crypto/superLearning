import React, { useState } from 'react';
import { QuizQuestion } from '../types';

interface QuizViewProps {
  questions: QuizQuestion[];
  onComplete: (allCorrect: boolean) => void;
  onClose: () => void;
}

export const QuizView: React.FC<QuizViewProps> = ({ questions, onComplete, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);

  const q = questions[currentIdx];

  const handleAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    setShowExplanation(true);
    if (idx === q.correctAnswer) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(s => s + 1);
      setSelected(null);
      setShowExplanation(false);
    } else {
      onComplete(score === questions.length - 1 || score === questions.length); // 允许错一个或者全对
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6 flex flex-col h-[calc(100vh-120px)] overflow-hidden justify-between">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">知识巩固 • STAGE QUIZ</h2>
          <p className="text-[11px] text-zinc-500">回答正确率将计入你的核心成长等级。</p>
        </div>
        <span className="text-xs font-mono font-bold bg-[#1c1c1e] border border-white/5 px-2.5 py-1 rounded-full text-zinc-400">
          {currentIdx + 1} of {questions.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
        <div className="bg-[#1c1c1e] border border-white/5 p-6 md:p-8 rounded-2xl shadow-xl">
          <p className="text-base font-bold leading-relaxed text-zinc-100 mb-6 tracking-tight">
            {q.question}
          </p>
          <div className="space-y-3">
            {q.options.map((opt, idx) => {
              const isSelected = selected === idx;
              const isCorrectOpt = idx === q.correctAnswer;
              const hasAnswered = selected !== null;

              let buttonClass = 'border-white/5 bg-[#2c2c2e]/20 hover:border-zinc-700 hover:bg-white/[0.02] text-zinc-300';
              if (hasAnswered) {
                if (isCorrectOpt) {
                  buttonClass = 'border-apple-green bg-apple-green/10 text-apple-green font-bold';
                } else if (isSelected) {
                  buttonClass = 'border-apple-red bg-apple-red/10 text-apple-red font-bold';
                } else {
                  buttonClass = 'border-white/5 bg-black/10 opacity-40 text-zinc-650';
                }
              }

              return (
                <button 
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  className={`w-full text-left p-4 rounded-xl border text-xs font-semibold tracking-tight transition-all duration-300 flex items-center justify-between ${buttonClass}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-zinc-500">{String.fromCharCode(65 + idx)}</span>
                    <span>{opt}</span>
                  </div>
                  {hasAnswered && isCorrectOpt && <i className="fas fa-check-circle text-apple-green text-xs"></i>}
                  {hasAnswered && isSelected && !isCorrectOpt && <i className="fas fa-times-circle text-apple-red text-xs"></i>}
                </button>
              );
            })}
          </div>
        </div>

        {showExplanation && (
          <div className="bg-apple-blue/5 border border-apple-blue/15 p-5 rounded-xl animate-in slide-in-from-bottom duration-300">
            <h4 className="font-bold text-[11px] uppercase tracking-wider text-apple-blue mb-1.5 font-mono">
              <i className="fas fa-info-circle mr-1"></i> SILI 解读
            </h4>
            <p className="text-xs text-zinc-350 leading-relaxed font-normal">{q.explanation}</p>
          </div>
        )}
      </div>

      {selected !== null && (
        <div className="mt-5 pt-3">
          <button 
            onClick={handleNext}
            className="w-full py-3.5 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-xs tracking-wide transition-all uppercase"
          >
            {currentIdx === questions.length - 1 ? '提交结果' : '下一测试单元'}
          </button>
        </div>
      )}
    </div>
  );
};
