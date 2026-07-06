import { useEffect, useState, useRef } from "react";
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
} from "lucide-react";

const MeetingRoom = () => {
  const [recording, setRecording] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const activeCallRef = useRef([]);
  const screenStreamRef = useRef(null);
  const recognitionRef = useRef(null);
  const isTranscribingRef = useRef(false);

  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const userName = localStorage.getItem("userName") || "User";

  const [meeting, setMeeting] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [transcript, setTranscript] = useState("");

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

        const peer = new Peer();

        if (!isActive) {
          peer.destroy();
          return;
        }
        peerRef.current = peer;

        peer.on("open", (peerId) => {
          if (!isActive) return;
          console.log("My PeerJS ID:", peerId);

          socket.connect();
          socket.emit("join-meeting", { meetingId: id, userName });
          socket.emit("broadcast-peer-id", { meetingId: id, peerId, userName });
        });

        peer.on("call", (call) => {
          call.answer(localStreamRef.current);
          activeCallRef.current.push(call);
          call.on("stream", (remoteStream) => {
            setRemoteStreams((prev) => {
              const exists = prev.find((s) => s.id === remoteStream.id);
              if (exists) return prev;
              return [...prev, remoteStream];
            });
          });
        });

        socket.on(
          "user-peer-id",
          ({ peerId: remotePeerId, userName: remoteUser }) => {
            setMessages((prev) => [
              ...prev,
              {
                type: "system",
                message: `${remoteUser} joined`,
                time: new Date().toLocaleTimeString(),
              },
            ]);

            const call = peer.call(remotePeerId, localStreamRef.current);
            activeCallRef.current.push(call);
            call.on("stream", (remoteStream) => {
              setRemoteStreams((prev) => {
                const exists = prev.find((s) => s.id === remoteStream.id);
                if (exists) return prev;
                return [...prev, remoteStream];
              });
            });
          },
        );

        socket.on("receive-message", (data) => {
          setMessages((prev) => [...prev, { type: "chat", ...data }]);
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
      peerRef.current?.destroy();

      socket.off("user-peer-id");
      socket.off("receive-message");
      socket.disconnect();
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    socket.emit("send-message", { meetingId: id, message: input, userName });
    setMessages((prev) => [
      ...prev,
      {
        type: "chat",
        message: input,
        userName: "You",
        time: new Date().toLocaleTimeString(),
      },
    ]);
    setInput("");
  };

  const createQuickTask = async () => {
    if (!taskTitle.trim()) return toast.error("Please enter a task title");
    setTaskLoading(true);
    try {
      await API.post("/tasks", {
        title: taskTitle,
        assignee: taskAssignee || "Unassigned",
        meetingId: id,
      });

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
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      activeCallRef.current.forEach((call) => {
        const sender = call.peerConnection
          ?.getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      setIsScreenSharing(true);
      toast.success("Screen sharing started");

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (cameraTrack) {
      activeCallRef.current.forEach((call) => {
        const sender = call.peerConnection
          ?.getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(cameraTrack);
      });
    }

    setIsScreenSharing(false);
  };

  const startTranscription = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
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
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript + " ";
        }
      }
      if (finalText) setTranscript((prev) => prev + finalText);
    };

    recognition.onerror = (e) => console.error("Speech error:", e);

    recognition.onend = () => {
      if (isTranscribingRef.current) recognition.start();
    };

    recognition.start();
    recognitionRef.current = recognition;
    isTranscribingRef.current = true;
    setIsTranscribing(true);
    toast.success("Live transcription started");
  };

  const stopTranscription = () => {
    isTranscribingRef.current = false;
    recognitionRef.current?.stop();
    setIsTranscribing(false);
  };

  const startRecording = () => {
    recordedChunksRef.current = [];

    const stream = localVideoRef.current?.srcObject || localStreamRef.current;
    if (!stream) return toast.error("No stream available to record");

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
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

    mediaRecorder.start();
    setRecording(true);
    toast.success("Recording started");
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const leaveMeeting = () => {
    isTranscribingRef.current = false;
    recognitionRef.current?.stop();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerRef.current?.destroy();
    socket.disconnect();
    navigate("/dashboard");
  };

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
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex flex-col">
      {/* Header */}
      <div className="bg-slate-900/70 backdrop-blur-xl border-b border-slate-800 px-6 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold text-white">{meeting.title}</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Code: <span className="text-slate-300 font-mono">{meeting.meetingCode}</span>
          </p>
        </div>
        <button
          onClick={leaveMeeting}
          className="flex items-center gap-2 bg-red-600/90 hover:bg-red-600 px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
        >
          <PhoneOff className="h-4 w-4" />
          Leave
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Video Area */}
        <div className="flex-1 bg-slate-950/40 flex flex-col">
          {/* Videos Grid */}
          <div className="flex-1 p-4 grid grid-cols-2 gap-4 content-start">
            {/* Local Video */}
            <div className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden aspect-video shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-medium">
                You {!camOn && "· Cam off"} {!micOn && "· Muted"}
                {isScreenSharing && " · Sharing"}
              </div>
            </div>

            {/* Remote Videos */}
            {remoteStreams.map((stream, i) => (
              <RemoteVideo key={i} stream={stream} />
            ))}
          </div>

          {/* Transcript Box */}
          <div className="mx-4 mb-2">
            <button
              onClick={isTranscribing ? stopTranscription : startTranscription}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm mb-2 font-semibold transition cursor-pointer ${
                isTranscribing
                  ? "bg-red-600/90 hover:bg-red-600"
                  : "bg-emerald-600/90 hover:bg-emerald-600"
              }`}
            >
              <Captions className="h-4 w-4" />
              {isTranscribing ? "Stop live transcription" : "Start live transcription"}
            </button>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Transcript will appear here (or paste manually for AI summary)..."
              className="w-full bg-slate-900/70 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 outline-none focus:border-blue-500/50 resize-none h-16 transition"
            />
          </div>

          {/* Controls */}
          <div className="bg-slate-900/70 backdrop-blur-xl border-t border-slate-800 py-4 flex justify-center gap-3 flex-wrap px-4">
            <button
              onClick={toggleMic}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition cursor-pointer ${
                micOn
                  ? "bg-slate-700 hover:bg-slate-600"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              {micOn ? "Mute" : "Unmute"}
            </button>
            <button
              onClick={toggleCam}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition cursor-pointer ${
                camOn
                  ? "bg-slate-700 hover:bg-slate-600"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              {camOn ? "Cam off" : "Cam on"}
            </button>
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition cursor-pointer ${
                isScreenSharing
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {isScreenSharing ? (
                <ScreenShareOff className="h-4 w-4" />
              ) : (
                <ScreenShare className="h-4 w-4" />
              )}
              {isScreenSharing ? "Stop sharing" : "Share screen"}
            </button>
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition cursor-pointer ${
                recording
                  ? "bg-red-500 hover:bg-red-600 animate-pulse"
                  : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
              {recording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {recording ? "Stop rec" : "Record"}
            </button>
            <button
              onClick={() =>
                navigate(`/meeting/${id}/summary?transcript=${encodeURIComponent(transcript)}`)
              }
              className="flex items-center gap-2 rounded-full bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-2 text-sm font-semibold shadow-lg shadow-blue-900/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              AI summary
            </button>
            <button
              onClick={leaveMeeting}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-5 py-2 rounded-full text-sm font-semibold transition cursor-pointer"
            >
              <PhoneOff className="h-4 w-4" />
              Leave
            </button>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="w-72 bg-slate-900/70 backdrop-blur-xl border-l border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-semibold text-sm">Meeting chat</h2>
            <button
              onClick={() => setShowTaskForm(!showTaskForm)}
              className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-700 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
            >
              {showTaskForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {showTaskForm ? "Close" : "Task"}
            </button>
          </div>

          {showTaskForm && (
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
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.type === "system" ? (
                  <p className="text-center text-slate-500 text-xs py-1">{msg.message}</p>
                ) : (
                  <div className={`flex flex-col ${msg.userName === "You" ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-slate-500 mb-1">
                      {msg.userName} · {msg.time}
                    </span>
                    <div
                      className={`px-3 py-2 rounded-xl max-w-xs text-sm ${
                        msg.userName === "You"
                          ? "bg-linear-to-r from-blue-600 to-indigo-600"
                          : "bg-slate-800"
                      }`}
                    >
                      {msg.message}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-slate-800 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Message..."
              className="flex-1 bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/50 transition"
            />
            <button
              onClick={sendMessage}
              className="flex items-center gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Remote Video Component
const RemoteVideo = ({ stream }) => {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden aspect-video shadow-lg">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-medium">
        Participant
      </div>
    </div>
  );
};

export default MeetingRoom;