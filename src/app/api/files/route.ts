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

  const files = fs.readdirSync(resolved)
    .filter((f) => f.endsWith(".jsonl"))
    .sort((a, b) => {
      // Sort by type (val first, then train) and step number
      const typeA = a.startsWith("val_") ? 0 : 1;
      const typeB = b.startsWith("val_") ? 0 : 1;
      if (typeA !== typeB) return typeA - typeB;
      const numA = parseInt(a.match(/step(\d+)/)?.[1] ?? "0");
      const numB = parseInt(b.match(/step(\d+)/)?.[1] ?? "0");
      return numA - numB;
    })
    .map((f) => {
      const stat = fs.statSync(path.join(resolved, f));
      return {
        name: f,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };
    });

  return NextResponse.json({ dir: resolved, files });
}
