import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Ic } from './icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen pz-scope flex items-center justify-center p-8" style={{ background: 'var(--pz-bg)' }}>
          <div className="pz-card p-12 max-w-lg w-full text-center">
            <div className="mb-6 flex justify-center text-amber-400"><Ic.Warning size={64} /></div>
            <div className="pz-eyebrow mb-3">Connection Lost</div>
            <h1 className="text-3xl text-white mb-4">
              Something Went Wrong
            </h1>
            <p className="mb-6" style={{ color: 'var(--pz-text)' }}>
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <div className="bg-red-500/10 border border-red-500/40 p-4 mb-6 text-left" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }}>
                <p className="text-red-300 text-sm font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleRetry}
                className="pz-btn px-8 py-4 text-xs"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="pz-btn-ghost px-8 py-4 text-xs"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
