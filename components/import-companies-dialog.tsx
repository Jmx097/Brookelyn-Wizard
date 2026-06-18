import { useState } from "react";
import * as XLSX from "xlsx";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { enrichImportedCompany } from "@/lib/import-companies.functions";

type Row = { company_name: string; website?: string | null };
type RowStatus = {
  row: Row;
  status: "queued" | "running" | "done" | "error";
  message?: string;
  fit_score?: number;
  jobs_found?: number;
  execs_found?: number;
};

function parseFile(file: File): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const rows: Row[] = [];
        for (const r of json) {
          const keys = Object.keys(r);
          const nameKey = keys.find((k) => /company|name|account/i.test(k));
          const siteKey = keys.find((k) => /website|url|domain|site/i.test(k));
          if (!nameKey) continue;
          const name = String(r[nameKey] ?? "").trim();
          if (!name) continue;
          const site = siteKey ? String(r[siteKey] ?? "").trim() : "";
          rows.push({ company_name: name.slice(0, 200), website: site || null });
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export function ImportCompaniesDialog() {
  const qc = useQueryClient();
  const enrichFn = useServerFn(enrichImportedCompany);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RowStatus[]>([]);
  const [running, setRunning] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    try {
      const parsed = await parseFile(f);
      if (parsed.length === 0) {
        toast.error("No valid rows found. Make sure your sheet has a 'Company Name' column.");
        return;
      }
      if (parsed.length > 250) {
        toast.error("Limit is 250 rows per import");
        return;
      }
      setRows(parsed.map((row) => ({ row, status: "queued" as const })));
      toast.success(`Loaded ${parsed.length} companies — ready to import`);
    } catch (err) {
      toast.error(`Could not parse file: ${(err as Error).message}`);
    }
  };

  const runImport = async () => {
    setRunning(true);


    for (let i = 0; i < rows.length; i++) {
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "running" } : r)));
    }

    const CONCURRENCY = 3;
    const ROW_TIMEOUT_MS = 90_000;
    let cursor = 0;

    const runOne = async (i: number) => {
      try {
        const result = await Promise.race([
          enrichFn({ data: rows[i].row }),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error("Timed out after 90s")), ROW_TIMEOUT_MS),
          ),
        ]);

        if ("ok" in result && result.ok === false) {
          throw new Error(result.error);
        }

        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: "done",
                  fit_score: result.fit_score,
                  jobs_found: result.jobs_found,
                  execs_found: result.execs_found,
                }
              : r,
          ),
        );
      } catch (err) {
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", message: (err as Error).message } : r,
          ),
        );
      }
    };

    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= rows.length) return;
        await runOne(i);
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()));
    setRunning(false);
    qc.invalidateQueries();
    toast.success("Import complete");
  };

  const done = rows.filter((r) => r.status === "done").length;
  const errored = rows.filter((r) => r.status === "error").length;
  const progress = rows.length > 0 ? Math.round(((done + errored) / rows.length) * 100) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (running) return;
        setOpen(o);
        if (!o) {
          setRows([]);
          setFileName(null);
        }

      }}
    >
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <Upload className="h-4 w-4" /> Import Companies
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Import Companies from Spreadsheet
          </DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-8 text-center">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload an .xlsx or .csv with columns <strong>Company Name</strong> and{" "}
                <strong>Website</strong>. Max 250 rows.
              </p>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={onFile}
                className="max-w-sm mx-auto"
              />
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              Each company will be: scraped for context, scored against your ICP, searched across
              5 job boards for open positions, and enriched with 5 executive LinkedIn profiles
              via Google snippet search.
            </div>
          </div>
        ) : (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between gap-4 pb-3 border-b">
              <div className="text-sm">
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground"> · {rows.length} companies</span>
              </div>
              {running && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> {done + errored}/{rows.length}
                </div>
              )}
            </div>

            {running && <Progress value={progress} className="my-3" />}


            <div className="flex-1 overflow-y-auto -mx-6 px-6">
              <div className="space-y-1">
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 py-2 px-2 rounded hover:bg-muted/50 text-sm"
                  >
                    <div className="w-5 shrink-0">
                      {r.status === "queued" && <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />}
                      {r.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      {r.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {r.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{r.row.company_name}</div>
                      {r.row.website && (
                        <div className="text-xs text-muted-foreground truncate">{r.row.website}</div>
                      )}
                      {r.message && (
                        <div className="text-xs text-destructive truncate">{r.message}</div>
                      )}
                    </div>
                    {r.status === "done" && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="text-xs">
                          {r.fit_score}/100
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {r.jobs_found} jobs
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {r.execs_found}/5 execs
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              {!running && (
                <Button variant="outline" onClick={() => setRows([])}>
                  Choose different file
                </Button>
              )}
              <Button onClick={runImport} disabled={running}>
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing...
                  </>
                ) : (
                  `Import ${rows.length} companies`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
