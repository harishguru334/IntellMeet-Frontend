import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import API from "../Api/Axios";

// Single Task Card
const TaskCard = ({ task, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-slate-800/70 rounded-xl p-4 cursor-grab active:cursor-grabbing border border-slate-700 hover:border-slate-600 transition"
    >
      <p className="text-white text-sm font-medium mb-2">{task.title}</p>
      <div className="flex justify-between items-center">
        <span className="text-xs text-purple-300 bg-purple-900/30 px-2 py-1 rounded-lg">
          {task.assignee}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task._id);
          }}
          className="text-slate-500 hover:text-red-400 text-xs transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

// Task ka static preview jo drag karte waqt mouse ke saath float karta hai
const TaskCardPreview = ({ task }) => (
  <div className="bg-slate-800 rounded-xl p-4 border border-blue-500/50 shadow-2xl shadow-blue-900/40 rotate-2 cursor-grabbing">
    <p className="text-white text-sm font-medium mb-2">{task.title}</p>
    <span className="text-xs text-purple-300 bg-purple-900/30 px-2 py-1 rounded-lg">
      {task.assignee}
    </span>
  </div>
);

// Column Component
const Column = ({ title, color, tasks, onDelete }) => {
  const { setNodeRef } = useSortable({ id: title });

  return (
    <div
      ref={setNodeRef}
      className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-4 flex flex-col gap-3 min-h-64 border border-slate-800"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-3 h-3 rounded-full ${color}`} />
        <h3 className="font-semibold text-white">{title}</h3>
        <span className="ml-auto text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      <SortableContext
        items={tasks.map((t) => t._id)}
        strategy={verticalListSortingStrategy}
      >
        {tasks.map((task) => (
          <TaskCard key={task._id} task={task} onDelete={onDelete} />
        ))}
      </SortableContext>

      {tasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-xl">
          Drop tasks here
        </div>
      )}
    </div>
  );
};

// Main Kanban Board
const KanbanBoard = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState("");

  const sensors = useSensors(useSensor(PointerSensor));

  const fetchTasks = async () => {
    const { data } = await API.get("/tasks");
    setTasks(data);
  };

  const fetchMeetings = async () => {
    const { data } = await API.get("/meetings/my");
    setMeetings(data.filter((m) => m.actionItems?.length > 0));
  };

  useEffect(() => {
    fetchTasks();
    fetchMeetings();
  }, []);

  const columns = {
    "To Do": tasks.filter((t) => t.status === "todo"),
    "In Progress": tasks.filter((t) => t.status === "inprogress"),
    Done: tasks.filter((t) => t.status === "done"),
  };

  const columnColors = {
    "To Do": "bg-blue-500",
    "In Progress": "bg-yellow-500",
    Done: "bg-emerald-500",
  };

  const statusMap = {
    "To Do": "todo",
    "In Progress": "inprogress",
    Done: "done",
  };

  // ✅ Active task nikalo — DragOverlay ke liye
  const activeTask = tasks.find((t) => t._id === activeId);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null); // ✅ pehle hi clear kar do, DragOverlay hat jayega turant
    if (!over) return;

    const activeTaskObj = tasks.find((t) => t._id === active.id);
    if (!activeTaskObj) return;

    let newStatus = null;
    for (const [colName, colTasks] of Object.entries(columns)) {
      if (over.id === colName || colTasks.find((t) => t._id === over.id)) {
        newStatus = statusMap[colName];
        break;
      }
    }

    if (!newStatus || newStatus === activeTaskObj.status) return;

    setTasks((prev) =>
      prev.map((t) => (t._id === active.id ? { ...t, status: newStatus } : t)),
    );

    await API.put(`/tasks/${active.id}/status`, { status: newStatus });
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const { data } = await API.post("/tasks", { title: newTask });
    setTasks((prev) => [...prev, data]);
    setNewTask("");
  };

  const deleteTask = async (taskId) => {
    await API.delete(`/tasks/${taskId}`);
    setTasks((prev) => prev.filter((t) => t._id !== taskId));
  };

  const importFromMeeting = async () => {
    if (!selectedMeeting) return;
    setImporting(true);
    try {
      const { data } = await API.post(`/tasks/import/${selectedMeeting}`);
      setTasks((prev) => [...prev, ...data]);
      setSelectedMeeting("");
    } catch (err) {
      console.error(err);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Kanban Board</h1>
          <p className="text-slate-400 text-sm mt-1">
            Drag tasks to update status
          </p>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-xl text-sm transition"
        >
          ← Dashboard
        </button>
      </div>

      {/* Add Task + Import */}
      <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 mb-6 border border-slate-800">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addTask()}
            placeholder="New task title..."
            className="flex-1 bg-slate-800/70 rounded-xl px-4 py-2 text-sm outline-none border border-slate-700 focus:border-blue-500/50 transition"
          />
          <button
            onClick={addTask}
            className="rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-2 text-sm font-semibold shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5"
          >
            + Add Task
          </button>
        </div>

        {meetings.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedMeeting}
              onChange={(e) => setSelectedMeeting(e.target.value)}
              className="flex-1 bg-slate-800/70 rounded-xl px-4 py-2 text-sm outline-none border border-slate-700"
            >
              <option value="">Import action items from meeting...</option>
              {meetings.map((m) => (
                <option key={m._id} value={m._id}>
                  {m.title} ({m.actionItems.length} items)
                </option>
              ))}
            </select>
            <button
              onClick={importFromMeeting}
              disabled={!selectedMeeting || importing}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-5 py-2 rounded-xl text-sm font-semibold transition"
            >
              {importing ? "Importing..." : "Import"}
            </button>
          </div>
        )}
      </div>

      {/* Kanban Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(e.active.id)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(columns).map(([colName, colTasks]) => (
            <Column
              key={colName}
              title={colName}
              color={columnColors[colName]}
              tasks={colTasks}
              onDelete={deleteTask}
            />
          ))}
        </div>

        {/* ✅ DragOverlay — ab drag karte waqt smooth floating preview dikhega */}
        <DragOverlay>
          {activeTask ? <TaskCardPreview task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl p-4 text-center border border-slate-800">
          <p className="text-2xl font-bold text-blue-400">
            {columns["To Do"].length}
          </p>
          <p className="text-slate-400 text-sm">To Do</p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl p-4 text-center border border-slate-800">
          <p className="text-2xl font-bold text-yellow-400">
            {columns["In Progress"].length}
          </p>
          <p className="text-slate-400 text-sm">In Progress</p>
        </div>
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-xl p-4 text-center border border-slate-800">
          <p className="text-2xl font-bold text-emerald-400">
            {columns["Done"].length}
          </p>
          <p className="text-slate-400 text-sm">Done</p>
        </div>
      </div>
    </div>
  );
};

export default KanbanBoard;