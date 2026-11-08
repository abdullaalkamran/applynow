import { Component, type ErrorInfo, type ReactNode } from "react";

/** Wraps one optional section of a page (accreditations, careers…). If that section throws while rendering — say a record
 * holds data in an unexpected shape — only the section disappears; the rest of the page, and what a crawler sees, stays. */
export class SectionBoundary extends Component<{ children: ReactNode; name?: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Section "${this.props.name ?? "unnamed"}" failed to render:`, error, info.componentStack);
  }
  render() { return this.state.failed ? null : this.props.children; }
}
