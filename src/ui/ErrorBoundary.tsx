import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Forma crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas p-8 text-center font-sans text-ink">
        <h1 className="font-display text-[22px] font-bold">Something went wrong</h1>
        <p className="max-w-md text-[12.5px] text-ink/60">
          Your saved design is untouched. Reloading usually recovers the session.
        </p>
        <pre className="max-w-md overflow-x-auto rounded-lg bg-surface p-3 text-left font-mono text-[11px] text-ink/50">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 h-8 rounded-[7px] bg-accent px-4 text-[12.5px] font-bold text-canvas"
        >
          Reload
        </button>
      </div>
    );
  }
}
