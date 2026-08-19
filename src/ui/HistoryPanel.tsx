import { resolveAppearance } from '@/domain/catalog';
import { downloadVersion, restoreVersion } from '@/store/actions';
import { useDocumentStore } from '@/store/documentStore';
import { useUiStore } from '@/store/uiStore';
import { relativeTime } from './format';
import { Icon } from './primitives/Icon';

export function HistoryPanel() {
  const open = useUiStore((s) => s.historyOpen);
  const toggleHistory = useUiStore((s) => s.toggleHistory);
  const versions = useDocumentStore((s) => s.versions);
  const currentVersionId = useDocumentStore((s) => s.currentVersionId);

  return (
    <div
      aria-hidden={!open}
      className={`absolute top-0 right-0 bottom-0 z-20 w-80 border-l border-hairline bg-panel shadow-[-12px_0_32px_rgba(0,0,0,.35)] transition-transform duration-[220ms] ease-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-hairline px-4">
        <h2 className="text-[13px] font-semibold text-ink">Version History</h2>
        <button
          type="button"
          aria-label="Close version history"
          onClick={toggleHistory}
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink/60 hover:text-ink"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="overflow-y-auto p-3">
        {versions.length === 0 && (
          <p className="px-1 py-6 text-center text-[11.5px] text-ink/35">
            No versions yet. Use Save Version to capture the current design in
            this browser. Download a .forma.json copy from a version's row.
          </p>
        )}

        {[...versions].reverse().map((version) => {
          const isCurrent = version.id === currentVersionId;
          return (
            <div
              key={version.id}
              className="mb-1.5 flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-2.5"
            >
              <span
                className="h-2.5 w-2.5 flex-none rounded-full"
                style={{
                  background: resolveAppearance(version.doc.defaultMaterialId, version.doc.defaultColorId)
                    .color,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-ink">{version.label}</div>
                <div className="font-mono text-[10.5px] text-ink/35">
                  {relativeTime(version.createdAt)} · {version.doc.customParts.length}{' '}
                  {version.doc.customParts.length === 1 ? 'part' : 'parts'}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Download ${version.label}`}
                onClick={() => downloadVersion(version.id)}
                className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-ink/45 hover:bg-white/5 hover:text-ink"
              >
                <Icon name="download" size={15} />
              </button>
              {isCurrent ? (
                <span className="flex-none rounded-md bg-success/15 px-2 py-1 text-[10.5px] font-semibold text-success">
                  Current
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => restoreVersion(version.id)}
                  className="flex-none rounded-md bg-select/12 px-2 py-1 text-[10.5px] font-semibold text-select"
                >
                  Restore
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
