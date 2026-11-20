import { Menu, SlidersHorizontal } from 'lucide-react';
import type { WorkspaceTab } from './Sidebar';

interface TopBarProps {
  activeTab: WorkspaceTab;
  policyName: string;
  onOpenMobileNav: () => void;
  onOpenPolicy: () => void;
}

const TAB_TITLES: Record<WorkspaceTab, string> = {
  analyzer: 'Live Content Analyzer',
  batch: 'Batch Moderation Queue',
  policy: 'Policy & Threshold Rules',
  history: 'Session Moderation Log',
};

export function TopBar({
  activeTab,
  policyName,
  onOpenMobileNav,
  onOpenPolicy,
}: TopBarProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-500 whitespace-nowrap hidden sm:inline">
            ToxicShield AI
          </span>
          <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden md:inline text-xs text-slate-500 whitespace-nowrap">
          Policy: <strong className="font-medium text-slate-800">{policyName}</strong>
        </span>
        {activeTab !== 'policy' && (
          <button
            type="button"
            onClick={onOpenPolicy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            Configure Policy
          </button>
        )}
      </div>
    </header>
  );
}
