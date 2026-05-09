// src/components/ChatInput.jsx
// 职责：消息输入区
//   - textarea（Enter 发送，Shift+Enter 换行）
//   - 发送按钮 / 停止按钮（streaming 中）
//   - 字符计数

import { useRef, useEffect } from "react";

/**
 * Props:
 *   value      : string
 *   onChange   : (val: string) => void
 *   onSend     : () => void
 *   onStop     : () => void
 *   streaming  : boolean
 *   disabled   : boolean
 */
export default function ChatInput({ value, onChange, onSend, onStop, streaming, disabled }) {
  const textareaRef = useRef(null);

  // 发送后自动聚焦
  useEffect(() => {
    if (!streaming) textareaRef.current?.focus();
  }, [streaming]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const charCount = value.length;

  return (
    <div style={{
      borderTop: "2px solid #000",
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      flexShrink: 0,
      background: "#fff",
    }}>
      {/* 主行：输入框 + 按钮 */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息… (Enter 发送，Shift+Enter 换行)"
          disabled={disabled || streaming}
          rows={3}
          style={{
            flex: 1,
            border: "2px solid #000",
            padding: "10px 12px",
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontSize: 14,
            resize: "none",
            lineHeight: 1.6,
            background: (disabled || streaming) ? "#f5f5f5" : "#fff",
            color: "#000",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {streaming ? (
            <button className="btn btn-danger" onClick={onStop}>
              ■ STOP
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={onSend}
              disabled={!value.trim() || disabled}
            >
              SEND →
            </button>
          )}
        </div>
      </div>

      {/* 底部提示行 */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontFamily: "monospace",
        fontSize: 10,
        color: "#aaa",
        paddingLeft: 2,
      }}>
        <span>ENTER 发送 · SHIFT+ENTER 换行</span>
        <span style={{ color: charCount > 2000 ? "#ff3b30" : "#aaa" }}>
          {charCount} chars
        </span>
      </div>
    </div>
  );
}
