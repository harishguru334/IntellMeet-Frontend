import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import API from "../Api/Axios";

const MeetingSummary = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const transcript = searchParams.get("transcript") || "";

  useEffect(() => {
    const generate = async () => {
      try {
        // AI se summary lo
        const { data } = await API.post("/ai/summarize", { transcript });
        setSummary(data);

        // ✅ DB mein save karo
        await API.put(`/meetings/${id}/summary`, {
          summary: data.summary,
          keyPoints: data.keyPoints,
          actionItems: data.actionItems,
          transcript,
        });
        setSaved(true);

      } catch (err) {
        setError("AI summary generate karne mein error aaya.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (transcript) {
      generate();
    } else {
      setError("Koi transcript nahi mili.");
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">🤖 AI Meeting Summary</h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl text-sm transition"
          >
            ← Dashboard
          </button>
        </div>

        {/* Saved Badge */}
        {saved && (
          <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-xl p-3 mb-6 text-emerald-400 text-sm text-center">
            ✅ Summary saved to meeting history!
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-12 text-center border border-slate-800">
            <div className="text-5xl mb-4 animate-pulse">🤖</div>
            <p className="text-slate-400 text-lg">AI summary generate ho rahi hai...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-2xl p-6 text-red-300 text-center">
            <div className="text-3xl mb-2">❌</div>
            {error}
          </div>
        )}

        {/* Summary Result */}
        {summary && (
          <div className="space-y-5">

            {/* Summary */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
              <h2 className="text-blue-400 font-semibold mb-3">📋 Meeting Summary</h2>
              <p className="text-slate-300 leading-relaxed">{summary.summary}</p>
            </div>

            {/* Key Points */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
              <h2 className="text-emerald-400 font-semibold mb-3">💡 Key Points</h2>
              <ul className="space-y-2">
                {summary.keyPoints?.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <span className="text-emerald-400 font-bold">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Items */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
              <h2 className="text-purple-400 font-semibold mb-3">✅ Action Items</h2>
              <div className="space-y-2">
                {summary.actionItems?.map((item, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-3">
                    <span className="text-slate-300 text-sm">{item.task}</span>
                    <span className="text-purple-300 text-xs font-semibold ml-4 whitespace-nowrap bg-purple-900/30 px-2 py-1 rounded-lg">
                      👤 {item.assignee}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Transcript */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
              <h2 className="text-slate-400 font-semibold mb-3">📝 Original Transcript</h2>
              <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingSummary;