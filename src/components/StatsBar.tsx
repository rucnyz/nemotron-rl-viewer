"use client";

interface Stats {
  count: number;
  mean: number;
  min: number;
  max: number;
  nonzero: number;
}

export default function StatsBar({ stats }: { stats: Stats }) {
  const accuracy = stats.count > 0 ? ((stats.nonzero / stats.count) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex gap-4 items-center text-sm bg-white border rounded-lg px-4 py-2 mb-4">
      <div>
        <span className="text-gray-500">Samples:</span>{" "}
        <span className="font-semibold">{stats.count}</span>
      </div>
      <div>
        <span className="text-gray-500">Accuracy:</span>{" "}
        <span className="font-semibold text-green-600">{accuracy}%</span>
      </div>
      <div>
        <span className="text-gray-500">Mean reward:</span>{" "}
        <span className="font-semibold">{stats.mean.toFixed(3)}</span>
      </div>
      <div>
        <span className="text-gray-500">Range:</span>{" "}
        <span className="font-mono">[{stats.min}, {stats.max}]</span>
      </div>
    </div>
  );
}
