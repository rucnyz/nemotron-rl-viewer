"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  dir: string;
  filename: string;
}

export default function LogViewer({ dir, filename }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [tail, setTail] = useState(200);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLog = useCallback(async () => {
    const params = new URLSearchParams({ dir, name: filename, tail: String(tail) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/log?${params}`);
    if (res.ok) {
      const data = await res.json();
      setLines(data.lines);
      setTotal(data.total);
    }
  }, [dir, filename, tail, search]);

  useEffect(() => {
    fetchLog();
    if (!autoRefresh) return;
    const interval = setInterval(fetchLog, 3000);
    return () => clearInterval(interval);
  }, [fetchLog, autoRefresh]);

  useEffect(() => {
    if (autoRefresh) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, autoRefresh]);

  const colorize = (line: string) => {
    if (line.includes("FAILED") || line.includes("error") || line.includes("Error")) {
      return "text-red-600";
    }
    if (line.includes("PASSED") || line.includes("DONE reward=1")) {
      return "text-green-600";
    }
    if (line.includes("[OpenSage]")) {
      return "text-blue-600";
    }
    if (line.includes("WARNING") || line.includes("UserWarning")) {
      return "text-yellow-600";
    }
    return "text-gray-700";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b">
        <span className="text-sm font-semibold">{filename}</span>
        <span className="text-xs text-gray-400">{total} total lines</span>
        <input
          type="text"
          placeholder="Filter..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-2 py-1 text-sm w-48"
        />
        <select
          value={tail}
          onChange={(e) => setTail(parseInt(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="100">Last 100</option>
          <option value="200">Last 200</option>
          <option value="500">Last 500</option>
          <option value="2000">Last 2000</option>
        </select>
        <label className="flex items-center gap-1 text-sm ml-auto">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh (3s)
        </label>
        <button
          onClick={fetchLog}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-100"
        >
          Refresh
        </button>
      </div>

      {/* Log content */}
      <div className="flex-1 overflow-y-auto bg-gray-900 p-4 font-mono text-xs leading-5">
        {lines.map((line, i) => (
          <div key={i} className={colorize(line)}>
            {line || "\u00A0"}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
