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

interface Step {
  name: string;
  tasks: Task[];
}

interface Experiment {
  name: string;
  taskCount: number;
  hasLive: boolean;
}

export default function SessionView({ dir }: { dir: string }) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExp, setSelectedExp] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [reward, setReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isDirectMode, setIsDirectMode] = useState(false);

  const loadRoot = useCallback(async () => {
    const res = await fetch(`/api/sessions?dir=${encodeURIComponent(dir)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.experiments) {
        setExperiments(data.experiments);
        setIsDirectMode(false);
        if (data.experiments.length === 1) {
          selectExperiment(data.experiments[0].name);
        }
      } else if (data.steps) {
        setSteps(data.steps);
        setIsDirectMode(true);
        setExperiments([]);
        // Auto-expand all steps
        setExpandedSteps(new Set(data.steps.map((s: Step) => s.name)));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir]);

  const selectExperiment = async (expName: string) => {
    setSelectedExp(expName);
    setSelectedTask(null);
    setSelectedStep(null);
    setTurns([]);
    setSystemPrompt("");
    setUserMessage("");
    setReward(null);
    setError(null);
    const res = await fetch(`/api/sessions?dir=${encodeURIComponent(dir)}&exp=${encodeURIComponent(expName)}`);
    if (res.ok) {
      const data = await res.json();
      setSteps(data.steps || []);
      // Auto-expand all steps
      setExpandedSteps(new Set((data.steps || []).map((s: Step) => s.name)));
    }
  };

  const toggleStep = (stepName: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepName)) next.delete(stepName);
      else next.add(stepName);
      return next;
    });
  };

  const loadSession = async (stepName: string, taskName: string) => {
    setSelectedTask(taskName);
    setSelectedStep(stepName);
    const params = new URLSearchParams({ dir, task: taskName, step: stepName });
    if (selectedExp) params.set("exp", selectedExp);
    const res = await fetch(`/api/sessions?${params}`);
    if (res.ok) {
      const data = await res.json();
      setTurns(data.turns || []);
      setSystemPrompt(data.systemPrompt || "");
      setUserMessage(data.userMessage || "");
      setReward(data.reward ?? null);
      setError(data.error ? JSON.stringify(data.error, null, 2) : null);
      setIsLive(data.live || false);
    }
  };

  // Auto-refresh for live sessions
  useEffect(() => {
    if (!isLive || !selectedTask || !selectedStep) return;
    const interval = setInterval(() => loadSession(selectedStep, selectedTask), 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, selectedTask, selectedStep]);

  useEffect(() => { loadRoot(); }, [loadRoot]);

  const hasSteps = steps.length > 0;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r overflow-y-auto">
        {/* Experiment list */}
        {experiments.length > 0 && (
          <>
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b bg-gray-50">
              Experiments ({experiments.length})
            </div>
            {experiments.map((exp) => (
              <button
                key={exp.name}
                onClick={() => selectExperiment(exp.name)}
                className={`w-full text-left px-3 py-2 text-xs border-b hover:bg-indigo-50 ${
                  selectedExp === exp.name ? "bg-indigo-100 font-semibold" : ""
                }`}
              >
                <div className="truncate font-mono">{exp.name}</div>
                <div className="flex gap-1 mt-0.5">
                  <span className="text-gray-400">{exp.taskCount} tasks</span>
                  {exp.hasLive && <span className="bg-amber-100 text-amber-700 px-1 rounded text-[10px]">running</span>}
                </div>
              </button>
            ))}
          </>
        )}

        {/* Steps + Tasks */}
        {(selectedExp || isDirectMode) && hasSteps && (
          <>
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase border-b bg-gray-50 sticky top-0">
              Steps ({steps.length}) &middot; {steps.reduce((n, s) => n + s.tasks.length, 0)} sessions
            </div>
            {steps.map((step) => (
              <div key={step.name}>
                {/* Step header */}
                <button
                  onClick={() => toggleStep(step.name)}
                  className="w-full text-left px-3 py-1.5 text-xs border-b bg-gray-50 hover:bg-gray-100 flex items-center gap-1"
                >
                  <span className="text-gray-400">{expandedSteps.has(step.name) ? "▾" : "▸"}</span>
                  <span className="font-semibold text-gray-600 font-mono">{step.name}</span>
                  <span className="text-gray-400 ml-auto">{step.tasks.length}</span>
                  {step.tasks.some(t => t.hasLive && !t.hasTrace) && (
                    <span className="bg-amber-100 text-amber-700 px-1 rounded text-[10px]">live</span>
                  )}
                </button>
                {/* Tasks within step */}
                {expandedSteps.has(step.name) && step.tasks.map((t) => (
                  <button
                    key={`${step.name}/${t.name}`}
                    onClick={() => loadSession(step.name, t.name)}
                    className={`w-full text-left pl-6 pr-3 py-1.5 text-xs border-b hover:bg-blue-50 ${
                      selectedTask === t.name && selectedStep === step.name ? "bg-blue-100 font-semibold" : ""
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
              </div>
            ))}
          </>
        )}

        {experiments.length === 0 && !isDirectMode && (
          <div className="px-3 py-8 text-sm text-gray-400 text-center">No experiments found</div>
        )}
        {(selectedExp || isDirectMode) && !hasSteps && (
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

        {!selectedTask && !selectedExp && !isDirectMode && (
          <div className="text-center text-gray-400 py-20">Select an experiment from the sidebar</div>
        )}

        {!selectedTask && (selectedExp || isDirectMode) && (
          <div className="text-center text-gray-400 py-20">Select a session from the sidebar</div>
        )}

        {/* Live indicator */}
        {selectedTask && isLive && (
          <div className="mb-3 px-4 py-2 rounded-lg text-sm font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Live — auto-refreshing every 3s
          </div>
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

        {/* User message */}
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
