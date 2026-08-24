import { useState, useMemo } from "react";
import { Property, DatabaseRecord } from "./types";
import { PropertyValue } from "./PropertyValue";
import { PropertyEditor } from "./PropertyEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Settings2, Search, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, ExternalLink } from "lucide-react";

export interface DatabaseSortOption {
  label: string;
  field: string;
  dir: Exclude<SortDir, null>;
}

interface Props {
  title: string;
  storageKey: string;
  defaultProperties: Property[];
  records: DatabaseRecord[];
  loading?: boolean;
  onAddRecord?: (data: Record<string, unknown>) => Promise<void>;
  onUpdateRecord?: (id: string, field: string, value: unknown) => Promise<void>;
  onDeleteRecord?: (id: string) => Promise<void>;
  defaultSort?: Omit<Sort, "dir"> & { dir: Exclude<SortDir, null> };
  sortOptions?: DatabaseSortOption[];
  onOpenRecord?: (record: DatabaseRecord) => void;
  openRecordLabel?: string;
}

type SortDir = "asc" | "desc" | null;
interface Sort { field: string; dir: SortDir }

function useStoredProperties(storageKey: string, defaultProperties: Property[]) {
  const key = `db_props_${storageKey}`;
  const [properties, setProperties] = useState<Property[]>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return defaultProperties;

      const parsed = JSON.parse(stored) as Property[];
      const storedById = new Map(parsed.map((property) => [property.id, property]));
      const defaultIds = new Set(defaultProperties.map((property) => property.id));

      // Keep personal display settings, while always introducing newly-added
      // system columns and the latest read-only/format metadata.
      return [
        ...defaultProperties.map((property) => {
          const saved = storedById.get(property.id);
          if (!saved) return property;
          return {
            ...property,
            width: saved.width ?? property.width,
            hidden: saved.hidden ?? property.hidden,
          };
        }),
        ...parsed.filter((property) => !defaultIds.has(property.id)),
      ];
    } catch {
      return defaultProperties;
    }
  });

  const update = (props: Property[]) => {
    setProperties(props);
    localStorage.setItem(key, JSON.stringify(props));
  };

  return [properties, update] as const;
}

