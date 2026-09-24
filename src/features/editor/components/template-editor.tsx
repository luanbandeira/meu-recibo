"use client";

import TextAlign from "@tiptap/extension-text-align";
import { TextSelection } from "@tiptap/pm/state";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { renameTemplate, saveTemplate } from "@/features/templates/actions";
import {
  FONTS,
  FONT_KEYS,
  FONT_SIZES,
  LINE_HEIGHTS,
  MARGINS,
  type MarginKey,
  type TemplateSettings,
} from "@/features/templates/document/constants";
import type { DocumentProfile } from "@/features/templates/document/profile-values";
import type { CatalogVariable } from "@/features/templates/document/variables";
import { EditorDataProvider, type EditorAssets } from "../editor-context";
import { LogoBlock, ProfessionalHeader, SignatureBlock } from "../extensions/blocks";
import { LineHeight, TextStyle } from "../extensions/formatting";
import { Variable } from "../extensions/variable";
import { Toolbar } from "./toolbar";
import { VariablePicker } from "./variable-picker";

type Status = "saved" | "dirty" | "saving" | "error";
type Zoom = "text" | "fit" | "real";

const NARROW = "(max-width: 639px)";
const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
type Backup = { revision: number; content: JSONContent; settings: TemplateSettings; at: number };

const AUTOSAVE_DELAY = 1200;
const backupKey = (id: string) => `meurecibo:modelo:${id}`;

