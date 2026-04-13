"use client";

import { useState, useEffect, useCallback } from "react";
import ConversationView from "@/components/ConversationView";
import StatsBar from "@/components/StatsBar";
import LogViewer from "@/components/LogViewer";

interface FileInfo {
  name: string;
  size: number;
  modified: string;
}

interface Experiment {
  name: string;
  hasJsonl: boolean;
  hasLogs: boolean;
  fileCount: number;
}

interface Sample {
  content?: Array<{ role: string; content: string }>;
  rewards?: number;
  idx?: number;
  advantages?: number;
  input_lengths?: number;
}

interface Stats {
  count: number;
  mean: number;
  min: number;
  max: number;
  nonzero: number;
}

type ViewMode = "trajectories" | "log";

function getSavedDir(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("nrl-viewer-dir") ?? "";
}

export default function Home() {
  const [dir, setDir] = useState("");
  const [dirInput, setDirInput] = useState("");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [logFiles, setLogFiles] = useState<FileInfo[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("trajectories");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("idx");
  const [sortOrder, setSortOrder] = useState("asc");
  const [rewardFilter, setRewardFilter] = useState<"all" | "positive" | "zero">("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const loadFiles = useCallback(async (directory: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/files?dir=${encodeURIComponent(directory)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFiles(data.files ?? []);
      setLogFiles(data.logFiles ?? []);
      setExperiments(data.experiments ?? []);
      setDir(data.dir);
      setDirInput(data.dir);
      setSelectedFile(null);
      setSelectedLog(null);
      setSamples([]);
      setStats(null);
      // Persist dir in localStorage
      localStorage.setItem("nrl-viewer-dir", data.dir);
      // Auto-select log if no jsonl files but logs exist
      if ((data.files ?? []).length === 0 && (data.logFiles ?? []).length > 0) {
        setViewMode("log");
        setSelectedLog(data.logFiles[0].name);
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFile = useCallback(
    async (name: string, pg = 0, sort = sortBy, order = sortOrder, filter = rewardFilter) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          dir,
          name,
          offset: String(pg * pageSize),
          limit: String(pageSize),
          sort,
          order,
        });
        if (filter === "positive") {
          params.set("minReward", "0.001");
        } else if (filter === "zero") {
          params.set("maxReward", "0");
        }
        const res = await fetch(`/api/file?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSamples(data.samples);
        setStats(data.stats);
        setTotal(data.total);
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [dir, sortBy, sortOrder, rewardFilter]
  );

  // Auto-load from localStorage on mount
  useEffect(() => {
    const saved = getSavedDir();
    if (saved) {
      setDirInput(saved);
      loadFiles(saved);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedFile && viewMode === "trajectories") {
      setPage(0);
      loadFile(selectedFile, 0);
    }
  }, [selectedFile, sortBy, sortOrder, rewardFilter, loadFile, viewMode]);

  const openExperiment = (expName: string) => {
    const expDir = `${dir}/${expName}`;
    setDirInput(expDir);
    loadFiles(expDir);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-72 bg-white border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold mb-3">NeMo RL Viewer</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadFiles(dirInput);
            }}
          >
            <input
              type="text"
              placeholder="/path/to/logs or /path/to/logs/exp_001"
              value={dirInput}
              onChange={(e) => setDirInput(e.target.value)}
              className="w-full border rounded px-2 py-1.5 text-sm mb-2"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 text-white rounded py-1.5 text-sm hover:bg-blue-700"
            >
              Open Directory
            </button>
          </form>
        </div>

        {dir && (
          <div className="p-3 bg-gray-50 border-b text-xs text-gray-500 truncate" title={dir}>
            {dir}
          </div>
        )}

        {/* Experiments list */}
        {experiments.length > 0 && (
          <div className="border-b">
            <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase">Experiments</div>
            {experiments.map((exp) => (
              <button
                key={exp.name}
                onClick={() => openExperiment(exp.name)}
                className="w-full text-left px-4 py-2 text-sm border-b hover:bg-blue-50"
              >
                <div className="flex items-center gap-2">
                  <span>{exp.name}</span>
                  {exp.hasJsonl && <span className="text-xs bg-green-100 text-green-700 px-1 rounded">jsonl</span>}
                  {exp.hasLogs && <span className="text-xs bg-blue-100 text-blue-700 px-1 rounded">log</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* View mode tabs */}
        {(files.length > 0 || logFiles.length > 0) && (
          <div className="flex border-b">
            <button
              onClick={() => setViewMode("trajectories")}
              className={`flex-1 py-2 text-xs font-semibold ${
                viewMode === "trajectories" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"
              }`}
            >
              Trajectories ({files.length})
            </button>
            <button
              onClick={() => setViewMode("log")}
              className={`flex-1 py-2 text-xs font-semibold ${
                viewMode === "log" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-400"
              }`}
            >
              Logs ({logFiles.length})
            </button>
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "trajectories" &&
            files.map((f) => (
              <button
                key={f.name}
                onClick={() => {
                  setSelectedFile(f.name);
                  setSelectedLog(null);
                }}
                className={`w-full text-left px-4 py-2 text-sm border-b hover:bg-blue-50 ${
                  selectedFile === f.name ? "bg-blue-100 font-semibold" : ""
                }`}
              >
                <div className="truncate">{f.name}</div>
                <div className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</div>
              </button>
            ))}
          {viewMode === "log" &&
            logFiles.map((f) => (
              <button
                key={f.name}
                onClick={() => {
                  setSelectedLog(f.name);
                  setSelectedFile(null);
                }}
                className={`w-full text-left px-4 py-2 text-sm border-b hover:bg-blue-50 ${
                  selectedLog === f.name ? "bg-blue-100 font-semibold" : ""
                }`}
              >
                <div className="truncate">{f.name}</div>
                <div className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</div>
              </button>
            ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Log viewer */}
        {viewMode === "log" && selectedLog && (
          <LogViewer dir={dir} filename={selectedLog} />
        )}

        {/* Trajectory toolbar */}
        {viewMode === "trajectories" && selectedFile && (
          <div className="flex items-center gap-4 px-6 py-3 bg-white border-b">
            <span className="font-semibold text-sm">{selectedFile}</span>
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-xs text-gray-500">Sort:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="idx">Index</option>
                <option value="rewards">Reward</option>
                <option value="advantages">Advantage</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
              <label className="text-xs text-gray-500 ml-2">Filter:</label>
              <select
                value={rewardFilter}
                onChange={(e) => setRewardFilter(e.target.value as "all" | "positive" | "zero")}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="positive">Reward &gt; 0</option>
                <option value="zero">Reward = 0</option>
              </select>
            </div>
          </div>
        )}

        {/* Trajectory content */}
        {viewMode === "trajectories" && (
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">
                {error}
              </div>
            )}

            {loading && <div className="text-center text-gray-500 py-8">Loading...</div>}

            {!selectedFile && !loading && experiments.length === 0 && (
              <div className="text-center text-gray-400 py-20">
                <p className="text-lg mb-2">Enter a logs directory path to start</p>
                <p className="text-sm">
                  e.g. <code className="bg-gray-200 px-1 rounded">logs/</code> or{" "}
                  <code className="bg-gray-200 px-1 rounded">logs/exp_001</code>
                </p>
              </div>
            )}

            {!selectedFile && !loading && experiments.length > 0 && files.length === 0 && (
              <div className="text-center text-gray-400 py-20">
                <p className="text-lg mb-2">Select an experiment from the sidebar</p>
                <p className="text-sm">or switch to the Logs tab to view training output</p>
              </div>
            )}

            {stats && <StatsBar stats={stats} />}

            {samples.map((s, i) => (
              <ConversationView
                key={`${page}-${i}`}
                messages={s.content ?? []}
                reward={s.rewards ?? 0}
                idx={s.idx ?? i}
                advantages={s.advantages}
              />
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-4">
                <button
                  disabled={page === 0}
                  onClick={() => {
                    setPage(page - 1);
                    loadFile(selectedFile!, page - 1);
                  }}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-30 hover:bg-gray-50"
                >
                  Prev
                </button>
                <span className="text-sm text-gray-500">
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => {
                    setPage(page + 1);
                    loadFile(selectedFile!, page + 1);
                  }}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-30 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
