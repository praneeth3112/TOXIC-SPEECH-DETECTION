import { useEffect, useState } from 'react';
import { Sidebar, type WorkspaceTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AnalyzerView } from './components/AnalyzerView';
import { BatchView } from './components/BatchView';
import { PolicyView } from './components/PolicyView';
import { HistoryView } from './components/HistoryView';
import { POLICY_PRESETS, SAMPLE_INPUTS } from './data/presets';
import type {
  AnalysisResult,
  BatchItemResult,
  ModerationPolicy,
} from './types/moderation';

const HISTORY_STORAGE_KEY = 'toxicshield_history_v1';
const POLICY_STORAGE_KEY = 'toxicshield_policy_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('analyzer');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [policy, setPolicy] = useState<ModerationPolicy>(() => {
    try {
      const saved = localStorage.getItem(POLICY_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as ModerationPolicy;
    } catch {
      // ignore storage errors
    }
    return POLICY_PRESETS[1]; // Workplace & PR Review default
  });

  const [history, setHistory] = useState<AnalysisResult[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as AnalysisResult[];
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [batchResults, setBatchResults] = useState<BatchItemResult[]>([]);
  const [inspectedItem, setInspectedItem] = useState<AnalysisResult | null>(null);
  const [analyzerKey, setAnalyzerKey] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
    } catch {
      // ignore storage errors
    }
  }, [policy]);

  useEffect(() => {
    try {
      localStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(history.slice(0, 50))
      );
    } catch {
      // ignore storage errors
    }
  }, [history]);

  function handleAnalysisComplete(result: AnalysisResult) {
    setHistory((prev) => [result, ...prev.slice(0, 49)]);
  }

  function handleInspectHistoryItem(item: AnalysisResult) {
    setInspectedItem(item);
    setAnalyzerKey((k) => k + 1);
    setActiveTab('analyzer');
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        historyCount={history.length}
        batchCount={batchResults.length}
        policyName={policy.name}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeTab={activeTab}
          policyName={policy.name}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenPolicy={() => setActiveTab('policy')}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'analyzer' && (
            <AnalyzerView
              key={analyzerKey}
              policy={policy}
              onAnalysisComplete={handleAnalysisComplete}
              initialText={inspectedItem?.text ?? SAMPLE_INPUTS[0].text}
              initialResult={inspectedItem}
            />
          )}

          {activeTab === 'batch' && (
            <BatchView
              policy={policy}
              results={batchResults}
              onBatchComplete={(items) => setBatchResults(items)}
              onClearBatch={() => setBatchResults([])}
            />
          )}

          {activeTab === 'policy' && (
            <PolicyView policy={policy} onChangePolicy={setPolicy} />
          )}

          {activeTab === 'history' && (
            <HistoryView
              history={history}
              onInspectItem={handleInspectHistoryItem}
              onClearHistory={() => setHistory([])}
            />
          )}
        </main>
      </div>
    </div>
  );
}