function readBackup(id: string): Backup | null {
  try {
    const raw = localStorage.getItem(backupKey(id));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch {
    return null;
  }
}

function writeBackup(id: string, backup: Backup) {
  try {
    localStorage.setItem(backupKey(id), JSON.stringify(backup));
  } catch {
    // Armazenamento indisponível (modo privado): segue só com o servidor.
  }
}

function clearBackup(id: string) {
  try {
    localStorage.removeItem(backupKey(id));
  } catch {}
}

export type EditorTemplate = {
  id: string;
  name: string;
  content: JSONContent;
  settings: TemplateSettings;
  revision: number;
};

export function TemplateEditor({
  template,
  profile,
  assets,
  initialCatalog,
  fieldLabels,
  readOnly = false,
}: {
  template: EditorTemplate;
  profile: DocumentProfile;
  assets: EditorAssets;
  initialCatalog: CatalogVariable[];
  fieldLabels: Record<string, string>;
  /** Modo suporte: só visualização — sem barra de ferramentas, sem salvar, sem cópia local. */
  readOnly?: boolean;
}) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [settings, setSettings] = useState(template.settings);
  const [name, setName] = useState(template.name);
  const [status, setStatus] = useState<Status>("saved");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [recovery, setRecovery] = useState<Backup | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pageOpen, setPageOpen] = useState(false);
  // Celular abre em "Texto" (legível); telas maiores, na página A4 inteira.
  const isNarrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
  const [zoomChoice, setZoom] = useState<Zoom | null>(null);
  const zoom: Zoom = zoomChoice ?? (isNarrow ? "text" : "fit");

  const revisionRef = useRef(template.revision);
  const settingsRef = useRef(settings);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const blockedRef = useRef(false);
  const actionsRef = useRef<{ markDirty: () => void; save: () => Promise<void> }>({
    markDirty: () => {},
    save: async () => {},
  });

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        strike: false,
        link: false,
        heading: { levels: [1, 2, 3] },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      TextStyle,
      LineHeight,
      Variable,
      ProfessionalHeader,
      LogoBlock,
      SignatureBlock,
    ],
    content: template.content,
    editorProps: {
      attributes: { class: "doc-content", "aria-label": "Conteúdo do modelo", lang: "pt-BR", spellcheck: "true" },
    },
    onCreate: ({ editor: created }) => {
      if (readOnly) return;
      // Alterações que não chegaram ao servidor (aba fechada, queda de conexão)?
      // Lida ANTES de qualquer transação: a próxima atualização regrava a cópia.
      const backup = readBackup(template.id);
      if (
        backup &&
        backup.revision === template.revision &&
        JSON.stringify(backup.content) !== JSON.stringify(created.getJSON())
      ) {
        setRecovery(backup);
      } else if (backup) {
        clearBackup(template.id);
      }

      // Começa com o cursor no primeiro texto (e não com o cabeçalho selecionado).
      const firstText = TextSelection.findFrom(created.state.doc.resolve(0), 1, true);
      if (firstText) created.view.dispatch(created.state.tr.setSelection(firstText).setMeta("addToHistory", false));
    },
    onUpdate: () => {
      if (!readOnly) actionsRef.current.markDirty();
    },
  });

  const save = useCallback(async () => {
    if (!editor || blockedRef.current || readOnly) return;
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    clearTimeout(timerRef.current);
    savingRef.current = true;
    pendingRef.current = false;
    setStatus("saving");

    const result = await saveTemplate({
      id: template.id,
      revision: revisionRef.current,
      contentJson: JSON.stringify(editor.getJSON()),
      settings: settingsRef.current,
    });
    savingRef.current = false;

    if (result.ok) {
      revisionRef.current = result.revision;
      setError(null);
      if (pendingRef.current) {
        setStatus("dirty");
        timerRef.current = setTimeout(() => actionsRef.current.save(), 300);
      } else {
        setStatus("saved");
        clearBackup(template.id);
      }
    } else if (result.conflict) {
      blockedRef.current = true;
      setConflict(true);
      setStatus("error");
    } else {
      setError(result.error);
      setStatus("error");
    }
  }, [editor, template.id, readOnly]);

  const markDirty = useCallback(() => {
    if (!editor || readOnly) return;
    pendingRef.current = true;
    setStatus((s) => (s === "saving" ? s : "dirty"));
    writeBackup(template.id, {
      revision: revisionRef.current,
      content: editor.getJSON(),
      settings: settingsRef.current,
      at: Date.now(),
    });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => actionsRef.current.save(), AUTOSAVE_DELAY);
  }, [editor, template.id, readOnly]);

  useEffect(() => {
    actionsRef.current = { markDirty, save };
  }, [markDirty, save]);

  // Ctrl+S salva na hora; aviso ao sair com alterações pendentes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        actionsRef.current.save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (status === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function updateSettings(patch: Partial<TemplateSettings>) {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    markDirty();
  }

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed) return setName(template.name);
    if (trimmed === template.name) return;
    const result = await renameTemplate(template.id, trimmed);
    if (!result.ok) setError(result.error ?? "Não foi possível renomear.");
  }

  function applyRecovery() {
    if (!editor || !recovery) return;
    settingsRef.current = recovery.settings;
    setSettings(recovery.settings);
    editor.commands.setContent(recovery.content, { emitUpdate: true });
    setRecovery(null);
  }

  const statusText: Record<Status, string> = {
    saved: "Salvo",
    dirty: "Alterações não salvas",
    saving: "Salvando…",
    error: "Não salvo",
  };

  const pageStyle = {
    "--margin": MARGINS[settings.margins].pt,
    "--fs": settings.fontSize,
    "--lh": settings.lineHeight,
    "--doc-font": FONTS[settings.fontFamily].css,
  } as CSSProperties;

  return (
    <EditorDataProvider value={{ profile, assets, catalog, fieldLabels }}>
      <div className="flex flex-col gap-3">
        {/* Barra superior: voltar, nome, situação do salvamento */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/modelos" className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Modelos
          </Link>
          {readOnly ? (
            <>
              <h1 className="order-last w-full min-w-0 truncate px-2 text-lg font-semibold text-slate-900 sm:order-none sm:w-auto sm:flex-1">
                {template.name}
              </h1>
              <span className="ml-auto text-sm font-medium text-amber-800">Somente leitura</span>
            </>
          ) : (
            <>
              <label htmlFor="template-name" className="sr-only">
                Nome do modelo
              </label>
              <input
                id="template-name"
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="order-last min-h-11 w-full min-w-0 rounded-lg bg-transparent px-2 text-lg font-semibold text-slate-900 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600 sm:order-none sm:w-auto sm:flex-1"
              />
              <span
                role="status"
                className={`ml-auto flex items-center gap-1.5 text-sm ${status === "error" ? "text-red-700" : "text-slate-500"}`}
              >
                <span aria-hidden="true" className={`size-2 rounded-full ${status === "saved" ? "bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-amber-400"}`} />
                {statusText[status]}
              </span>
            </>
          )}
          <button
            type="button"
            onClick={() => setZoom(zoom === "text" ? "fit" : "text")}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-brand-700 ring-1 ring-inset ring-slate-200 hover:bg-brand-50"
          >
            {zoom === "text" ? "Ver página A4" : "Modo texto"}
          </button>
        </div>

        {recovery && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            Encontramos alterações que não chegaram a ser salvas neste aparelho.
            <div className="flex gap-2">
              <Button onClick={applyRecovery}>Recuperar</Button>
              <Button variant="ghost" onClick={() => { clearBackup(template.id); setRecovery(null); }}>
                Descartar
              </Button>
            </div>
          </div>
        )}
        {conflict && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
            Este modelo foi alterado em outra aba ou aparelho. Recarregue para continuar sem sobrescrever.
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Recarregar
            </Button>
          </div>
        )}
        {error && !conflict && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-200">
            {error}
            <Button variant="secondary" onClick={() => save()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {/* Toolbar fixa ao rolar */}
        {!readOnly && (
          <div className="sticky top-16 z-20 rounded-xl bg-white shadow-xs ring-1 ring-slate-200">
            {editor && (
              <Toolbar
                editor={editor}
                onOpenVariables={() => setPickerOpen((open) => !open)}
                onTogglePage={() => setPageOpen((open) => !open)}
                pageOpen={pageOpen}
              />
            )}
            {pickerOpen && (
              <div className="absolute left-2 right-2 top-full z-30 mt-2 sm:left-auto">
                <VariablePicker
                  catalog={catalog}
                  onClose={() => setPickerOpen(false)}
                  onFieldCreated={(variable) => setCatalog((c) => [...c.filter((v) => v.key !== variable.key), variable])}
                  onPick={(key) => {
                    editor?.chain().focus().insertVariable(key).run();
                    setPickerOpen(false);
                  }}
                />
              </div>
            )}
            {pageOpen && (
              <PageSettings settings={settings} onChange={updateSettings} zoom={zoom} onZoom={setZoom} />
            )}
          </div>
        )}

        {/* Página A4 proporcional: 1pt = largura/595 */}
        <div className={zoom === "real" ? "overflow-x-auto pb-2" : ""}>
          <div className={`doc-page mx-auto ${zoom === "real" ? "w-[794px]" : "w-full max-w-[820px]"}`}>
            <div className={`doc-sheet bg-white shadow-sm ring-1 ring-slate-200 ${zoom === "text" ? "doc-reflow rounded-xl" : ""}`} style={pageStyle}>
              {editor ? <EditorContent editor={editor} /> : <p className="text-slate-400">Carregando editor…</p>}
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500">
          As linhas tracejadas indicam onde começa uma nova página A4. Variáveis em azul viram campos na emissão;
          em verde são preenchidas pelo seu perfil.
        </p>
      </div>
    </EditorDataProvider>
  );
}

