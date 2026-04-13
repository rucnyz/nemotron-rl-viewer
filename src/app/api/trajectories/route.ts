import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import readline from "readline";

// GET /api/trajectories?dir=...
// Returns the trajectory tree: steps -> tasks -> samples
// Or with &step=step_1&task=django__django-16116&sample=sample_0 returns turns
export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");
  const step = req.nextUrl.searchParams.get("step");
  const task = req.nextUrl.searchParams.get("task");
  const sample = req.nextUrl.searchParams.get("sample");

  if (!dir) {
    return NextResponse.json({ error: "Missing ?dir= parameter" }, { status: 400 });
  }

  const trajDir = path.join(path.resolve(dir), "trajectories");
  if (!fs.existsSync(trajDir)) {
    return NextResponse.json({ error: "No trajectories/ directory found", steps: [] });
  }

  // Level 1: list steps
  if (!step) {
    const steps = fs.readdirSync(trajDir)
      .filter((f) => fs.statSync(path.join(trajDir, f)).isDirectory())
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] ?? "0");
        const nb = parseInt(b.match(/\d+/)?.[0] ?? "0");
        return na - nb;
      })
      .map((s) => {
        const stepPath = path.join(trajDir, s);
        const tasks = fs.readdirSync(stepPath).filter((t) =>
          fs.statSync(path.join(stepPath, t)).isDirectory()
        );
        return { name: s, taskCount: tasks.length };
      });
    return NextResponse.json({ steps });
  }

  // Level 2: list tasks in a step
  const stepDir = path.join(trajDir, step);
  if (!fs.existsSync(stepDir)) {
    return NextResponse.json({ error: `Step not found: ${step}` }, { status: 404 });
  }

  if (!task) {
    const tasks = fs.readdirSync(stepDir)
      .filter((f) => fs.statSync(path.join(stepDir, f)).isDirectory())
      .sort()
      .map((t) => {
        const taskPath = path.join(stepDir, t);
        const samples = fs.readdirSync(taskPath).filter((f) => f.endsWith(".jsonl"));
        return { name: t, sampleCount: samples.length };
      });
    return NextResponse.json({ step, tasks });
  }

  // Level 3: list samples in a task
  const taskDir = path.join(stepDir, task);
  if (!fs.existsSync(taskDir)) {
    return NextResponse.json({ error: `Task not found: ${task}` }, { status: 404 });
  }

  if (!sample) {
    const samples = fs.readdirSync(taskDir)
      .filter((f) => f.endsWith(".jsonl"))
      .sort((a, b) => {
        const na = parseInt(a.match(/\d+/)?.[0] ?? "0");
        const nb = parseInt(b.match(/\d+/)?.[0] ?? "0");
        return na - nb;
      })
      .map((s) => {
        const filePath = path.join(taskDir, s);
        const content = fs.readFileSync(filePath, "utf-8").trim();
        const lines = content ? content.split("\n") : [];
        const lastLine = lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : null;
        return {
          name: s,
          turns: lines.length,
          terminated: lastLine?.terminated ?? false,
          reward: lastLine?.reward ?? null,
        };
      });
    return NextResponse.json({ step, task, samples });
  }

  // Level 4: read all turns for a sample
  const samplePath = path.join(taskDir, sample);
  if (!fs.existsSync(samplePath)) {
    return NextResponse.json({ error: `Sample not found: ${sample}` }, { status: 404 });
  }

  const turns: unknown[] = [];
  const fileStream = fs.createReadStream(samplePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      turns.push(JSON.parse(line));
    } catch {
      // skip
    }
  }

  return NextResponse.json({ step, task, sample, turns });
}
