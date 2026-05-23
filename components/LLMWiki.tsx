import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { askLLMWiki } from '../geminiService';

export const LLMWiki: React.FC = () => {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setAnswer('');
    try {
      const response = await askLLMWiki(query.trim());
      setAnswer(response);
    } catch (err: any) {
      console.error(err);
      setAnswer(`❌ 查询失败: ${err.message || '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1c1c1e]/40 backdrop-blur-md rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
      <div className="p-6 bg-black/40 border-b border-white/5 backdrop-blur-xl">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <i className="fas fa-search text-apple-blue"></i>
          LLM Wiki / 智能百科
        </h2>
        <p className="text-xs text-zinc-400 mb-4">输入任何你想了解的概念或知识点，通过大型语言模型无缝探索万维百科知识网络。</p>
        
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <i className="fas fa-microscope text-sm"></i>
            </div>
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索任何知识理念、算法原理，或历史事件..."
              className="w-full bg-[#2c2c2e] hover:bg-[#323236] focus:bg-[#323236] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-apple-blue/50 transition-all font-semibold shadow-inner"
            />
          </div>
          <button 
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-6 py-3 bg-apple-blue hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-apple-blue text-white font-bold text-sm rounded-xl transition shadow active:scale-95 flex items-center gap-2"
          >
            {isLoading ? <i className="fas fa-spinner fa-spin text-sm"></i> : <i className="fas fa-search text-sm"></i>}
            搜索
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-8 relative">
        {isLoading && !answer && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-12 h-12 border-4 border-apple-blue/20 border-t-apple-blue rounded-full animate-spin mb-4"></div>
            <div className="text-sm font-semibold tracking-wide text-zinc-400 animate-pulse">大模型百科检索中，正在解析知识语义...</div>
          </div>
        )}

        {!isLoading && !answer && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <i className="fas fa-book-open text-6xl text-zinc-600 mb-6 drop-shadow-lg"></i>
            <h3 className="text-lg font-bold text-zinc-400">百科知识库已就绪</h3>
            <p className="text-xs text-zinc-500 mt-2 max-w-sm leading-relaxed">
              在这个无尽的 AI 百科宇宙中，你可以深度询问关于物理法则、数学定理、艺术历史或程序的底层架构的一切... 
            </p>
          </div>
        )}

        {answer && (
          <div className="max-w-4xl mx-auto h-full">
            <div className="bg-black/40 border border-white/5 p-6 md:p-10 rounded-[24px] shadow-2xl relative">
              <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none">
                <i className="fas fa-atom text-[100px]"></i>
              </div>
              <div className="markdown-renderer relative z-10">
                <ReactMarkdown>{answer}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
