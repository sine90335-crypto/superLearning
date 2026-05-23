import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Note } from "../types";

interface EditorProps {
  note: Note;
  onSave: (note: Note) => void;
  onGenerateCards: (content: string) => void;
  onGenerateQuiz: (content: string) => void;
  onStartDemo: (content: string) => void;
  onImport: (title: string, content: string, isPdf: boolean) => void;
  isGenerating: boolean;
}

export const Editor: React.FC<EditorProps> = ({
  note,
  onSave,
  onGenerateCards,
  onGenerateQuiz,
  onStartDemo,
  onImport,
  isGenerating,
}) => {
  const [content, setContent] = useState(note.content);
  const [title, setTitle] = useState(note.title);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [mode, setMode] = useState<"source" | "preview">("source");
  const [vaultName, setVaultName] = useState<string>(() => {
    return localStorage.getItem("sili_obsidian_vault") || "SILI_Brain";
  });
  const [showObsidianPanel, setShowObsidianPanel] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync internal state when active note changes
  useEffect(() => {
    setContent(note.content);
    setTitle(note.title);
    setSaveStatus("");
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [note]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const triggerAutoSave = (currentTitle: string, currentContent: string) => {
    setSaveStatus("自动保存中...");

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onSave({
        ...note,
        title: currentTitle,
        content: currentContent,
        updatedAt: Date.now(),
      });
      setSaveStatus("已保存");
      setLastSavedTime(new Date().toLocaleTimeString());
    }, 1000);
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    triggerAutoSave(title, newContent);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    triggerAutoSave(newTitle, content);
  };

  const handleSave = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    onSave({ ...note, title, content, updatedAt: Date.now() });
    setSaveStatus("已保存");
    setLastSavedTime(new Date().toLocaleTimeString());
  };

  const processFile = (file: File) => {
    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    const isText =
      file.type.startsWith("text/") ||
      file.name.toLowerCase().endsWith(".md") ||
      file.name.toLowerCase().endsWith(".txt");

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(",")[1];
        if (base64) onImport(fileName, base64, true);
      };
      reader.readAsDataURL(file);
    } else if (isText) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) onImport(fileName, text, false);
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(processFile);

    // Clear input so same files can be uploaded again
    if (e.target) e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full backdrop-blur-md rounded-2xl border overflow-hidden shadow-2xl" style={{ backgroundColor: "var(--glass-bg)", borderColor: "var(--border-color)" }}>
      <div
        className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 border-b backdrop-blur-xl transition-colors"
        style={{
          backgroundColor: "var(--bg-nav)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="flex-1 flex items-center min-w-0 mr-4 relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-indigo-400 transition-colors">
            <i className="fas fa-heading text-sm"></i>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="bg-transparent hover:bg-white/5 focus:bg-white/[0.08] text-lg font-bold focus:outline-none w-full text-zinc-100 placeholder-zinc-600 tracking-tight rounded-xl py-2 pl-9 pr-4 transition-all border border-transparent focus:border-white/10"
            placeholder="无标题笔记..."
          />
        </div>

        {/* Navigation & Action tools */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Render Mode Switcher */}
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mr-2">
            <button
              onClick={() => setMode("source")}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                mode === "source"
                  ? "bg-white/10 text-white shadow-sm border border-white/5"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="编辑 Markdown 源码"
            >
              <i className="fas fa-code text-[10px] mr-1"></i> 编辑源码
            </button>
            <button
              onClick={() => setMode("preview")}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                mode === "preview"
                  ? "bg-white/10 text-white shadow-sm border border-white/5"
                  : "text-zinc-500 hover:text-zinc-350"
              }`}
              title="预览 Markdown 渲染效果"
            >
              <i className="fas fa-eye text-[10px] mr-1"></i> 渲染视图
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".txt,.md,.pdf"
            multiple
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".txt,.md,.pdf"
            {...({ webkitdirectory: "true", directory: "true" } as any)}
            multiple
          />

          <button
            disabled={isGenerating}
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-zinc-300 disabled:opacity-40 rounded-xl text-xs font-semibold tracking-tight transition flex items-center gap-1.5 border border-white/5"
          >
            <i className="fas fa-file-pdf text-[#ff453a]"></i>
            导入文件
          </button>
          <button
            disabled={isGenerating}
            onClick={() => folderInputRef.current?.click()}
            className="px-3.5 py-1.5 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-zinc-300 disabled:opacity-40 rounded-xl text-xs font-semibold tracking-tight transition flex items-center gap-1.5 border border-white/5"
            title="导入包含多个学习资料的文件夹"
          >
            <i className="fas fa-folder-open text-blue-400"></i>
            导入文件夹
          </button>
          <button
            onClick={handleSave}
            className="px-3.5 py-1.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-semibold tracking-tight transition flex items-center gap-1"
          >
            <i className="fas fa-save text-[10px]"></i>保存
          </button>
          <button
            disabled={isGenerating}
            onClick={() => onStartDemo(content)}
            className="px-3.5 py-1.5 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-zinc-300 disabled:opacity-40 rounded-xl text-xs font-semibold tracking-tight transition flex items-center gap-1.5 border border-white/5"
          >
            <i className="fas fa-play-circle text-xs text-purple-400"></i>
            模拟演练
          </button>
          <button
            disabled={isGenerating}
            onClick={() => onGenerateCards(content)}
            className="px-3.5 py-1.5 bg-[#2c2c2e] hover:bg-[#3a3a3c] text-zinc-300 disabled:opacity-40 rounded-xl text-xs font-semibold tracking-tight transition flex items-center gap-1.5 border border-white/5"
          >
            <i className="fas fa-bolt text-xs text-amber-400"></i>记忆卡
          </button>
        </div>
      </div>

      {mode === "source" ? (
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="flex-1 p-6 bg-transparent resize-none focus:outline-none mono text-zinc-300 leading-relaxed text-sm selection:bg-apple-blue/20"
          placeholder="在这里输入、粘贴或拖拽导入你的学习讲义、课件或读书笔记，点击顶部的智能按钮开始强化记忆..."
        />
      ) : (
        <div className="flex-1 p-6 overflow-y-auto bg-transparent text-left markdown-renderer border-t border-white/5 bg-black/5 custom-scrollbar">
          {content ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : (
            <div className="text-center py-20 text-zinc-500 font-medium text-xs leading-relaxed space-y-2">
              <i className="fas fa-edit text-2xl text-zinc-600 block mb-2"></i>
              <p>当前笔记中尚无内容...</p>
              <p className="text-[10px] text-zinc-650">
                请切换至“编辑源码”开始勾勒您的知识脉络！
              </p>
            </div>
          )}
        </div>
      )}

      {/* Obsidian Integration Bar */}
      <div className="border-t border-white/5 bg-[#161617]/10 p-3.5 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full bg-indigo-505 animate-pulse"
              style={{ backgroundColor: "#6366f1" }}
            ></span>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <i className="fas fa-link text-indigo-400"></i> Obsidian
              知识库智连
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowObsidianPanel(!showObsidianPanel)}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 font-semibold px-2.5 py-1 rounded-lg transition-all border border-indigo-500/15"
          >
            {showObsidianPanel
              ? "收起面板 (Close Panel)"
              : "配置与导出 (Connect & Export)"}{" "}
            <i
              className={`fas ${showObsidianPanel ? "fa-chevron-down" : "fa-chevron-up"} ml-1 text-[8px]`}
            ></i>
          </button>
        </div>

        {showObsidianPanel && (
          <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/35 p-3.5 rounded-xl border border-white/5 animate-in slide-in-from-bottom duration-200">
            <div className="space-y-1.5 text-left">
              <label className="block text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                本地 Obsidian Vault 库名称
              </label>
              <input
                type="text"
                value={vaultName}
                onChange={(e) => {
                  setVaultName(e.target.value);
                  localStorage.setItem("sili_obsidian_vault", e.target.value);
                }}
                className="w-full bg-[#1c1c1e] text-xs border border-white/10 rounded-lg px-2.5 py-1.5 text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
                placeholder="例如: SILI_Brain"
              />
              <p className="text-[9px] text-zinc-500 leading-normal">
                设置专属 Vault
                后，下方深度协议唤醒接口将直连对应的本地笔记本体系。
              </p>
            </div>

            <div className="flex flex-col justify-end gap-2 text-right">
              <div className="flex flex-wrap gap-1.5 justify-end">
                <a
                  href={`obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(title)}`}
                  className="text-[10px] bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/25 px-2.5 py-1.5 rounded-lg transition-all font-bold flex items-center gap-1.5 shrink-0"
                  title="在本地 Obsidian 客户端打开此笔记"
                >
                  <i className="fas fa-bolt text-[9px]"></i> 唤醒 Obsidian 节点
                </a>

                <button
                  type="button"
                  onClick={() => {
                    const protocolLink = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(title)}`;
                    navigator.clipboard.writeText(protocolLink);
                    alert(
                      `链接成功拷贝至剪贴板！可在浏览器中直接调用或配合 Obsidian 使用。\n\n链接: ${protocolLink}`,
                    );
                  }}
                  className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/5 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  <i className="fas fa-copy text-[9px]"></i> 拷贝唤醒协议
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const frontmatter = `---\ntitle: ${title || "未命名"}\ncreated: ${new Date().toISOString()}\nsili_sync: true\ntags:\n  - sili-intelligence\n  - obsidian-brain\n---\n\n`;
                    const downloadText = frontmatter + content;

                    const blob = new Blob([downloadText], {
                      type: "text/markdown;charset=utf-8;",
                    });
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = blobUrl;
                    link.setAttribute("download", `${title || "未命名"}.md`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(blobUrl);
                  }}
                  className="text-[10px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 active:scale-95 text-white px-3 py-1.5 rounded-lg transition-all font-bold flex items-center gap-1.5 shadow"
                >
                  <i className="fas fa-download text-[9px]"></i> 导出 .md 到
                  Obsidian 库
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {saveStatus && (
        <div
          id="editor-save-status"
          className="px-6 py-2 border-t border-white/5 bg-[#161617]/20 flex items-center justify-between text-xs font-mono text-zinc-500 transition-all duration-300"
        >
          <div className="flex items-center gap-2">
            {saveStatus === "自动保存中..." ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-apple-orange opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-apple-orange"></span>
                </span>
                <span className="text-apple-orange font-medium text-[11px]">
                  {saveStatus}
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex rounded-full h-1.5 w-1.5 bg-apple-green"></span>
                <span className="text-apple-green font-medium text-[11px]">
                  {saveStatus}
                </span>
              </>
            )}
          </div>
          {lastSavedTime && (
            <span className="text-zinc-650 text-[10px]">
              本地已同步：{lastSavedTime}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
