import type { NotebookSummary } from "@/lib/notebooklm/client";

interface Props {
  notebook: NotebookSummary & { hasAudio?: boolean };
  selected: boolean;
  onClick: () => void;
}

export function NotebookCard({ notebook, selected, onClick }: Props) {
  return (
    <button
      className={`card text-left transition-all ${
        selected ? "ring-2 ring-accent" : "hover:border-line-strong"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <h3 className="font-display text-lg">{notebook.title}</h3>
        {notebook.hasAudio && (
          <span className="text-xs text-accent font-mono">✓ AUDIO READY</span>
        )}
      </div>

      {notebook.description && (
        <p className="mt-2 text-sm text-dim line-clamp-2">
          {notebook.description}
        </p>
      )}

      <div className="mt-3 flex gap-3 text-xs text-mute">
        {notebook.sourceCount !== undefined && (
          <span>
            {notebook.sourceCount} source{notebook.sourceCount !== 1 ? "s" : ""}
          </span>
        )}
        {notebook.updatedAt && (
          <span>{new Date(notebook.updatedAt).toLocaleDateString()}</span>
        )}
      </div>
    </button>
  );
}
