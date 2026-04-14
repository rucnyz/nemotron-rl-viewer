import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// GET /api/sessions?dir=...
// Discovers experiments, lists steps+tasks, or loads a session trace.
// &exp=...   select experiment
// &step=...  select step (e.g. "step_0000")
// &task=...  select task within step
export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");
  const task = req.nextUrl.searchParams.get("task");
  const exp = req.nextUrl.searchParams.get("exp");
  const step = req.nextUrl.searchParams.get("step");

  if (!dir) {
    return NextResponse.json({ error: "Missing ?dir= parameter" }, { status: 400 });
  }

  const resolvedDir = path.resolve(dir);

  // If exp is specified, use that as the experiment directory
  const expDir = exp ? path.join(resolvedDir, exp) : resolvedDir;

  // Load a specific session trace
  if (task && step) {
    return loadSessionTrace(expDir, step, task);
  }

  // Check if dir itself has jobs/
  const jobsDir = path.join(expDir, "jobs");
  if (fs.existsSync(jobsDir) && fs.statSync(jobsDir).isDirectory()) {
    return listStepsAndTasks(expDir);
  }

  // Otherwise, discover experiment directories recursively (max depth 4)
  const experiments = discoverExperiments(resolvedDir, resolvedDir, 0, 4);
  return NextResponse.json({ experiments });
}

interface ExperimentInfo {
  name: string;
  taskCount: number;
  hasLive: boolean;
}

function discoverExperiments(rootDir: string, currentDir: string, depth: number, maxDepth: number): ExperimentInfo[] {
  if (depth > maxDepth || !fs.existsSync(currentDir)) return [];

  const results: ExperimentInfo[] = [];
  const jobsDir = path.join(currentDir, "jobs");

  if (fs.existsSync(jobsDir) && fs.statSync(jobsDir).isDirectory()) {
    let taskCount = 0;
    let hasLive = false;
    try {
      const countTasks = (dir: string) => {
        for (const entry of fs.readdirSync(dir)) {
          if (entry.startsWith(".")) continue;
          const entryPath = path.join(dir, entry);
          if (!fs.statSync(entryPath).isDirectory()) continue;
          // Is this a step_XXXX dir?
          if (entry.startsWith("step_")) {
            countTasks(entryPath); // recurse into step dir
          } else {
            // This is a task dir
            taskCount++;
            for (const sub of fs.readdirSync(entryPath)) {
              const subPath = path.join(entryPath, sub);
              if (fs.statSync(subPath).isDirectory() && fs.existsSync(path.join(subPath, "live_events.jsonl"))) {
                hasLive = true;
              }
            }
          }
        }
      };
      countTasks(jobsDir);
    } catch {}
    results.push({ name: path.relative(rootDir, currentDir), taskCount, hasLive });
    return results;
  }

  try {
    for (const entry of fs.readdirSync(currentDir).sort()) {
      if (entry.startsWith(".")) continue;
      const entryPath = path.join(currentDir, entry);
      if (fs.statSync(entryPath).isDirectory()) {
        results.push(...discoverExperiments(rootDir, entryPath, depth + 1, maxDepth));
      }
    }
  } catch {}

  return results;
}

interface TaskInfo {
  name: string;
  hasTrace: boolean;
  hasLive: boolean;
  hasError: boolean;
}

interface StepInfo {
  name: string;
  tasks: TaskInfo[];
}

function scanTaskDir(entryPath: string, entryName: string): TaskInfo {
  let hasTrace = false;
  let hasLive = false;
  let hasError = false;
  try {
    for (const sub of fs.readdirSync(entryPath)) {
      const subPath = path.join(entryPath, sub);
      if (fs.statSync(subPath).isDirectory()) {
        if (fs.existsSync(path.join(subPath, "session_trace.json"))) hasTrace = true;
        if (fs.existsSync(path.join(subPath, "live_events.jsonl"))) hasLive = true;
        if (fs.existsSync(path.join(subPath, "error.json"))) hasError = true;
      }
    }
  } catch {}
  return { name: entryName, hasTrace, hasLive, hasError };
}

