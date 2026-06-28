import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';

const Dashboard = () => {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchMeetings = async () => {
    try {
      const { data } = await API.get('/meetings/my');
      setMeetings(Array.isArray(data) ? data : data.meetings || []);
    } catch (err) {
      console.log("Fetch error:", err);
      setMeetings([]);
    }
  };

  useEffect(() => { fetchMeetings(); }, []);

  const createMeeting = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const { data } = await API.post('/meetings/create', { title });
      navigate(`/meeting/${data._id}`);
    } catch (err) {
      console.log("Create error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">
          IntellMeet Dashboard
        </h1>

        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20 backdrop-blur-md sm:p-6 lg:p-8">
          <h2 className="mb-4 text-xl font-semibold">New Meeting</h2>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Meeting title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 sm:text-base"
            />
            <button
              onClick={createMeeting}
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {loading ? 'Creating...' : 'Start Meeting'}
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">My Meetings</h2>
          <span className="text-sm text-slate-400">
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {meetings.length === 0 ? (
            <p className="text-slate-400">Koi meeting nahi hai abhi.</p>
          ) : (
            meetings.map(m => (
              <div
                key={m._id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:bg-white/10 sm:p-5"
              >
                <div className="mb-4">
                  <p className="text-base font-semibold text-white sm:text-lg">
                    {m.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Code: {m.meetingCode}
                  </p>
                  <p className="text-sm text-slate-400">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/meeting/${m._id}`)}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Open
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;