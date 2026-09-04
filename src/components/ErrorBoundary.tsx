import { Component, ErrorInfo, ReactNode } from 'react';

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

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--surface))] p-8">
          <div className="max-w-2xl w-full bg-[hsl(var(--surface-container-lowest))] rounded-2xl p-8 shadow-xl">
            <h1 className="text-2xl font-bold text-red-600 mb-4">页面渲染出错</h1>
            <div className="bg-red-50 rounded-lg p-4 mb-4 overflow-auto">
              <p className="text-red-800 font-mono text-sm mb-2">{this.state.error?.toString()}</p>
              <pre className="text-red-600 text-xs whitespace-pre-wrap">
                {this.state.errorInfo?.componentStack}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-lg hover:opacity-90"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
