import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import API from "../Api/Axios";
import {
  Bot,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Lightbulb,
  ListChecks,
  User,
  AlertTriangle,
  Check,
} from "lucide-react";

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
        const { data } = await API.post("/ai/summarize", { transcript });
        setSummary(data);

        await API.put(`/meetings/${id}/summary`, {
          summary: data.summary,
          keyPoints: data.keyPoints,
          actionItems: data.actionItems,
          transcript,
        });
        setSaved(true);
      } catch (err) {
        setError("Something went wrong while generating the summary.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (transcript) {
      generate();
    } else {
      setError("No transcript was found for this meeting.");
      setLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Bot className="h-7 w-7 text-blue-400" />
            AI Meeting Summary
          </h1>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl text-sm transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </button>
        </div>

        {saved && (
          <div className="flex items-center justify-center gap-2 bg-emerald-900/30 border border-emerald-500/50 rounded-xl p-3 mb-6 text-emerald-400 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Summary saved to meeting history
          </div>
        )}

        {loading && (
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-12 text-center border border-slate-800">
            <Bot className="h-12 w-12 mx-auto mb-4 text-blue-400 animate-pulse" />
            <p className="text-slate-400 text-lg">Generating your AI summary...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-2xl p-6 text-red-300 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            {error}
          </div>
        )}

        {summary && (
          <div className="space-y-5">
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
              <h2 className="flex items-center gap-2 text-blue-400 font-semibold mb-3">
                <FileText className="h-4 w-4" />
                Meeting Summary
              </h2>
              <p className="text-slate-300 leading-relaxed">{summary.summary}</p>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
              <h2 className="flex items-center gap-2 text-emerald-400 font-semibold mb-3">
                <Lightbulb className="h-4 w-4" />
                Key Points
              </h2>
              <ul className="space-y-2">
                {summary.keyPoints?.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
              <h2 className="flex items-center gap-2 text-purple-400 font-semibold mb-3">
                <ListChecks className="h-4 w-4" />
                Action Items
              </h2>
              <div className="space-y-2">
                {summary.actionItems?.map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-3"
                  >
                    <span className="text-slate-300 text-sm">{item.task}</span>
                    <span className="flex items-center gap-1 text-purple-300 text-xs font-semibold ml-4 whitespace-nowrap bg-purple-900/30 px-2 py-1 rounded-lg">
                      <User className="h-3 w-3" />
                      {item.assignee}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
              <h2 className="flex items-center gap-2 text-slate-400 font-semibold mb-3">
                <FileText className="h-4 w-4" />
                Original Transcript
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap">
                {transcript}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingSummary;