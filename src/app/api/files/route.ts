import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");
  if (!dir) {
    return NextResponse.json({ error: "Missing ?dir= parameter" }, { status: 400 });
  }

  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: `Directory not found: ${resolved}` }, { status: 404 });
  }

  const allFiles = fs.readdirSync(resolved);

  const jsonlFiles = allFiles
    .filter((f) => f.endsWith(".jsonl"))
    .sort((a, b) => {
      const typeA = a.startsWith("val_") ? 0 : 1;
      const typeB = b.startsWith("val_") ? 0 : 1;
      if (typeA !== typeB) return typeA - typeB;
      const numA = parseInt(a.match(/step(\d+)/)?.[1] ?? "0");
      const numB = parseInt(b.match(/step(\d+)/)?.[1] ?? "0");
      return numA - numB;
    })
    .map((f) => {
      const stat = fs.statSync(path.join(resolved, f));
      return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
    });

  const logFiles = allFiles
    .filter((f) => f.endsWith(".log"))
    .sort()
    .map((f) => {
      const stat = fs.statSync(path.join(resolved, f));
      return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
    });

  // List experiment subdirs if this is a top-level logs directory
  const experiments = allFiles
    .filter((f) => {
      const full = path.join(resolved, f);
      return fs.statSync(full).isDirectory() && f.startsWith("exp_");
    })
    .sort()
    .map((f) => {
      const expDir = path.join(resolved, f);
      const expFiles = fs.readdirSync(expDir);
      return {
        name: f,
        hasJsonl: expFiles.some((ef) => ef.endsWith(".jsonl")),
        hasLogs: expFiles.some((ef) => ef.endsWith(".log")),
        fileCount: expFiles.filter((ef) => ef.endsWith(".jsonl") || ef.endsWith(".log")).length,
      };
    });

  return NextResponse.json({ dir: resolved, files: jsonlFiles, logFiles, experiments });
}
