import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import readline from "readline";

interface Sample {
  content?: Array<{ role: string; content: string }>;
  rewards?: number;
  idx?: number;
  advantages?: number;
  input_lengths?: number;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");
  const name = req.nextUrl.searchParams.get("name");
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "100");
  const sortBy = req.nextUrl.searchParams.get("sort") ?? "idx";
  const sortOrder = req.nextUrl.searchParams.get("order") ?? "asc";
  const minReward = parseFloat(req.nextUrl.searchParams.get("minReward") ?? "-Infinity");
  const maxReward = parseFloat(req.nextUrl.searchParams.get("maxReward") ?? "Infinity");

  if (!dir || !name) {
    return NextResponse.json({ error: "Missing ?dir= or ?name= parameter" }, { status: 400 });
  }

  const filepath = path.join(path.resolve(dir), name);
  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: `File not found: ${filepath}` }, { status: 404 });
  }

  // Stream-parse JSONL
  const samples: Sample[] = [];
  const fileStream = fs.createReadStream(filepath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Sample;
      // Filter by reward range
      const reward = parsed.rewards ?? 0;
      if (reward >= minReward && reward <= maxReward) {
        // Strip heavy fields for listing (keep them available on detail request)
        const { token_ids, token_loss_mask, sample_loss_mask, generation_logprobs, prev_logprobs, ...rest } = parsed;
        samples.push(rest);
      }
    } catch {
      // skip malformed lines
    }
  }

  // Sort
  const sortKey = sortBy as keyof Sample;
  samples.sort((a, b) => {
    const va = (a[sortKey] as number) ?? 0;
    const vb = (b[sortKey] as number) ?? 0;
    return sortOrder === "desc" ? vb - va : va - vb;
  });

  const total = samples.length;
  const paginated = samples.slice(offset, offset + limit);

  // Compute reward stats
  const rewards = samples.map((s) => s.rewards ?? 0);
  const stats = {
    count: total,
    mean: rewards.reduce((a, b) => a + b, 0) / (total || 1),
    min: Math.min(...rewards),
    max: Math.max(...rewards),
    nonzero: rewards.filter((r) => r > 0).length,
  };

  return NextResponse.json({ total, offset, limit, stats, samples: paginated });
}
