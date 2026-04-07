import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Providers } from "./Providers.jsx";
import "./index.css";

function showError(label, err) {
  const root = document.getElementById("root");
  root.innerHTML = `<pre style="color:#ff9aa2;background:#1a0a0a;padding:16px;white-space:pre-wrap;font:12px ui-monospace,monospace">[${label}]\n${err && (err.stack || err.message || err)}</pre>`;
}

window.addEventListener("error", (e) => showError("window.error", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => showError("unhandledrejection", e.reason));

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error(err, info); }
  render() {
    if (this.state.err) {
      return <pre style={{color:"#ff9aa2",background:"#1a0a0a",padding:16,whiteSpace:"pre-wrap",font:"12px ui-monospace,monospace"}}>{`[render]\n${this.state.err.stack || this.state.err.message}`}</pre>;
    }
    return this.props.children;
  }
}

try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Providers>
          <App />
        </Providers>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (err) {
  showError("createRoot", err);
}
