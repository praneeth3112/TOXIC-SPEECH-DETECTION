import {
  ShieldCheck,
  ScanSearch,
  Layers,
  SlidersHorizontal,
  History,
  X,
} from 'lucide-react';

export type WorkspaceTab = 'analyzer' | 'batch' | 'policy' | 'history';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  historyCount: number;
  batchCount: number;
  policyName: string;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  description: string;
  icon: typeof ScanSearch;
}> = [
  {
    id: 'analyzer',
    label: 'Live Analyzer',
    description: 'Deep scan & detoxification',
    icon: ScanSearch,
  },
  {
    id: 'batch',
    label: 'Batch Queue',
    description: 'Multi-line & CSV moderation',
    icon: Layers,
  },
  {
    id: 'policy',
    label: 'Policy Rules',
    description: 'Thresholds & guardrails',
    icon: SlidersHorizontal,
  },
  {
    id: 'history',
    label: 'Moderation Log',
    description: 'Session metrics & audit',
    icon: History,
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  historyCount,
  batchCount,
  policyName,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200 w-64">
      <div className="flex items-center justify-between px-5 h-16 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            ToxicShield AI
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Workspace navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const count =
            item.id === 'history'
              ? historyCount
              : item.id === 'batch'
                ? batchCount
                : undefined;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors focus-visible:outline-2 focus-visible:outline-slate-900 ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-white' : 'text-slate-500'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-tight whitespace-nowrap truncate">
                    {item.label}
                  </div>
                  <div
                    className={`text-xs leading-tight mt-0.5 truncate ${
                      isActive ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {item.description}
                  </div>
                </div>
              </div>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`font-mono text-xs tabular-nums shrink-0 ${
                    isActive ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-slate-200 text-xs text-slate-600 space-y-1">
        <div className="font-medium text-slate-800">Active Guardrail</div>
        <div className="text-slate-500 truncate">{policyName}</div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 h-full">{navContent}</div>
        </div>
      )}
    </>
  );
}
