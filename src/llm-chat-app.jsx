/**
 * ┌─ src/ ─────────────────────────────────────────────────────────────────┐
 * │  App.jsx                    根组件：壳、全局样式、Sidebar/Header 组合    │
 * │  components/                                                            │
 * │    Chat.jsx        聊天窗口：消费 useChat，渲染消息列表                  │
 * │    Message.jsx     单条消息：气泡、Markdown、Loading 三点、代码块        │
 * │    ChatInput.jsx   输入框：textarea + Enter 发送 + STOP 按钮            │
 * │    Header.jsx      顶栏：标题、指示灯、模型切换、CLEAR                   │
 * │    Sidebar.jsx     侧边栏：会话列表、Context 用量、NEW CHAT              │
 * │  hooks/                                                                 │
 * │    useChat.js      核心 Hook：messages/history/streaming/loading/error  │
 * │  services/                                                              │
 * │    openai.js       API 层：streamChat、mockStream、trimHistory           │
 * │  styles/                                                                │
 * │    globals.css     全局 CSS（此 Artifact 中内联注入）                    │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * 预览说明：useMock=true → 使用 mockStream，无需真实 API Key
 *           useMock=false → 调用 Anthropic API（需配置 Key）
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════════════
//  src/services/openai.js
// ══════════════════════════════════════════════════════
const API_URL = "https://api.anthropic.com/v1/messages";
const SYSTEM_PROMPT = "你是一个专业、简洁的 AI 助手。回答要准确、有条理。支持 Markdown 格式输出。";
const MAX_HISTORY_CHARS = 12000;

function trimHistory(history) {
  let total = history.reduce((s, m) => s + m.content.length, 0);
  let arr = [...history];
  while (total > MAX_HISTORY_CHARS && arr.length > 2) {
    const removed = arr.splice(0, 2);
    total -= removed.reduce((s, m) => s + m.content.length, 0);
  }
  return arr;
}

function mockStream(onChunk, onDone, signal) {
  const parts = [
    "这是一条**模拟回复**，用于测试 UI 流程。\n\n",
    "支持代码块高亮：\n\n",
    "```js\n// src/hooks/useChat.js\nconst { messages, sendMessage } = useChat({ model });\n```\n\n",
    "以及列表：\n- ✅ 流式输出（SSE）\n- ✅ 自动滚底\n- ✅ Loading 三点动画\n- ✅ 中断控制\n\n",
    "将 `useMock={false}` 即可切换到真实 API。",
  ];
  let i = 0, cancelled = false;
  signal?.addEventListener("abort", () => { cancelled = true; });
  function next() {
    if (cancelled || i >= parts.length) { onDone(); return; }
    onChunk(parts[i++]);
    setTimeout(next, 100 + Math.random() * 80);
  }
  setTimeout(next, 500);
}

async function streamChat({ model, messages, onChunk, onDone, signal }) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST", signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "deepseek/deepseek-chat", max_tokens: 1024, stream: true, system: SYSTEM_PROMPT, messages }),
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
        const p = JSON.parse(data);
        if (p.type === "content_block_delta" && p.delta?.text) onChunk(p.delta.text);
      } catch { }
    }
  }
  onDone();
}

// ══════════════════════════════════════════════════════
//  src/hooks/useChat.js
// ══════════════════════════════════════════════════════
function uid() { return Math.random().toString(36).slice(2, 9); }

function useChat({ model, useMock = true }) {
  const [messages, setMessages] = useState([{ id: "init", role: "system-notice", content: "LLM CHAT v1.0 — SESSION STARTED" }]);
  const [history, setHistory] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [charCount, setCharCount] = useState(0);
  const abortRef = useRef(null);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || streaming) return;
    setError(null);

    setMessages(prev => [...prev, { id: uid(), role: "user", content: text }]);

    const newHistory = trimHistory([...history, { role: "user", content: text }]);
    setHistory(newHistory);
    setCharCount(newHistory.reduce((s, m) => s + m.content.length, 0));

    const assistantId = uid();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", streaming: true }]);
    setLoading(true);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let fullText = "";

    const onChunk = (chunk) => {
      fullText += chunk;
      setLoading(false);
      const snap = fullText;
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: snap, streaming: true } : m));
    };

    const onDone = () => {
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m));
      const final = trimHistory([...newHistory, { role: "assistant", content: fullText }]);
      setHistory(final);
      setCharCount(final.reduce((s, m) => s + m.content.length, 0));
      setStreaming(false);
      setLoading(false);
      abortRef.current = null;
    };

    try {
      if (useMock) {
        mockStream(onChunk, onDone, controller.signal);
      } else {
        await streamChat({ model, messages: newHistory, onChunk, onDone, signal: controller.signal });
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText || "[已中断]", streaming: false } : m));
      } else {
        setMessages(prev => prev.filter(m => m.id !== assistantId));
        setError(err.message);
      }
      setStreaming(false); setLoading(false); abortRef.current = null;
    }
  }, [streaming, history, model, useMock]);

  const stopStreaming = useCallback(() => abortRef.current?.abort(), []);

  const clearChat = useCallback(() => {
    setMessages([{ id: uid(), role: "system-notice", content: "SESSION CLEARED — NEW CONTEXT" }]);
    setHistory([]); setCharCount(0); setError(null);
    setStreaming(false); setLoading(false);
  }, []);

  return { messages, streaming, loading, error, charCount, sendMessage, stopStreaming, clearChat };
}

// ══════════════════════════════════════════════════════
//  src/components/Message.jsx
// ══════════════════════════════════════════════════════
function parseMarkdown(text) {
  let h = text
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre data-lang="${lang || "code"}"><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^(?!<[hupcobi])(.+)$/gm, m => m.trim() ? `<p>${m}</p>` : m);
  return h;
}

function StreamingCursor() {
  return <span style={{ display: "inline-block", width: 2, height: "1em", background: "#000", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />;
}

function ThinkingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", height: "1em", padding: "2px 0" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ width: 5, height: 5, background: "#999", display: "inline-block", animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </span>
  );
}

function Avatar({ role }) {
  const isUser = role === "user";
  return (
    <div style={{ width: 28, height: 28, border: "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, fontFamily: "monospace", flexShrink: 0, marginTop: 2, background: isUser ? "#fff" : "#000", color: isUser ? "#000" : "#fff" }}>
      {isUser ? "U" : "AI"}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  const isNotice = msg.role === "system-notice";

  if (isNotice) return (
    <div style={{ textAlign: "center", fontSize: 11, color: "#aaa", fontFamily: "monospace", padding: "6px 0", letterSpacing: 1 }}>
      — {msg.content} —
    </div>
  );

  const body = isUser ? (
    <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
  ) : msg.loading ? (
    <ThinkingDots />
  ) : (
    <>
      <div className="md-content" dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }} />
      {msg.streaming && <StreamingCursor />}
    </>
  );

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", alignItems: "flex-start", gap: 8 }}>
      {!isUser && <Avatar role="assistant" />}
      <div style={{ maxWidth: "72%", padding: "10px 14px", border: "2px solid #000", background: isUser ? "#000" : "#fff", color: isUser ? "#fff" : "#000", fontFamily: isUser ? "'IBM Plex Mono',monospace" : "'IBM Plex Sans',sans-serif", fontSize: 14, lineHeight: 1.65, wordBreak: "break-word" }}>
        {body}
      </div>
      {isUser && <Avatar role="user" />}
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  src/components/ChatInput.jsx
// ══════════════════════════════════════════════════════
function ChatInput({ value, onChange, onSend, onStop, streaming, disabled }) {
  const ref = useRef(null);
  useEffect(() => { if (!streaming) ref.current?.focus(); }, [streaming]);

  return (
    <div style={{ borderTop: "2px solid #000", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, background: "#fff" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="输入消息… (Enter 发送，Shift+Enter 换行)"
          disabled={disabled || streaming}
          rows={3}
          style={{ flex: 1, border: "2px solid #000", padding: "10px 12px", fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 14, resize: "none", lineHeight: 1.6, background: (disabled || streaming) ? "#f5f5f5" : "#fff", color: "#000" }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {streaming
            ? <button className="btn btn-danger" onClick={onStop}>■ STOP</button>
            : <button className="btn btn-primary" onClick={onSend} disabled={!value.trim() || disabled}>SEND →</button>
          }
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 10, color: "#bbb", paddingLeft: 2 }}>
        <span>ENTER 发送 · SHIFT+ENTER 换行</span>
        <span style={{ color: value.length > 2000 ? "#ff3b30" : "#bbb" }}>{value.length} chars</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  src/components/Chat.jsx
// ══════════════════════════════════════════════════════
function Chat({ model, useMock = true, onStreamChange, chatRef }) {
  const { messages, streaming, loading, error, charCount, sendMessage, stopStreaming, clearChat } = useChat({ model, useMock });
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { onStreamChange?.(streaming); }, [streaming]);
  useEffect(() => { if (chatRef) chatRef.current = { clear: clearChat }; }, [chatRef, clearChat]);

  const handleSend = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    sendMessage(t);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, idx) => {
          const isLast = idx === messages.length - 1;
          const showDots = isLast && msg.role === "assistant" && loading;
          return (
            <div key={msg.id} className="msg-appear">
              <Message msg={{ ...msg, loading: showDots }} />
            </div>
          );
        })}
        {error && (
          <div style={{ border: "2px solid #ff3b30", padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "#ff3b30" }}>
            ✕ ERROR: {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <ChatInput value={input} onChange={setInput} onSend={handleSend} onStop={stopStreaming} streaming={streaming} disabled={false} />
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  src/components/Header.jsx
// ══════════════════════════════════════════════════════
const MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Sonnet 4" },
  { id: "claude-opus-4-5", label: "Opus 4.5" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

function Header({ streaming, model, onModelChange, onToggleSidebar, onClear }) {
  return (
    <div style={{ borderBottom: "2px solid #000", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" style={{ padding: "5px 10px", fontSize: 13 }} onClick={onToggleSidebar}>☰</button>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 900, fontSize: 15, letterSpacing: 2, textTransform: "uppercase" }}>LLM_CHAT</span>
        <div style={{ width: 8, height: 8, border: "2px solid #000", background: streaming ? "#00c851" : "#000", animation: streaming ? "blink 1s step-end infinite" : "none" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select value={model} onChange={e => onModelChange(e.target.value)} disabled={streaming}
          style={{ border: "2px solid #000", background: "#fff", fontFamily: "monospace", fontSize: 11, fontWeight: 700, padding: "5px 8px", cursor: "pointer" }}>
          {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <button className="btn" onClick={onClear} disabled={streaming}>CLEAR</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  src/components/Sidebar.jsx
// ══════════════════════════════════════════════════════
function TokenBar({ count }) {
  const pct = Math.min(100, Math.round((count / MAX_HISTORY_CHARS) * 100));
  const color = pct > 80 ? "#ff3b30" : pct > 50 ? "#ff9500" : "#000";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 11, color: "#555" }}>
      <div style={{ width: 52, height: 4, border: "1px solid #ccc", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, transition: "width 0.3s" }} />
      </div>
      <span>{count.toLocaleString()} ch</span>
    </div>
  );
}

function Sidebar({ conversations, charCount, onNewChat, onSelect }) {
  return (
    <div style={{ width: 220, borderRight: "2px solid #000", display: "flex", flexDirection: "column", flexShrink: 0, background: "#fff" }}>
      <div style={{ padding: "12px 14px", borderBottom: "2px solid #000", fontFamily: "monospace", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>HISTORY</div>
      <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
        {conversations.map(c => (
          <div key={c.id} onClick={() => onSelect?.(c.id)}
            style={{ padding: "8px 10px", border: `2px solid ${c.active ? "#000" : "#e0e0e0"}`, marginBottom: 6, cursor: "pointer", fontFamily: "monospace", fontSize: 12, background: c.active ? "#000" : "#fff", color: c.active ? "#fff" : "#000", userSelect: "none" }}>
            {c.label}
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 12px", borderTop: "2px solid #000", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, color: "#aaa", letterSpacing: .5 }}>CONTEXT</span>
          <TokenBar count={charCount} />
        </div>
        <button className="btn" style={{ width: "100%" }} onClick={onNewChat}>+ NEW CHAT</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
//  src/App.jsx
// ══════════════════════════════════════════════════════
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;500;700&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes dotBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
      .msg-appear{animation:fadeIn .18s ease forwards}
      .md-content h1,.md-content h2,.md-content h3{font-family:'IBM Plex Mono',monospace;font-weight:700;margin:12px 0 6px;border-bottom:1px solid #000;padding-bottom:4px}
      .md-content h1{font-size:16px}.md-content h2{font-size:14px}.md-content h3{font-size:13px}
      .md-content p{margin:6px 0}.md-content ul,.md-content ol{padding-left:18px;margin:6px 0}.md-content li{margin:3px 0}
      .md-content code{background:#f0f0f0;border:1px solid #ccc;padding:1px 5px;font-family:'IBM Plex Mono',monospace;font-size:12px}
      .md-content pre{background:#f5f5f5;border:1px solid #ddd;border-left:3px solid #000;padding:10px 12px;margin:8px 0;overflow-x:auto;font-size:12px;position:relative}
      .md-content pre[data-lang]::before{content:attr(data-lang);position:absolute;top:4px;right:8px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1px}
      .md-content pre code{background:none;border:none;padding:0;font-size:12px;line-height:1.6}
      .md-content strong{font-weight:700}.md-content em{font-style:italic}
      textarea:focus,select:focus{outline:none}
      ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#f0f0f0}::-webkit-scrollbar-thumb{background:#bbb}
      .btn{border:2px solid #000;background:#fff;color:#000;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;padding:6px 12px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;transition:background .1s,color .1s}
      .btn:hover{background:#000;color:#fff}.btn:disabled{opacity:.4;cursor:not-allowed}.btn:disabled:hover{background:#fff;color:#000}
      .btn-danger{border-color:#ff3b30;color:#ff3b30}.btn-danger:hover{background:#ff3b30;color:#fff}
      .btn-primary{background:#000;color:#fff}.btn-primary:hover{background:#333}.btn-primary:disabled:hover{background:#000}
    `}</style>
  );
}

export default function App() {
  const [model, setModel] = useState(MODELS[0].id);
  const [streaming, setStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [conversations, setConversations] = useState([{ id: "main", label: "对话 #1", active: true }]);
  const chatRef = useRef(null);

  const handleClear = () => { chatRef.current?.clear(); setCharCount(0); };
  const handleNewChat = () => {
    setConversations(prev => [
      ...prev.map(c => ({ ...c, active: false })),
      { id: uid(), label: `对话 #${prev.length + 1}`, active: true },
    ]);
    chatRef.current?.clear();
    setCharCount(0);
  };

  return (
    <>
      <GlobalStyles />
      <div style={{ display: "flex", height: "100vh", width: "100%", fontFamily: "'IBM Plex Sans',sans-serif", background: "#fff", color: "#000", overflow: "hidden" }}>
        {showSidebar && (
          <Sidebar
            conversations={conversations}
            charCount={charCount}
            onNewChat={handleNewChat}
            onSelect={id => setConversations(prev => prev.map(c => ({ ...c, active: c.id === id })))}
          />
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Header
            streaming={streaming} model={model}
            onModelChange={setModel}
            onToggleSidebar={() => setShowSidebar(v => !v)}
            onClear={handleClear}
          />
          {/* useMock=true → mock 模式预览；useMock=false → 真实 API */}
          <Chat model={model} useMock={true} onStreamChange={setStreaming} chatRef={chatRef} />
        </div>
      </div>
    </>
  );
}
