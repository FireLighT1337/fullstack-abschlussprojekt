import React, { useMemo } from "react";
import { toast } from "react-toastify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import "./Message.css";

function getPlainText(node) {
  // Recursively extract text from React nodes
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getPlainText).join("");
  if (typeof node === "object" && "props" in node) {
    return getPlainText(node.props?.children);
  }
  return "";
}

function getLanguage(className) {
  if (!className) return "text";
  // className can be: "hljs language-cpp", "hljs cpp", "language-js", etc.
  const parts = className.split(/\s+/).filter(Boolean);
  const prefixed = parts
    .map((p) =>
      p.startsWith("language-") ? p.slice("language-".length) : null,
    )
    .find(Boolean);
  if (prefixed) return prefixed;

  // fallback: take first non-hljs token if present
  const fallback = parts.find((p) => p !== "hljs");
  return fallback || "text";
}

function CodeBlock({ inline, className, children, ...props }) {
  const lang = getLanguage(className);

  if (inline) {
    return (
      <code className={`code-inline ${className || ""}`} {...props}>
        {children}
      </code>
    );
  }

  const plainText = getPlainText(children);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText);
      toast.success("Kopiert!");
    } catch {
      toast.error("Kopieren fehlgeschlagen", { toastId: "copy_failure" });
    }
  };

  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span className="lang">{lang}</span>
        <button className="copy-btn" onClick={copy} aria-label="Code kopieren">
          Copy
        </button>
      </div>
      <pre className={className}>
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function TableWrapper({ children }) {
  return <div className="table-wrapper">{children}</div>;
}

const Message = React.memo(({ sender, text, timestamp, isOwnMessage }) => {
  const components = useMemo(
    () => ({
      a: ({ node, children, ...props }) => (
        <a {...props} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
      code: CodeBlock,
      table: TableWrapper,
    }),
    [],
  );

  return (
    <div className={isOwnMessage ? "own-message" : "other-message"}>
      <div className="message-header">
        <span className={isOwnMessage ? "user" : "bernd"}>{sender}</span>
        <span className="timestamp">{timestamp}</span>
      </div>

      <div className="message-text">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]} // tables, task lists, strikethrough
          rehypePlugins={[
            rehypeRaw,
            [rehypeHighlight, { ignoreMissing: true }],
          ]} // syntax highlighting
          components={components}
        >
          {text || ""}
        </ReactMarkdown>
      </div>
    </div>
  );
});
export default Message;
