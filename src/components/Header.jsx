// src/components/Header.jsx
// 职责：顶部导航栏
//   - 汉堡按钮（切换侧边栏）
//   - 应用标题
//   - Streaming 状态指示灯
//   - 模型切换 select
//   - CLEAR 按钮

const MODELS = [
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o mini" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", label: "GPT-3.5" },
];

/**
 * Props:
 *   streaming       : boolean
 *   model           : string
 *   onModelChange   : (id: string) => void
 *   onToggleSidebar : () => void
 *   onClear         : () => void
 */
export default function Header({ streaming, model, onModelChange, onToggleSidebar, onClear }) {
  return (
    <div style={{
      borderBottom: "2px solid #000",
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexShrink: 0,
      background: "#fff",
    }}>
      {/* 左侧 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="btn"
          style={{ padding: "5px 10px", fontSize: 13 }}
          onClick={onToggleSidebar}
          title="切换侧边栏"
        >
          ☰
        </button>

        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontWeight: 900,
          fontSize: 15,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}>
          LLM_CHAT
        </span>

        {/* 状态指示灯 */}
        <div
          title={streaming ? "Streaming…" : "Idle"}
          style={{
            width: 8,
            height: 8,
            border: "2px solid #000",
            background: streaming ? "#00c851" : "#000",
            animation: streaming ? "blink 1s step-end infinite" : "none",
          }}
        />
      </div>

      {/* 右侧 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select
          value={model}
          onChange={e => onModelChange(e.target.value)}
          disabled={streaming}
          style={{
            border: "2px solid #000",
            background: "#fff",
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 700,
            padding: "5px 8px",
            cursor: "pointer",
            letterSpacing: 0.5,
          }}
        >
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>

        <button className="btn" onClick={onClear} disabled={streaming}>
          CLEAR
        </button>
      </div>
    </div>
  );
}
