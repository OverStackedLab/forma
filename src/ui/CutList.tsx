import { useMemo } from 'react';
import { computeBOM } from '@/domain/bom';
import { SHEET } from '@/domain/catalog';
import { csvHeaders, toCSV, CSV_BOM } from '@/domain/csv';
import { formatLength } from '@/domain/units';
import { useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import { downloadBlob } from './download';
import { Icon } from './primitives/Icon';

const COLUMNS = 'grid grid-cols-[1.8fr_.4fr_1.1fr_.6fr_.6fr_.6fr_.7fr_1.2fr_.9fr] gap-x-2.5';

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
        defaultMaterialId: doc.defaultMaterialId,
        defaultColorId: doc.defaultColorId,
        defaultHardwareFinishId: doc.defaultHardwareFinishId,
      }),
    [doc],
  );

  const handleExport = () => {
    // The BOM is added here rather than in `toCSV` so the serializer stays a
    // pure string function that unit tests can compare directly.
    downloadBlob(
      new Blob([CSV_BOM, toCSV(bom.rows, unit)], { type: 'text/csv;charset=utf-8' }),
      'cut-list.csv',
    );
    showToast('Cut list exported');
  };

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-panel">
      <div className="mx-auto max-w-[1100px] px-8 pt-9 pb-15">
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
            Nothing to manufacture yet. Insert a panel or hardware item from the Library.
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

            {bom.sheetRequirements.length > 0 && (
              <div className="mb-6 rounded-lg border border-hairline bg-surface px-3.5 py-3">
                <h2 className="text-[10.5px] font-semibold tracking-[.04em] text-ink/45 uppercase">
                  Sheet breakdown
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {bom.sheetRequirements.map((requirement) => (
                    <span
                      key={`${requirement.finish}-${requirement.thickness}`}
                      className="rounded-md bg-input px-2.5 py-1.5 font-mono text-[11px] text-ink/70"
                    >
                      {requirement.sheets} × {requirement.finish}, {formatLength(requirement.thickness, unit)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {bom.sheetRows.length > 0 && (
              <ManufacturingTable title="Sheet Goods" rows={bom.sheetRows} unit={unit} />
            )}
            {bom.hardwareRows.length > 0 && (
              <ManufacturingTable title="Purchased Hardware" rows={bom.hardwareRows} unit={unit} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ManufacturingTable({
  title,
  rows,
  unit,
}: {
  title: string;
  rows: ReturnType<typeof computeBOM>['rows'];
  unit: ReturnType<typeof useUiStore.getState>['displayUnit'];
}) {
  const headers = csvHeaders(unit).slice(1);
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[12px] font-semibold text-ink/75">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-hairline">
        <div
          className={`${COLUMNS} bg-surface px-3.5 py-2.5 text-[10.5px] font-semibold tracking-[.04em] text-ink/45 uppercase`}
        >
          {headers.map((header) => <span key={header}>{header}</span>)}
        </div>
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className={`${COLUMNS} border-t border-white/6 px-3.5 py-2.5 font-mono text-xs text-ink/80`}
          >
            <span className="font-sans text-ink">{row.label}</span>
            <span>{row.qty}</span>
            <span className="font-sans">{row.finish}</span>
            <span>{formatLength(row.w, unit)}</span>
            <span>{formatLength(row.h, unit)}</span>
            <span>{formatLength(row.d, unit)}</span>
            <span>{row.thickness === null ? '—' : formatLength(row.thickness, unit)}</span>
            <span className="font-sans">{row.edgeBand}</span>
            <span className="font-sans">{row.grain}</span>
          </div>
        ))}
      </div>
    </section>
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
