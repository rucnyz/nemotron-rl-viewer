import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// GET /api/sessions?dir=...
// Lists all session traces in jobs/ directory
// Or with &task=sympy__sympy-14711_4c2a419d returns the session trace
export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir");
  const task = req.nextUrl.searchParams.get("task");

  if (!dir) {
    return NextResponse.json({ error: "Missing ?dir= parameter" }, { status: 400 });
  }

  const jobsDir = path.join(path.resolve(dir), "jobs");
  if (!fs.existsSync(jobsDir)) {
    return NextResponse.json({ error: "No jobs/ directory found", tasks: [] });
  }

  // List all tasks
  if (!task) {
    const tasks: { name: string; hasTrace: boolean; hasError: boolean }[] = [];

    for (const entry of fs.readdirSync(jobsDir).sort()) {
      const entryPath = path.join(jobsDir, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;

      // Look for session_trace.json inside nested task dir
      let hasTrace = false;
      let hasError = false;
      for (const sub of fs.readdirSync(entryPath)) {
        const subPath = path.join(entryPath, sub);
        if (fs.statSync(subPath).isDirectory()) {
          if (fs.existsSync(path.join(subPath, "session_trace.json"))) hasTrace = true;
          if (fs.existsSync(path.join(subPath, "error.json"))) hasError = true;
        }
      }

      tasks.push({ name: entry, hasTrace, hasError });
    }

    return NextResponse.json({ tasks });
  }

  // Read specific session trace
  const taskDir = path.join(jobsDir, task);
  if (!fs.existsSync(taskDir)) {
    return NextResponse.json({ error: `Task not found: ${task}` }, { status: 404 });
  }

  // Find session_trace.json in nested subdirectory
  for (const sub of fs.readdirSync(taskDir)) {
    const tracePath = path.join(taskDir, sub, "session_trace.json");
    if (fs.existsSync(tracePath)) {
      const data = JSON.parse(fs.readFileSync(tracePath, "utf-8"));
      const events = data.events || [];

      // Read result.json for system_prompt and user_message
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

      // Parse events into a readable format
      const turns = events.map((ev: any, idx: number) => {
        const role = ev?.content?.role || "unknown";
        const parts = ev?.content?.parts || [];

        const textParts: string[] = [];
        const functionCalls: { name: string; args: any; id: string }[] = [];
        const functionResponses: { name: string; response: any; id: string }[] = [];

        for (const part of parts) {
          if (part.text) {
            textParts.push(part.text);
          }
          if (part.function_call || part.functionCall) {
            const fc = part.function_call || part.functionCall;
            functionCalls.push({
              name: fc.name || "",
              args: fc.args || {},
              id: fc.id || "",
            });
          }
          if (part.function_response || part.functionResponse) {
            const fr = part.function_response || part.functionResponse;
            functionResponses.push({
              name: fr.name || "",
              response: fr.response || {},
              id: fr.id || "",
            });
          }
        }

        return {
          index: idx,
          role,
          author: ev.author || "",
          text: textParts.join("\n"),
          functionCalls,
          functionResponses,
          timestamp: ev.timestamp,
          usageMetadata: ev.usage_metadata || ev.usageMetadata || null,
        };
      });

      return NextResponse.json({ task, turns, systemPrompt, userMessage, reward });
    }
  }

  // Check for error.json
  for (const sub of fs.readdirSync(taskDir)) {
    const errorPath = path.join(taskDir, sub, "error.json");
    if (fs.existsSync(errorPath)) {
      const errorData = JSON.parse(fs.readFileSync(errorPath, "utf-8"));
      return NextResponse.json({ task, error: errorData, turns: [] });
    }
  }

  return NextResponse.json({ error: "No session trace found", turns: [] });
}
