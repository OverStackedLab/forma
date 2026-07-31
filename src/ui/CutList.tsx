import { useMemo } from 'react';
import { computeBOM } from '@/domain/bom';
import { SHEET } from '@/domain/catalog';
import { csvHeaders, toCSV } from '@/domain/csv';
import { formatLength } from '@/domain/units';
import { useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import { downloadBlob } from './download';
import { Icon } from './primitives/Icon';

const COLUMNS = 'grid grid-cols-[2fr_.5fr_1.1fr_.7fr_.7fr_.7fr_.9fr_.9fr] gap-x-2.5';

export function CutList() {
  const doc = useDocumentStore();
  const showToast = useUiStore((s) => s.showToast);
  const unit = useUiStore((s) => s.displayUnit);

  // The table, the summary cards and the CSV all read this one result.
  const bom = useMemo(
    () =>
      computeBOM({
        customParts: doc.customParts,
        overrides: doc.overrides,
        transforms: doc.transforms,
        defaultFinishId: doc.defaultFinishId,
      }),
    [doc],
  );

  const handleExport = () => {
    downloadBlob(
      new Blob([toCSV(bom.rows, unit)], { type: 'text/csv;charset=utf-8' }),
      'cut-list.csv',
    );
    showToast('Cut list exported');
  };

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-panel">
      <div className="mx-auto max-w-[900px] px-8 pt-9 pb-15">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[22px] font-bold text-ink">Cut List</h1>
            <p className="mt-1 text-[12.5px] text-ink/45">
              {doc.docTitle} · {bom.totals.partCount}{' '}
              {bom.totals.partCount === 1 ? 'part' : 'parts'}
            </p>
          </div>
          <button
            type="button"
            disabled={bom.rows.length === 0}
            onClick={handleExport}
            className="flex h-8 items-center gap-1.5 rounded-[7px] bg-accent px-3.5 text-[12.5px] font-bold text-canvas disabled:opacity-40"
          >
            <Icon name="download" size={16} />
            Export CSV
          </button>
        </header>

        {bom.rows.length === 0 ? (
          <p className="rounded-lg border border-hairline bg-surface px-3.5 py-6 text-center text-[12.5px] text-ink/45">
            Nothing to cut yet. Insert a panel from the Library in Model mode.
          </p>
        ) : (
          <>
            <div className="mb-6 flex gap-3">
              <SummaryCard
                label="Sheets Needed"
                value={String(bom.totals.sheets)}
                caption={`${formatLength(SHEET.width, unit)}×${formatLength(SHEET.height, unit)} ply`}
              />
              <SummaryCard
                label="Edge Banding"
                value={bom.totals.edgeBandM.toFixed(1)}
                caption="metres"
              />
              <SummaryCard
                label="Parts"
                value={String(bom.totals.partCount)}
                caption="total pieces"
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-hairline">
              <div
                className={`${COLUMNS} bg-surface px-3.5 py-2.5 text-[10.5px] font-semibold tracking-[.04em] text-ink/45 uppercase`}
              >
                {csvHeaders(unit).map((h) => (
                  <span key={h}>{h}</span>
                ))}
              </div>
              {bom.rows.map((row, i) => (
                <div
                  key={`${row.label}-${i}`}
                  className={`${COLUMNS} border-t border-white/6 px-3.5 py-2.5 font-mono text-xs text-ink/80`}
                >
                  <span className="font-sans text-ink">{row.label}</span>
                  <span>{row.qty}</span>
                  <span className="font-sans">{row.material}</span>
                  <span>{formatLength(row.w, unit)}</span>
                  <span>{formatLength(row.h, unit)}</span>
                  <span>{formatLength(row.d, unit)}</span>
                  <span>{row.edge ? 'Y' : 'N'}</span>
                  <span>{row.grain}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="flex-1 rounded-lg bg-surface px-3.5 py-3">
      <div className="text-[11px] font-semibold tracking-[.04em] text-ink/45 uppercase">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg text-ink">{value}</div>
      <div className="text-[10.5px] text-ink/35">{caption}</div>
    </div>
  );
}
