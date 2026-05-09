// src/App.jsx
// 职责：应用根组件
//   - 注入全局样式
//   - 管理：model、showSidebar、conversations、streaming
//   - 组合 Header + Sidebar + Chat

import { useState, useRef } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import Chat from "./components/Chat";

// uid
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// GlobalStyles — CSS 注入 
// 生产项目中改为 import "./styles/globals.css"
// 此处内联是为了 Artifact / CodeSandbox 单文件预览兼容
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;500;700&display=swap');

      * { box-sizing: border-box; margin: 0; padding: 0; }

      @keyframes blink   { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes fadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      @keyframes dotBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }

      .msg-appear { animation: fadeIn 0.18s ease forwards; }

      .md-content h1,.md-content h2,.md-content h3 {
        font-family:'IBM Plex Mono',monospace; font-weight:700;
        margin:12px 0 6px; border-bottom:1px solid #000; padding-bottom:4px;
      }
      .md-content h1{font-size:16px} .md-content h2{font-size:14px} .md-content h3{font-size:13px}
      .md-content p{margin:6px 0}
      .md-content ul,.md-content ol{padding-left:18px;margin:6px 0}
      .md-content li{margin:3px 0}
      .md-content code{background:#f0f0f0;border:1px solid #ccc;padding:1px 5px;font-family:'IBM Plex Mono',monospace;font-size:12px}
      .md-content pre{background:#f5f5f5;border:1px solid #ddd;border-left:3px solid #000;padding:10px 12px;margin:8px 0;overflow-x:auto;font-size:12px;position:relative}
      .md-content pre[data-lang]::before{content:attr(data-lang);position:absolute;top:4px;right:8px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:1px}
      .md-content pre code{background:none;border:none;padding:0;font-size:12px;line-height:1.6}
      .md-content strong{font-weight:700} .md-content em{font-style:italic}

      textarea:focus,select:focus{outline:none}
      ::-webkit-scrollbar{width:4px}
      ::-webkit-scrollbar-track{background:#f0f0f0}
      ::-webkit-scrollbar-thumb{background:#bbb}

      .btn{border:2px solid #000;background:#fff;color:#000;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;padding:6px 12px;cursor:pointer;letter-spacing:1px;text-transform:uppercase;transition:background .1s,color .1s}
      .btn:hover{background:#000;color:#fff}
      .btn:disabled{opacity:.4;cursor:not-allowed}
      .btn:disabled:hover{background:#fff;color:#000}
      .btn-danger{border-color:#ff3b30;color:#ff3b30}
      .btn-danger:hover{background:#ff3b30;color:#fff}
      .btn-primary{background:#000;color:#fff}
      .btn-primary:hover{background:#333}
      .btn-primary:disabled:hover{background:#000}
    `}</style>
  );
}

// App 
export default function App() {
  const [model, setModel] = useState("gpt-4.1-mini");
  const [streaming, setStreaming] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [conversations, setConversations] = useState([
    { id: "main", label: "对话 #1", active: true },
  ]);

  // chatRef：命令式调用 Chat 内部的 clear()
  const chatRef = useRef(null);

  const handleClear = () => {
    chatRef.current?.clear();
    setCharCount(0);
  };

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

      <div style={{
        display: "flex",
        height: "100vh",
        width: "100%",
        fontFamily: "'IBM Plex Sans', sans-serif",
        background: "#fff",
        color: "#000",
        overflow: "hidden",
      }}>

        {/* 侧边栏 */}
        {showSidebar && (
          <Sidebar
            conversations={conversations}
            charCount={charCount}
            onNewChat={handleNewChat}
            onSelect={(id) =>
              setConversations(prev =>
                prev.map(c => ({ ...c, active: c.id === id }))
              )
            }
          />
        )}

        {/* 主体 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Header
            streaming={streaming}
            model={model}
            onModelChange={setModel}
            onToggleSidebar={() => setShowSidebar(v => !v)}
            onClear={handleClear}
          />

          <Chat model={model} useMock={true} onStreamChange={setStreaming} chatRef={chatRef} />
        </div>
      </div>
    </>
  );
}
