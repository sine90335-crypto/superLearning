import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LearningPlan, PlanTask } from '../types';
import { 
  fetchTaskLists, 
  fetchTasks, 
  createTaskList, 
  createTask, 
  updateTaskStatus, 
  deleteTask, 
  GoogleTaskList, 
  GoogleTask,
  fetchCalendars,
  fetchCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  GoogleCalendarResource,
  GoogleCalendarEvent,
  createGoogleDoc,
  getGoogleDoc,
  appendGoogleDocText,
  GoogleDoc,
  fetchChatSpaces,
  sendChatMessage,
  GoogleChatSpace,
  GoogleChatMessage,
  createGoogleSpreadsheet,
  appendSpreadsheetValues,
  getSpreadsheetValues,
  createGoogleForm,
  addQuestionsToGoogleForm,
  GoogleSpreadsheet,
  GoogleForm
} from '../tasksService';

interface LearningPlanViewProps {
  plan: LearningPlan;
  onToggleTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, updates: Partial<PlanTask>) => void;
  user: any; // User | null
  googleToken: string | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
}

// Memoized individual task item for faster response
const TaskItem = React.memo(({ 
  task, 
  onToggle, 
  onStartTimer, 
  formatTime,
  onScheduleToCalendar,
  googleToken
}: { 
  task: PlanTask, 
  onToggle: (id: string) => void, 
  onStartTimer: (t: PlanTask) => void,
  formatTime: (s: number) => string,
  onScheduleToCalendar: (t: PlanTask) => void,
  googleToken: string | null
}) => {
  return (
    <div 
      className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-350 ${
        task.done 
          ? 'bg-apple-green/5 border-apple-green/20' 
          : task.isActive 
            ? 'bg-apple-blue/5 border-apple-blue/30 shadow-lg shadow-apple-blue/5' 
            : 'bg-[#1c1c1e]/40 border-white/5 hover:border-zinc-700'
      }`}
    >
      <div 
        onClick={() => onToggle(task.id)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition cursor-pointer shrink-0 ${
          task.done 
            ? 'bg-apple-green border-apple-green text-black' 
            : 'border-zinc-650 hover:border-apple-blue'
        }`}
      >
        {task.done && <i className="fas fa-check text-[9px] font-bold"></i>}
      </div>

      <div className="flex-1 min-w-0" onClick={() => onToggle(task.id)}>
        <div className="flex justify-between items-start">
          <span className={`text-xs font-semibold tracking-tight truncate block ${task.done ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
            {task.time && <span className="text-apple-blue mr-2 font-mono">[{task.time}]</span>}
            {task.task}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.units && (
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
              {task.units} 学习单位
            </span>
          )}
          {task.googleTaskId && (
            <span className="text-[8px] text-apple-blue font-semibold tracking-wide bg-apple-blue/10 px-1.5 py-0.5 rounded flex items-center gap-1 border border-apple-blue/15 scale-95 origin-left">
              <i className="fas fa-sync text-[6px]"></i> Google Tasks 已同步
            </span>
          )}
          {task.done && <span className="text-[8px] text-apple-green font-extrabold uppercase tracking-widest">Done</span>}
        </div>
      </div>

      <div className="flex items-center gap-3 pl-3 border-l border-white/5 shrink-0">
        {!task.done && (
          <>
            {task.remainingSeconds !== undefined && (
              <span className={`font-mono text-xs font-bold w-12 text-center ${task.isActive ? 'text-apple-blue' : 'text-zinc-500'}`}>
                {formatTime(task.remainingSeconds)}
              </span>
            )}
            <button 
              id={`play-btn-${task.id}`}
              onClick={(e) => { e.stopPropagation(); onStartTimer(task); }}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                task.isActive 
                  ? 'bg-apple-blue text-white shadow-md shadow-apple-blue/20' 
                  : 'bg-[#2c2c2e] hover:bg-[#323236] text-zinc-400 hover:text-white'
              }`}
              title={task.isActive ? "暂停" : "开始计时"}
            >
              <i className={`fas ${task.isActive ? 'fa-pause' : 'fa-play'} text-[10px]`}></i>
            </button>
          </>
        )}
        
        {googleToken && (
          <button
            id={`cal-schedule-btn-${task.id}`}
            onClick={(e) => { e.stopPropagation(); onScheduleToCalendar(task); }}
            className="w-8 h-8 rounded-lg bg-[#2c2c2e] hover:bg-[#3a3a3e] text-zinc-400 hover:text-apple-blue flex items-center justify-center transition"
            title="排程到 Google Calendar"
          >
            <i className="far fa-calendar-plus text-xs"></i>
          </button>
        )}
      </div>
    </div>
  );
});

