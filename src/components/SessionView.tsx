"use client";

import { useState, useEffect, useCallback } from "react";

interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
  id: string;
}

interface FunctionResponse {
  name: string;
  response: Record<string, unknown> | string;
  id: string;
}

interface Turn {
  index: number;
  role: string;
  author: string;
  text: string;
  functionCalls: FunctionCall[];
  functionResponses: FunctionResponse[];
  timestamp: number;
  usageMetadata: { prompt_token_count?: number; candidates_token_count?: number } | null;
}

interface Task {
  name: string;
  hasTrace: boolean;
  hasLive: boolean;
  hasError: boolean;
}

export default function SessionView({ dir }: { dir: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const res = await fetch(`/api/sessions?dir=${encodeURIComponent(dir)}`);
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks || []);
    }
  }, [dir]);

  const loadSession = useCallback(async (task: string) => {
    setSelectedTask(task);
    const res = await fetch(`/api/sessions?dir=${encodeURIComponent(dir)}&task=${encodeURIComponent(task)}`);
    if (res.ok) {
      const data = await res.json();
      setTurns(data.turns || []);
      setSystemPrompt(data.systemPrompt || "");
      setUserMessage(data.userMessage || "");
      setReward(data.reward ?? null);
      setError(data.error ? JSON.stringify(data.error, null, 2) : null);
    }
  }, [dir]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  return (
    <div className="flex h-full">
      {/* Task list sidebar */}
      <div className="w-64 shrink-0 border-r overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b">
          Sessions ({tasks.length})
        </div>
        {tasks.map((t) => (
          <button
            key={t.name}
            onClick={() => loadSession(t.name)}
            className={`w-full text-left px-3 py-2 text-xs border-b hover:bg-blue-50 ${
              selectedTask === t.name ? "bg-blue-100 font-semibold" : ""
            }`}
          >
            <div className="truncate">{t.name}</div>
            <div className="flex gap-1 mt-0.5">
              {t.hasTrace && <span className="bg-green-100 text-green-700 px-1 rounded text-[10px]">trace</span>}
              {t.hasLive && !t.hasTrace && <span className="bg-amber-100 text-amber-700 px-1 rounded text-[10px]">live</span>}
              {t.hasError && <span className="bg-red-100 text-red-600 px-1 rounded text-[10px]">error</span>}
            </div>
          </button>
        ))}
        {tasks.length === 0 && (
          <div className="px-3 py-8 text-sm text-gray-400 text-center">No sessions yet</div>
        )}
      </div>

      {/* Session content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <div className="text-xs font-semibold text-red-700 mb-1">Error</div>
            <pre className="text-xs font-mono text-red-600 whitespace-pre-wrap">{error}</pre>
          </div>
        )}

        {!selectedTask && (
          <div className="text-center text-gray-400 py-20">Select a session from the sidebar</div>
        )}

        {/* Reward badge */}
        {selectedTask && reward !== null && (
          <div className={`mb-3 px-4 py-2 rounded-lg text-sm font-mono font-semibold ${
            reward > 0 ? "bg-green-50 text-green-600 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"
          }`}>
            Reward: {reward}
          </div>
        )}

        {/* System prompt */}
        {systemPrompt && (
          <div className="border rounded-lg mb-3 overflow-hidden">
            <div className="px-4 py-2 bg-purple-50 border-b text-sm font-semibold text-purple-700">System Prompt</div>
            <div className="px-4 py-3 border-l-4 border-purple-200 bg-purple-50">
              <div className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">
                {systemPrompt.length > 2000 ? (
                  <details>
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      {systemPrompt.slice(0, 300)}... ({systemPrompt.length} chars)
                    </summary>
                    <div className="mt-2">{systemPrompt}</div>
                  </details>
                ) : systemPrompt}
              </div>
            </div>
          </div>
        )}

        {/* User message (task instruction) */}
        {userMessage && (
          <div className="border rounded-lg mb-3 overflow-hidden">
            <div className="px-4 py-2 bg-blue-50 border-b text-sm font-semibold text-blue-700">User Message</div>
            <div className="px-4 py-3 border-l-4 border-blue-200 bg-blue-50">
              <div className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">
                {userMessage.length > 3000 ? (
                  <details>
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      {userMessage.slice(0, 300)}... ({userMessage.length} chars)
                    </summary>
                    <div className="mt-2">{userMessage}</div>
                  </details>
                ) : userMessage}
              </div>
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.index} className="border rounded-lg mb-3 overflow-hidden">
            {/* Turn header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b text-sm">
              <span className={`font-semibold ${turn.role === "model" ? "text-green-700" : "text-blue-700"}`}>
                {turn.role}
              </span>
              {turn.author && <span className="text-xs text-gray-400">{turn.author}</span>}
              {turn.usageMetadata && (
                <span className="text-xs text-gray-400 ml-auto">
                  {turn.usageMetadata.prompt_token_count}→{turn.usageMetadata.candidates_token_count} tokens
                </span>
              )}
            </div>

            {/* Text content */}
            {turn.text && (
              <div className={`px-4 py-3 border-l-4 ${turn.role === "model" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
                <div className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {turn.text.length > 3000 ? (
                    <details>
                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                        {turn.text.slice(0, 300)}... ({turn.text.length} chars)
                      </summary>
                      <div className="mt-2">{turn.text}</div>
                    </details>
                  ) : turn.text}
                </div>
              </div>
            )}

            {/* Function calls */}
            {turn.functionCalls.map((fc, i) => (
              <div key={`call-${i}`} className="px-4 py-2 bg-purple-50 border-l-4 border-purple-200 border-t">
                <div className="text-xs font-semibold uppercase text-purple-700 mb-1">
                  tool call: {fc.name}
                </div>
                <pre className="text-xs font-mono text-gray-600 bg-white rounded p-2 overflow-x-auto max-h-40 overflow-y-auto">
                  {JSON.stringify(fc.args, null, 2)}
                </pre>
              </div>
            ))}

            {/* Function responses */}
            {turn.functionResponses.map((fr, i) => (
              <div key={`resp-${i}`} className="px-4 py-2 bg-yellow-50 border-l-4 border-yellow-200 border-t">
                <div className="text-xs font-semibold uppercase text-yellow-700 mb-1">
                  tool response: {fr.name}
                </div>
                <details open={JSON.stringify(fr.response).length < 500}>
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    output ({JSON.stringify(fr.response).length} chars)
                  </summary>
                  <pre className="text-xs font-mono text-gray-700 bg-white rounded p-2 mt-1 overflow-x-auto max-h-60 overflow-y-auto">
                    {typeof fr.response === "string" ? fr.response : JSON.stringify(fr.response, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
