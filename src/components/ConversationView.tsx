"use client";

interface Message {
  role: string;
  content: string;
}

interface Props {
  messages: Message[];
  reward: number;
  idx: number;
  advantages?: number;
}

const roleBg: Record<string, string> = {
  system: "bg-purple-50 border-purple-200",
  user: "bg-blue-50 border-blue-200",
  assistant: "bg-green-50 border-green-200",
  tool: "bg-yellow-50 border-yellow-200",
};

const roleLabel: Record<string, string> = {
  system: "text-purple-700",
  user: "text-blue-700",
  assistant: "text-green-700",
  tool: "text-yellow-700",
};

export default function ConversationView({ messages, reward, idx, advantages }: Props) {
  const rewardColor =
    reward > 0 ? "text-green-600 bg-green-50" : reward === 0 ? "text-gray-500 bg-gray-50" : "text-red-600 bg-red-50";

  return (
    <div className="border rounded-lg mb-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <span className="text-sm text-gray-500">#{idx}</span>
        <div className="flex gap-3 items-center">
          {advantages !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              adv: {advantages.toFixed(3)}
            </span>
          )}
          <span className={`text-sm font-mono font-semibold px-2 py-0.5 rounded ${rewardColor}`}>
            reward: {reward}
          </span>
          <span className="text-xs text-gray-400">{messages.length} turns</span>
        </div>
      </div>

      {/* Messages */}
      <div className="divide-y">
        {messages.map((msg, i) => (
          <div key={i} className={`px-4 py-3 border-l-4 ${roleBg[msg.role] ?? "bg-gray-50 border-gray-200"}`}>
            <div className={`text-xs font-semibold uppercase mb-1 ${roleLabel[msg.role] ?? "text-gray-600"}`}>
              {msg.role}
            </div>
            <div className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">
              {msg.content.length > 2000 ? (
                <details>
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    {msg.content.slice(0, 200)}... ({msg.content.length} chars)
                  </summary>
                  <div className="mt-2">{msg.content}</div>
                </details>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
