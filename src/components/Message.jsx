// src/components/Message.jsx
// 职责：渲染单条消息
//   - user 消息：右对齐，黑底白字
//   - assistant 消息：左对齐，白底黑字，Markdown + 代码高亮
//   - system-notice：居中小字提示
//   - loading 状态：三点跳动动画

// Markdown 解析（轻量自实现，无需安装 react-markdown）
// 生产项目可替换为：npm install react-markdown react-syntax-highlighter
function parseMarkdown(text) {
  // 代码块（含语言标注）
  let html = text.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_, lang, code) => {
      const escaped = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<pre data-lang="${lang || "code"}"><code>${escaped}</code></pre>`;
    }
  );
  // 行内代码
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // 粗体 / 斜体
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // 标题
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // 无序列表
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  // 把连续 <li> 包进 <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  // 段落
  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br/>");
  html = html.replace(/^(?!<[hupcobi])(.+)$/gm, m => m.trim() ? `<p>${m}</p>` : m);
  return html;
}

// StreamingCursor — 流式光标
function StreamingCursor() {
  return (
    <span style={{
      display: "inline-block",
      width: 2,
      height: "1em",
      background: "#000",
      marginLeft: 2,
      verticalAlign: "text-bottom",
      animation: "blink 1s step-end infinite",
    }} />
  );
}

// ThinkingDots — Loading 三点跳动 
export function ThinkingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", height: "1em" }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5,
          height: 5,
          background: "#888",
          display: "inline-block",
          animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}

// Avatar — 用户 / AI 头像
function Avatar({ role }) {
  const isUser = role === "user";
  return (
    <div style={{
      width: 28,
      height: 28,
      border: "2px solid #000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 10,
      fontWeight: 900,
      fontFamily: "monospace",
      flexShrink: 0,
      marginTop: 2,
      background: isUser ? "#fff" : "#000",
      color: isUser ? "#000" : "#fff",
      letterSpacing: 0,
    }}>
      {isUser ? "U" : "AI"}
    </div>
  );
}

// Message — 主导出
/**
 * Props:
 *   msg.role      : "user" | "assistant" | "system-notice"
 *   msg.content   : string
 *   msg.streaming : boolean  (助手流式输出中)
 *   msg.loading   : boolean  (等待首字节，显示三点)
 */
export default function Message({ msg }) {
  const isUser = msg.role === "user";
  const isNotice = msg.role === "system-notice";

  // 系统通知
  if (isNotice) {
    return (
      <div style={{
        textAlign: "center",
        fontSize: 11,
        color: "#888",
        fontFamily: "monospace",
        padding: "4px 0",
        letterSpacing: 1,
      }}>
        — {msg.content} —
      </div>
    );
  }

  //气泡内容
  const bubbleContent = isUser ? (
    // 用户消息：纯文本，保留换行
    <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
  ) : msg.loading ? (
    // AI loading 状态：三点跳动
    <ThinkingDots />
  ) : (
    // AI 消息：Markdown 渲染 + 流式光标
    <>
      <div
        className="md-content"
        dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
      />
      {msg.streaming && <StreamingCursor />}
    </>
  );

  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      alignItems: "flex-start",
      gap: 8,
    }}>
      {!isUser && <Avatar role="assistant" />}

      <div style={{
        maxWidth: "72%",
        padding: "10px 14px",
        border: "2px solid #000",
        background: isUser ? "#000" : "#fff",
        color: isUser ? "#fff" : "#000",
        fontFamily: isUser ? "'IBM Plex Mono', monospace" : "'IBM Plex Sans', sans-serif",
        fontSize: 14,
        lineHeight: 1.65,
        wordBreak: "break-word",
      }}>
        {bubbleContent}
      </div>

      {isUser && <Avatar role="user" />}
    </div>
  );
}
