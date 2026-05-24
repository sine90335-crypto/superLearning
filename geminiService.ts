import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Flashcard, QuizQuestion, DemoStep, LearningPlan } from "./types";

// Lazy initialization of GoogleGenAI to ensure startup works offline
let aiInstance: GoogleGenAI | null = null;
const getAI = (): GoogleGenAI => {
  if (!aiInstance) {
    const key = process.env.API_KEY || (typeof window !== "undefined" ? (window as any).API_KEY : "");
    if (!key) {
      throw new Error("SILI AI 智能引擎当前处于离线或未配置 API Key 状态。请输入 GEMINI_API_KEY 后继续。");
    }
    aiInstance = new GoogleGenAI({ apiKey: key });
  }
  return aiInstance;
};

export const speakSweetly = async (
  text: string,
  context: "praise" | "explain" | "encourage" = "explain",
): Promise<void> => {
  let prompt = text;
  if (context === "praise")
    prompt = `用超级甜美、崇拜且开心的语气赞美学习者（中文）：${text}`;
  else if (context === "explain")
    prompt = `用温柔、耐心、大姐姐般的语气详细讲解这个知识点（中文）：${text}`;
  else prompt = `用充满元气、鼓励的语气给学习者加油（中文）：${text}`;

  try {
    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )({ sampleRate: 24000 });
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const dataInt16 = new Int16Array(bytes.buffer);
      const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();
    }
  } catch (error) {
    console.error("语音生成失败", error);
  }
};

export const analyzePdf = async (base64Pdf: string): Promise<string> => {
  // Use gemini-3-flash-preview for basic text extraction tasks
  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
          { text: "精准识别并以Markdown格式提取核心知识。中文。" },
        ],
      },
    ],
  });
  return response.text || "";
};

export const generateLearningPlan = async (
  content: string,
  userReq: string,
): Promise<LearningPlan> => {
  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `基于内容和需求制定规划。内容：${content}。需求：${userReq}。必须包含宏观(按月里程碑)和微观(半小时排班)。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          goal: { type: Type.STRING },
          macro: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                month: { type: Type.STRING },
                milestones: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          daily: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                task: { type: Type.STRING },
                units: { type: Type.NUMBER },
              },
            },
          },
        },
      },
    },
  });
  const text = response.text || "{}";
  const data = JSON.parse(text);
  return {
    ...data,
    id: Date.now().toString(),
    daily:
      data.daily?.map((d: any) => ({
        ...d,
        id: Math.random().toString(),
        done: false,
      })) || [],
  };
};

export const generateDynamicDemo = async (
  concept: string,
): Promise<DemoStep[]> => {
  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `将概念分解为推演步骤。要求：话术基于原文，通顺逻辑，比喻极少(1-2个)。中文。内容：${concept}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            visualHighlight: { type: Type.STRING },
          },
        },
      },
    },
  });
  const text = response.text || "[]";
  return JSON.parse(text);
};

export const generateFlashcardsFromNote = async (
  content: string,
  noteId: string,
): Promise<Flashcard[]> => {
  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `将内容转换为中文学习卡片。必须JSON。内容：${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            front: { type: Type.STRING },
            back: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    },
  });
  const text = response.text || "[]";
  return JSON.parse(text).map((item: any, idx: number) => ({
    ...item,
    id: `card-${Date.now()}-${idx}`,
    sourceNoteId: noteId,
    level: 0,
    nextReview: Date.now() - 1,
    lastInterval: 0,
  }));
};

export const generateQuiz = async (
  content: string,
): Promise<QuizQuestion[]> => {
  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `生成选择题。内容：${content}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
          },
        },
      },
    },
  });
  const text = response.text || "[]";
  return JSON.parse(text);
};

export const askLLMWiki = async (query: string): Promise<string> => {
  const response = await getAI().models.generateContent({
    model: "gemini-3.5-flash",
    contents: `请直接作为【AI智能百科】回答我的问题，运用详细、专业、条理清晰的Markdown排版进行解释。
要求：
- 如果涉及技术或者历史等概念，请提供背景、核心原理以及示例。
- 语气客观中立。
问题：${query}`,
  });
  return response.text || "无法获取到回答。";
};

export const askLLMWikiWithRAG = async (
  query: string,
  retrievedContext: string,
): Promise<string> => {
  const systemInstruction = `您是内置的【大模型RAG智能百科检索系统】。请根据所检索到的本地知识库上下文展开专业、具体、条理分明的回答。
要求：
- 在保证解答严谨的前提下，应以本地检索上下文为最核心、最优先的参考依据，对已有概念不要进行臆造 or 歪曲，在答案中自然引用，并可标明 [Note: 标题名] 来源。
- 如果关联的检索上下文与问题无关或不匹配，请明确诚实地通过这句话作为前缀告知：“在您的本地进化知识树中未检索到强强关联的主导项，本回答将基于智能百科的通用公用知识网络进行推演：”，接着基于你自身的专业通识知识给出一个非常精彩深刻的百科详解。
- 排版上使用优质 Markdown 排版，如列表、代码块、引用和重点文字加粗。`;

  const response = await getAI().models.generateContent({
    model: "gemini-3.5-flash",
    contents: `问题：${query}\n\n本地匹配出的检索上下文（供参考）：\n<retrieved_context>\n${retrievedContext || "（无直接相关的匹配项）"}\n</retrieved_context>`,
    config: {
      systemInstruction,
    },
  });
  return response.text || "检索失败，未生成回答。";
};
