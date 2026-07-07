import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../Api/Axios";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Trash2, CheckCircle2 } from "lucide-react";

const MeetingTasks = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("");

  const fetchTasks = async () => {
    try {
      const { data } = await API.get(`/tasks?meetingId=${id}`);
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    API.get(`/meetings/${id}`).then(({ data }) => setMeeting(data)).catch(() => {});
    fetchTasks();
  }, [id]);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    try {
      const { data } = await API.post("/tasks", {
        title: newTitle,
        assignee: newAssignee || "Unassigned",
        meetingId: id,
      });
      setTasks((prev) => [data, ...prev]);
      setNewTitle("");
      setNewAssignee("");
      toast.success("Task added");
    } catch (err) {
      toast.error("Failed to add task");
    }
  };

  const toggleStatus = async (task) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, status: newStatus } : t)));
    try {
      await API.put(`/tasks/${task._id}/status`, { status: newStatus });
    } catch (err) {
      toast.error("Failed to update task");
      fetchTasks();
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await API.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      toast.success("Task deleted");
    } catch (err) {
      toast.error("Failed to delete task");
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            {meeting && (
              <p className="text-slate-400 text-sm mt-1">{meeting.title}</p>
            )}
          </div>
          <button
            onClick={() => navigate(`/meeting/${id}`)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl text-sm transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to meeting
          </button>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 mb-6 border border-slate-800 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addTask()}
            placeholder="New task title..."
            className="flex-1 bg-slate-800/70 rounded-xl px-4 py-2 text-sm outline-none border border-slate-700 focus:border-blue-500/50 transition"
          />
          <input
            type="text"
            value={newAssignee}
            onChange={(e) => setNewAssignee(e.target.value)}
            placeholder="Assign to..."
            className="sm:w-40 bg-slate-800/70 rounded-xl px-4 py-2 text-sm outline-none border border-slate-700 focus:border-blue-500/50 transition"
          />
          <button
            onClick={addTask}
            className="flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-2 text-sm font-semibold shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm text-center py-8">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No tasks yet for this meeting.</p>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task._id}
                className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-4 flex items-center gap-3"
              >
                <button
                  onClick={() => toggleStatus(task)}
                  className={`shrink-0 cursor-pointer ${task.status === "done" ? "text-emerald-400" : "text-slate-600 hover:text-slate-400"}`}
                  aria-label="Toggle done"
                >
                  <CheckCircle2 className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-slate-500" : "text-white"}`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Assigned to: <span className="text-slate-300">{task.assignee || "Unassigned"}</span>
                  </p>
                </div>
                <button
                  onClick={() => deleteTask(task._id)}
                  className="text-slate-500 hover:text-red-400 transition cursor-pointer shrink-0"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingTasks;