function listStepsAndTasks(expDir: string) {
  const jobsDir = path.join(expDir, "jobs");
  if (!fs.existsSync(jobsDir)) {
    return NextResponse.json({ error: "No jobs/ directory found", steps: [] });
  }

  const steps: StepInfo[] = [];

  for (const entry of fs.readdirSync(jobsDir).sort()) {
    if (!entry.startsWith("step_")) continue;
    const entryPath = path.join(jobsDir, entry);
    if (!fs.statSync(entryPath).isDirectory()) continue;

    const tasks: TaskInfo[] = [];
    for (const taskEntry of fs.readdirSync(entryPath).sort()) {
      const taskPath = path.join(entryPath, taskEntry);
      if (!fs.statSync(taskPath).isDirectory()) continue;
      tasks.push(scanTaskDir(taskPath, taskEntry));
    }
    steps.push({ name: entry, tasks });
  }

  return NextResponse.json({ steps });
}

function loadSessionTrace(expDir: string, step: string | null, task: string) {
  const jobsDir = path.join(expDir, "jobs");
  const taskDir = step
    ? path.join(jobsDir, step, task)
    : path.join(jobsDir, task);

  if (!fs.existsSync(taskDir)) {
    return NextResponse.json({ error: `Task not found: ${task}` }, { status: 404 });
  }

  // Read result.json (agent server writes this early with system_prompt/user_message,
  // and overwrites at completion with the reward)
  let systemPrompt = "";
  let userMessage = "";
  let reward: number | null = null;
  const resultPath = path.join(taskDir, "result.json");
  if (fs.existsSync(resultPath)) {
    try {
      const resultData = JSON.parse(fs.readFileSync(resultPath, "utf-8"));
      systemPrompt = resultData.system_prompt || "";
      userMessage = resultData.user_message || "";
      reward = resultData.reward ?? null;
    } catch {}
  }

  // Find session_trace.json
  for (const sub of fs.readdirSync(taskDir)) {
    const tracePath = path.join(taskDir, sub, "session_trace.json");
    if (fs.existsSync(tracePath)) {
      const data = JSON.parse(fs.readFileSync(tracePath, "utf-8"));
      const turns = parseEvents(data.events || []);
      return NextResponse.json({ task, step, turns, systemPrompt, userMessage, reward });
    }
  }

  // Check for live_events.jsonl
  for (const sub of fs.readdirSync(taskDir)) {
    const livePath = path.join(taskDir, sub, "live_events.jsonl");
    if (fs.existsSync(livePath)) {
      const lines = fs.readFileSync(livePath, "utf-8").trim().split("\n").filter(Boolean);
      const events = lines.map((line) => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
      const turns = parseEvents(events);
      return NextResponse.json({ task, step, turns, systemPrompt, userMessage, reward, live: true });
    }
  }

  // Check for error.json
  for (const sub of fs.readdirSync(taskDir)) {
    const errorPath = path.join(taskDir, sub, "error.json");
    if (fs.existsSync(errorPath)) {
      const errorData = JSON.parse(fs.readFileSync(errorPath, "utf-8"));
      return NextResponse.json({ task, step, error: errorData, turns: [] });
    }
  }

  return NextResponse.json({ error: "No session trace found", turns: [] });
}

function parseEvents(events: any[]) {
  return events.map((ev: any, idx: number) => {
    const role = ev?.content?.role || "unknown";
    const parts = ev?.content?.parts || [];
    const textParts: string[] = [];
    const functionCalls: { name: string; args: any; id: string }[] = [];
    const functionResponses: { name: string; response: any; id: string }[] = [];

    for (const part of parts) {
      if (part.text) textParts.push(part.text);
      if (part.function_call || part.functionCall) {
        const fc = part.function_call || part.functionCall;
        functionCalls.push({ name: fc.name || "", args: fc.args || {}, id: fc.id || "" });
      }
      if (part.function_response || part.functionResponse) {
        const fr = part.function_response || part.functionResponse;
        functionResponses.push({ name: fr.name || "", response: fr.response || {}, id: fr.id || "" });
      }
    }

    return {
      index: idx, role, author: ev.author || "", text: textParts.join("\n"),
      functionCalls, functionResponses, timestamp: ev.timestamp,
      usageMetadata: ev.usage_metadata || ev.usageMetadata || null,
    };
  });
}
