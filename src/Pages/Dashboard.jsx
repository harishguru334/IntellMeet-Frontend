import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../Api/Axios";
import toast from "react-hot-toast";
import {
  Video,
  Calendar,
  Sparkles,
  Play,
  FileText,
  CheckCircle2,
} from "lucide-react";

const Dashboard = () => {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchMeetings = async () => {
    try {
      const { data } = await API.get("/meetings/my");
      setMeetings(Array.isArray(data) ? data : data.meetings || []);
    } catch (err) {
      console.log("Fetch error:", err);
      setMeetings([]);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

 const createMeeting = async () => {
  if (!title.trim()) return;
  setLoading(true);
  try {
    const { data } = await API.post("/meetings/create", { title });
    navigate(`/meeting/${data._id}`);
  } catch (err) {
    console.log("Create error:", err);
    toast.error("Failed to create meeting. Please try again.");
  } finally {
    setLoading(false);
  }
};

  const totalMeetings = meetings.length;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const meetingsThisWeek = meetings.filter(
    (m) => new Date(m.createdAt) >= oneWeekAgo
  ).length;

  const summariesCount = meetings.filter((m) => m.summary).length;

  const totalActionItems = meetings.reduce(
    (sum, m) => sum + (m.actionItems?.length || 0),
    0
  );

  const stats = [
    { icon: Video, value: totalMeetings, label: "Total meetings", color: "text-purple-400" },
    { icon: Calendar, value: meetingsThisWeek, label: "This week", color: "text-orange-400" },
    { icon: Sparkles, value: summariesCount, label: "AI summaries", color: "text-pink-400" },
    { icon: CheckCircle2, value: totalActionItems, label: "Action items", color: "text-emerald-400" },
  ];

  return (
    <div className="min-h-screen bg-linear-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-6">
          <h1 className="text-white text-2xl font-bold tracking-tight sm:text-3xl">
            Meetings that get things done
          </h1>
          <p className="mt-1 text-sm text-slate-400 sm:text-base">
            Video calls, Kanban boards, and AI-powered summaries — all in one place.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
              <p className="mt-2 text-2xl font-semibold text-white">
                {stat.value}
              </p>
              <p className="text-xs text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl transition hover:bg-white/7 sm:p-6 lg:p-8">
          <h2 className="text-white mb-4 text-xl font-semibold">
            Start a new meeting
          </h2>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Weekly sync, client call..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:text-base"
            />
            <button
              onClick={createMeeting}
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-blue-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer sm:w-auto"
            >
              <Play className="h-4 w-4" />
              {loading ? "Creating..." : "Start"}
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-white text-xl font-semibold">My Meetings</h2>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
            {meetings.length} meeting{meetings.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {meetings.length === 0 ? (
            <p className="col-span-full py-8 text-center text-slate-400">
              No meetings yet. Start your first one above! 👆
            </p>
          ) : (
            meetings.map((m) => (
              <div
                key={m._id}
                className="group rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:bg-white/10 sm:p-6"
              >
                <div className="mb-4">
                  <p className="text-base font-semibold text-white transition group-hover:text-blue-300 sm:text-lg">
                    {m.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Code: {m.meetingCode}
                  </p>
                  <p className="text-sm text-slate-400">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                  {m.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                      {m.summary}
                    </p>
                  )}

                  {m.actionItems?.length > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-purple-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {m.actionItems.length} action items
                    </p>
                  )}
                </div>

                <button
                  onClick={() => navigate(`/meeting/${m._id}`)}
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 cursor-pointer"
                >
                  Open
                </button>
                {m.summary && (
                  <button
                    onClick={() => navigate(`/meeting/${m._id}/detail`)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-purple-500 cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    View Summary
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;