export const LearningPlanView: React.FC<LearningPlanViewProps> = ({ 
  plan, 
  onToggleTask, 
  onUpdateTask,
  user,
  googleToken,
  onGoogleSignIn,
  onGoogleSignOut
}) => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // Widget Unified Integration Channel Tab: 'tasks' | 'calendar' | 'docs' | 'sheets' | 'forms' | 'chat' | 'keep'
  const [activeIntegrationChannel, setActiveIntegrationChannel] = useState<'tasks' | 'calendar' | 'docs' | 'sheets' | 'forms' | 'chat' | 'keep'>('tasks');

  // Loader state
  const [isWidgetLoading, setIsWidgetLoading] = useState<boolean>(false);
  const [widgetStatusMsg, setWidgetStatusMsg] = useState<string>('');

  // 1. Google Tasks States
  const [activeWidgetTab, setActiveWidgetTab] = useState<'sync' | 'browser'>('sync');
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [browserTasks, setBrowserTasks] = useState<GoogleTask[]>([]);
  const [newBrowserTaskText, setNewBrowserTaskText] = useState<string>('');

  // 2. Google Calendar States
  const [calendars, setCalendars] = useState<GoogleCalendarResource[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('');
  const [calendarEvents, setCalendarEvents] = useState<GoogleCalendarEvent[]>([]);

  // 3. Google Docs States
  const [docExportStatus, setDocExportStatus] = useState<string>('');
  const [createdDocs, setCreatedDocs] = useState<Array<{ id: string; title: string; url: string }>>(() => {
    const saved = localStorage.getItem('sili_created_docs');
    return saved ? JSON.parse(saved) : [];
  });

  // Save docs lists to preserve them locally
  useEffect(() => {
    localStorage.setItem('sili_created_docs', JSON.stringify(createdDocs));
  }, [createdDocs]);

  // 3b. Google Sheets States
  const [sheetExportStatus, setSheetExportStatus] = useState<string>('');
  const [createdSheets, setCreatedSheets] = useState<Array<{ id: string; title: string; url: string }>>(() => {
    const saved = localStorage.getItem('sili_created_sheets');
    return saved ? JSON.parse(saved) : [];
  });
  const [newSheetLogContent, setNewSheetLogContent] = useState<string>('');
  const [newSheetLogMins, setNewSheetLogMins] = useState<number>(30);

  useEffect(() => {
    localStorage.setItem('sili_created_sheets', JSON.stringify(createdSheets));
  }, [createdSheets]);

  // 3c. Google Forms States
  const [formCreateStatus, setFormCreateStatus] = useState<string>('');
  const [createdForms, setCreatedForms] = useState<Array<{ id: string; title: string; responderUri: string }>>(() => {
    const saved = localStorage.getItem('sili_created_forms');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('sili_created_forms', JSON.stringify(createdForms));
  }, [createdForms]);

  // 4. Google Chat States
  const [chatSpaces, setChatSpaces] = useState<GoogleChatSpace[]>([]);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>('');
  const [chatMessageText, setChatMessageText] = useState<string>('');

  // 5. Keep Local Board States
  const [keepNotes, setKeepNotes] = useState<Array<{ id: string; title: string; content: string; color: string; pinned: boolean }>>(() => {
    const saved = localStorage.getItem('sili_keep_notes');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'welcome',
        title: '📌 欢迎来到 SILI 智能便签板',
        content: '因为消费者端的 Google Keep API 受到 Google Workspace 域权限严格限制。为了让您在 AI 个人学习中拥有同等便捷的体验，SILI 深度适配并启动了这款本地 Keep 精装工作板。支持便签盯、五彩画布和极速闪存记录！',
        color: '#fef08a',
        pinned: true
      },
      {
        id: 'tip',
        title: '💡 脑电波灵感栏',
        content: '在这里你可以记录学习过程中稍纵即逝的灵感或重难点疑难排查。右下角的按钮可以进行便签颜色自定义哦！',
        color: '#bbf7d0',
        pinned: false
      }
    ];
  });
  const [newStickyTitle, setNewStickyTitle] = useState<string>('');
  const [newStickyContent, setNewStickyContent] = useState<string>('');
  const [selectedStickyColor, setSelectedStickyColor] = useState<string>('#fef08a');
  const [keepNotesSearch, setKeepNotesSearch] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('sili_keep_notes', JSON.stringify(keepNotes));
  }, [keepNotes]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalUnits = plan.daily.reduce((acc, curr) => acc + (curr.units || 0), 0);
    const completedUnits = plan.daily.filter(t => t.done).reduce((acc, curr) => acc + (curr.units || 0), 0);
    const remainingUnits = totalUnits - completedUnits;
    const totalTimeMinutes = completedUnits * 30; // Assuming 1 unit = 30 mins
    const syncedCount = plan.daily.filter(t => !!t.googleTaskId).length;
    return { totalUnits, completedUnits, remainingUnits, totalTimeMinutes, syncedCount };
  }, [plan.daily]);

  // Timer effect
  useEffect(() => {
    if (activeTaskId) {
      timerRef.current = window.setInterval(() => {
        const task = plan.daily.find(t => t.id === activeTaskId);
        if (task && task.remainingSeconds && task.remainingSeconds > 0) {
          onUpdateTask(activeTaskId, { remainingSeconds: task.remainingSeconds - 1 });
        } else if (task && task.remainingSeconds === 0) {
          handleStopTimer(activeTaskId);
          onToggleTask(activeTaskId);
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTaskId, plan.daily, onUpdateTask, onToggleTask]);

  // 1. Google Tasks Initialization API
  useEffect(() => {
    if (googleToken) {
      setIsWidgetLoading(true);
      fetchTaskLists(googleToken)
        .then(lists => {
          setTaskLists(lists);
          if (lists.length > 0) {
            const siliList = lists.find(l => l.title.startsWith("SILI:"));
            setSelectedListId(siliList ? siliList.id : lists[0].id);
          }
        })
        .catch(err => {
          console.error("Failed to load task lists:", err);
          setWidgetStatusMsg("无法加载 Google Tasks 列表");
        })
        .finally(() => setIsWidgetLoading(false));
    } else {
      setTaskLists([]);
      setBrowserTasks([]);
      setSelectedListId('');
    }
  }, [googleToken]);

  // Load Tasks whenever active listId or tab changes
  useEffect(() => {
    if (googleToken && selectedListId && activeWidgetTab === 'browser' && activeIntegrationChannel === 'tasks') {
      setIsWidgetLoading(true);
      fetchTasks(googleToken, selectedListId)
        .then(tasks => {
          setBrowserTasks(tasks);
        })
        .catch(err => {
          console.error("Failed to load tasks inside list:", err);
        })
        .finally(() => setIsWidgetLoading(false));
    }
  }, [googleToken, selectedListId, activeWidgetTab, activeIntegrationChannel]);

  // 2. Google Calendar Initialization APIs
  useEffect(() => {
    if (googleToken && activeIntegrationChannel === 'calendar') {
      setIsWidgetLoading(true);
      fetchCalendars(googleToken)
        .then(list => {
          setCalendars(list);
          const primaryCal = list.find(c => c.primary) || list[0];
          if (primaryCal) {
            setSelectedCalendarId(primaryCal.id);
          }
        })
        .catch(err => {
          console.error("Failed to fetch calendars:", err);
          setWidgetStatusMsg("无法加载 Google 日历");
        })
        .finally(() => setIsWidgetLoading(false));
    }
  }, [googleToken, activeIntegrationChannel]);

  const loadCalendarEvents = async () => {
    if (!googleToken || !selectedCalendarId) return;
    setIsWidgetLoading(true);
    try {
      const now = new Date();
      now.setHours(0,0,0,0);
      const events = await fetchCalendarEvents(googleToken, selectedCalendarId, now.toISOString());
      setCalendarEvents(events);
    } catch (err: any) {
      console.error(err);
      setWidgetStatusMsg("加载日历事情失败");
    } finally {
      setIsWidgetLoading(false);
    }
  };

  useEffect(() => {
    if (googleToken && selectedCalendarId && activeIntegrationChannel === 'calendar') {
      loadCalendarEvents();
    }
  }, [googleToken, selectedCalendarId, activeIntegrationChannel]);

  // 3. Google Chat Initialization APIs
  useEffect(() => {
    if (googleToken && activeIntegrationChannel === 'chat') {
      setIsWidgetLoading(true);
      fetchChatSpaces(googleToken)
        .then(spaces => {
          setChatSpaces(spaces);
          if (spaces.length > 0) {
            setSelectedSpaceName(spaces[0].name);
          }
        })
        .catch(err => {
          console.error("Failed to load chat spaces:", err);
          setWidgetStatusMsg("无可用 Google Chat 聊天室");
        })
        .finally(() => setIsWidgetLoading(false));
    }
  }, [googleToken, activeIntegrationChannel]);

  const handleStartTimer = (task: PlanTask) => {
    if (activeTaskId === task.id) {
      handleStopTimer(task.id);
      return;
    }
    const defaultSeconds = (task.units ? task.units * 30 : 30) * 60;
    const seconds = task.remainingSeconds ?? defaultSeconds;
    onUpdateTask(task.id, { remainingSeconds: seconds, isActive: true });
    setActiveTaskId(task.id);
  };

  const handleStopTimer = (taskId: string) => {
    onUpdateTask(taskId, { isActive: false });
    setActiveTaskId(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Action: Google Tasks Synchronization
   */
  const handlePushSync = async () => {
    if (!googleToken) return;
    setIsWidgetLoading(true);
    setWidgetStatusMsg("🔍 正在扫描云端列表通道...");
    try {
      const lists = await fetchTaskLists(googleToken);
      const listName = `SILI: ${plan.goal.substring(0, 30)}${plan.goal.length > 30 ? '...' : ''}`;
      let targetList = lists.find(l => l.title === listName);

      if (!targetList) {
        setWidgetStatusMsg("🔨 正在创建 SILI 专属 Google Tasks 任务列表...");
        targetList = await createTaskList(googleToken, listName);
      }

      const targetListId = targetList.id;
      setWidgetStatusMsg("📂 正在同步并拉取现有云端数据...");
      const existingGoogleTasks = await fetchTasks(googleToken, targetListId);

      setWidgetStatusMsg("⚡ 正在双向匹配并推送最新的微观学习指标...");
      
      for (const task of plan.daily) {
        let matchingGTask = existingGoogleTasks.find(gt => gt.id === task.googleTaskId);
        if (!matchingGTask) {
          matchingGTask = existingGoogleTasks.find(gt => gt.title === task.task);
        }

        if (matchingGTask) {
          const expectedStatus = task.done ? 'completed' : 'needsAction';
          if (matchingGTask.status !== expectedStatus) {
            await updateTaskStatus(googleToken, targetListId, matchingGTask.id, expectedStatus);
          }
          if (task.googleTaskId !== matchingGTask.id || task.googleTaskListId !== targetListId) {
            onUpdateTask(task.id, { 
              googleTaskId: matchingGTask.id, 
              googleTaskListId: targetListId 
            });
          }
        } else {
          const newGTask = await createTask(googleToken, targetListId, {
            title: task.task,
            notes: `SILI Study Unit${task.time ? ` [时辰安排: ${task.time}]` : ""}`,
            status: task.done ? 'completed' : 'needsAction'
          });
          onUpdateTask(task.id, { 
            googleTaskId: newGTask.id, 
            googleTaskListId: targetListId 
          });
        }
      }

      const refreshedLists = await fetchTaskLists(googleToken);
      setTaskLists(refreshedLists);
      setWidgetStatusMsg("✅ 成功完成云端双重映射！");
      setTimeout(() => setWidgetStatusMsg(''), 4500);
    } catch (err: any) {
      console.error(err);
      setWidgetStatusMsg(`❌ 同步异常: ${err.message || err}`);
    } finally {
      setIsWidgetLoading(false);
    }
  };

  const handlePullSync = async () => {
    if (!googleToken) return;
    const targetTaskListId = plan.daily.find(t => !!t.googleTaskListId)?.googleTaskListId;
    if (!targetTaskListId) {
      alert("请先点击 “一键同步至 Google Tasks” 创建云端卡槽！");
      return;
    }

    setIsWidgetLoading(true);
    setWidgetStatusMsg("📡 正在获取云端打卡状态...");
    try {
      const cloudTasks = await fetchTasks(googleToken, targetTaskListId);
      let localUpdates = 0;

      for (const localTask of plan.daily) {
        if (localTask.googleTaskId) {
          const cloudTask = cloudTasks.find(ct => ct.id === localTask.googleTaskId);
          if (cloudTask) {
            const isCloudCompleted = cloudTask.status === 'completed';
            if (isCloudCompleted !== localTask.done) {
              onUpdateTask(localTask.id, { done: isCloudCompleted, isActive: false });
              localUpdates++;
            }
          }
        }
      }
      setWidgetStatusMsg(`✅ 进度同步：成功拉取并校验了 ${localUpdates} 个任务状态！`);
      setTimeout(() => setWidgetStatusMsg(''), 4500);
    } catch (err: any) {
      console.error(err);
      setWidgetStatusMsg(`❌ 拉取异常: ${err.message || err}`);
    } finally {
      setIsWidgetLoading(false);
    }
  };

  const handleCreateBrowserTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken || !selectedListId || !newBrowserTaskText.trim()) return;

    setIsWidgetLoading(true);
    try {
      const added = await createTask(googleToken, selectedListId, {
        title: newBrowserTaskText.trim(),
        status: 'needsAction'
      });
      setBrowserTasks(prev => [added, ...prev]);
      setNewBrowserTaskText('');
    } catch (err: any) {
      alert(`创建云端任务失败: ${err.message}`);
    } finally {
      setIsWidgetLoading(false);
    }
  };

  const handleToggleBrowserTask = async (task: GoogleTask) => {
    if (!googleToken || !selectedListId) return;
    const nextStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    setBrowserTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));

    try {
      await updateTaskStatus(googleToken, selectedListId, task.id, nextStatus);
    } catch (err: any) {
      console.error(err);
      setBrowserTasks(prev => prev.map(t => t.id === task.id ? t : t));
      alert(`无法在 Google Tasks 更新状态: ${err.message}`);
    }
  };

  const handleDeleteBrowserTask = async (taskId: string) => {
    if (!googleToken || !selectedListId) return;
    const confirmed = window.confirm("您确定要从 Google Tasks Cloud 中彻底删除该任务吗？此操作无法撤销。");
    if (!confirmed) return;

    setIsWidgetLoading(true);
    try {
      await deleteTask(googleToken, selectedListId, taskId);
      setBrowserTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    } finally {
      setIsWidgetLoading(false);
    }
  };

  /**
   * Action: Google Calendar Scheduling
   */
  const handleScheduleTaskOnCalendar = async (task: PlanTask) => {
    if (!googleToken || !selectedCalendarId) {
      alert("请先登录 Google 账号并选中日历列表中的目标卡槽。");
      return;
    }

    const confirmed = window.confirm(`您确定要为任务 “${task.task}” 在 Google 日历中创建一个 30 分钟的学习日程吗？`);
    if (!confirmed) return;

    setIsWidgetLoading(true);
    setWidgetStatusMsg("📅 正在与 Google 日历进行时间切片通信...");
    try {
      const start = new Date();
      start.setHours(start.getHours() + 1, 0, 0, 0); // Scheduled for 1 hour from now
      const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 mins

      const eventBody = {
        summary: `SILI 学学: ${task.task}`,
        description: `超级智能学习日程安排\n目标命题: ${plan.goal}\n任务安排: ${task.task}\n单位计时: 30分钟`,
        start: { dateTime: start.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: end.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      };

      await createCalendarEvent(googleToken, selectedCalendarId, eventBody);
      setWidgetStatusMsg(`✅ 成功添加日程: “${task.task}”！`);
      loadCalendarEvents();
      setTimeout(() => setWidgetStatusMsg(''), 4500);
    } catch (err: any) {
      console.error(err);
      alert(`日历事件添加失败: ${err.message || err}`);
    } finally {
      setIsWidgetLoading(false);
    }
  };

  const handleDeleteCalendarEvent = async (eventId: string) => {
    if (!googleToken || !selectedCalendarId) return;
    const confirmed = window.confirm("确定要永久从您的 Google 日历中移除此日程活动吗？");
    if (!confirmed) return;

    setIsWidgetLoading(true);
    try {
      await deleteCalendarEvent(googleToken, selectedCalendarId, eventId);
      setCalendarEvents(prev => prev.filter(e => e.id !== eventId));
      setWidgetStatusMsg("✅ 成功移除日历日程项");
      setTimeout(() => setWidgetStatusMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`日历事件删除失败: ${err.message || err}`);
    } finally {
      setIsWidgetLoading(false);
    }
  };

  /**
   * Action: Google Docs Exporter
   */
  const handleExportToGoogleDocs = async () => {
    if (!googleToken) return;
    setIsWidgetLoading(true);
    setDocExportStatus("🏗️ 正在云端架构新 Google Docs 存储文档...");
    try {
      const dateStr = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const docTitle = `SILI 智能大脑蓝图：${plan.goal.substring(0, 30)}`;
      
      let content = `=========================================================\n`;
      content += `          SILI 智能学习个体 (Super Intelligent Learning)   \n`;
      content += `                       核心大脑进展报告                    \n`;
      content += `=========================================================\n\n`;
      content += `导出时间: ${dateStr}\n`;
      content += `进化命题: ${plan.goal}\n\n`;
      
      content += `一、宏观进化航图 (Structural Chronology)\n`;
      content += `---------------------------------------------------------\n`;
      plan.macro.forEach((m, i) => {
        content += `${i + 1}. [${m.month}] -> ${m.milestones.join(' | ')}\n`;
      });
      content += `\n`;

      content += `二、微观突触任务打卡清单 (Daily Action Items Summary)\n`;
      content += `---------------------------------------------------------\n`;
      plan.daily.forEach((t, i) => {
        const symbol = t.done ? '✓ [已达标 COMPLETED]' : '☐ [待执行 PENDING]';
        content += `${i + 1}. ${symbol} ${t.time ? `[时安排: ${t.time}] ` : ''}${t.task}\n`;
      });
      content += `\n`;

      content += `=========================================================\n`;
      content += `        SILI System Synapse Cloud Synchronization Completed\n`;
      content += `=========================================================\n`;

      const doc = await createGoogleDoc(googleToken, docTitle);
      setDocExportStatus("🖋️ 正在向 Google Document 核心段落填装神经元指标...");
      await appendGoogleDocText(googleToken, doc.documentId, content);

      const docUrl = `https://docs.google.com/document/d/${doc.documentId}/edit`;
      setCreatedDocs(prev => [{ id: doc.documentId, title: docTitle, url: docUrl }, ...prev]);
      setDocExportStatus("✅ 文档已完成云端转录并安全发布！");

      const confirmOpen = window.confirm(`导出成功！文档《${docTitle}》已保存在您的谷歌云端硬盘。\n是否现在就在新窗口中打开它进行浏览？`);
      if (confirmOpen) {
        window.open(docUrl, '_blank');
      }
    } catch (err: any) {
      console.error(err);
      setDocExportStatus(`❌ 导出失败: ${err.message || err}`);
    } finally {
      setIsWidgetLoading(false);
      setTimeout(() => setDocExportStatus(''), 4500);
    }
  };

  /**
   * Action: Google Sheets Exporter and study minutes addition
   */
  const handleExportToGoogleSheets = async () => {
    if (!googleToken) return;
    setIsWidgetLoading(true);
    setSheetExportStatus("🏗️ 正在云端架设新 Google Sheets 进度记录表...");
    try {
      const sheetTitle = `SILI 进化数据电子流：${plan.goal.substring(0, 30)}`;
      const spreadsheet = await createGoogleSpreadsheet(googleToken, sheetTitle);
      
      setSheetExportStatus("🖋️ 正在往 Google Sheets 导入进化计划维度与核心序列...");
      
      // Headers
      const headers = [["单元任务名称", "预测安排时间", "规划专注单位 (格)", "打卡状态", "同步最后更新时间"]];
      await appendSpreadsheetValues(googleToken, spreadsheet.spreadsheetId, "A1:E1", headers);

      // Data Rows
      const rows = plan.daily.map(t => [
        t.task,
        t.time || "不限",
        t.units || 1,
        t.done ? "✓ 已完成 COMPLETE" : "☐ 待执行 PENDING",
        new Date().toLocaleString('zh-CN')
      ]);

      await appendSpreadsheetValues(googleToken, spreadsheet.spreadsheetId, `A2:E${rows.length + 1}`, rows);
      
      const sheetUrl = spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`;
      setCreatedSheets(prev => [{ id: spreadsheet.spreadsheetId, title: sheetTitle, url: sheetUrl }, ...prev]);
      setSheetExportStatus("✅ 进化数据表已成功建立并完成初始映射！");

      const confirmOpen = window.confirm(`进度表《${sheetTitle}》已保存在您的谷歌云盘！\n是否立即在新窗口中打开它？`);
      if (confirmOpen) {
        window.open(sheetUrl, '_blank');
      }
    } catch (err: any) {
      console.error(err);
      setSheetExportStatus(`❌ 导出失败: ${err.message || err}`);
    } finally {
      setIsWidgetLoading(false);
      setTimeout(() => setSheetExportStatus(''), 4500);
    }
  };

  const handleAddHoursRowToSheets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken || createdSheets.length === 0 || !newSheetLogContent.trim()) {
      alert("请先创建或选择一个活动进度表表格，并输入日志内容！");
      return;
    }

    const currentSheet = createdSheets[0]; // Use the most recently created sheet
    const confirmed = window.confirm(`您确定要向 Google Sheet《${currentSheet.title}》追加一条学习日志与专注时长记录吗？`);
    if (!confirmed) return;

    setIsWidgetLoading(true);
    setSheetExportStatus("🖋️ 正在向 Google Sheets 追加日志数据...");
    try {
      const logRows = [[
        `专注心得: ${newSheetLogContent.trim()}`,
        "自主记录",
        1, // Log unit
        `✓ 已记录 (${newSheetLogMins} 分钟)`,
        new Date().toLocaleString('zh-CN')
      ]];

      await appendSpreadsheetValues(googleToken, currentSheet.id, "A2", logRows);
      setSheetExportStatus("✅ 学习心得与耗时已追加并在 Google Sheet 安全落盘！");
      setNewSheetLogContent('');
    } catch (err: any) {
      console.error(err);
      alert(`向 Google Sheets 追加日志失败: ${err.message}`);
    } finally {
      setIsWidgetLoading(false);
      setTimeout(() => setSheetExportStatus(''), 4500);
    }
  };

  /**
   * Action: Google Forms Exporter
   */
  const handleCreateEvaluationForm = async () => {
    if (!googleToken) return;
    setIsWidgetLoading(true);
    setFormCreateStatus("🏗️ 正在向 Google Form 递交表单骨架与路由调配...");
    try {
      const formTitle = `SILI 【${plan.goal.substring(0, 20)}】进度自测与深度反馈表`;
      const form = await createGoogleForm(googleToken, formTitle);

      setFormCreateStatus("🖋️ 正在生成复盘问卷多维度指标并进行批量注入 (batchUpdate)...");
      const questions = [
        {
          title: "您对于近来在这一目标上的每日进展感到满意吗？",
          options: ["1. 非常不满意", "2. 部分不满意", "3. 一般般", "4. 较为满意", "5. 每天都有极大收获，极度满意"]
        },
        {
          title: "目前在推进微观突触打卡任务时，面临最大的卡点或瓶颈是什么？",
        },
        {
          title: "下一步最想加强哪一方面的专业训练，以加速突破？",
          options: ["理论深度理解 (Theory)", "实战代码打磨 (Code)", "宏观航线调整 (Milestones)", "增加专注时长 (Focus)", "向AI寻求精简例子 (Examples)"]
        },
        {
          title: "请写下任何您对学习方案的纠偏建议，或您希望 SILI 陪伴您做出的改变："
        }
      ];

      await addQuestionsToGoogleForm(googleToken, form.formId, questions);
      
      const responderUri = form.responderUri;
      setCreatedForms(prev => [{ id: form.formId, title: formTitle, responderUri }, ...prev]);
      setFormCreateStatus("✅ 自测问卷已成功发布并激活响应收集接口！");

      const confirmOpen = window.confirm(`评估反馈表《${formTitle}》架设成功！已经自动与您的谷歌账号表单无缝挂接。\n是否现在就在新窗口中打开表单进行模拟评估与答题？`);
      if (confirmOpen) {
        window.open(responderUri, '_blank');
      }
    } catch (err: any) {
      console.error(err);
      setFormCreateStatus(`❌ 表单创建失败: ${err.message || err}`);
    } finally {
      setIsWidgetLoading(false);
      setTimeout(() => setFormCreateStatus(''), 4500);
    }
  };

  /**
   * Action: Google Chat Alert Messages
   */
  const handleSendChatAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken || !selectedSpaceName || !chatMessageText.trim()) return;

    setIsWidgetLoading(true);
    setWidgetStatusMsg("💬 正在将电波发往 Google Chat 空间...");
    try {
      await sendChatMessage(googleToken, selectedSpaceName, chatMessageText.trim());
      setWidgetStatusMsg("✅ 消息已安全送达 Google Chat！");
      setChatMessageText('');
      setTimeout(() => setWidgetStatusMsg(''), 4500);
    } catch (err: any) {
      console.error(err);
      alert(`通知发送失败: ${err.message || err}`);
    } finally {
      setIsWidgetLoading(false);
    }
  };

  const handleSendFullProgressAlert = async () => {
    if (!googleToken || !selectedSpaceName) return;
    const progressPercent = Math.round((stats.completedUnits / (stats.totalUnits || 1)) * 100);
    const alertText = `🚨 SILI 学习进程报告：\n命题【${plan.goal}】已完成 ${progressPercent}% 打卡突触！合计已积累专注时间: ${stats.totalTimeMinutes} 分钟。SILI 陪伴在身边，继续加油！`;
    
    setIsWidgetLoading(true);
    setWidgetStatusMsg("💬 正在广播整体进度折线消息...");
    try {
      await sendChatMessage(googleToken, selectedSpaceName, alertText);
      setWidgetStatusMsg("✅ 进度卡片已广播至 Chat 频道！");
      setTimeout(() => setWidgetStatusMsg(''), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`广播失败: ${err.message}`);
    } finally {
      setIsWidgetLoading(false);
    }
  };

  /**
   * Action: Keep Sticky Board Actions (Local Engine)
   */
  const handleAddKeepNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStickyContent.trim()) return;

    const newNote = {
      id: Date.now().toString(),
      title: newStickyTitle.trim() || '💡 便签',
      content: newStickyContent.trim(),
      color: selectedStickyColor,
      pinned: false
    };

    setKeepNotes([newNote, ...keepNotes]);
    setNewStickyTitle('');
    setNewStickyContent('');
  };

  const handleTogglePinKeepNote = (id: string) => {
    setKeepNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  const handleDeleteKeepNote = (id: string) => {
    const confirmed = window.confirm("确定要永久撕下该张学习便签吗？此操作无法撤销。");
    if (!confirmed) return;
    setKeepNotes(prev => prev.filter(n => n.id !== id));
  };

  // Keep Notes Search filtration
  const filteredKeepNotes = useMemo(() => {
    const query = keepNotesSearch.toLowerCase();
    const list = keepNotes.filter(n => 
      n.title.toLowerCase().includes(query) || 
      n.content.toLowerCase().includes(query)
    );
    // Sort so pinned are on top
    return [...list].sort((a,b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
  }, [keepNotes, keepNotesSearch]);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full overflow-hidden">
      
      {/* LEFT COLUMN: STATS, TIMELINE, GOOGLE WORKSPACE SYSTEM INTEGRATION CENTER */}
      <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
        <h3 className="text-[15px] font-bold tracking-tight text-white flex items-center gap-2 sticky top-0 bg-black/90 backdrop-blur-xl py-3 z-10">
          <i className="fas fa-map-marked-alt text-apple-blue"></i>
          宏观进化航线：{plan.goal}
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#1c1c1e] border border-white/5 p-4 rounded-xl text-center shadow">
            <div className="text-[9px] text-zinc-500 font-extrabold tracking-wider mb-1 uppercase">预测分配</div>
            <div className="text-xl font-bold font-mono text-apple-blue">{stats.totalUnits}</div>
          </div>
          <div className="bg-[#1c1c1e] border border-white/5 p-4 rounded-xl text-center shadow">
            <div className="text-[9px] text-zinc-500 font-extrabold tracking-wider mb-1 uppercase">已达单位</div>
            <div className="text-xl font-bold font-mono text-apple-green">{stats.completedUnits}</div>
          </div>
          <div className="bg-[#1c1c1e] border border-white/5 p-4 rounded-xl text-center shadow">
            <div className="text-[9px] text-zinc-500 font-extrabold tracking-wider mb-1 uppercase">计入时数</div>
            <div className="text-xs font-bold font-mono text-apple-purple mt-1.5">{Math.floor(stats.totalTimeMinutes / 60)}h {stats.totalTimeMinutes % 60}m</div>
          </div>
        </div>

        {/* INTEGRATED OFFICE SUITE CONTAINER */}
        <div className="bg-[#1c1c1e] border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden transition-all duration-300">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                <i className="fas fa-network-wired text-apple-blue text-xs"></i>
                Google Workspace 智能全栈
              </h4>
              <p className="text-[10px] text-zinc-500 mt-0.5">多驱协同：管理 Tasks/日历/Docs文库/Sheets表格/Forms表单与知识板</p>
            </div>
            {user && (
              <div className="flex items-center gap-2 shrink-0">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Google Avatar" className="w-5 h-5 rounded-full border border-white/10" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-5 h-5 bg-apple-blue/20 rounded-full flex items-center justify-center text-[9px] font-bold text-apple-blue"><i className="fas fa-user text-[8px]"></i></div>
                )}
                <span className="text-[10px] text-zinc-300 font-medium truncate max-w-[80px] hidden sm:inline-block">{user.displayName}</span>
                <button id="signout-btn" onClick={onGoogleSignOut} className="text-[9px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 px-2 py-0.5 rounded transition">退出</button>
              </div>
            )}
          </div>

          {!user ? (
            <div className="py-2 space-y-3">
              <p className="text-[11px] text-zinc-400 leading-relaxed font-normal">
                通过授权，SILI 可以在云端为你激活 Google Tasks 智能打卡、Google Calendar 自动排程、Google Docs 深度笔记本转录、Google Sheets 数据表、Google Forms 评估表单，以及 Google Chat 团队广播提醒！
              </p>
              
              <button
                id="g-signin-btn"
                onClick={onGoogleSignIn}
                className="inline-flex items-center gap-3 bg-white hover:bg-zinc-100 text-[#1f1f1f] text-xs font-bold px-4 py-2.5 rounded-xl transition duration-200 shadow active:scale-95 border border-zinc-200"
              >
                <div className="w-4.5 h-4.5 flex items-center justify-center shrink-0">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-full h-full">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="text-xs font-semibold tracking-tight">授权关联 Google 办公系列服务</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* FIVE CHANNEL MAIN TABS */}
              <div className="flex bg-black/40 p-1 rounded-xl gap-1 overflow-x-auto text-[10px] md:text-xs">
                {[
                  { id: 'tasks', label: 'Tasks 任务', icon: 'fa-tasks' },
                  { id: 'calendar', label: '日历', icon: 'fa-calendar-alt' },
                  { id: 'docs', label: 'Docs 文档', icon: 'fa-file-alt' },
                  { id: 'sheets', label: 'Sheets 表格', icon: 'fa-table' },
                  { id: 'forms', label: 'Forms 表单', icon: 'fa-poll' },
                  { id: 'chat', label: 'Chat', icon: 'fa-comment-alt' },
                  { id: 'keep', label: 'Keep 便签', icon: 'fa-thumbtack' }
                ].map((channelTab) => {
                  const isActive = activeIntegrationChannel === channelTab.id;
                  return (
                    <button
                      key={channelTab.id}
                      onClick={() => setActiveIntegrationChannel(channelTab.id as any)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg font-bold transition whitespace-nowrap ${
                        isActive 
                          ? 'bg-apple-blue/15 text-apple-blue text-white shadow-sm border border-apple-blue/10' 
                          : 'text-zinc-400 hover:text-white hover:bg-white/[0.02]'
                      }`}
                    >
                      <i className={`fas ${channelTab.icon} text-[10px]`}></i>
                      {channelTab.label}
                    </button>
                  );
                })}
              </div>

              {/* Loader Line indicator */}
              {isWidgetLoading && (
                <div className="flex items-center gap-2 py-0.5 text-[9px] text-zinc-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-apple-blue animate-ping"></span>
                  <span>云端网关正在接入，传输数据中...</span>
                </div>
              )}

              {/* Status Message Line */}
              {widgetStatusMsg && (
                <div className="text-[10px] bg-white/[0.03] px-3 py-2 rounded-lg text-zinc-300 font-mono border border-white/5">
                  {widgetStatusMsg}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* CH 1: GOOGLE TASKS PANE */}
              {activeIntegrationChannel === 'tasks' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex border-b border-white/5 pb-1 gap-4 text-xs font-bold tracking-tight">
                    <button 
                      onClick={() => setActiveWidgetTab('sync')} 
                      className={`pb-1 border-b-2 transition-all ${activeWidgetTab === 'sync' ? 'border-apple-blue text-white' : 'border-transparent text-zinc-500'}`}
                    >
                      智能规划同步
                    </button>
                    <button 
                      onClick={() => setActiveWidgetTab('browser')} 
                      className={`pb-1 border-b-2 transition-all ${activeWidgetTab === 'browser' ? 'border-apple-blue text-white' : 'border-transparent text-zinc-500'}`}
                    >
                      云端任务浏览器
                    </button>
                  </div>

                  {activeWidgetTab === 'sync' ? (
                    <div className="space-y-3">
                      <p className="text-[10px] text-zinc-400 leading-relaxed font-normal">
                        系统自动映射。拉取 Google 任务列表云端并在云端映射当前微观进化计划：
                      </p>
                      
                      <div className="bg-black/20 p-3 rounded-xl border border-white/[0.02] flex justify-between items-center text-[11px]">
                        <div className="space-y-1">
                          <div className="font-semibold text-zinc-300">目标列表</div>
                          <div className="font-mono text-zinc-500 leading-none">SILI: {plan.goal.substring(0, 25)}...</div>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="font-semibold text-apple-blue">已链接进度</div>
                          <div className="font-mono text-zinc-400">{stats.syncedCount} / {stats.totalUnits} 颗微突触</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={handlePushSync}
                          disabled={isWidgetLoading}
                          className="px-3.5 py-2.5 bg-apple-blue hover:bg-[#409cff] text-white disabled:opacity-40 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow"
                        >
                          <i className="fas fa-cloud-upload-alt text-[11px]"></i>
                          一键同步至 Google Tasks
                        </button>
                        <button
                          onClick={handlePullSync}
                          disabled={isWidgetLoading}
                          className="px-3.5 py-2.5 bg-[#2c2c2e] hover:bg-[#323236] text-zinc-300 disabled:opacity-40 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-white/5"
                        >
                          <i className="fas fa-cloud-download-alt text-[11px]"></i>
                          从云端校验状态 (Pull)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">选择 Google Tasks 列表</label>
                        <select
                          value={selectedListId}
                          onChange={(e) => setSelectedListId(e.target.value)}
                          className="bg-[#2c2c2e] text-zinc-200 border border-white/5 px-2.5 py-1.5 rounded-lg text-[11px] focus:outline-none focus:border-apple-blue"
                        >
                          {taskLists.map(list => (
                            <option key={list.id} value={list.id}>{list.title}</option>
                          ))}
                        </select>
                      </div>

                      <form onSubmit={handleCreateBrowserTask} className="flex gap-2">
                        <input
                          type="text"
                          value={newBrowserTaskText}
                          onChange={(e) => setNewBrowserTaskText(e.target.value)}
                          placeholder="键入云端随笔打卡条目..."
                          className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-apple-blue/50"
                        />
                        <button
                          type="submit"
                          disabled={isWidgetLoading || !newBrowserTaskText.trim()}
                          className="px-3 py-2 bg-white hover:bg-zinc-200 text-black font-bold disabled:opacity-40 rounded-xl text-xs shrink-0 flex items-center gap-1"
                        >
                          <i className="fas fa-plus text-[9px]"></i> 创建
                        </button>
                      </form>

                      <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {browserTasks.length === 0 ? (
                          <div className="text-center py-6 text-[10px] text-zinc-500 font-mono">
                            该任务清单中尚未检索到任何条目
                          </div>
                        ) : (
                          browserTasks.map(bt => (
                            <div 
                              key={bt.id} 
                              className="flex items-center justify-between p-2.5 bg-black/25 rounded-xl border border-white/[0.02] hover:border-zinc-800 transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleBrowserTask(bt)}
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition shrink-0 ${
                                    bt.status === 'completed' 
                                      ? 'bg-apple-blue border-apple-blue text-white' 
                                      : 'border-zinc-650 hover:border-apple-blue'
                                  }`}
                                >
                                  {bt.status === 'completed' && <i className="fas fa-check text-[9px]"></i>}
                                </button>
                                <span className={`text-[11px] font-medium leading-none truncate ${bt.status === 'completed' ? 'text-zinc-500 line-through' : 'text-zinc-250'}`}>
                                  {bt.title}
                                </span>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => handleDeleteBrowserTask(bt.id)}
                                className="text-zinc-600 hover:text-red-400 p-1 rounded hover:bg-white/[0.04] transition"
                              >
                                <i className="fas fa-trash-alt text-[10px]"></i>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* CH 2: GOOGLE CALENDAR PANE */}
              {activeIntegrationChannel === 'calendar' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-white/5">
                    <div>
                      <h5 className="text-[11px] font-bold text-zinc-300">📅 选择同步的 Google 日历栏目</h5>
                      <p className="text-[9px] text-zinc-500">将微任务派发为 30 分钟的学习日程</p>
                    </div>
                    <select
                      value={selectedCalendarId}
                      onChange={(e) => setSelectedCalendarId(e.target.value)}
                      className="bg-[#2c2c2e] text-zinc-200 border border-white/5 px-2.5 py-1 rounded-lg text-[11px] focus:outline-none focus:border-apple-blue font-semibold"
                    >
                      {calendars.map(cal => (
                        <option key={cal.id} value={cal.id}>{cal.summary} {cal.primary ? '(主)' : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Calendar Scheduled Events List */}
                  <div>
                    <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
                      <span>今日及未来 Google 日历日程 </span>
                      <button 
                        onClick={loadCalendarEvents}
                        className="text-apple-blue hover:underline flex items-center gap-1 font-semibold"
                      >
                        <i className="fas fa-sync text-[8px]"></i> 刷新
                      </button>
                    </div>

                    <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {calendarEvents.length === 0 ? (
                        <div className="text-center py-6 text-[10px] text-zinc-500 font-mono border border-dashed border-white/5 rounded-xl bg-black/10">
                          本计划尚未拉取到今日未来的日历预约。请在微观任务单后面点击日历加号（📅+）进行排程。
                        </div>
                      ) : (
                        calendarEvents.map(evt => {
                          const dateObj = new Date(evt.start.dateTime || evt.start.date || '');
                          const timeStr = dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                          const dateStr = dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
                          
                          return (
                            <div 
                              key={evt.id} 
                              className="flex items-center justify-between p-2.5 bg-black/25 rounded-xl border border-white/[0.02] hover:border-zinc-800 transition"
                            >
                              <div className="min-w-0 flex items-start gap-2.5">
                                <div className="text-center bg-apple-blue/10 px-2 py-1 rounded border border-apple-blue/15 scale-95 origin-top-left">
                                  <div className="text-[8px] text-zinc-500 font-bold leading-none uppercase">{dateStr}</div>
                                  <div className="text-[10px] text-apple-blue font-bold font-mono mt-0.5 leading-none">{timeStr}</div>
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[11px] font-semibold text-zinc-200 block truncate leading-tight">
                                    {evt.summary}
                                  </span>
                                  {evt.description && (
                                    <span className="text-[9px] text-zinc-650 block truncate">
                                      {evt.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1 shrink-0">
                                {evt.htmlLink && (
                                  <a 
                                    href={evt.htmlLink} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="p-1.5 text-zinc-600 hover:text-white rounded hover:bg-white/[0.04] transition"
                                    title="在 Google Calendar Web 端打开"
                                  >
                                    <i className="fas fa-external-link-alt text-[9px]"></i>
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCalendarEvent(evt.id)}
                                  className="text-zinc-600 hover:text-red-400 p-1 rounded hover:bg-white/[0.04] transition"
                                  title="从日历里永久移除日程"
                                >
                                  <i className="fas fa-trash-alt text-[10px]"></i>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* CH 3: GOOGLE DOCS PANE */}
              {activeIntegrationChannel === 'docs' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-black/20 p-4 border border-white/5 rounded-xl space-y-2">
                    <h5 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fas fa-file-invoice text-apple-blue"></i>
                      智能脑波笔记本转录 (Docs 导出器)
                    </h5>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      一键快速建立并将当前的宏观战略里程、微日志完成比例以及突触统计，渲染为一篇逻辑清晰排版优雅的 Google Docs 文件存放在主云盘！
                    </p>

                    {docExportStatus && (
                      <div className="text-[9px] bg-apple-blue/5 border border-apple-blue/20 text-zinc-300 p-2.5 rounded-lg font-mono leading-relaxed">
                        {docExportStatus}
                      </div>
                    )}

                    <button
                      onClick={handleExportToGoogleDocs}
                      disabled={isWidgetLoading}
                      className="w-full py-2.5 bg-gradient-to-r from-[#2f80ed] to-[#00d2ff] hover:brightness-110 active:scale-95 transition-all text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
                    >
                      <i className="fas fa-cloud-upload-alt text-[11px]"></i>
                      一键向 Google Docs 转发布置当前的大脑报告
                    </button>
                  </div>

                  {/* Recently Exported files */}
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">最近建立的 Docs 列表</span>
                    <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 mt-1.5 custom-scrollbar">
                      {createdDocs.length === 0 ? (
                        <div className="text-center py-5 text-[10px] text-zinc-500 font-mono">
                          目前本地暂无从 SILI 导出至 Docs 的记录条目
                        </div>
                      ) : (
                        createdDocs.map(docItem => (
                          <div 
                            key={docItem.id} 
                            className="flex items-center justify-between p-2 bg-black/25 rounded-lg border border-white/[0.02]"
                          >
                            <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[220px]">
                              📝 {docItem.title}
                            </span>
                            <div className="flex gap-2">
                              <a 
                                href={docItem.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[9px] bg-white/5 hover:bg-white/10 text-zinc-300 px-2 py-1 rounded transition border border-white/5 flex items-center gap-1 font-semibold"
                              >
                                打开 <i className="fas fa-external-link-alt text-[8px]"></i>
                              </a>
                              <button
                                onClick={() => {
                                  const confirmed = window.confirm("确定要在本地历史记录中删除此篇 Docs 指引吗？(不会影响云端实体文档)");
                                  if (confirmed) {
                                    setCreatedDocs(prev => prev.filter(d => d.id !== docItem.id));
                                  }
                                }}
                                className="text-zinc-650 hover:text-red-400 p-1 transition"
                              >
                                <i className="fas fa-times text-[10px]"></i>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* CH 3b: GOOGLE SHEETS PANE */}
              {activeIntegrationChannel === 'sheets' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-black/20 p-4 border border-white/5 rounded-xl space-y-3">
                    <h5 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fas fa-table text-emerald-500"></i>
                      Google Sheets 学习数据与专注流同步器
                    </h5>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      将当前进化计划中的核心数据投递并创建成电子表格。你也可以在下方记录今日的学习日志、专注耗时并一键追加到电子表格中。
                    </p>

                    {sheetExportStatus && (
                      <div className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-zinc-350 p-2.5 rounded-lg font-mono leading-relaxed">
                        {sheetExportStatus}
                      </div>
                    )}

                    <button
                      onClick={handleExportToGoogleSheets}
                      disabled={isWidgetLoading}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 active:scale-95 transition-all text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
                    >
                      <i className="fas fa-file-excel text-[11px]"></i>
                      一键同步当前计划至 Google Sheets
                    </button>
                  </div>

                  {createdSheets.length > 0 && (
                    <form onSubmit={handleAddHoursRowToSheets} className="bg-black/20 p-4 border border-white/5 rounded-xl space-y-3">
                      <h6 className="text-[10px] font-bold text-zinc-350 tracking-wider uppercase flex items-center gap-1">
                        <i className="fas fa-edit text-emerald-400"></i>
                        追加自主专注日志 (Append Log Row to Sheets)
                      </h6>
                      <div className="space-y-2">
                        <div>
                          <label className="block text-[9px] text-zinc-500 font-bold mb-1">今日的心得/专注主题</label>
                          <input
                            type="text"
                            value={newSheetLogContent}
                            onChange={(e) => setNewSheetLogContent(e.target.value)}
                            placeholder="例如：完成了第二阶段的后端 API 边界单元测试..."
                            className="w-full bg-[#1c1c1e] text-xs border border-white/5 rounded-lg px-2.5 py-1.5 text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-emerald-500"
                            required
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="block text-[9px] text-zinc-500 font-bold mb-1">累计专注时值 (分钟)</label>
                            <input
                              type="number"
                              min="5"
                              max="480"
                              value={newSheetLogMins}
                              onChange={(e) => setNewSheetLogMins(parseInt(e.target.value) || 30)}
                              className="w-full bg-[#1c1c1e] text-xs border border-white/5 rounded-lg px-2.5 py-1.5 text-zinc-200 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                          <div className="pt-4">
                            <button
                              type="submit"
                              disabled={isWidgetLoading}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition active:scale-95 shadow disabled:opacity-40"
                            >
                              追加到表格
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* Recently Exported sheets */}
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">最近建立的 Sheets 表格</span>
                    <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 mt-1.5 custom-scrollbar">
                      {createdSheets.length === 0 ? (
                        <div className="text-center py-5 text-[10px] text-zinc-500 font-mono">
                          目前本地暂无从 SILI 导出至 Sheets 表格的记录条目
                        </div>
                      ) : (
                        createdSheets.map(sheetItem => (
                          <div 
                            key={sheetItem.id} 
                            className="flex items-center justify-between p-2 bg-black/25 rounded-lg border border-white/[0.02]"
                          >
                            <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[210px]">
                              📊 {sheetItem.title}
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              <a 
                                href={sheetItem.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[9px] bg-white/5 hover:bg-white/10 text-emerald-400 hover:text-emerald-300 px-2.5 py-1 rounded transition border border-white/5 flex items-center gap-1 font-bold"
                              >
                                浏览表格 <i className="fas fa-external-link-alt text-[8px]"></i>
                              </a>
                              <button
                                onClick={() => {
                                  const confirmed = window.confirm("确定要在本地历史记录中删除此 Sheets 数据表格吗？(不会影响云端实体表格)");
                                  if (confirmed) {
                                    setCreatedSheets(prev => prev.filter(d => d.id !== sheetItem.id));
                                  }
                                }}
                                className="text-zinc-600 hover:text-red-400 p-1.5 transition"
                              >
                                <i className="fas fa-times text-[10px]"></i>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* CH 3c: GOOGLE FORMS PANE */}
              {activeIntegrationChannel === 'forms' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-black/20 p-4 border border-white/5 rounded-xl space-y-2">
                    <h5 className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fas fa-poll text-indigo-400"></i>
                      Google Forms 自测与效能评估表生成器
                    </h5>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      运用 Google Forms API，一键云端生成与当前进化目标深度挂钩的学习复盘问卷。包含满意度评价、阻碍困难收集、后续加强训练方向分析等维度。
                    </p>

                    {formCreateStatus && (
                      <div className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-zinc-350 p-2.5 rounded-lg font-mono leading-relaxed">
                        {formCreateStatus}
                      </div>
                    )}

                    <button
                      onClick={handleCreateEvaluationForm}
                      disabled={isWidgetLoading}
                      className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-[#5f5ce5] hover:brightness-110 active:scale-95 transition-all text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
                    >
                      <i className="fas fa-poll-h text-[11px]"></i>
                      一键云端架设阶段进度评估表
                    </button>
                  </div>

                  {/* Recently Exported forms */}
                  <div>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">最近建立的 Google 评估表单</span>
                    <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 mt-1.5 custom-scrollbar">
                      {createdForms.length === 0 ? (
                        <div className="text-center py-5 text-[10px] text-zinc-500 font-mono">
                          目前本地暂无从 SILI 导出至 Forms 评估表单的记录条目
                        </div>
                      ) : (
                        createdForms.map(formItem => (
                          <div 
                            key={formItem.id} 
                            className="flex items-center justify-between p-2 bg-black/25 rounded-lg border border-white/[0.02]"
                          >
                            <span className="text-[11px] font-medium text-zinc-300 truncate max-w-[210px]">
                              📝 {formItem.title}
                            </span>
                            <div className="flex gap-1.5 shrink-0">
                              <a 
                                href={formItem.responderUri} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[9px] bg-white/5 hover:bg-white/10 text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded transition border border-white/5 flex items-center gap-1 font-bold"
                              >
                                打开问卷 <i className="fas fa-external-link-alt text-[8px]"></i>
                              </a>
                              <button
                                onClick={() => {
                                  const confirmed = window.confirm("确定要在本地历史记录中删除此表单吗？(不会影响云端表单)");
                                  if (confirmed) {
                                    setCreatedForms(prev => prev.filter(f => f.id !== formItem.id));
                                  }
                                }}
                                className="text-zinc-650 hover:text-red-400 p-1.5 transition"
                              >
                                <i className="fas fa-times text-[10px]"></i>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* CH 4: GOOGLE CHAT MESSAGE BROADCAST PANE */}
              {activeIntegrationChannel === 'chat' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-white/5">
                    <div>
                      <h5 className="text-[11px] font-bold text-zinc-300">💬 选择推送消息的 Google Chat</h5>
                      <p className="text-[9px] text-zinc-500">将日常学习进展发送至选定的聊天群聊或空间</p>
                    </div>
                    {chatSpaces.length > 0 ? (
                      <select
                        value={selectedSpaceName}
                        onChange={(e) => setSelectedSpaceName(e.target.value)}
                        className="bg-[#2c2c2e] text-zinc-200 border border-white/5 px-2.5 py-1 rounded-lg text-[11px] focus:outline-none focus:border-apple-blue font-semibold max-w-[200px]"
                      >
                        {chatSpaces.map(sp => (
                          <option key={sp.name} value={sp.name}>{sp.displayName} ({sp.type === 'ROOM' ? '室' : '企'})</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[10px] text-zinc-600 font-bold font-mono">未检索到聊天空间 </span>
                    )}
                  </div>

                  <form onSubmit={handleSendChatAlert} className="space-y-2.5">
                    <textarea
                      value={chatMessageText}
                      onChange={(e) => setChatMessageText(e.target.value)}
                      placeholder="发送你当前的打卡感悟或复盘至 Google Chat..."
                      rows={2}
                      maxLength={400}
                      className="w-full bg-black/40 border border-white/5 rounded-xl p-3 text-xs text-zinc-200 focus:outline-none focus:border-apple-blue/50 placeholder-zinc-600 resize-none font-sans"
                    />

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isWidgetLoading || !chatMessageText.trim() || !selectedSpaceName}
                        className="flex-1 py-1.5 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl transition duration-200 shadow disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        <i className="fas fa-paper-plane text-[9px]"></i> 投发当前消息到 Chat
                      </button>
                      <button
                        type="button"
                        onClick={handleSendFullProgressAlert}
                        disabled={isWidgetLoading || !selectedSpaceName}
                        className="px-3.5 py-1.5 bg-[#2c2c2e] hover:bg-[#323236] text-zinc-300 font-bold text-xs rounded-xl border border-white/5 transition flex items-center gap-1"
                        title="广播本计划打卡进度报告"
                      >
                        <i className="fas fa-chart-line"></i> 广播进度报告
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* CH 5: GOOGLE KEEP COGNITIVE STICKY BOARD PANE */}
              {activeIntegrationChannel === 'keep' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-orange-500/10 border border-orange-500/15 p-2 rounded-xl">
                    <p className="text-[8px] text-orange-400 font-semibold leading-relaxed leading-tight text-center">
                      📌 提示：由于消费者个人 Gmail 账号不受 GCP 团队开放 Keep API 的直接授权，SILI 已自动为您安全降级为“本地精装 Keep 便签板”（基于 LocalStorage 极速闪存记录，并保留全功能）。
                    </p>
                  </div>

                  {/* Add sticky notes form */}
                  <form onSubmit={handleAddKeepNote} className="bg-black/20 p-2.5 rounded-xl border border-white/[0.02] space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newStickyTitle}
                        onChange={(e) => setNewStickyTitle(e.target.value)}
                        placeholder="便签标题 (选填)"
                        className="flex-1 bg-black/40 border border-white/5 rounded-lg px-2.5 py-1 text-[11px] text-zinc-200 focus:outline-none focus:border-apple-blue"
                      />
                      <div className="flex items-center gap-1">
                        {[
                          { value: '#fef08a', colorClass: 'bg-yellow-200' },
                          { value: '#bbf7d0', colorClass: 'bg-green-200' },
                          { value: '#bfdbfe', colorClass: 'bg-blue-200' },
                          { value: '#e9d5ff', colorClass: 'bg-purple-200' },
                          { value: '#fecaca', colorClass: 'bg-red-200' }
                        ].map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setSelectedStickyColor(c.value)}
                            className={`w-3.5 h-3.5 rounded-full ${c.colorClass} border transition-all ${selectedStickyColor === c.value ? 'scale-125 border-white ring-1 ring-white/20' : 'border-transparent'}`}
                          ></button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <textarea
                        value={newStickyContent}
                        onChange={(e) => setNewStickyContent(e.target.value)}
                        placeholder="快写写学习心得或要点..."
                        rows={2}
                        className="flex-1 bg-black/40 border border-white/5 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-apple-blue placeholder-zinc-650 resize-none font-sans"
                      />
                      <button
                        type="submit"
                        disabled={!newStickyContent.trim()}
                        className="px-3.5 py-2 bg-white hover:bg-zinc-200 text-black font-bold text-xs rounded-xl disabled:opacity-40 transition self-end flex items-center justify-center"
                      >
                        <i className="fas fa-thumbtack text-[10px]"></i>
                      </button>
                    </div>
                  </form>

                  {/* Keep Board Notes search */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={keepNotesSearch}
                      onChange={(e) => setKeepNotesSearch(e.target.value)}
                      placeholder="🔍 搜索保存的 Keep 便签..."
                      className="w-full bg-black/35 border border-white/5 rounded-lg px-2.5 py-1 text-[10px] text-zinc-300 focus:outline-none focus:border-apple-blue"
                    />
                    {keepNotesSearch && (
                      <button 
                        onClick={() => setKeepNotesSearch('')}
                        className="text-zinc-500 hover:text-white text-[10px] shrink-0"
                      >
                        重置
                      </button>
                    )}
                  </div>

                  {/* Search / Render grid of stickies */}
                  <div className="grid grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1 mt-2 custom-scrollbar">
                    {filteredKeepNotes.length === 0 ? (
                      <div className="col-span-2 text-center py-6 text-[10px] text-zinc-500 font-mono">
                        没有检索或保存过匹配的 Keep 便签卡片
                      </div>
                    ) : (
                      filteredKeepNotes.map(note => (
                        <div
                          key={note.id}
                          style={{ backgroundColor: note.color }}
                          className="p-3.5 rounded-xl text-black border border-black/10 relative shadow transition flex flex-col justify-between group hover:shadow-lg"
                        >
                          <div>
                            <span className="text-[11px] font-bold block mb-1 leading-tight tracking-tight pr-5">
                              {note.title}
                            </span>
                            <p className="text-[10px] leading-relaxed whitespace-pre-wrap select-text selection:bg-black/15">
                              {note.content}
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-3 border-t border-black/5 pt-2">
                            <button
                              onClick={() => handleTogglePinKeepNote(note.id)}
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition ${note.pinned ? 'bg-black/10 text-black' : 'text-black/50 hover:text-black hover:bg-black/5'}`}
                              title={note.pinned ? "取消置顶" : "置顶便签"}
                            >
                              <i className="fas fa-thumbtack"></i>
                            </button>
                            <button
                              onClick={() => handleDeleteKeepNote(note.id)}
                              className="text-black/45 hover:text-red-700 p-0.5 text-[9px] transition opacity-0 group-hover:opacity-100"
                              title="永久撕除便签"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timeline representation (months + milestones) */}
        <div className="relative border-l border-zinc-800 ml-3 pl-6 space-y-8 py-2">
          {plan.macro.map((m, idx) => (
            <div key={idx} className="relative">
              <div className="absolute -left-[28.5px] top-1 w-[8px] h-[8px] rounded-full bg-apple-blue shadow-[0_0_8px_rgba(10,132,255,0.7)] border border-black"></div>
              <h4 className="text-sm font-bold text-zinc-200 mb-2 tracking-tight">{m.month}</h4>
              <ul className="space-y-1.5 ms-0.5">
                {m.milestones.map((ms, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-zinc-400 leading-normal group">
                    <i className="fas fa-circle text-[4px] mt-2 text-zinc-600 group-hover:text-apple-blue transition-colors duration-200"></i>
                    <span>{ms}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT COLUMN: DAILY CHECKLIST, POMODORO TIMER, REWARD BAR */}
      <div className="bg-[#1c1c1e]/40 border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="mb-6">
          <h3 className="text-sm font-bold tracking-tight text-white flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-2">
              <i className="fas fa-bolt text-apple-yellow"></i>
              微观落实任务单
            </span>
            <span className="text-[9px] bg-apple-blue/10 text-apple-blue px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-apple-blue/15">
              待执行 {stats.remainingUnits} 周期
            </span>
          </h3>
          <p className="text-[11px] text-zinc-500 leading-normal">点击开启内置番茄计时。每个学习周期持续30分钟，深度锻炼绝对专注力。</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
          {plan.daily.map(task => (
            <TaskItem 
              key={task.id} 
              task={task} 
              onToggle={onToggleTask} 
              onStartTimer={handleStartTimer} 
              formatTime={formatTime} 
              onScheduleToCalendar={handleScheduleTaskOnCalendar}
              googleToken={googleToken}
            />
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-white/5">
          <div className="flex justify-between text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">
            <span>日常任务打卡进度 (Evolution Metric)</span>
            <span className="text-apple-blue font-mono">{Math.round((stats.completedUnits / (stats.totalUnits || 1)) * 100)}%</span>
          </div>
          <div className="h-[4px] w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-apple-blue via-apple-purple to-apple-green transition-all duration-[800ms] ease-out" 
              style={{ width: `${(stats.completedUnits / (stats.totalUnits || 1)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};
