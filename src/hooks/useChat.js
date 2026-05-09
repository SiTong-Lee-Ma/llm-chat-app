// src/hooks/useChat.js
// 职责：封装聊天核心逻辑，供 Chat.jsx 调用
// 管理：messages state、history（API 上下文）、streaming、loading、error

import { useState, useRef, useCallback } from "react";
import { streamChat, mockStream, trimHistory } from "../services/openai";

// uid 工具 
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const INIT_NOTICE = { id: "init", role: "system-notice", content: "LLM CHAT v1.0 — SESSION STARTED" };
const CLEAR_NOTICE = { id: "clear", role: "system-notice", content: "SESSION CLEARED — NEW CONTEXT" };

// useChat 
/**
 * @param {{ model: string, useMock?: boolean }} options
 * @returns {{
 *   messages, history, streaming, loading, error, charCount,
 *   sendMessage, stopStreaming, clearChat
 * }}
 */
export function useChat({ model, useMock = true }) {
  const [messages, setMessages] = useState([INIT_NOTICE]);
  const [history, setHistory] = useState([]);      // API 上下文（仅 user/assistant）
  const [streaming, setStreaming] = useState(false);   // SSE 流正在输出
  const [loading, setLoading] = useState(false);   // 等待首字节（loading 动画）
  const [error, setError] = useState(null);
  const [charCount, setCharCount] = useState(0);

  const abortRef = useRef(null);

  // 发送消息 
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming) return;
    setError(null);

    // 1. 渲染用户消息
    const userMsg = { id: uid(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);

    // 2. 更新 API 历史（滑动窗口）
    const newHistory = trimHistory([...history, { role: "user", content: text }]);
    setHistory(newHistory);
    setCharCount(newHistory.reduce((s, m) => s + m.content.length, 0));

    // 3. 占位 AI 气泡，进入 loading 状态
    const assistantId = uid();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setLoading(true);
    setStreaming(true);

    // 4. AbortController 用于中断
    const controller = new AbortController();
    abortRef.current = controller;

    let fullText = "";

    const onChunk = (chunk) => {
      fullText += chunk;
      setLoading(false);  // 首字到达，关闭 loading
      const snap = fullText;
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, content: snap, streaming: true } : m)
      );
    };

    const onDone = () => {
      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m)
      );
      const finalHistory = trimHistory([...newHistory, { role: "assistant", content: fullText }]);
      setHistory(finalHistory);
      setCharCount(finalHistory.reduce((s, m) => s + m.content.length, 0));
      setStreaming(false);
      setLoading(false);
      abortRef.current = null;
    };

    try {
      if (useMock) {
        // Mock 模式：不调真实 API
        mockStream(onChunk, onDone, controller.signal);
      } else {
        // 真实 API 模式
        await streamChat({
          model,
          messages: newHistory,
          onChunk,
          onDone,
          signal: controller.signal,
        });
      }
    } catch (err) {
      if (err.name === "AbortError") {
        // 用户主动中断，保留已生成内容
        setMessages(prev =>
          prev.map(m => m.id === assistantId
            ? { ...m, content: fullText || "[已中断]", streaming: false }
            : m
          )
        );
      } else {
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        setError(err.message);
      }
      setStreaming(false);
      setLoading(false);
      abortRef.current = null;
    }
  }, [streaming, history, model, useMock]);

  // 中断流式输出 
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // 清空会话 
  const clearChat = useCallback(() => {
    setMessages([{ ...CLEAR_NOTICE, id: uid() }]);
    setHistory([]);
    setCharCount(0);
    setError(null);
    setStreaming(false);
    setLoading(false);
  }, []);

  return {
    messages,
    history,
    streaming,
    loading,
    error,
    charCount,
    sendMessage,
    stopStreaming,
    clearChat,
  };
}
