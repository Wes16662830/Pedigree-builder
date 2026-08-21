import { Component, type ErrorInfo, type ReactNode } from 'react';

// A page-level crash (an uncaught exception during render) leaves React
// with nothing to show and the whole app goes blank — worse than useless
// when trying to diagnose what broke. This catches that and shows the
// actual error instead, with a way back out. Give it a `key` tied to
// whatever identifies the current page/view so navigating away and back
// resets it, rather than staying tripped forever once one page misbehaves.
interface Props {
  children: ReactNode;
}
interface State {
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] caught render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="mx-auto max-w-2xl py-8">
          <h1 className="mb-2 text-xl font-semibold text-red-700">Something went wrong showing this page</h1>
          <p className="mb-3 text-sm text-neutral-600">
            This is a bug, not something you did — please share the error text below so it can be fixed. Going back or reloading is safe; nothing was
            lost.
          </p>
          <pre className="mb-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-100 p-3 text-xs text-neutral-800">
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
          <button onClick={() => window.location.reload()} className="rounded-md px-4 py-2 text-sm font-medium text-white" style={{ background: '#111111' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
