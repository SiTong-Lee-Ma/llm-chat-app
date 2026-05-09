// src/components/Sidebar.jsx
// 职责：会话历史侧边栏
//   - 显示会话列表（高亮当前活跃会话）
//   - 新建会话按钮
//   - Context 用量指示条

import { MAX_HISTORY_CHARS } from "../services/openai";

// TokenBadge
function TokenBadge({ count }) {
  const pct = Math.min(100, Math.round((count / MAX_HISTORY_CHARS) * 100));
  const color = pct > 80 ? "#ff3b30" : pct > 50 ? "#ff9500" : "#000";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontFamily: "monospace",
      fontSize: 11,
      color: "#555",
    }}>
      <div style={{
        width: 52,
        height: 4,
        border: "1px solid #ccc",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: `${pct}%`,
          background: color,
          transition: "width 0.3s",
        }} />
      </div>
      <span>{count.toLocaleString()} ch</span>
    </div>
  );
}

/**
 * Props:
 *   conversations : Array<{ id, label, active }>
 *   charCount     : number
 *   onNewChat     : () => void
 *   onSelect      : (id: string) => void
 */
export default function Sidebar({ conversations, charCount, onNewChat, onSelect }) {
  return (
    <div style={{
      width: 220,
      borderRight: "2px solid #000",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      background: "#fff",
    }}>
      {/* 标题栏 */}
      <div style={{
        padding: "12px 14px",
        borderBottom: "2px solid #000",
        fontFamily: "monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
      }}>
        HISTORY
      </div>

      {/* 会话列表 */}
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {conversations.map(c => (
          <div
            key={c.id}
            onClick={() => onSelect?.(c.id)}
            style={{
              padding: "8px 10px",
              border: `2px solid ${c.active ? "#000" : "#e0e0e0"}`,
              marginBottom: 6,
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 12,
              background: c.active ? "#000" : "#fff",
              color: c.active ? "#fff" : "#000",
              userSelect: "none",
            }}
          >
            {c.label}
          </div>
        ))}
      </div>

      {/* 底部：Context 用量 + 新建按钮 */}
      <div style={{
        padding: "10px 12px",
        borderTop: "2px solid #000",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#888", letterSpacing: 0.5 }}>
            CONTEXT
          </span>
          <TokenBadge count={charCount} />
        </div>

        <button className="btn" style={{ width: "100%" }} onClick={onNewChat}>
          + NEW CHAT
        </button>
      </div>
    </div>
  );
}
