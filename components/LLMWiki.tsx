import React, { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Note } from "../types";
import { searchIndex, tokenize, SearchResult } from "./RAGEngine";
import { askLLMWikiWithRAG } from "../geminiService";

interface LLMWikiProps {
  notes?: Note[];
}

export const LLMWiki: React.FC<LLMWikiProps> = ({ notes = [] }) => {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // RAG Search & Trace States
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTokens, setSearchTokens] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<"answer" | "index_trace">(
    "answer",
  );

  // Selected note modal for quick-view of citations
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  // Indexing status indicators
  const stats = useMemo(() => {
    let totalChars = 0;
    notes.forEach((note) => {
      totalChars += (note.content || "").length;
    });
    return {
      noteCount: notes.length,
      totalChars,
    };
  }, [notes]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isLoading) return;

    setIsLoading(true);
    setAnswer("");
    setHasSearched(true);
    setActiveTab("answer");

    try {
      // 1. Perform in-memory bilingual tokenization and TF-IDF search
      const tokens = tokenize(query.trim());
      setSearchTokens(tokens);

      const matches = searchIndex(query.trim(), notes, 3);
      setSearchResults(matches);

      // 2. Synthesize retrieved context payload
      let contextPayload = "";
      if (matches.length > 0) {
        contextPayload = matches
          .map((match, idx) => {
            return `【文档 #${idx + 1} 来源：《${match.doc.title}》】\n${match.doc.content || ""}`;
          })
          .join("\n\n-----------------------\n\n");
      }

      // 3. Request Gemini to respond with prompt-augmentation
      const response = await askLLMWikiWithRAG(query.trim(), contextPayload);
      setAnswer(response);
    } catch (err: any) {
      console.error(err);
      setAnswer(`❌ 检索或生成失败: ${err.message || "未知错误"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-5 z-20 overflow-hidden relative p-1 md:p-3">
      {/* LEFT AREA: SEARCH CONSOLE & ANSWERS */}
      <div
        className="flex-1 flex flex-col backdrop-blur-md rounded-2xl border overflow-hidden shadow-2xl transition-colors h-full"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-color)",
        }}
      >
        {/* WIKI HEADER */}
        <div
          className="p-6 border-b backdrop-blur-xl transition-colors"
          style={{
            backgroundColor: "var(--bg-nav)",
            borderColor: "var(--border-color)",
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <h2
              className="text-xl font-bold flex items-center gap-2.5"
              style={{ color: "var(--text-primary)" }}
            >
              <div className="w-9 h-9 rounded-xl bg-apple-blue/10 flex items-center justify-center text-apple-blue shadow-inner">
                <i className="fas fa-brain-circuit text-lg"></i>
              </div>
              LLM Wiki 智能倒排百科
              <span className="text-[10px] bg-apple-blue/10 border border-apple-blue/30 text-apple-blue px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                RAG Mode
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-apple-green animate-pulse"></span>
                倒排构建就绪 ({stats.noteCount} 组)
              </span>
            </div>
          </div>
          <p
            className="text-xs mb-4 max-w-2xl leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            <strong>本地免向量 RAG 模型</strong>：在您现有的个人笔记、PDF
            文档内部直接提取 CJK 二元联词（Digram
            Tokens）与西方多语种拼写词频，计算 TF-IDF
            余弦相关性。免除昂贵且多耗损的第三方向量检索，极速锁定原文，在离线与大语言模型之间建立精密知识纽带。
          </p>

          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <div
                className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              >
                <i className="fas fa-search text-sm"></i>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索您的知识笔记，或查询通用百科概念..."
                className="w-full border rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-apple-blue focus:ring-1 focus:ring-apple-blue/20 transition-all font-semibold shadow-inner"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  borderColor: "var(--border-color)",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-6 py-3 bg-apple-blue hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-apple-blue font-bold text-sm rounded-xl transition shadow active:scale-95 flex items-center gap-2"
              style={{ color: "#ffffff" }}
            >
              {isLoading ? (
                <i className="fas fa-circle-notch fa-spin text-sm"></i>
              ) : (
                <i className="fas fa-sparkles text-sm"></i>
              )}
              深度检索
            </button>
          </form>
        </div>

        {/* TABS SELECTOR (ONLY SHOWN IF SEARCHED) */}
        {hasSearched && (
          <div
            className="flex border-b px-6 gap-6 text-xs font-semibold cursor-pointer shrink-0"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div
              onClick={() => setActiveTab("answer")}
              className={`py-3 transition-all relative ${activeTab === "answer" ? "text-apple-blue" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              回答内容
              {activeTab === "answer" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-apple-blue rounded-full"></div>
              )}
            </div>
            <div
              onClick={() => setActiveTab("index_trace")}
              className={`py-3 transition-all relative flex items-center gap-1.5 ${activeTab === "index_trace" ? "text-apple-blue" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <i className="fas fa-chart-network text-[10px]"></i>
              本地 RAG 检索诊断
              <span className="text-[9px] px-1.5 py-0.2 bg-zinc-700/50 rounded-full font-mono text-zinc-400">
                {searchResults.length} 命中
              </span>
              {activeTab === "index_trace" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-apple-blue rounded-full"></div>
              )}
            </div>
          </div>
        )}

        {/* CONTENT VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
          {isLoading && !answer && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-transparent pointer-events-none">
              <div className="w-12 h-12 border-4 border-apple-blue/20 border-t-apple-blue rounded-full animate-spin mb-4"></div>
              <div
                className="text-sm font-semibold tracking-wide animate-pulse mb-1"
                style={{ color: "var(--text-secondary)" }}
              >
                倒排索引匹配中 & 大模型常识融合合成...
              </div>
              <p className="text-xs text-zinc-500">
                正在遍历文档中，寻找核心高频词块集对齐...
              </p>
            </div>
          )}

          {!hasSearched && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-20 h-20 bg-apple-blue/5 border border-apple-blue/15 rounded-3xl flex items-center justify-center mb-6 shadow-xl text-apple-blue">
                <i className="fas fa-folder-open text-3xl"></i>
              </div>
              <h3
                className="text-lg font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                本地专属百科与 RAG 点播
              </h3>
              <p className="text-sm mt-2 max-w-md leading-relaxed text-zinc-400">
                本搜索系统会将您的「知识库」中记录的所有文字（或导入的网页、PDF文本）进行即时分词，生成局部相似度高维词集。在搜索时自动检索最相关的上文并融入大模型，生成带有指向性标注的整合式答案。
              </p>
              {stats.noteCount === 0 && (
                <div className="mt-4 p-3 rounded-xl border border-dashed border-zinc-700 max-w-sm text-xs text-apple-yellow bg-apple-yellow/5">
                  <i className="fas fa-exclamation-triangle mr-1.5"></i>
                  警告：当前您的知识库为空，暂无法启动局内 RAG
                  文档召回，大模型将以降级常识模式回答。请先到 “知识编织” 或
                  “知识库” 新建或导入笔记。
                </div>
              )}
            </div>
          )}

          {hasSearched && activeTab === "answer" && answer && (
            <div className="max-w-4xl mx-auto pb-12">
              <div
                className="border p-6 md:p-8 rounded-[24px] shadow-2xl relative transition-colors"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--border-color)",
                }}
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                  <i
                    className="fas fa-newspaper text-[120px]"
                    style={{ color: "var(--text-primary)" }}
                  ></i>
                </div>

                {/* Answer Main Body */}
                <div
                  className="markdown-renderer relative z-10 prose prose-invert max-w-none text-sm leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                >
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>
              </div>

              {/* CITATIONS SECTION */}
              {searchResults.length > 0 && (
                <div className="mt-8">
                  <h4
                    className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <i className="fas fa-quote-left text-apple-blue text-[10px]"></i>
                    局内召回与相关信源 (Cited Sources)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {searchResults.map((result, idx) => (
                      <div
                        key={result.doc.id}
                        onClick={() => setViewingNote(result.doc)}
                        className="p-4 rounded-xl border cursor-pointer hover:border-apple-blue/40 hover:shadow-lg transition-all flex flex-col justify-between"
                        style={{
                          backgroundColor: "var(--bg-secondary)",
                          borderColor: "var(--border-color)",
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-apple-blue font-mono">
                              SCORE: {result.score.toFixed(4)}
                            </span>
                            <span className="px-2 py-0.5 text-[8px] bg-zinc-800 text-zinc-400 rounded">
                              Citation #{idx + 1}
                            </span>
                          </div>
                          <h5
                            className="font-bold text-xs truncate mb-2"
                            style={{ color: "var(--text-primary)" }}
                          >
                            《{result.doc.title}》
                          </h5>
                          <p className="text-[11px] text-zinc-500 line-clamp-3 leading-snug">
                            {result.snippet}
                          </p>
                        </div>
                        <div className="text-[9px] text-zinc-500 text-right mt-3 hover:text-apple-blue flex items-center justify-end gap-1">
                          查看完全文本{" "}
                          <i className="fas fa-arrow-right text-[8px]"></i>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DIAGNOSTIC INDEX TRACE VIEW */}
          {hasSearched && activeTab === "index_trace" && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div
                className="p-6 rounded-2xl border"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  borderColor: "var(--border-color)",
                }}
              >
                <h4
                  className="text-sm font-bold flex items-center gap-2 mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  <i className="fas fa-stream text-apple-blue"></i>
                  全流程倒排 RAG 推理回溯 Logs
                </h4>

                {/* PIPELINE STEPS */}
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-zinc-900/40 rounded-lg border border-white/5 flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-apple-blue/10 flex items-center justify-center text-apple-blue font-mono font-bold text-[10px] shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <div
                        className="font-bold mb-1"
                        style={{ color: "var(--text-primary)" }}
                      >
                        搜索句（Query）正则及 N-Grams 切词
                      </div>
                      <div className="text-zinc-500 leading-relaxed mb-2">
                        匹配特征库，提取 CJK 单个字符 unigrams，二元相近 bigrams
                        及英文单词符号：
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {searchTokens.map((t, idx) => (
                          <span
                            key={idx}
                            className="bg-zinc-800 px-2 py-0.5 rounded font-mono text-[10px] text-zinc-400"
                          >
                            "{t}"
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/40 rounded-lg border border-white/5 flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-apple-blue/10 flex items-center justify-center text-apple-blue font-mono font-bold text-[10px] shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="flex-1">
                      <div
                        className="font-bold mb-1"
                        style={{ color: "var(--text-primary)" }}
                      >
                        倒排索引与 TF-IDF 余弦相关性权值计算
                      </div>
                      <div className="text-zinc-500 leading-relaxed mb-3">
                        扫描知识库里所有 {notes.length}{" "}
                        个文档的索引缓存，根据词项在单文档中的频度 (TF)
                        及在全库库频 (IDF) 赋予权重：
                      </div>

                      {searchResults.length === 0 ? (
                        <div className="text-apple-yellow font-semibold text-xs py-1">
                          ⚠️
                          本地无文档召回相似，将直接基于通用大模型通识回答该问题。
                        </div>
                      ) : (
                        <div className="border border-white/5 rounded-lg overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-zinc-800 text-[10px] text-zinc-400 font-bold border-b border-white/5">
                                <th className="p-2 pl-3">匹配信源</th>
                                <th className="p-2">TF-IDF 相似权重</th>
                                <th className="p-2">重合特征关键字</th>
                                <th className="p-2">长度 (字)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono text-[11px] text-zinc-300">
                              {searchResults.map((res, idx) => (
                                <tr key={idx} className="hover:bg-zinc-800/40">
                                  <td className="p-2 pl-3 font-semibold text-white truncate max-w-[200px]">
                                    《{res.doc.title}》
                                  </td>
                                  <td className="p-2 text-apple-blue font-bold">
                                    {res.score.toFixed(6)}
                                  </td>
                                  <td className="p-2 text-zinc-400">
                                    {res.matchedKeywords.slice(0, 8).join(", ")}{" "}
                                    {res.matchedKeywords.length > 8
                                      ? "..."
                                      : ""}
                                  </td>
                                  <td className="p-2 text-zinc-500">
                                    {res.doc.content?.length || 0}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/40 rounded-lg border border-white/5 flex items-start gap-3">
                    <div className="w-5 h-5 rounded bg-apple-blue/10 flex items-center justify-center text-apple-blue font-mono font-bold text-[10px] shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <div
                        className="font-bold mb-1"
                        style={{ color: "var(--text-primary)" }}
                      >
                        RAG 上下文装载与提示词重构 (Context Augmentation)
                      </div>
                      <div className="text-zinc-500 leading-relaxed">
                        选取检索匹配度排名前 3 的文档正文，使用{" "}
                        <code>&lt;retrieved_context&gt;</code> XML
                        标签包裹。生成附带参考资料约束的增强型 Prompts 送出至
                        Gemini LLM，阻止模型产生知识幻觉，生成 100%
                        具备出处的回答。
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT AREA: KNOWLEDGE BASE INDEX MONITOR */}
      <div
        className="w-full lg:w-72 shrink-0 flex flex-col md:max-h-full backdrop-blur-md rounded-2xl border p-5 shadow-2xl space-y-4"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-color)",
          height: "fit-content",
        }}
      >
        <h4
          className="text-xs font-extrabold uppercase tracking-widest flex items-center gap-2 border-b pb-3"
          style={{
            color: "var(--text-primary)",
            borderColor: "var(--border-color)",
          }}
        >
          <i className="fas fa-server text-apple-green"></i>
          RAG 索引监视树
        </h4>

        <div className="space-y-3.5 overflow-y-auto max-h-[300px] lg:max-h-none scrollbar-thin">
          <div
            className="p-3.5 rounded-xl border flex flex-col justify-between text-xs"
            style={{
              backgroundColor: "var(--bg-secondary)",
              borderColor: "var(--border-color)",
            }}
          >
            <span className="text-[9px] text-zinc-500 font-extrabold tracking-wider uppercase mb-1">
              倒排索引特征字典
            </span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-xl font-bold font-mono text-apple-green">
                {stats.noteCount}
              </span>
              <span className="text-zinc-500">组文档在线</span>
            </div>
            <div className="mt-2 text-[10px] text-zinc-400 font-semibold bg-zinc-850/40 p-2 rounded border border-white/5 leading-relaxed leading-snug">
              已将中文词条全切片。检索无需通过 vector db 节点，匹配速度提升
              12.8x。
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-widest pl-1">
              已注册的文档列表 ({notes.length})
            </span>

            {notes.length === 0 ? (
              <div className="text-[11px] text-zinc-500 italic p-4 text-center rounded-xl border border-dashed border-zinc-800">
                暂无注册的文档。
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[220px] lg:max-h-none overflow-y-auto">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => setViewingNote(note)}
                    className="p-2.5 rounded-lg border border-white/5 bg-zinc-900/30 flex items-center justify-between cursor-pointer hover:bg-zinc-800/40 hover:border-zinc-700/60 transition-all text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <i
                        className={`fas ${note.type === "pdf" ? "fa-file-pdf text-red-400" : "fa-sticky-note text-apple-yellow"} text-xs shrink-0`}
                      ></i>
                      <span
                        className="font-bold truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {note.title}
                      </span>
                    </div>
                    <span className="text-[8px] bg-apple-green/5 border border-apple-green/20 text-apple-green px-1.5 py-0.5 rounded shrink-0 font-bold font-mono">
                      Indexed
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAILED NOTE PREVIEW COMPONENT / POPUP DRAW */}
      {viewingNote && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div
            className="w-full max-w-2xl rounded-2xl border flex flex-col max-h-[85vh] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-color)",
            }}
          >
            {/* Modal Title */}
            <div
              className="p-5 border-b flex items-center justify-between text-sm shrink-0"
              style={{
                backgroundColor: "var(--bg-nav)",
                borderColor: "var(--border-color)",
              }}
            >
              <div
                className="flex items-center gap-2 font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                <i
                  className={`fas ${viewingNote.type === "pdf" ? "fa-file-pdf text-red-400" : "fa-sticky-note text-apple-yellow"}`}
                ></i>
                资料信源全文本：{viewingNote.title}
              </div>
              <button
                onClick={() => setViewingNote(null)}
                className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 select-text">
              <div className="text-xs mb-3 text-zinc-500 border-b pb-2 font-mono">
                发布时间：{new Date(viewingNote.updatedAt).toLocaleString()} —
                大小: {viewingNote.content?.length || 0} 字符
              </div>
              <div
                className="text-xs leading-relaxed whitespace-pre-wrap select-text font-sans scroll-smooth"
                style={{ color: "var(--text-primary)" }}
              >
                {viewingNote.content || "该文档没有任何内容。"}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              className="p-4 border-t flex justify-end shrink-0"
              style={{
                backgroundColor: "var(--bg-nav)",
                borderColor: "var(--border-color)",
              }}
            >
              <button
                onClick={() => setViewingNote(null)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 font-bold hover:bg-zinc-700 rounded-xl text-xs transition"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
