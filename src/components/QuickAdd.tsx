import { Plus } from "lucide-react";
import { useState } from "react";

export function QuickAdd({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const nextTitle = title.trim();
    if (!nextTitle || busy) return;
    setBusy(true);
    try {
      await onAdd(nextTitle);
      setTitle("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="quick-add">
      <Plus size={21} strokeWidth={1.6} />
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
        }}
        placeholder="Ajouter une tâche…"
        aria-label="Titre de la nouvelle tâche"
      />
      <span>Entrée</span>
    </div>
  );
}
