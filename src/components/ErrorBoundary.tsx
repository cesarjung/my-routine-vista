import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-500 bg-red-50 min-h-screen">
          <h1 className="text-2xl font-bold mb-4">Ocorreu um Erro de Renderização!</h1>
          <p className="mb-2 text-black font-semibold">Mensagem: {this.state.error?.message}</p>
          <pre className="text-sm bg-white p-4 border border-red-200 overflow-auto max-w-full">
            {this.state.error?.stack}
          </pre>
          <pre className="text-sm bg-white p-4 mt-4 border border-red-200 overflow-auto max-w-full">
            {this.state.errorInfo?.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
