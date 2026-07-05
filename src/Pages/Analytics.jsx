import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../Api/Axios";

const Analytics = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get("/analytics")
      .then(({ data }) => setData(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="text-5xl animate-pulse">📊</div>
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading analytics...
        </div>
      </div>
    </div>
  );

  const stats = [
    { label: "Total Meetings", value: data?.totalMeetings, color: "text-blue-400", bg: "bg-blue-500/10", ring: "border-blue-500/20", icon: "🎯" },
    { label: "AI Summaries", value: data?.meetingsWithSummary, color: "text-purple-400", bg: "bg-purple-500/10", ring: "border-purple-500/20", icon: "🤖" },
    { label: "Action Items", value: data?.totalActionItems, color: "text-yellow-400", bg: "bg-yellow-500/10", ring: "border-yellow-500/20", icon: "✅" },
    { label: "Total Tasks", value: data?.totalTasks, color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "border-emerald-500/20", icon: "📋" },
  ];

  const completionRate = data?.totalTasks
    ? Math.round((data.completedTasks / data.totalTasks) * 100)
    : 0;

  const maxMeetings = Math.max(...(data?.meetingsByDay?.map(d => d.count) || [1]), 1);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">📊 Analytics</h1>
            <p className="text-slate-400 text-sm mt-1">Meeting productivity insights</p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl text-sm transition"
          >
            ← Dashboard
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className={`${stat.bg} backdrop-blur-xl border ${stat.ring} rounded-2xl p-5 text-center shadow-lg transition hover:-translate-y-0.5`}
            >
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value ?? 0}</div>
              <div className="text-slate-400 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Completion Rate */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800 mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">🏆 Task Completion Rate</h2>
            <span className="text-emerald-400 font-bold text-xl">{completionRate}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden">
            <div
              className="bg-linear-to-r from-emerald-500 to-green-400 h-4 rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>

        {/* Task Status Breakdown */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800 mb-6">
          <h2 className="text-lg font-semibold mb-4">📋 Task Status Breakdown</h2>
          <div className="space-y-4">

            <div className="flex items-center gap-3">
              <span className="text-blue-400 w-28 text-sm">To Do</span>
              <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${data?.totalTasks ? (data.todoTasks / data.totalTasks) * 100 : 0}%` }}
                />
              </div>
              <span className="text-slate-400 text-sm w-8 text-right">{data?.todoTasks ?? 0}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-yellow-400 w-28 text-sm">In Progress</span>
              <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${data?.totalTasks ? (data.inProgressTasks / data.totalTasks) * 100 : 0}%` }}
                />
              </div>
              <span className="text-slate-400 text-sm w-8 text-right">{data?.inProgressTasks ?? 0}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-emerald-400 w-28 text-sm">Done</span>
              <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${data?.totalTasks ? (data.completedTasks / data.totalTasks) * 100 : 0}%` }}
                />
              </div>
              <span className="text-slate-400 text-sm w-8 text-right">{data?.completedTasks ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Last 7 Days Bar Chart */}
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800 mb-6">
          <h2 className="text-lg font-semibold mb-6">📅 Meetings - Last 7 Days</h2>
          <div className="flex items-end gap-3 h-40">
            {data?.meetingsByDay?.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-slate-400 text-xs">{day.count}</span>
                <div className="w-full flex items-end justify-center h-full">
                  <div
                    className="w-full bg-linear-to-t from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${day.count > 0 ? (day.count / maxMeetings) * 100 : 4}%`,
                      minHeight: day.count > 0 ? "20px" : "4px"
                    }}
                  />
                </div>
                <span className="text-slate-500 text-xs">
                  {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-900/60 backdrop-blur-xl hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 text-center transition hover:-translate-y-0.5"
          >
            <div className="text-2xl mb-1">🏠</div>
            <div className="text-sm text-slate-300">Dashboard</div>
          </button>
          <button
            onClick={() => navigate("/kanban")}
            className="bg-slate-900/60 backdrop-blur-xl hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 text-center transition hover:-translate-y-0.5"
          >
            <div className="text-2xl mb-1">📋</div>
            <div className="text-sm text-slate-300">Kanban Board</div>
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-900/60 backdrop-blur-xl hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 text-center transition hover:-translate-y-0.5"
          >
            <div className="text-2xl mb-1">➕</div>
            <div className="text-sm text-slate-300">New Meeting</div>
          </button>
        </div>

      </div>
    </div>
  );
};

export default Analytics;