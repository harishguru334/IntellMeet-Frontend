import { useEffect, useState, useRef, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../Api/Axios";
import socket from "../Socket";
import Peer from "peerjs";
import toast from "react-hot-toast";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  Circle,
  Square,
  Sparkles,
  PhoneOff,
  Send,
  Plus,
  X,
  Captions,
  Share2,
  Users,
  Crown,
  Copy,
  MoreVertical,
  ShieldCheck,
  Wifi,
  CheckCircle2,
} from "lucide-react";

const getUserIdFromToken = (token) => {
  try {
    return JSON.parse(atob(token.split(".")[1]))?.id || null;
  } catch {
    return null;
  }
};

// Recording duration ko mm:ss / hh:mm:ss format mein dikhane ke liye
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

/* ============================================================
   MEMOIZED SUB-COMPONENTS
   Yeh sab React.memo se wrapped hain taaki jab parent (MeetingRoom)
   ki koi bhi state change ho (messages, participants, tasks, etc.),
   to sirf wahi section re-render ho jiska data actually badla ho —
   baaki sab untouched rahein. Isse click handlers turant respond
   karte hain, kyunki wo kisi bhi heavy re-render ke peeche queue
   nahi hote.
   ============================================================ */

// Local + remote video grid
const VideoGrid = memo(function VideoGrid({
  localVideoRef,
  camOn,
  micOn,
  isScreenSharing,
  showMoreMenu,
  setShowMoreMenu,
  shareInvite,
  setShowTranscript,
  remoteStreams,
  registerRemoteRef,
}) {
  return (
    <div
      className={`min-h-[60vh] p-4 grid gap-4 ${
        remoteStreams.length === 0
          ? "grid-cols-1 place-content-center"
          : remoteStreams.length === 1
            ? "grid-cols-1 sm:grid-cols-2 content-center"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 content-start"
      }`}
    >
      {/* Local Video */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden aspect-video shadow-2xl">
        <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />

        <div className="absolute top-2 right-2">
          <button
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="bg-black/50 hover:bg-black/70 p-1.5 rounded-full transition cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMoreMenu && (
            <div className="absolute right-0 mt-1 w-40 bg-slate-900 border border-slate-800 rounded-lg shadow-xl overflow-hidden text-sm z-10">
              <button
                onClick={() => { shareInvite(); setShowMoreMenu(false); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/70 cursor-pointer"
              >
                Copy invite link
              </button>
              <button
                onClick={() => { setShowTranscript(true); setShowMoreMenu(false); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/70 cursor-pointer"
              >
                Show transcript
              </button>
            </div>
          )}
        </div>

        <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
          You {!camOn && "· Cam off"} {!micOn && "· Muted"}
          {isScreenSharing && " · Sharing"}
        </div>
      </div>

      {/* Remote Videos */}
      {remoteStreams.map((remote) => (
        <RemoteVideo
          key={remote.peerId}
          peerId={remote.peerId}
          stream={remote.stream}
          userName={remote.userName}
          registerRef={registerRemoteRef}
        />
      ))}
    </div>
  );
});

// Transcript toggle + textarea
const TranscriptSection = memo(function TranscriptSection({
  isTranscribing,
  startTranscription,
  stopTranscription,
  showTranscript,
  setShowTranscript,
  transcript,
  setTranscript,
}) {
  return (
    <div className="mx-4 mb-2">
      <div className="flex gap-2 mb-2 flex-wrap">
        <button
          onClick={isTranscribing ? stopTranscription : startTranscription}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
            isTranscribing ? "bg-red-600/90 hover:bg-red-600" : "bg-emerald-600/90 hover:bg-emerald-600"
          }`}
        >
          <Captions className="h-4 w-4" />
          {isTranscribing ? "Stop live transcription" : "Start live transcription"}
        </button>

        <button
          onClick={() => setShowTranscript((prev) => !prev)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer"
        >
          {showTranscript ? "Hide transcript" : "Show transcript"}
        </button>
      </div>

      {showTranscript && (
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Transcript will appear here (or paste manually for AI summary)..."
          className="w-full bg-slate-900/70 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-blue-500/50 resize-none h-24 lg:h-28 transition"
        />
      )}
    </div>
  );
});

// Bottom control bar (mic, cam, screen share, record, AI summary, leave)
const ControlsBar = memo(function ControlsBar({
  micOn,
  toggleMic,
  camOn,
  toggleCam,
  isScreenSharing,
  startScreenShare,
  stopScreenShare,
  recording,
  startRecording,
  stopRecording,
  generateSummaryInPlace,
  leaveMeeting,
}) {
  return (
    <div className="bg-slate-900/70 backdrop-blur-xl border-t border-slate-800 py-3 sm:py-5 flex justify-center items-center gap-3 flex-wrap px-3 sm:px-4">
      <button
        onClick={toggleMic}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition cursor-pointer ${
          micOn ? "bg-slate-700 hover:bg-slate-600" : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        <span className="hidden sm:inline">{micOn ? "Mute" : "Unmute"}</span>
      </button>

      <button
        onClick={toggleCam}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition cursor-pointer ${
          camOn ? "bg-slate-700 hover:bg-slate-600" : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        <span className="hidden sm:inline">{camOn ? "Cam off" : "Cam on"}</span>
      </button>

      <button
        onClick={isScreenSharing ? stopScreenShare : startScreenShare}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition cursor-pointer ${
          isScreenSharing ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
        }`}
      >
        {isScreenSharing ? <ScreenShareOff className="h-4 w-4" /> : <ScreenShare className="h-4 w-4" />}
        <span className="hidden sm:inline">{isScreenSharing ? "Stop sharing" : "Share screen"}</span>
      </button>

      <button
        onClick={recording ? stopRecording : startRecording}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition cursor-pointer ${
          recording ? "bg-slate-800 border border-red-600 text-red-400" : "bg-slate-800 hover:bg-slate-700 border border-slate-700"
        }`}
      >
        {recording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4 text-red-500" />}
        <span className="hidden sm:inline">{recording ? "Stop rec" : "Record"}</span>
      </button>

      <button
        onClick={generateSummaryInPlace}
        className="flex items-center gap-2 rounded-full bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 cursor-pointer"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">AI summary</span>
      </button>

      <button
        onClick={leaveMeeting}
        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-5 py-2.5 rounded-full text-sm font-semibold transition cursor-pointer"
      >
        <PhoneOff className="h-4 w-4" />
        <span className="hidden sm:inline">Leave</span>
      </button>
    </div>
  );
});

// Status bar (secure connection / recording timer / connection quality)
const StatusBar = memo(function StatusBar({ recording, recordingSeconds, connectionQuality }) {
  return (
    <div className="border-t border-slate-800 px-4 py-2 flex justify-between items-center text-xs text-slate-400 flex-wrap gap-2">
      <span className="flex items-center gap-1.5 text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Secure connection
      </span>
      {recording && (
        <span className="flex items-center gap-1.5 text-red-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
          Recording {formatDuration(recordingSeconds)}
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <Wifi className="h-3.5 w-3.5" />
        {connectionQuality}
      </span>
    </div>
  );
});

// Quick task creation form (title + assignee + create button)
const TaskForm = memo(function TaskForm({
  taskTitle,
  setTaskTitle,
  taskAssignee,
  setTaskAssignee,
  taskLoading,
  createQuickTask,
}) {
  return (
    <div className="p-3 border-b border-slate-800 bg-slate-800/40 space-y-2">
      <input
        type="text"
        value={taskTitle}
        onChange={(e) => setTaskTitle(e.target.value)}
        placeholder="Task title..."
        className="w-full bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500/50 transition"
      />
      <input
        type="text"
        value={taskAssignee}
        onChange={(e) => setTaskAssignee(e.target.value)}
        placeholder="Assign to (name)..."
        className="w-full bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500/50 transition"
      />
      <button
        onClick={createQuickTask}
        disabled={taskLoading}
        className="w-full bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
      >
        {taskLoading ? "Creating..." : "Create task"}
      </button>
    </div>
  );
});

// Chat message list
const MessageList = memo(function MessageList({ messages, messagesEndRef }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 max-h-[40vh] lg:max-h-none">
      {messages.map((msg, i) => (
        <div key={i}>
          {msg.type === "system" ? (
            <p className="text-center text-slate-500 text-xs py-1">{msg.message}</p>
          ) : (
            <div className={`flex gap-2 ${msg.userName === "You" ? "flex-row-reverse" : ""}`}>
              <div className="w-7 h-7 shrink-0 rounded-full bg-linear-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-[11px] font-bold">
                {(msg.userName || "?").charAt(0).toUpperCase()}
              </div>
              <div className={`flex flex-col ${msg.userName === "You" ? "items-end" : "items-start"} max-w-[75%]`}>
                <span className="text-xs text-slate-500 mb-1">
                  {msg.userName} · {msg.time}
                </span>
                <div
                  className={`px-3 py-2 rounded-xl text-sm ${
                    msg.userName === "You" ? "bg-linear-to-r from-blue-600 to-indigo-600" : "bg-slate-800"
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
});

// Chat input row
const ChatInput = memo(function ChatInput({ input, setInput, sendMessage }) {
  return (
    <div className="p-3 border-t border-slate-800 flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && sendMessage()}
        placeholder="Type a message..."
        className="flex-1 bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/50 transition"
      />
      <button
        onClick={sendMessage}
        className="flex items-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
});

// Tasks preview panel (bottom of sidebar) — "View all" button lives here
const TasksPanel = memo(function TasksPanel({ tasks, goToTasksPage }) {
  return (
    <div className="border-t border-slate-800 p-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-sm">Tasks</h3>
        <button
          onClick={goToTasksPage}
          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
        >
          View all
        </button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">No tasks yet</p>
        ) : (
          tasks.slice(0, 4).map((task) => (
            <div
              key={task._id || task.id}
              className="bg-slate-800/50 border border-slate-800 rounded-xl p-3 text-sm"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-medium flex items-center gap-1.5">
                  {task.status === "Done" && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  {task.title}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    task.status === "Done"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-indigo-500/15 text-indigo-400"
                  }`}
                >
                  {task.status || "Open"}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 text-[11px] text-slate-400">
                <span>
                  Assigned to: <span className="text-slate-300">{task.assignee || "Unassigned"}</span>
                </span>
                {task.dueDate && (
                  <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

// Whole right-hand chat sidebar — combines header, task form, messages, input, tasks panel
const ChatSidebar = memo(function ChatSidebar({
  showTaskForm,
  setShowTaskForm,
  taskTitle,
  setTaskTitle,
  taskAssignee,
  setTaskAssignee,
  taskLoading,
  createQuickTask,
  messages,
  messagesEndRef,
  input,
  setInput,
  sendMessage,
  tasks,
  goToTasksPage,
}) {
  return (
    <div className="w-full lg:w-[340px] xl:w-[380px] bg-slate-900/70 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col min-h-[400px] lg:min-h-0 overflow-hidden rounded-2xl lg:rounded-none">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <h2 className="font-semibold text-sm">Meeting chat</h2>
        <button
          onClick={() => setShowTaskForm((prev) => !prev)}
          className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-700 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
        >
          {showTaskForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {showTaskForm ? "Close" : "Task"}
        </button>
      </div>

      {showTaskForm && (
        <TaskForm
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          taskAssignee={taskAssignee}
          setTaskAssignee={setTaskAssignee}
          taskLoading={taskLoading}
          createQuickTask={createQuickTask}
        />
      )}

      <MessageList messages={messages} messagesEndRef={messagesEndRef} />
      <ChatInput input={input} setInput={setInput} sendMessage={sendMessage} />
      <TasksPanel tasks={tasks} goToTasksPage={goToTasksPage} />
    </div>
  );
});

// Participants dropdown list
const ParticipantsDropdown = memo(function ParticipantsDropdown({ participants, userName, userId, meeting }) {
  const list = participants.length ? participants : [{ userName, userId }];
  return (
    <div className="absolute top-12 right-0 w-56 max-w-[75vw] bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800 font-semibold text-sm">
        Participants ({participants.length || 1})
      </div>
      <div className="max-h-72 overflow-y-auto py-2">
        {list.map((p, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-800/60">
            <span>
              {p.userName}
              {p.userId && String(p.userId) === String(userId) && " (You)"}
            </span>
            {meeting.host && String(p.userId) === String(meeting.host) && (
              <span className="flex items-center gap-1 text-amber-400 text-xs">
                <Crown className="h-3 w-3" />
                Host
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

// Header bar (title, code, participants button, share, leave)
const Header = memo(function Header({
  meeting,
  isHost,
  copyMeetingCode,
  showParticipants,
  setShowParticipants,
  participants,
  userName,
  userId,
  shareInvite,
  leaveMeeting,
}) {
  return (
    <div className="bg-slate-900/70 backdrop-blur-xl border-b border-slate-800 px-6  flex justify-between items-center gap-3 flex-wrap shrink-0 sticky top-0 z-30">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          {meeting.title}
          {isHost && (
            <span className="flex items-center gap-1 bg-indigo-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              <Crown className="h-3.5 w-3.5" />
              Host
            </span>
          )}
        </h1>
        <p className="text-slate-400 text-sm mt-1 flex items-center gap-2">
          Code:{" "}
          <span className="text-indigo-400 font-mono font-semibold">{meeting.meetingCode}</span>
          <button
            onClick={copyMeetingCode}
            className="text-slate-500 hover:text-white transition cursor-pointer"
            aria-label="Copy meeting code"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </p>
      </div>

      <div className="flex items-center gap-2.5 relative">
        <button
          onClick={() => setShowParticipants((prev) => !prev)}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-full text-sm font-medium transition cursor-pointer"
        >
          <Users className="h-4 w-4" />
          {participants.length || 1} Participant{(participants.length || 1) > 1 ? "s" : ""}
        </button>
        {showParticipants && (
          <ParticipantsDropdown
            participants={participants}
            userName={userName}
            userId={userId}
            meeting={meeting}
          />
        )}

        <button
          onClick={shareInvite}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-full text-sm font-medium transition cursor-pointer"
        >
          <Share2 className="h-4 w-4" />
          Share Invite
        </button>

        <button
          onClick={leaveMeeting}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-full text-sm font-semibold transition cursor-pointer"
        >
          <PhoneOff className="h-4 w-4" />
          Leave
        </button>
      </div>
    </div>
  );
});


const MeetingRoom = () => {
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState("Good connection");

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const activeCallRef = useRef([]);
  const screenStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const isTranscribingRef = useRef(false);
  const remoteVideoRefs = useRef(new Map());
  const screenRecordStreamRef = useRef(null); 
  const audioContextRef = useRef(null);
  const audioDestinationRef = useRef(null);
  const connectedAudioSourcesRef = useRef(new Set());
  const recordingTimerRef = useRef(null);

  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const userName = localStorage.getItem("userName") || "User";
  const userId = token ? getUserIdFromToken(token) : null;

  const [meeting, setMeeting] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [transcript, setTranscript] = useState("");
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const isHost = meeting && userId && String(meeting.host) === String(userId);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        const { data } = await API.get(`/meetings/${id}`);
        setMeeting(data);
      } catch (err) {
        console.error("Meeting fetch error:", err);
      }
    };
    fetchMeeting();
  }, [id]);

  // Quick tasks fetch
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data } = await API.get(`/tasks?meetingId=${id}`);
        setTasks(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Tasks fetch error:", err);
      }
    };
    fetchTasks();
  }, [id]);

  useEffect(() => {
    let isActive = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (!isActive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const peer = new Peer({
          config: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              {
                urls: "turn:openrelay.metered.ca:80",
                username: "openrelayproject",
                credential: "openrelayproject",
              },
              {
                urls: "turn:openrelay.metered.ca:443",
                username: "openrelayproject",
                credential: "openrelayproject",
              },
              {
                urls: "turn:openrelay.metered.ca:443?transport=tcp",
                username: "openrelayproject",
                credential: "openrelayproject",
              },
            ],
          },
        });

        if (!isActive) {
          peer.destroy();
          return;
        }
        peerRef.current = peer;

        peer.on("open", (peerId) => {
          if (!isActive) return;
          socket.connect();
          socket.emit("join-meeting", { meetingId: id, userName, userId });
          socket.emit("broadcast-peer-id", { meetingId: id, peerId, userName });
        });

        peer.on("error", (err) => {
          console.error("Peer error:", err.type, err);
          toast.error(`Peer error: ${err.type}`);
          setConnectionQuality("Weak connection");
        });

        peer.on("disconnected", () => {
          setConnectionQuality("Reconnecting...");
          peer.reconnect();
        });

        peer.on("call", (call) => {
          call.answer(localStreamRef.current);
          activeCallRef.current.push(call);
          const remoteUserName = call.metadata?.userName || "Participant";
          call.on("stream", (remoteStream) => {
            setRemoteStreams((prev) => {
              const exists = prev.find((s) => s.peerId === call.peer);
              if (exists) return prev;
              return [
                ...prev,
                { peerId: call.peer, userName: remoteUserName, stream: remoteStream },
              ];
            });
          });
        });

        socket.on("user-peer-id", ({ peerId: remotePeerId, userName: remoteUser }) => {
          setMessages((prev) => [
            ...prev,
            { type: "system", message: `${remoteUser} joined`, time: new Date().toLocaleTimeString() },
          ]);

          const call = peer.call(remotePeerId, localStreamRef.current, {
            metadata: { userName },
          });
          activeCallRef.current.push(call);
          call.on("stream", (remoteStream) => {
            setRemoteStreams((prev) => {
              const exists = prev.find((s) => s.peerId === remotePeerId);
              if (exists) return prev;
              return [
                ...prev,
                { peerId: remotePeerId, userName: remoteUser, stream: remoteStream },
              ];
            });
          });
        });

        socket.on("user-left", ({ peerId: leftPeerId, userName: leftUser }) => {
          setRemoteStreams((prev) => prev.filter((s) => s.peerId !== leftPeerId));
          setMessages((prev) => [
            ...prev,
            { type: "system", message: `${leftUser || "A participant"} left`, time: new Date().toLocaleTimeString() },
          ]);
        });

        socket.on("room-users", (users) => setParticipants(users));

        socket.on("receive-message", (data) => {
          setMessages((prev) => [...prev, { type: "chat", ...data }]);
        });

        // Saamne wale participant ki transcription humare transcript me merge karne ke liye
        socket.on("transcript-line", ({ userName: speakerName, text }) => {
          if (speakerName === userName) return; // apna khud ka avoid — wo already local se add ho chuka hai
          setTranscript((prev) => `${prev}${speakerName}: ${text}`);
        });

        
        socket.on("summary-ready", (data) => {
          setSummaryData(data);
          setShowSummaryModal(true);
          toast.success("AI summary is ready");
        });
      } catch (err) {
        console.error("Init error:", err);
        toast.error("Camera/mic access denied!");
      }
    };

    init();

    return () => {
      isActive = false;
      isTranscribingRef.current = false;
      recognitionRef.current?.stop();

      
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      socket.off("user-peer-id");
      socket.off("user-left");
      socket.off("room-users");
      socket.off("receive-message");
      socket.off("transcript-line");
      socket.off("summary-ready");
      socket.disconnect();
      clearInterval(recordingTimerRef.current);
      screenRecordStreamRef.current?.getTracks().forEach((t) => t.stop());

      const peerToDestroy = peerRef.current;
      const audioCtxToClose = audioContextRef.current;
      setTimeout(() => {
        peerToDestroy?.destroy();
        audioCtxToClose?.close();
      }, 0);
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!recording || !audioContextRef.current || !audioDestinationRef.current) return;
    remoteStreams.forEach((remote) => {
      if (!connectedAudioSourcesRef.current.has(remote.peerId)) {
        try {
          const src = audioContextRef.current.createMediaStreamSource(remote.stream);
          src.connect(audioDestinationRef.current);
          connectedAudioSourcesRef.current.add(remote.peerId);
        } catch (err) {
          console.error("Audio mix error:", err);
        }
      }
    });
  }, [remoteStreams, recording]);

 

  const sendMessage = useCallback(() => {
    setInput((currentInput) => {
      if (!currentInput.trim()) return currentInput;
      socket.emit("send-message", { meetingId: id, message: currentInput, userName });
      setMessages((prev) => [
        ...prev,
        { type: "chat", message: currentInput, userName: "You", time: new Date().toLocaleTimeString() },
      ]);
      return "";
    });
  }, [id, userName]);

  const createQuickTask = useCallback(async () => {
    if (!taskTitle.trim()) return toast.error("Please enter a task title");
    setTaskLoading(true);
    try {
      const { data } = await API.post("/tasks", {
        title: taskTitle,
        assignee: taskAssignee || "Unassigned",
        meetingId: id,
      });

      setTasks((prev) => [data, ...prev]);

      setMessages((prev) => [
        ...prev,
        {
          type: "system",
          message: `Task created: "${taskTitle}" (${taskAssignee || "Unassigned"})`,
          time: new Date().toLocaleTimeString(),
        },
      ]);

      toast.success("Task created!");
      setTaskTitle("");
      setTaskAssignee("");
      setShowTaskForm(false);
    } catch (err) {
      console.error("Task create error:", err);
      toast.error("Failed to create task");
    } finally {
      setTaskLoading(false);
    }
  }, [taskTitle, taskAssignee, id]);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }, []);

  const toggleCam = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

      activeCallRef.current.forEach((call) => {
        const sender = call.peerConnection?.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      setIsScreenSharing(true);
      toast.success("Screen sharing started");

      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.error("Screen share error:", err);
    }
   
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack) {
      activeCallRef.current.forEach((call) => {
        const sender = call.peerConnection?.getSenders().find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(cameraTrack);
      });
    }

    setIsScreenSharing(false);
  }, []);

  const startTranscription = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("This browser doesn't support live transcription. Try Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript + " ";
      }
      if (finalText) {
        setTranscript((prev) => `${prev}${userName}: ${finalText}`);
       
        socket.emit("transcript-line", { meetingId: id, userName, text: finalText });
      }
    };

    recognition.onerror = (e) => {
      if (e.error === "no-speech") return;
      console.error("Speech error:", e.error);
    };

    recognition.onend = () => {
      if (isTranscribingRef.current) {
        setTimeout(() => {
          if (isTranscribingRef.current) recognition.start();
        }, 300);
      }
    };
    recognition.start();
    recognitionRef.current = recognition;
    isTranscribingRef.current = true;
    setIsTranscribing(true);
    setShowTranscript(true);
    toast.success("Live transcription started");
  }, [id, userName]);

  const stopTranscription = useCallback(() => {
    isTranscribingRef.current = false;
    recognitionRef.current?.stop();
    setIsTranscribing(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      recordedChunksRef.current = [];

     
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser", frameRate: 30 },
        audio: false,
        preferCurrentTab: true,
      });
      screenRecordStreamRef.current = displayStream;

      // Audio mixing: apna mic + sab remote participants ka audio ek stream me combine karo
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const destination = audioContext.createMediaStreamDestination();
      audioContextRef.current = audioContext;
      audioDestinationRef.current = destination;
      connectedAudioSourcesRef.current = new Set();

      if (localStreamRef.current) {
        const localSource = audioContext.createMediaStreamSource(localStreamRef.current);
        localSource.connect(destination);
        connectedAudioSourcesRef.current.add("local");
      }

      remoteStreams.forEach((remote) => {
        try {
          const src = audioContext.createMediaStreamSource(remote.stream);
          src.connect(destination);
          connectedAudioSourcesRef.current.add(remote.peerId);
        } catch (err) {
          console.error("Audio mix error:", err);
        }
      });

      const combinedStream = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType: "video/webm;codecs=vp9,opus" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `meeting-recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Recording downloaded");
      };

      // Agar user browser ke apne "Stop sharing" button se rok de, to
      // recording bhi automatically ruk jaye
      displayStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          stopRecording();
        }
      };

      mediaRecorder.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
      toast.success("Recording started — poora page record ho raha hai");
    } catch (err) {
      console.error("Recording start error:", err);
      if (err.name === "NotAllowedError") {
        toast.error("Recording shuru karne ke liye screen access allow karna zaroori hai");
      } else {
        toast.error("Recording start nahi ho payi");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStreams]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();

    screenRecordStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenRecordStreamRef.current = null;

    audioContextRef.current?.close();
    audioContextRef.current = null;
    audioDestinationRef.current = null;
    connectedAudioSourcesRef.current = new Set();
    clearInterval(recordingTimerRef.current);

    setRecording(false);
    setRecordingSeconds(0);
  }, []);

  const leaveMeeting = useCallback(() => {
    isTranscribingRef.current = false;
    recognitionRef.current?.stop();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());

    if (recording) {
      mediaRecorderRef.current?.stop();
      screenRecordStreamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(recordingTimerRef.current);
    }

    socket.disconnect();
    navigate("/dashboard");

    
    const peerToDestroy = peerRef.current;
    const audioCtxToClose = audioContextRef.current;
    setTimeout(() => {
      peerToDestroy?.destroy();
      audioCtxToClose?.close();
    }, 0);
  }, [recording, navigate]);

  const shareInvite = useCallback(() => {
    const link = `${window.location.origin}/meeting/${id}`;
    navigator.clipboard
      .writeText(link)
      .then(() => toast.success(`Invite link copied! Code: ${meeting?.meetingCode}`))
      .catch(() => toast.error("Couldn't copy link"));
  }, [id, meeting]);

  const copyMeetingCode = useCallback(() => {
    if (!meeting?.meetingCode) return;
    navigator.clipboard
      .writeText(meeting.meetingCode)
      .then(() => toast.success("Meeting code copied!"))
      .catch(() => toast.error("Couldn't copy code"));
  }, [meeting]);

  
  const generateSummaryInPlace = useCallback(async () => {
    if (!transcript.trim()) {
      toast.error("Transcript khaali hai — pehle live transcription start karo ya manually likho.");
      return;
    }
    setShowSummaryModal(true);
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const { data } = await API.post("/ai/summarize", { transcript });
      setSummaryData(data);

      await API.put(`/meetings/${id}/summary`, {
        summary: data.summary,
        keyPoints: data.keyPoints,
        actionItems: data.actionItems,
        transcript,
      });

      // Sabko bhej do — unki call ko haath nahi lagta, bas unka modal khul jaata hai
      socket.emit("summary-ready", { meetingId: id, summary: data });
    } catch (err) {
      console.error("Summary generation error:", err);
      setSummaryError("Something went wrong while generating the summary.");
    } finally {
      setSummaryLoading(false);
    }
  }, [transcript, id]);

  const goToTasksPage = useCallback(() => {
    navigate(`/meeting/${id}/tasks`);
  }, [navigate, id]);

  const registerRemoteRef = useCallback((peerId, el) => {
    if (el) remoteVideoRefs.current.set(peerId, el);
    else remoteVideoRefs.current.delete(peerId);
  }, []);

  if (!meeting)
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading meeting...
        </div>
      </div>
    );

  return (
    <div className="min-h-screen w-full bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex flex-col">
      <Header
        meeting={meeting}
        isHost={isHost}
        copyMeetingCode={copyMeetingCode}
        showParticipants={showParticipants}
        setShowParticipants={setShowParticipants}
        participants={participants}
        userName={userName}
        userId={userId}
        shareInvite={shareInvite}
        leaveMeeting={leaveMeeting}
      />

      <div className="flex flex-col lg:flex-row flex-1 gap-4 p-4">
        {/* Video Area */}
        <div className="flex-1 rounded-3xl bg-slate-950/40 flex flex-col">
          <VideoGrid
            localVideoRef={localVideoRef}
            camOn={camOn}
            micOn={micOn}
            isScreenSharing={isScreenSharing}
            showMoreMenu={showMoreMenu}
            setShowMoreMenu={setShowMoreMenu}
            shareInvite={shareInvite}
            setShowTranscript={setShowTranscript}
            remoteStreams={remoteStreams}
            registerRemoteRef={registerRemoteRef}
          />

          <TranscriptSection
            isTranscribing={isTranscribing}
            startTranscription={startTranscription}
            stopTranscription={stopTranscription}
            showTranscript={showTranscript}
            setShowTranscript={setShowTranscript}
            transcript={transcript}
            setTranscript={setTranscript}
          />

          <ControlsBar
            micOn={micOn}
            toggleMic={toggleMic}
            camOn={camOn}
            toggleCam={toggleCam}
            isScreenSharing={isScreenSharing}
            startScreenShare={startScreenShare}
            stopScreenShare={stopScreenShare}
            recording={recording}
            startRecording={startRecording}
            stopRecording={stopRecording}
            generateSummaryInPlace={generateSummaryInPlace}
            leaveMeeting={leaveMeeting}
          />

          <StatusBar
            recording={recording}
            recordingSeconds={recordingSeconds}
            connectionQuality={connectionQuality}
          />
        </div>

        {/* Chat Sidebar */}
        <ChatSidebar
          showTaskForm={showTaskForm}
          setShowTaskForm={setShowTaskForm}
          taskTitle={taskTitle}
          setTaskTitle={setTaskTitle}
          taskAssignee={taskAssignee}
          setTaskAssignee={setTaskAssignee}
          taskLoading={taskLoading}
          createQuickTask={createQuickTask}
          messages={messages}
          messagesEndRef={messagesEndRef}
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
          tasks={tasks}
          goToTasksPage={goToTasksPage}
        />
      </div>

      {showSummaryModal && (
        <SummaryModal
          loading={summaryLoading}
          error={summaryError}
          summary={summaryData}
          onClose={() => setShowSummaryModal(false)}
        />
      )}
    </div>
  );
};


const SummaryModal = memo(function SummaryModal({ loading, error, summary, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-blue-400" />
            AI Meeting Summary
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="text-center py-8">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-blue-400 animate-pulse" />
              <p className="text-slate-400 text-sm">Generating summary — meeting chalti rahegi...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {summary && !loading && (
            <>
              <div>
                <h3 className="text-blue-400 font-semibold text-sm mb-2">Summary</h3>
                <p className="text-slate-300 text-sm leading-relaxed">{summary.summary}</p>
              </div>

              {summary.keyPoints?.length > 0 && (
                <div>
                  <h3 className="text-emerald-400 font-semibold text-sm mb-2">Key Points</h3>
                  <ul className="space-y-1.5">
                    {summary.keyPoints.map((point, i) => (
                      <li key={i} className="text-slate-300 text-sm flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.actionItems?.length > 0 && (
                <div>
                  <h3 className="text-purple-400 font-semibold text-sm mb-2">Action Items</h3>
                  <div className="space-y-2">
                    {summary.actionItems.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                      >
                        <span className="text-slate-300">{item.task}</span>
                        <span className="text-purple-300 text-xs font-semibold bg-purple-900/30 px-2 py-1 rounded-lg shrink-0 ml-2">
                          {item.assignee}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

const RemoteVideo = memo(function RemoteVideo({ stream, userName, peerId, registerRef }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    registerRef?.(peerId, videoRef.current);
    return () => registerRef?.(peerId, null);
  }, [peerId, registerRef]);

  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden aspect-video shadow-2xl">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-medium">
        {userName || "Participant"}
      </div>
    </div>
  );
});

export default MeetingRoom;