import { useState } from 'react';
import { BookOpen, CheckCircle2, Eye } from 'lucide-react';

interface PanicShieldProps {
  onExit: () => void;
}

const FLASHCARDS = [
  {
    term: 'Glycolysis',
    def: 'Anaerobic breakdown of 1 glucose (6C) into 2 pyruvate (3C) in the cytosol; yields 2 net ATP and 2 NADH.',
  },
  {
    term: 'Citric Acid (Krebs) Cycle',
    def: 'Occurs in the mitochondrial matrix; oxidizes acetyl-CoA into CO₂ while generating 6 NADH, 2 FADH₂, and 2 ATP per glucose.',
  },
  {
    term: 'Oxidative Phosphorylation',
    def: 'Electron transport chain + chemiosmosis across the inner mitochondrial membrane; O₂ serves as final electron acceptor (~28–32 ATP).',
  },
];

export default function PanicShield({ onExit }: PanicShieldProps) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f8fafc] text-slate-900">
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-blue-700" />
            <span className="text-base font-semibold text-slate-900">
              AP Biology — Unit 3 Review Notes
            </span>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Cellular Energetics · Chapter 9
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8 space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            Cellular Respiration &amp; ATP Synthesis Summary
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Cellular respiration is the catabolic pathway by which eukaryotic cells harvest chemical
            energy stored in organic molecules (primarily glucose) to synthesize adenosine
            triphosphate (ATP). The overall balanced reaction is:
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800">
            C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O + Energy (ATP + Heat)
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Key Metabolic Stages Checklist
          </h2>
          <div className="space-y-3">
            {FLASHCARDS.map((card, i) => (
              <button
                key={card.term}
                type="button"
                onClick={() => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))}
                className="flex w-full items-start gap-3 rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <CheckCircle2
                  className={`mt-0.5 h-5 w-5 shrink-0 ${
                    checked[i] ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">{card.term}</div>
                  <div className="mt-1 text-sm text-slate-600">{card.def}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>

      <button
        type="button"
        onClick={onExit}
        title="Return to workspace"
        className="fixed bottom-4 right-4 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm hover:text-slate-800 cursor-pointer"
      >
        <Eye className="h-3.5 w-3.5" />
        <span>Resume</span>
      </button>
    </div>
  );
}
