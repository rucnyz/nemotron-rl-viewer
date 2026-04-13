"use client";

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  output: string;
}

interface Turn {
  task_id: string;
  sample: number;
  turn: number;
  terminated: boolean;
  reward: number | null;
  tool_calls: ToolCall[];
  elapsed: number;
  assistant_response: string;
  env_observation: string;
}

export default function TurnView({ turns }: { turns: Turn[] }) {
  const lastTurn = turns[turns.length - 1];
  const reward = lastTurn?.reward;
  const rewardColor =
    reward === null
      ? "text-gray-500 bg-gray-50 border-gray-200"
      : reward > 0
        ? "text-green-600 bg-green-50 border-green-200"
        : "text-red-600 bg-red-50 border-red-200";
  const totalElapsed = turns.reduce((sum, t) => sum + t.elapsed, 0);
  const toolCounts: Record<string, number> = {};
  turns.forEach((t) => t.tool_calls.forEach((tc) => { toolCounts[tc.name] = (toolCounts[tc.name] ?? 0) + 1; }));

  return (
    <div className="flex gap-4 h-full">
      {/* Main: turns */}
      <div className="flex-1 overflow-y-auto">
        {turns.map((turn, idx) => (
          <div key={idx} className="border rounded-lg mb-3 overflow-hidden">
            {/* Turn header */}
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b text-sm">
              <span className="font-semibold">Turn {turn.turn}</span>
              <span className="text-gray-400">{turn.elapsed}s</span>
              {turn.tool_calls.length > 0 ? (
                <span className="text-xs text-blue-600">
                  {turn.tool_calls.map((t) => t.name).join(", ")}
                </span>
              ) : (
                <span className="text-xs text-gray-400">no tools</span>
              )}
              {turn.terminated && turn.reward !== null && (
                <span className={`ml-auto text-sm font-mono font-semibold px-2 py-0.5 rounded border ${rewardColor}`}>
                  reward: {turn.reward}
                </span>
              )}
            </div>

            {/* Assistant response */}
            <div className="px-4 py-3 border-l-4 bg-green-50 border-green-200">
              <div className="text-xs font-semibold uppercase mb-1 text-green-700">assistant</div>
              <div className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">
                {turn.assistant_response.length > 3000 ? (
                  <details>
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      {turn.assistant_response.slice(0, 300)}... ({turn.assistant_response.length} chars)
                    </summary>
                    <div className="mt-2">{turn.assistant_response}</div>
                  </details>
                ) : (
                  turn.assistant_response
                )}
              </div>
            </div>

            {/* Tool calls */}
            {turn.tool_calls.map((tc, tIdx) => (
              <div key={tIdx} className="border-t">
                <div className="px-4 py-2 bg-blue-50 border-l-4 border-blue-200">
                  <div className="text-xs font-semibold uppercase text-blue-700 mb-1">tool: {tc.name}</div>
                  <div className="text-xs font-mono text-gray-600 bg-white rounded p-2 mb-2">
                    {JSON.stringify(tc.arguments, null, 2)}
                  </div>
                  {tc.output && (
                    <details open={tc.output.length < 1000}>
                      <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                        output ({tc.output.length} chars)
                      </summary>
                      <pre className="text-xs font-mono text-gray-700 bg-white rounded p-2 mt-1 overflow-x-auto max-h-60 overflow-y-auto">
                        {tc.output}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}

            {/* No tools */}
            {turn.tool_calls.length === 0 && (
              <div className="px-4 py-3 border-l-4 bg-yellow-50 border-yellow-200 border-t">
                <div className="text-xs font-semibold uppercase mb-1 text-yellow-700">environment</div>
                <div className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {turn.env_observation}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right sidebar: metadata */}
      <div className="w-56 shrink-0">
        <div className="sticky top-0 border rounded-lg bg-white overflow-hidden">
          {/* Reward */}
          <div className={`px-4 py-3 border-b text-center ${rewardColor}`}>
            <div className="text-xs uppercase font-semibold mb-1">Reward</div>
            <div className="text-2xl font-bold font-mono">{reward ?? "—"}</div>
          </div>

          {/* Metadata */}
          <div className="px-4 py-3 text-sm space-y-2">
            <div>
              <div className="text-xs text-gray-400">Task</div>
              <div className="font-mono text-xs break-all">{lastTurn?.task_id}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Sample</div>
              <div className="font-mono">{lastTurn?.sample}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Turns</div>
              <div className="font-mono">{turns.length}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Total time</div>
              <div className="font-mono">{totalElapsed.toFixed(1)}s</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Terminated</div>
              <div className="font-mono">{lastTurn?.terminated ? "Yes" : "No"}</div>
            </div>
          </div>

          {/* Tool usage summary */}
          {Object.keys(toolCounts).length > 0 && (
            <div className="px-4 py-3 border-t text-sm">
              <div className="text-xs text-gray-400 mb-1">Tool usage</div>
              {Object.entries(toolCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                <div key={name} className="flex justify-between text-xs">
                  <span className="font-mono truncate">{name}</span>
                  <span className="text-gray-500">{count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
