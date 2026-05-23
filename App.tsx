
import React, { useState, useEffect, useCallback } from 'react';
import { AppView, Note, Flashcard, UserStats, QuizQuestion, DemoStep, LearningPlan, PlanTask } from './types';
import { Editor } from './components/Editor';
import { FlashcardView } from './components/FlashcardView';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { DynamicDemoView } from './components/DynamicDemoView';
import { QuizView } from './components/QuizView';
import { RewardView } from './components/RewardView';
import { KnowledgeLibrary } from './components/KnowledgeLibrary';
import { LearningPlanView } from './components/LearningPlanView';
import { LLMWiki } from './components/LLMWiki';
import { 
  generateFlashcardsFromNote, 
  generateQuiz, 
  speakSweetly, 
  generateDynamicDemo,
  generateLearningPlan,
  analyzePdf 
} from './geminiService';
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  updateTaskStatus 
} from './tasksService';
import { User } from 'firebase/auth';

const INITIAL_NOTE: Note = {
  id: '1',
  title: '欢迎来到 SILI 智能学习',
  content: '# 开始你的进化\n\n- 在 **知识库** 管理你的 PDF 和笔记。\n- 使用 **智能规划** 对话定制宏观与微观目标。\n- 导出 **精美卡片图** 分享学习成果。',
  updatedAt: Date.now()
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('sili_notes_v6');
    return saved ? JSON.parse(saved) : [INITIAL_NOTE];
  });
  const [cards, setCards] = useState<Flashcard[]>(() => {
    const saved = localStorage.getItem('sili_cards_v6');
    return saved ? JSON.parse(saved) : [];
  });
  const [plans, setPlans] = useState<LearningPlan[]>(() => {
    const saved = localStorage.getItem('sili_plans_v6');
    return saved ? JSON.parse(saved) : [];
  });
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('sili_stats_v6');
    return saved ? JSON.parse(saved) : { 
      xp: 0, 
      level: 1, 
      streak: 1, 
      completedCards: 0, 
      lastActive: new Date().toISOString(),
      totalFocusTimeMinutes: 0
    };
  });

  const [user, setUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const [activeNoteId, setActiveNoteId] = useState<string>(notes[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState("正在为您构建智能连接...");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [demoSteps, setDemoSteps] = useState<DemoStep[]>([]);
  const [userPlanReq, setUserPlanReq] = useState("");

  const [isLightMode, setIsLightMode] = useState<boolean>(() => {
    return localStorage.getItem('sili_theme') === 'light';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sili_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light');
      localStorage.setItem('sili_theme', 'light');
    } else {
      document.body.classList.remove('light');
      localStorage.setItem('sili_theme', 'dark');
    }
  }, [isLightMode]);

  useEffect(() => {
    localStorage.setItem('sili_sidebar_collapsed', isSidebarCollapsed ? 'true' : 'false');
  }, [isSidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('sili_notes_v6', JSON.stringify(notes));
    localStorage.setItem('sili_cards_v6', JSON.stringify(cards));
    localStorage.setItem('sili_plans_v6', JSON.stringify(plans));
    localStorage.setItem('sili_stats_v6', JSON.stringify(stats));
  }, [notes, cards, plans, stats]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setGoogleToken(token);
      },
      () => {
        setUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch (err) {
      console.error("Sign in failed:", err);
      alert("登录 Google 账号失败，请确认为浏览器开启了弹窗授权。");
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await googleSignOut();
      setUser(null);
      setGoogleToken(null);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const activeNote = notes.find(n => n.id === activeNoteId) || notes[0];

  const handleCreatePlan = async () => {
    if (!userPlanReq) {
      alert("请输入您的具体学习目标，以便 SILI 为您量身定制。");
      return;
    }
    setLoadingText("正在为您推演宏观与微观进化路径...");
    setIsGenerating(true);
    try {
      const plan = await generateLearningPlan(activeNote.content.substring(0, 2000), userPlanReq);
      setPlans([plan, ...plans]);
      speakSweetly("已经为你量身定制好了双重规划，每一步我都陪着逆哦！", "encourage");
    } catch (err) {
      console.error(err);
      alert("规划生成失败，请检查网络连接或稍后再试。");
    } finally {
      setIsGenerating(false);
      setUserPlanReq("");
    }
  };

  // useCallback to prevent re-renders in children
  const toggleTask = useCallback((planId: string, taskId: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        const task = p.daily.find(t => t.id === taskId);
        const newlyDone = task ? !task.done : false;

        // If Google Tasks link is active and we have token, update asynchronously
        if (task?.googleTaskId && task?.googleTaskListId && googleToken) {
          updateTaskStatus(googleToken, task.googleTaskListId, task.googleTaskId, newlyDone ? 'completed' : 'needsAction')
            .catch(err => {
              console.error("Google Task status update exception:", err);
              // Silent recovery to prevent user blocking, but log to debugger
            });
        }

        return {
          ...p,
          daily: p.daily.map(t => t.id === taskId ? { ...t, done: !t.done, isActive: false } : t)
        };
      }
      return p;
    }));
    
    setStats(s => ({ 
      ...s, 
      xp: s.xp + 20,
      totalFocusTimeMinutes: s.totalFocusTimeMinutes + 30 
    }));
  }, [googleToken]);

  const updateTask = useCallback((planId: string, taskId: string, updates: Partial<PlanTask>) => {
    setPlans(prev => prev.map(p => {
      if (p.id === planId) {
        return {
          ...p,
          daily: p.daily.map(t => t.id === taskId ? { ...t, ...updates } : t)
        };
      }
      return p;
    }));
  }, []);

  const handleImport = async (title: string, data: string, isPdf: boolean) => {
    if (isPdf) {
      setLoadingText("正在深度解析 PDF ...");
      setIsGenerating(true);
      try {
        const text = await analyzePdf(data);
        const n = { id: Date.now().toString(), title, content: text, updatedAt: Date.now(), type: 'pdf' as const };
        setNotes(prev => [n, ...prev]);
        setActiveNoteId(n.id);
      } catch (err) {
        console.error(err);
        alert("PDF解析失败，请确保文件格式正确且未加密。");
      } finally { setIsGenerating(false); }
    } else {
      const n = { id: Date.now().toString(), title, content: data, updatedAt: Date.now(), type: 'note' as const };
      setNotes(prev => [n, ...prev]);
      setActiveNoteId(n.id);
    }
  };

  return (
    <div className="flex h-screen bg-[#000000] text-gray-100 overflow-hidden font-sans select-none">
      <nav className={`${isSidebarCollapsed ? 'w-16' : 'w-16 md:w-64'} flex flex-col bg-[#161617]/95 border-r border-white/5 z-30 transition-all duration-300`}>
        <div className="p-4 md:p-6 mb-4 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-b from-[#1c1c1e] to-black border border-white/10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-lg">s</div>
            {!isSidebarCollapsed && (
              <span className="hidden md:block font-bold text-[15px] tracking-tight text-zinc-100 truncate">SILI Intelligence</span>
            )}
          </div>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition active:scale-95 border border-white/5 shrink-0"
            title={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <i className={`fas ${isSidebarCollapsed ? 'fa-angle-right' : 'fa-angle-left'} text-xs`}></i>
          </button>
        </div>
        <div className="flex-1 px-3 space-y-1">
          {[
            { id: AppView.DASHBOARD, icon: 'fa-home', label: '控制台' },
            { id: AppView.PLANS, icon: 'fa-calendar-check', label: '进化方案' },
            { id: AppView.LIBRARY, icon: 'fa-database', label: '知识库' },
            { id: AppView.EDITOR, icon: 'fa-pen-nib', label: '知识编织' },
            { id: AppView.REVIEW, icon: 'fa-layer-group', label: '记忆强化' },
            { id: AppView.GRAPH, icon: 'fa-project-diagram', label: '脑图谱' },
            { id: AppView.LLM_WIKI, icon: 'fa-search', label: 'LLM Wiki' },
          ].map(item => {
            const isActive = view === item.id;
            return (
              <button 
                key={item.id} 
                onClick={() => setView(item.id as AppView)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-white/10 text-white font-medium border border-white/5 shadow-md shadow-black/20' 
                    : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                }`}
              >
                <i className={`fas ${item.icon} w-5 text-sm ${isActive ? 'text-apple-blue' : 'text-zinc-500 group-hover:text-zinc-300'}`}></i>
                {!isSidebarCollapsed && (
                  <span className="hidden md:block text-xs font-semibold tracking-wide">{item.label}</span>
                )}
                {isActive && (
                  <span className="absolute left-1 w-1 h-4 bg-apple-blue rounded-full"></span>
                )}
              </button>
            );
          })}
        </div>
        <div className="p-4 mt-auto">
          {isSidebarCollapsed ? (
            <div className="text-center py-2">
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider">LV.{stats.level}</span>
            </div>
          ) : (
            <div className="hidden md:block bg-[#1c1c1e] border border-white/5 rounded-2xl p-4 shadow-xl">
               <div className="flex justify-between text-[10px] mb-2 font-bold text-zinc-400 uppercase tracking-wider">
                 <span>LV.{stats.level}</span>
                 <span className="text-apple-blue">{stats.xp % 500} / 500 XP</span>
               </div>
               <div className="h-[3px] w-full bg-zinc-800 rounded-full overflow-hidden">
                 <div className="h-full bg-gradient-to-r from-apple-blue to-[#30d158] shadow-[0_0_10px_rgba(10,132,255,0.4)] transition-all duration-500" style={{ width: `${(stats.xp % 500) / 5.0}%` }}></div>
               </div>
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 overflow-hidden flex flex-col relative bg-black">
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-black/40 backdrop-blur-xl z-20">
          <h2 className="text-xs font-medium text-zinc-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-apple-blue shadow-[0_0_8px_rgba(10,132,255,0.8)] animate-pulse"></span>
            {view === AppView.DASHBOARD && '欢迎回来，开始进化'}
            {view === AppView.LIBRARY && '知识库管理中心'}
            {view === AppView.EDITOR && `正在编辑：${activeNote.title}`}
            {view === AppView.REVIEW && '记忆库：正在强化大脑连接'}
          </h2>
          <div className="flex items-center gap-4">
            <button 
              id="theme-toggle-btn"
              onClick={() => setIsLightMode(!isLightMode)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5 active:scale-95"
              title={isLightMode ? "切换为暗色模式" : "切换为浅色模式"}
            >
              <i className={`fas ${isLightMode ? 'fa-moon' : 'fa-sun'} text-[11px]`}></i>
            </button>
            <div className="text-[#ff9f0a] font-bold text-[10px] tracking-widest flex items-center gap-1.5 bg-[#ff9f0a]/10 px-3 py-1.5 rounded-full border border-[#ff9f0a]/15 shadow-sm">
              <i className="fas fa-fire text-xs"></i> {stats.streak} DAYS STREAK
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {view === AppView.DASHBOARD && (
            <div className="max-w-7xl mx-auto space-y-8">
              <section className="bg-gradient-to-b from-[#1c1c1e] to-[#121214] border border-white/5 p-8 md:p-12 rounded-[28px] relative overflow-hidden shadow-2xl">
                <div className="absolute top-[-20%] right-[-10%] w-[350px] h-[350px] bg-apple-blue/5 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[250px] h-[250px] bg-apple-purple/5 rounded-full blur-[80px] pointer-events-none"></div>
                <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12 transition-transform duration-1000 hidden md:block">
                  <i className="fas fa-brain text-[120px]"></i>
                </div>
                <div className="relative z-10">
                  <h1 className="text-3xl font-extrabold mb-2 tracking-tight text-white">定制你的进化之路</h1>
                  <p className="text-zinc-400 max-w-lg mb-8 leading-relaxed text-xs">基于你最近的学习笔记或PDF内容，SILI 将深度进行全流程的重点推演，为您安排科学的学习周期、宏观路线图与高并发记忆测试。</p>
                  <div className="flex flex-col md:flex-row gap-3.5 max-w-4xl">
                    <input 
                      value={userPlanReq}
                      onChange={(e) => setUserPlanReq(e.target.value)}
                      placeholder="输入具体研究或学习目标，例如：系统掌握 D3.js 核心算法与力导向图..."
                      className="flex-1 bg-black/60 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-apple-blue/50 focus:ring-1 focus:ring-apple-blue/15 text-gray-100 transition shadow-inner font-sans placeholder-zinc-600"
                    />
                    <button onClick={handleCreatePlan} className="px-8 py-4 bg-white text-black hover:bg-zinc-200 rounded-2xl font-bold text-xs tracking-tight transition-all duration-200 flex items-center justify-center gap-2 shadow-xl active:scale-95">
                      开始智能规划 <i className="fas fa-magic text-xs"></i>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {view === AppView.PLANS && (
            <div className="max-w-7xl mx-auto h-full">
              {plans.length > 0 ? (
                <LearningPlanView 
                  plan={plans[0]} 
                  onToggleTask={(tid) => toggleTask(plans[0].id, tid)} 
                  onUpdateTask={(tid, updates) => updateTask(plans[0].id, tid, updates)}
                  user={user}
                  googleToken={googleToken}
                  onGoogleSignIn={handleGoogleSignIn}
                  onGoogleSignOut={handleGoogleSignOut}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                  <i className="fas fa-calendar-check text-4xl text-zinc-600"></i>
                  <h2 className="text-xl font-bold text-zinc-300">还没有制定智能进化方案</h2>
                  <p className="text-zinc-500 text-sm">请先在【控制台】输入目标，让 SILI 为你生成专属的学习排期和宏观路线图。</p>
                  <button onClick={() => setView(AppView.DASHBOARD)} className="mt-4 px-6 py-2 bg-apple-blue text-white font-bold text-sm rounded-xl hover:bg-blue-600 transition">
                    去控制台生成
                  </button>
                </div>
              )}
            </div>
          )}

          {view === AppView.LIBRARY && (
            <KnowledgeLibrary 
              notes={notes} 
              cards={cards} 
              onDeleteNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
              onDeleteCard={(id) => setCards(prev => prev.filter(c => c.id !== id))}
              onSelectNote={(id) => { setActiveNoteId(id); setView(AppView.EDITOR); }}
            />
          )}

          {view === AppView.EDITOR && (
            <div className="h-[calc(100vh-160px)] flex gap-6">
              <div className="flex-1">
                <Editor note={activeNote} isGenerating={isGenerating} onSave={(n) => setNotes(prev => prev.map(p => p.id === n.id ? n : p))} 
                  onImport={handleImport} onGenerateCards={async (c) => {
                    setLoadingText("提取卡片中..."); setIsGenerating(true);
                    try {
                      const newCards = await generateFlashcardsFromNote(c, activeNoteId);
                      setCards(prev => [...prev, ...newCards]);
                    } finally { setIsGenerating(false); }
                  }}
                  onGenerateQuiz={async (c) => {
                    setLoadingText("准备题目中..."); setIsGenerating(true);
                    try {
                      const qs = await generateQuiz(c); setQuizQuestions(qs); setView(AppView.QUIZ);
                    } finally { setIsGenerating(false); }
                  }}
                  onStartDemo={async (c) => {
                    setLoadingText("逻辑推演中..."); setIsGenerating(true);
                    try {
                      const steps = await generateDynamicDemo(c); setDemoSteps(steps); setView(AppView.DEMO);
                    } finally { setIsGenerating(false); }
                  }}
                />
              </div>
            </div>
          )}

          {view === AppView.REVIEW && (
            <FlashcardView 
              cards={cards.filter(c => c.nextReview <= Date.now())}
              onReview={(id, ok) => {
                setCards(prev => prev.map(c => {
                  if (c.id === id) {
                    const nl = ok ? Math.min(5, c.level + 1) : 0;
                    return { ...c, level: nl, nextReview: Date.now() + (nl || 1) * 86400000 };
                  }
                  return c;
                }));
                if (ok) setStats(s => ({ ...s, xp: s.xp + 10 }));
              }}
              onSpeak={speakSweetly}
              onNavigateToSource={(id) => { setActiveNoteId(id); setView(AppView.EDITOR); }}
              onClose={() => setView(AppView.DASHBOARD)}
            />
          )}

          {view === AppView.DEMO && <DynamicDemoView steps={demoSteps} onSpeak={speakSweetly} onClose={() => setView(AppView.EDITOR)} />}
          {view === AppView.QUIZ && <QuizView questions={quizQuestions} onClose={() => setView(AppView.EDITOR)} onComplete={() => setView(AppView.REWARD)} />}
          {view === AppView.REWARD && <RewardView stats={stats} onBack={() => setView(AppView.DASHBOARD)} onSpeak={speakSweetly} />}
          {view === AppView.GRAPH && <KnowledgeGraph notes={notes} cards={cards} />}
          {view === AppView.LLM_WIKI && <LLMWiki />}
        </div>
      </main>

      {isGenerating && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-2xl z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-16 h-16 mb-8 relative">
             <div className="absolute inset-0 border-[3px] border-white/5 rounded-full"></div>
             <div className="absolute inset-0 border-[3px] border-t-apple-blue rounded-full animate-spin"></div>
          </div>
          <p className="text-lg font-semibold text-white tracking-tight animate-pulse">{loadingText}</p>
          <p className="mt-3 text-zinc-500 text-xs font-mono">SILI System Synapse Optimizing...</p>
        </div>
      )}
    </div>
  );
};

export default App;
