import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { clearPersonalDataScope } from '../utils/storage';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('DAKNUX UI boundary caught an error:', error.message, info.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090d] px-4 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-6 shadow-2xl">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-white">Something interrupted this view</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            An unexpected rendering issue occurred. Your saved favorites and play history in browser
            storage remain intact.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reload Page</span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearPersonalDataScope('preferences');
                window.location.reload();
              }}
              className="inline-flex h-10 items-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-200 hover:bg-white/10 cursor-pointer"
            >
              Reset Display Preferences
            </button>
          </div>
        </div>
      </div>
    );
  }
}
