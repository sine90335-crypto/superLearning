
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Flashcard, QuizQuestion, DemoStep, LearningPlan } from "./types";

// Always initialize with the named parameter and direct environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const speakSweetly = async (text: string, context: "praise" | "explain" | "encourage" = "explain"): Promise<void> => {
  let prompt = text;
  if (context === "praise") prompt = `用超级甜美、崇拜且开心的语气赞美学习者（中文）：${text}`;
  else if (context === "explain") prompt = `用温柔、耐心、大姐姐般的语气详细讲解这个知识点（中文）：${text}`;
  else prompt = `用充满元气、鼓励的语气给学习者加油（中文）：${text}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
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
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          { inlineData: { data: base64Pdf, mimeType: 'application/pdf' } },
          { text: "精准识别并以Markdown格式提取核心知识。中文。" }
        ]
      }
    ]
  });
  return response.text || "";
};

export const generateLearningPlan = async (content: string, userReq: string): Promise<LearningPlan> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
                milestones: { type: Type.ARRAY, items: { type: Type.STRING } }
              }
            }
          },
          daily: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                task: { type: Type.STRING },
                units: { type: Type.NUMBER }
              }
            }
          }
        }
      }
    }
  });
  const text = response.text || "{}";
  const data = JSON.parse(text);
  return {
    ...data,
    id: Date.now().toString(),
    daily: data.daily?.map((d: any) => ({ ...d, id: Math.random().toString(), done: false })) || []
  };
};

export const generateDynamicDemo = async (concept: string): Promise<DemoStep[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
            visualHighlight: { type: Type.STRING }
          }
        }
      }
    }
  });
  const text = response.text || "[]";
  return JSON.parse(text);
};

export const generateFlashcardsFromNote = async (content: string, noteId: string): Promise<Flashcard[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
            tags: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    }
  });
  const text = response.text || "[]";
  return JSON.parse(text).map((item: any, idx: number) => ({
    ...item,
    id: `card-${Date.now()}-${idx}`,
    sourceNoteId: noteId,
    level: 0,
    nextReview: Date.now() - 1,
    lastInterval: 0
  }));
};

export const generateQuiz = async (content: string): Promise<QuizQuestion[]> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
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
            explanation: { type: Type.STRING }
          }
        }
      }
    }
  });
  const text = response.text || "[]";
  return JSON.parse(text);
};

export const askLLMWiki = async (query: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请直接作为【AI智能百科】回答我的问题，运用详细、专业、条理清晰的Markdown排版进行解释。
要求：
- 如果涉及技术或者历史等概念，请提供背景、核心原理以及示例。
- 语气客观中立。
问题：${query}`
  });
  return response.text || "无法获取到回答。";
};
