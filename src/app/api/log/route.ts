import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");
  const name = req.nextUrl.searchParams.get("name");
  const tail = parseInt(req.nextUrl.searchParams.get("tail") ?? "200");
  const search = req.nextUrl.searchParams.get("search") ?? "";

  if (!dir || !name) {
    return NextResponse.json({ error: "Missing ?dir= or ?name= parameter" }, { status: 400 });
  }

  const filepath = path.join(path.resolve(dir), name);
  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: `File not found: ${filepath}` }, { status: 404 });
  }

  const content = fs.readFileSync(filepath, "utf-8");
  let lines = content.split("\n");

  // Filter by search term
  if (search) {
    lines = lines.filter((l) => l.toLowerCase().includes(search.toLowerCase()));
  }

  // Return last N lines
  const total = lines.length;
  const sliced = lines.slice(-tail);

  return NextResponse.json({ total, showing: sliced.length, lines: sliced });
}
