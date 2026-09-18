import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, a render-time error unmounts the whole app silently — a dark
 * body background plus nothing rendered looks exactly like a black screen
 * with no clue why. This turns that into a visible message.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[cordis-tutorial] render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace", color: "#e6e8ec", background: "#0f1115", minHeight: "100vh" }}>
          <h2>Something crashed</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre>
          <p>Check the browser console for the full stack trace, then reload.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
