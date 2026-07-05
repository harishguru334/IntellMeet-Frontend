import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../Api/Axios";

const MeetingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);

  useEffect(() => {
    API.get(`/meetings/${id}`).then(({ data }) => setMeeting(data));
  }, [id]);

  if (!meeting) return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center text-white">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        Loading...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{meeting.title}</h1>
            <p className="text-slate-400 text-sm mt-1">
              Code: <span className="font-mono text-slate-300">{meeting.meetingCode}</span> • {new Date(meeting.createdAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl text-sm transition"
          >
            ← Dashboard
          </button>
        </div>

        {meeting.summary ? (
          <div className="space-y-5">

            {/* Summary */}
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
              <h2 className="text-blue-400 font-semibold mb-3">📋 Meeting Summary</h2>
              <p className="text-slate-300 leading-relaxed">{meeting.summary}</p>
            </div>

            {/* Action Items */}
            {meeting.actionItems?.length > 0 && (
              <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
                <h2 className="text-purple-400 font-semibold mb-3">✅ Action Items</h2>
                <div className="space-y-2">
                  {meeting.actionItems.map((item, i) => (
                    <div key={i} className="flex justify-between items-center bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-3">
                      <span className="text-slate-300 text-sm">{item.task}</span>
                      <span className="text-purple-300 text-xs font-semibold bg-purple-900/30 px-2 py-1 rounded-lg">
                        👤 {item.assignee}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transcript */}
            {meeting.transcript && (
              <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-800">
                <h2 className="text-slate-400 font-semibold mb-3">📝 Transcript</h2>
                <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap">
                  {meeting.transcript}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-8 text-center text-slate-500 border border-slate-800">
            <div className="text-4xl mb-3">📋</div>
            <p>Koi summary nahi hai abhi.</p>
            <button
              onClick={() => navigate(`/meeting/${id}`)}
              className="mt-4 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5"
            >
              Join Meeting
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingDetail;