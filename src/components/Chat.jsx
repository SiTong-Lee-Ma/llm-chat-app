// src/components/Chat.jsx
// 职责：聊天主窗口
//   - 消费 useChat hook 获取状态和方法
//   - 渲染 Message 列表（含 loading 占位）
//   - 自动滚底
//   - 挂载 ChatInput
//   - 错误提示

import { useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import Message from "./Message";
import ChatInput from "./ChatInput";
import { useState } from "react";

/**
 * Props:
 *   model      : string        — 当前模型 ID（来自 App）
 *   useMock    : boolean       — true = mock 模式，不调真实 API
 *   onStream   : (bool)=>void  — 通知 App streaming 状态（驱动顶栏指示灯）
 *   chatRef    : React ref     — 暴露 clearChat() 给 App 调用
 */
export default function Chat({ model, useMock = true, onStreamChange, chatRef }) {
  const {
    messages,
    streaming,
    loading,
    error,
    charCount,
    sendMessage,
    stopStreaming,
    clearChat,
  } = useChat({ model, useMock });

  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  // 自动滚底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 通知父组件 streaming 变化
  useEffect(() => {
    onStreamChange?.(streaming);
  }, [streaming]);

  // 暴露 clearChat 给 App（命令式接口）
  useEffect(() => {
    if (chatRef) chatRef.current = { clear: clearChat };
  }, [chatRef, clearChat]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* 消息列表 */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {messages.map((msg, idx) => {
          // 最后一条 assistant 消息：如果 loading 为 true 显示三点
          const isLast = idx === messages.length - 1;
          const showDots = isLast && msg.role === "assistant" && loading;
          return (
            <div key={msg.id} className="msg-appear">
              <Message msg={{ ...msg, loading: showDots }} />
            </div>
          );
        })}

        {/* 错误提示 */}
        {error && (
          <div style={{
            border: "2px solid #ff3b30",
            padding: "10px 14px",
            fontFamily: "monospace",
            fontSize: 12,
            color: "#ff3b30",
          }}>
            ✕ ERROR: {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={stopStreaming}
        streaming={streaming}
        disabled={false}
      />
    </div>
  );
}
