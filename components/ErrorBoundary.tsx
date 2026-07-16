import React, { Component, ErrorInfo, ReactNode } from 'react';

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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-12 max-w-lg w-full text-center">
            <div className="text-7xl mb-6">⚠️</div>
            <h1 className="text-3xl font-display font-black text-slate-900 mb-4 uppercase">
              Something Went Wrong
            </h1>
            <p className="text-slate-600 mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                <p className="text-red-800 text-sm font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleRetry}
                className="bg-brand-blue text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg hover:bg-blue-600 transition-all"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-300 transition-all"
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