export function NotionDatabaseView({
  title,
  storageKey,
  defaultProperties,
  records,
  loading,
  onAddRecord,
  onUpdateRecord,
  onDeleteRecord,
  defaultSort,
  sortOptions = [],
  onOpenRecord,
  openRecordLabel = "詳細ページを開く",
}: Props) {
  const [properties, setProperties] = useStoredProperties(storageKey, defaultProperties);
  const [showPropEditor, setShowPropEditor] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DatabaseRecord | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>(defaultSort ?? { field: "", dir: null });
  const [newRecord, setNewRecord] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const visibleProps = properties.filter((p) => !p.hidden);

  const filtered = useMemo(() => {
    let result = [...records];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        visibleProps.some((p) => {
          const v = r[p.id];
          if (v == null) return false;
          return String(v).toLowerCase().includes(q);
        })
      );
    }
    if (sort.field && sort.dir) {
      const property = properties.find((item) => item.id === sort.field);
      result.sort((a, b) => {
        const av = a[sort.field];
        const bv = b[sort.field];

        // Empty values stay at the bottom in both directions.
        if (av == null || av === "") return bv == null || bv === "" ? 0 : 1;
        if (bv == null || bv === "") return -1;

        let cmp: number;
        if (property?.type === "number" || (typeof av === "number" && typeof bv === "number")) {
          cmp = Number(av) - Number(bv);
        } else if (property?.type === "date") {
          cmp = String(av).slice(0, 10).localeCompare(String(bv).slice(0, 10));
        } else {
          cmp = String(av).localeCompare(String(bv), "ja", { numeric: true, sensitivity: "base" });
        }

        if (cmp === 0) cmp = String(a.id).localeCompare(String(b.id));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [records, search, sort, visibleProps, properties]);

  const selectedSortValue = sort.dir ? `${sort.field}:${sort.dir}` : "none";

  const toggleSort = (field: string) => {
    setSort((prev) => {
      if (prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      return { field: "", dir: null };
    });
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sort.field !== field) return <ChevronsUpDown size={12} className="text-muted-foreground opacity-50" />;
    return sort.dir === "asc"
      ? <ChevronUp size={12} className="text-primary" />
      : <ChevronDown size={12} className="text-primary" />;
  };

  const handleAdd = async () => {
    if (!onAddRecord) return;
    setSaving(true);
    try {
      await onAddRecord(newRecord);
      setNewRecord({});
      setShowAddForm(false);
    } catch {
      // The parent displays the domain-specific error. Keep the form open.
    } finally {
      setSaving(false);
    }
  };

  const handleFieldUpdate = async (field: string, value: unknown) => {
    if (!selectedRecord || !onUpdateRecord) return;
    const previousRecord = selectedRecord;
    setSelectedRecord((prev) => prev ? { ...prev, [field]: value } : null);
    try {
      await onUpdateRecord(selectedRecord.id, field, value);
    } catch {
      setSelectedRecord(previousRecord);
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDeleteRecord || !confirm("削除しますか？")) return;
    try {
      await onDeleteRecord(id);
      if (selectedRecord?.id === id) setSelectedRecord(null);
    } catch {
      // The parent displays the error; retain the row and detail panel.
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="検索..."
            aria-label={`${title}を検索`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {sortOptions.length > 0 && (
          <Select
            value={selectedSortValue}
            onValueChange={(value) => {
              const option = sortOptions.find((item) => `${item.field}:${item.dir}` === value);
              if (option) setSort({ field: option.field, dir: option.dir });
            }}
          >
            <SelectTrigger className="h-8 w-full sm:w-[210px] text-xs" aria-label="並び順">
              <SelectValue placeholder="並び順" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={`${option.field}:${option.dir}`} value={`${option.field}:${option.dir}`}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">{filtered.length}件</span>
          <Button size="sm" variant="outline" onClick={() => setShowPropEditor(true)}>
            <Settings2 size={14} className="mr-1" />列設定
          </Button>
          {onAddRecord && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus size={14} className="mr-1" />新規追加
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden gap-4">
        {/* Table */}
        <div className={`flex-1 overflow-auto border border-border rounded-lg ${selectedRecord ? "hidden md:block" : ""}`}>
          {loading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">読み込み中...</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-muted/50 z-10">
                <tr>
                  {visibleProps.map((p, index) => (
                    <th
                      key={p.id}
                      className={`px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap border-b border-border cursor-pointer hover:bg-muted/80 select-none ${index === 0 ? "sticky left-0 z-20 bg-muted" : ""}`}
                      style={{ minWidth: p.width || 120 }}
                      onClick={() => toggleSort(p.id)}
                    >
                      <div className="flex items-center gap-1">
                        {p.name}
                        <SortIcon field={p.id} />
                      </div>
                    </th>
                  ))}
                  <th className="w-8 border-b border-border" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={visibleProps.length + 1} className="px-3 py-12 text-center text-muted-foreground">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  filtered.map((record) => (
                    <tr
                      key={record.id}
                      className={`group border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors ${selectedRecord?.id === record.id ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedRecord(record)}
                    >
                      {visibleProps.map((p, index) => (
                        <td
                          key={p.id}
                          className={`px-3 py-2 max-w-[250px] ${index === 0 ? "sticky left-0 z-[5] bg-background group-hover:bg-muted" : ""}`}
                        >
                          <PropertyValue property={p} value={record[p.id]} compact />
                        </td>
                      ))}
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        {onDeleteRecord && (
                          <button
                            className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selectedRecord && (
          <div className="w-full md:w-[360px] flex-shrink-0 border border-border rounded-lg overflow-hidden flex flex-col bg-background">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="font-semibold text-sm">詳細</span>
              <div className="flex items-center gap-1">
                {onOpenRecord && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    title={openRecordLabel}
                    aria-label={openRecordLabel}
                    onClick={() => onOpenRecord(selectedRecord)}
                  >
                    <ExternalLink size={13} className="mr-1" />カルテ
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelectedRecord(null)}>
                  <X size={16} />
                </Button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {properties.map((p) => (
                <div key={p.id}>
                  <Label className="text-xs text-muted-foreground mb-1 block">{p.name}</Label>
                  <PropertyInput
                    property={p}
                    value={selectedRecord[p.id]}
                    onChange={(v) => handleFieldUpdate(p.id, v)}
                    disabled={!onUpdateRecord || p.readOnly}
                  />
                </div>
              ))}
            </div>
            {onDeleteRecord && (
              <div className="p-4 border-t border-border space-y-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDelete(selectedRecord.id)}
                >
                  <Trash2 size={14} className="mr-2" />削除
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Record Dialog */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-lg border border-border w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold">新規追加</h3>
              <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}><X size={16} /></Button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {properties.filter((p) => !p.readOnly || p.allowOnCreate).map((p) => (
                <div key={p.id}>
                  <Label className="text-xs text-muted-foreground mb-1 block">{p.name}</Label>
                  <PropertyInput
                    property={p}
                    value={newRecord[p.id]}
                    onChange={(v) => setNewRecord((prev) => ({ ...prev, [p.id]: v }))}
                  />
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <Button className="flex-1" onClick={handleAdd} disabled={saving}>
                {saving ? "保存中..." : "追加"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setShowAddForm(false)}>
                キャンセル
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Property Editor */}
      {showPropEditor && (
        <PropertyEditor
          properties={properties}
          onChange={setProperties}
          onClose={() => setShowPropEditor(false)}
        />
      )}
    </div>
  );
}

function PropertyInput({
  property,
  value,
  onChange,
  disabled,
}: {
  property: Property;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const base = "text-sm";
  switch (property.type) {
    case "checkbox":
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4"
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={typeof value === "number" || typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled}
          className={`h-8 ${base}`}
        />
      );
    case "date":
      return (
        <Input
          type="date"
          value={value ? String(value).slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          className={`h-8 ${base}`}
        />
      );
    case "select":
      return (
        <Select
          value={typeof value === "string" && value ? value : "__unset__"}
          onValueChange={(next) => onChange(next === "__unset__" ? null : next)}
          disabled={disabled}
        >
          <SelectTrigger className={`h-8 ${base}`}><SelectValue placeholder="選択..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__unset__">—</SelectItem>
            {(property.options || []).map((o) => (
              <SelectItem key={o.label} value={o.label}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multi_select": {
      const vals: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            {vals.map((v) => (
              <span key={v} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs">
                {v}
                {!disabled && (
                  <button onClick={() => onChange(vals.filter((x) => x !== v))}><X size={10} /></button>
                )}
              </span>
            ))}
          </div>
          {!disabled && (
            <Select
              value=""
              onValueChange={(v) => { if (v && !vals.includes(v)) onChange([...vals, v]); }}
            >
              <SelectTrigger className={`h-7 text-xs`}><SelectValue placeholder="追加..." /></SelectTrigger>
              <SelectContent>
                {(property.options || []).filter((o) => !vals.includes(o.label)).map((o) => (
                  <SelectItem key={o.label} value={o.label}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      );
    }
    default:
      if (property.type === "text" && !disabled) {
        return (
          <Textarea
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            className={`text-sm resize-none`}
          />
        );
      }
      return (
        <Input
          value={typeof value === "string" || typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`h-8 ${base}`}
        />
      );
  }
}
