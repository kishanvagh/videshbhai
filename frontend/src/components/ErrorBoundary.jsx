import React from 'react';

/**
 * Prevents the entire app from going blank (white screen) when a runtime
 * rendering error occurs. Shows the error message + recovery options instead.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Keep the details in the DOM so they can be inspected / reported
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.href = window.location.pathname;
    }
  };

  handleBackHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="card max-w-md w-full text-center py-10">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Something went wrong</h2>
            <p className="text-sm text-gray-500 mb-4">
              An unexpected error occurred while rendering this page. Your data is safe.
            </p>
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg p-3 mb-5 break-words">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={this.handleReload} className="btn-primary text-sm">
                Reload Page
              </button>
              <button onClick={this.handleBackHome} className="btn-secondary text-sm">
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