function PageSettings({
  settings,
  onChange,
  zoom,
  onZoom,
}: {
  settings: TemplateSettings;
  onChange: (patch: Partial<TemplateSettings>) => void;
  zoom: Zoom;
  onZoom: (zoom: Zoom) => void;
}) {
  const select = "h-10 w-full rounded-lg bg-white px-2 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-600";
  return (
    <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-3 sm:grid-cols-5">
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Fonte do modelo
        <select className={select} value={settings.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value as TemplateSettings["fontFamily"] })}>
          {FONT_KEYS.map((key) => <option key={key} value={key}>{FONTS[key].label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Tamanho base
        <select className={select} value={settings.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })}>
          {FONT_SIZES.filter((s) => s >= 9 && s <= 16).map((s) => <option key={s} value={s}>{s} pt</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Espaçamento
        <select className={select} value={settings.lineHeight} onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}>
          {LINE_HEIGHTS.map((v) => <option key={v} value={v}>{String(v).replace(".", ",")}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Margens
        <select className={select} value={settings.margins} onChange={(e) => onChange({ margins: e.target.value as MarginKey })}>
          {(Object.keys(MARGINS) as MarginKey[]).map((key) => <option key={key} value={key}>{MARGINS[key].label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Visualização
        <select className={select} value={zoom} onChange={(e) => onZoom(e.target.value as Zoom)}>
          <option value="text">Texto (legível)</option>
          <option value="fit">Página inteira</option>
          <option value="real">Tamanho real</option>
        </select>
      </label>
    </div>
  );
}
