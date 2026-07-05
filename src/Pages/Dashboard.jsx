import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../Api/Axios"

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="!text-white text-3xl font-bold tracking-tight sm:text-4xl">
            Meetings that get things done
          </h1>
          <p className="text-sm text-slate-400 sm:text-base">
            Video calls, Kanban boards, and AI-powered summaries — all in one place.
          </p>
          <button
            onClick={() => navigate("/kanban")}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-semibold w-fit"
          >
            📋 Kanban Board
          </button>
        </div>

        <div className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl transition hover:bg-white/7 sm:p-6 lg:p-8">
          <h2 className="!text-white mb-4 text-xl font-semibold">New Meeting</h2>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Meeting title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:text-base"
            />
            <button
              onClick={createMeeting}
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition duration-200 hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 hover:shadow-xl hover:shadow-blue-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer sm:w-auto"
            >
              {loading ? "Creating..." : "Start Meeting"}
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="!text-white text-xl font-semibold">My Meetings</h2>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
            {meetings.length} meeting{meetings.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {meetings.length === 0 ? (
            <p className="text-slate-400 col-span-full text-center py-8">
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
                    <p className="text-slate-400 text-sm mt-2 line-clamp-2">
                      📋 {m.summary}
                    </p>
                  )}

                  {m.actionItems?.length > 0 && (
                    <p className="text-purple-400 text-xs mt-1">
                      ✅ {m.actionItems.length} action items
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
                    className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 cursor-pointer"
                  >
                    📋 View Summary
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