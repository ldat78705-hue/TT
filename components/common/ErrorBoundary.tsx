import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center flex-col p-8 text-center bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mb-4"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <h1 className="text-2xl font-bold">Đã xảy ra lỗi hệ thống</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-lg mb-6">
                Rất xin lỗi vì sự bất tiện này. Vui lòng tải lại trang để thử lại.
            </p>
            <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
                Tải lại trang
            </button>
            {this.state.error && (
                <pre className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded text-left text-sm overflow-auto max-w-2xl w-full text-red-600 dark:text-red-400">
                    {this.state.error.toString()}
                </pre>
            )}
        </div>
      );
    }

    return this.props.children;
  }
}
