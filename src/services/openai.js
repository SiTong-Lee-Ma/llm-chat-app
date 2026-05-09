// src/services/openai.js
// 职责：封装所有 LLM API 调用，与 UI 层完全解耦
// 支持：OpenAI 流式 SSE、Mock 模式、错误处理、中断控制

// API Key 从 Vite 环境变量读取（.env 文件中的 VITE_OPENAI_API_KEY）
const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const API_URL = "https://api.openai.com/v1/chat/completions";

export const SYSTEM_PROMPT =
  "你是一个专业、简洁的 AI 助手。回答要准确、有条理。支持 Markdown 格式输出。";

export const MAX_HISTORY_CHARS = 12000;

// 滑动窗口裁剪
// 超出字符上限时，成对删除最旧的 user+assistant 消息
export function trimHistory(history) {
  let total = history.reduce((s, m) => s + m.content.length, 0);
  let arr = [...history];
  while (total > MAX_HISTORY_CHARS && arr.length > 2) {
    const removed = arr.splice(0, 2);
    total -= removed.reduce((s, m) => s + m.content.length, 0);
  }
  return arr;
}

// Mock 回复（不消耗 API 额度，用于 UI 调试）
export function mockStream(onChunk, onDone, signal) {
  const parts = [
    "这是一条**模拟回复**，用于在未接入真实 API 时测试 UI 流程。\n\n",
    "支持 `Markdown` 渲染，例如代码块：\n\n",
    "```js\nconst greet = () => console.log('Hello!');\n```\n\n",
    "以及列表：\n- 流式输出\n- 自动滚底\n- Loading 动画\n\n",
    "将 `useMock={false}` 即可切换到真实 OpenAI API。",
  ];

  let i = 0;
  let cancelled = false;
  signal?.addEventListener("abort", () => { cancelled = true; });

  function next() {
    if (cancelled || i >= parts.length) { onDone(); return; }
    onChunk(parts[i++]);
    setTimeout(next, 120 + Math.random() * 80);
  }
  setTimeout(next, 500);
}

// 真实 OpenAI SSE 流式请求 
// OpenAI SSE 格式：每行 "data: {...}" 或 "data: [DONE]"
// delta 在 choices[0].delta.content 中
export async function streamChat({ model, messages, onChunk, onDone, signal }) {
  if (!API_KEY) {
    throw new Error("未找到 API Key，请检查 .env 文件中的 VITE_OPENAI_API_KEY");
  }

  // OpenAI 需要把 system prompt 作为第一条 system 消息传入
  const fullMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat",           // 例如 "gpt-4o" 或 "gpt-3.5-turbo"
      messages: fullMessages,
      stream: true,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    for (const line of decoder.decode(value, { stream: true }).split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        // OpenAI 流式格式：choices[0].delta.content
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) onChunk(text);
      } catch { /* skip malformed chunks */ }
    }
  }

  onDone();
}
