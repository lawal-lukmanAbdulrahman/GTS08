"use client";

import { Component } from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center px-7">
          <div className="text-center max-w-md">
            <h2 className="font-display text-2xl font-bold mb-3">
              Something went wrong
            </h2>
            <p className="text-txt-2 mb-6">
              We hit an unexpected error. Please try refreshing the page.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="inline-flex items-center gap-2 font-semibold text-sm py-2.5 px-5 rounded-full bg-green text-white hover:bg-green-hover transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
