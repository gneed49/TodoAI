import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const colors = ["#6366f1", "#38bdf8", "#f43f5e", "#a855f7", "#f59e0b"];

export function WorkspaceDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (name: string, color: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(colors[0]);
  if (!open) return null;

  const submit = async () => {
    if (!name.trim()) return;
    await onCreate(name, color);
    setName("");
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="workspace-dialog" role="dialog" aria-modal="true" aria-label="Nouvel espace" onMouseDown={(event) => event.stopPropagation()}>
        <header><h2>Nouvel espace</h2><Button variant="ghost" size="icon" type="button" aria-label="Fermer" onClick={onClose}><X size={19} /></Button></header>
        <label className="editor-field"><span>Nom</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void submit()} placeholder="Ex. Maison" /></label>
        <div className="color-picker" role="group" aria-label="Couleur de l’espace">{colors.map((item) => <button key={item} type="button" className={color === item ? "is-active" : ""} style={{ background: item }} aria-label={`Couleur ${item}`} onClick={() => setColor(item)} />)}</div>
        <footer><Button variant="outline" type="button" onClick={onClose}>Annuler</Button><Button type="button" onClick={() => void submit()}>Créer l’espace</Button></footer>
      </section>
    </div>
  );
}
