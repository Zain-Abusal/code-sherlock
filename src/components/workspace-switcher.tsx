import { useEffect, useState } from "react";
import { Building2, Check, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  createWorkspace,
  deleteWorkspace,
  getActiveWorkspace,
  listWorkspaces,
  setActiveWorkspace,
  type Workspace,
} from "@/lib/workspaces";

interface Props {
  onChange?: (ws: Workspace) => void;
}

export function WorkspaceSwitcher({ onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [active, setActive] = useState<Workspace>(() => ({
    id: "personal",
    name: "Personal",
    createdAt: 0,
  }));
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setWorkspaces(listWorkspaces());
    setActive(getActiveWorkspace());
  }, [open]);

  const pick = (ws: Workspace) => {
    setActiveWorkspace(ws.id);
    setActive(ws);
    setOpen(false);
    onChange?.(ws);
  };

  const create = () => {
    if (!newName.trim()) return;
    const ws = createWorkspace(newName);
    setNewName("");
    setWorkspaces(listWorkspaces());
    pick(ws);
  };

  const remove = (id: string) => {
    deleteWorkspace(id);
    setWorkspaces(listWorkspaces());
    if (active.id === id) {
      setActive(getActiveWorkspace());
      onChange?.(getActiveWorkspace());
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={`Workspace: ${active.name}. Click to switch.`}
          className="gap-2 border-border/60 bg-card/60 backdrop-blur"
        >
          <Building2 className="h-4 w-4 text-amber" aria-hidden />
          <span className="font-mono-tight text-xs uppercase tracking-wider">
            {active.name}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-card w-72 p-2">
        <div className="px-2 py-1 text-[10px] font-mono-tight uppercase tracking-widest text-muted-foreground">
          Workspaces
        </div>
        <ul className="max-h-56 space-y-0.5 overflow-auto" role="listbox">
          {workspaces.map((w) => (
            <li key={w.id}>
              <div
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                  active.id === w.id
                    ? "bg-amber/10 text-amber"
                    : "text-foreground/90 hover:bg-background/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => pick(w)}
                  className="flex flex-1 items-center gap-2 text-left"
                  aria-current={active.id === w.id}
                >
                  {active.id === w.id ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <span className="inline-block h-3.5 w-3.5" aria-hidden />
                  )}
                  <span className="truncate">{w.name}</span>
                </button>
                {w.id !== "personal" && (
                  <button
                    type="button"
                    onClick={() => remove(w.id)}
                    aria-label={`Delete workspace ${w.name}`}
                    className="rounded p-1 text-muted-foreground hover:text-crimson focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          className="mt-2 flex gap-1 border-t border-border/50 pt-2"
        >
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New workspace"
            aria-label="New workspace name"
            className="h-8 bg-background/60 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            aria-label="Create workspace"
            className="h-8 shrink-0 gap-1 px-2"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add
          </Button>
        </form>
        <p className="mt-2 px-2 text-[10px] leading-relaxed text-muted-foreground">
          Workspaces isolate caches, audit trails, and provider settings — great
          for separating client work or environments.
        </p>
      </PopoverContent>
    </Popover>
  );
}