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
  Share2,
  Users,
  Crown,
} from "lucide-react";

// JWT ke payload se userId nikalne ke liye (login aur OAuth dono ke liye kaam karta hai,
// kyunki token hamesha { id: userId } carry karta hai)
const getUserIdFromToken = (token) => {
  try {
    return JSON.parse(atob(token.split(".")[1]))?.id || null;
  } catch {
    return null;
  }
};

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
  const remoteVideoRefs = useRef(new Map()); // peerId -> <video> element
  const recordingCanvasRef = useRef(null);
  const recordingAnimationRef = useRef(null);
  const canvasStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioDestinationRef = useRef(null);
  const connectedAudioSourcesRef = useRef(new Set());

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

  // Meeting create karne wala hi host hota hai — Dashboard se "Start" dabane
  // par backend host: req.user._id set kar deta hai, isliye yahan sirf compare karna hai.
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
          console.log("My PeerJS ID:", peerId);

          socket.connect();
          socket.emit("join-meeting", { meetingId: id, userName, userId });
          socket.emit("broadcast-peer-id", { meetingId: id, peerId, userName });
        });
        peer.on("error", (err) => {
          console.error("❌ PeerJS error:", err.type, err);
          toast.error(`Peer error: ${err.type}`);
        });

        peer.on("disconnected", () => {
          console.warn(
            "⚠️ Peer disconnected from signaling server, trying to reconnect...",
          );
          peer.reconnect();
        });

        peer.on("call", (call) => {
          call.answer(localStreamRef.current);
          call.peerConnection?.addEventListener(
            "iceconnectionstatechange",
            () => {
              console.log(
                "ICE state (incoming call):",
                call.peerConnection.iceConnectionState,
              );
            },
          );
          activeCallRef.current.push(call);
          const remoteUserName = call.metadata?.userName || "Participant";
          call.on("stream", (remoteStream) => {
            setRemoteStreams((prev) => {
              const exists = prev.find((s) => s.peerId === call.peer);
              if (exists) return prev;
              return [
                ...prev,
                {
                  peerId: call.peer,
                  userName: remoteUserName,
                  stream: remoteStream,
                },
              ];
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

            const call = peer.call(remotePeerId, localStreamRef.current, {
              metadata: { userName },
            });
            call.peerConnection?.addEventListener(
              "iceconnectionstatechange",
              () => {
                console.log(
                  "ICE state (outgoing call):",
                  call.peerConnection.iceConnectionState,
                );
              },
            );
            activeCallRef.current.push(call);
            call.on("stream", (remoteStream) => {
              setRemoteStreams((prev) => {
                const exists = prev.find((s) => s.peerId === remotePeerId);
                if (exists) return prev;
                return [
                  ...prev,
                  {
                    peerId: remotePeerId,
                    userName: remoteUser,
                    stream: remoteStream,
                  },
                ];
              });
            });
          },
        );

        // Jab koi participant meeting chhod de — uska video tile hata do
        socket.on("user-left", ({ peerId: leftPeerId, userName: leftUser }) => {
          setRemoteStreams((prev) =>
            prev.filter((s) => s.peerId !== leftPeerId),
          );
          setMessages((prev) => [
            ...prev,
            {
              type: "system",
              message: `${leftUser || "A participant"} left`,
              time: new Date().toLocaleTimeString(),
            },
          ]);
        });

        // Room mein abhi kaun-kaun connected hai — live Participants list ke liye
        socket.on("room-users", (users) => {
          setParticipants(users);
        });

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
      isTranscribingRef.current = false;
      recognitionRef.current?.stop();

      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();

      if (recordingAnimationRef.current) {
        cancelAnimationFrame(recordingAnimationRef.current);
      }
      canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();

      socket.off("user-peer-id");
      socket.off("user-left");
      socket.off("room-users");
      socket.off("receive-message");
      socket.disconnect();
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!recording || !audioContextRef.current || !audioDestinationRef.current)
      return;
    remoteStreams.forEach((remote) => {
      if (!connectedAudioSourcesRef.current.has(remote.peerId)) {
        try {
          const src = audioContextRef.current.createMediaStreamSource(
            remote.stream,
          );
          src.connect(audioDestinationRef.current);
          connectedAudioSourcesRef.current.add(remote.peerId);
        } catch (err) {
          console.error("Audio mix error:", err);
        }
      }
    });
  }, [remoteStreams, recording]);

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
      toast.error(
        "This browser doesn't support live transcription. Try Chrome.",
      );
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

   recognition.onerror = (e) => {
  if (e.error === "no-speech") {
    // Silence hai, koi problem nahi — chup chap ignore karo
    return;
  }
  console.error("Speech error:", e.error);
};

recognition.onend = () => {
  if (isTranscribingRef.current) {
    // Thoda delay de do restart se pehle, taaki tight loop na bane
    setTimeout(() => {
      if (isTranscribingRef.current) recognition.start();
    }, 300);
  }
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
    try {
      recordedChunksRef.current = [];

      // Canvas banate hain jispe local + sabke remote video ek grid mein draw honge
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      recordingCanvasRef.current = canvas;

      // Sabka audio (apna + sab remote participants ka) ek stream mein mix karte hain
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      const destination = audioContext.createMediaStreamDestination();
      audioContextRef.current = audioContext;
      audioDestinationRef.current = destination;
      connectedAudioSourcesRef.current = new Set();

      if (localStreamRef.current) {
        const localSource = audioContext.createMediaStreamSource(
          localStreamRef.current,
        );
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

      // Har frame par local + sabke remote video ko grid layout mein canvas pe draw karo
      const drawFrame = () => {
        const tiles = [
          { el: localVideoRef.current, label: "You" },
          ...Array.from(remoteVideoRefs.current.entries()).map(
            ([peerId, el]) => ({
              el,
              label:
                remoteStreams.find((r) => r.peerId === peerId)?.userName ||
                "Participant",
            }),
          ),
        ].filter((t) => t.el && t.el.videoWidth > 0);

        const cols = Math.ceil(Math.sqrt(tiles.length)) || 1;
        const rows = Math.ceil(tiles.length / cols) || 1;
        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;

        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        tiles.forEach((tile, i) => {
          const x = (i % cols) * cellW;
          const y = Math.floor(i / cols) * cellH;
          try {
            ctx.drawImage(tile.el, x, y, cellW, cellH);
          } catch (err) {
            // frame abhi ready nahi hua, skip kar do
          }
          ctx.font = "14px sans-serif";
          const labelWidth = ctx.measureText(tile.label).width + 16;
          ctx.fillStyle = "rgba(0,0,0,0.6)";
          ctx.fillRect(x + 8, y + cellH - 30, labelWidth, 22);
          ctx.fillStyle = "#ffffff";
          ctx.fillText(tile.label, x + 16, y + cellH - 14);
        });

        recordingAnimationRef.current = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const canvasStream = canvas.captureStream(30);
      canvasStreamRef.current = canvasStream;

      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
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
      toast.success("Recording started — poori meeting record ho rahi hai");
    } catch (err) {
      console.error("Recording start error:", err);
      toast.error("Recording start nahi ho payi");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();

    if (recordingAnimationRef.current) {
      cancelAnimationFrame(recordingAnimationRef.current);
      recordingAnimationRef.current = null;
    }
    canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
    canvasStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    audioDestinationRef.current = null;
    connectedAudioSourcesRef.current = new Set();

    setRecording(false);
  };

  const leaveMeeting = () => {
    isTranscribingRef.current = false;
    recognitionRef.current?.stop();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerRef.current?.destroy();

    if (recording) {
      mediaRecorderRef.current?.stop();
      if (recordingAnimationRef.current)
        cancelAnimationFrame(recordingAnimationRef.current);
      canvasStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    }

    socket.disconnect();
    navigate("/dashboard");
  };

  const shareInvite = () => {
    const link = `${window.location.origin}/meeting/${id}`;
    navigator.clipboard
      .writeText(link)
      .then(() =>
        toast.success(`Invite link copied! Code: ${meeting?.meetingCode}`),
      )
      .catch(() => toast.error("Couldn't copy link"));
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
    <div className="h-screen w-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-white flex flex-col overflow-hidden">
      {/* Header */}
      {/* Header */}
      <div className="bg-slate-900/70 backdrop-blur-xl border-b border-slate-800 px-3 sm:px-6 py-3 flex justify-between items-center gap-2">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
            <span className="truncate">{meeting.title}</span>
            {isHost && (
              <span className="flex items-center gap-1 bg-amber-500/15 text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-500/30 shrink-0">
                <Crown className="h-3 w-3" />
                Host
              </span>
            )}
          </h1>
          <p className="text-slate-400 text-xs mt-0.5 truncate">
            Code:{" "}
            <span className="text-slate-300 font-mono">
              {meeting.meetingCode}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 relative shrink-0">
          <button
            onClick={() => setShowParticipants((prev) => !prev)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 sm:px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            <Users className="h-4 w-4" />
            {participants.length || 1}
          </button>
          {showParticipants && (
            <div className="absolute top-12 right-0 w-56 max-w-[75vw] bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 font-semibold text-sm">
                Participants ({participants.length || 1})
              </div>
              <div className="max-h-72 overflow-y-auto py-2">
                {(participants.length
                  ? participants
                  : [{ userName, userId }]
                ).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-800/60"
                  >
                    <span>
                      {p.userName}
                      {p.userId &&
                        String(p.userId) === String(userId) &&
                        " (You)"}
                    </span>
                    {meeting.host &&
                      String(p.userId) === String(meeting.host) && (
                        <span className="flex items-center gap-1 text-amber-400 text-xs">
                          <Crown className="h-3 w-3" />
                          Host
                        </span>
                      )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={shareInvite}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 sm:px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <button
            onClick={leaveMeeting}
            className="flex items-center gap-1.5 bg-red-600/90 hover:bg-red-600 px-2.5 sm:px-4 py-2 rounded-xl text-sm font-medium transition cursor-pointer"
          >
            <PhoneOff className="h-4 w-4" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        {/* Video Area */}
        <div className="flex-[2] lg:flex-1 bg-slate-950/40 flex flex-col min-h-0">
          {/* Videos Grid */}
          <div className="flex-1 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start overflow-y-auto">
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
            {remoteStreams.map((remote) => (
              <RemoteVideo
                key={remote.peerId}
                peerId={remote.peerId}
                stream={remote.stream}
                userName={remote.userName}
                registerRef={(peerId, el) => {
                  if (el) remoteVideoRefs.current.set(peerId, el);
                  else remoteVideoRefs.current.delete(peerId);
                }}
              />
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
              {isTranscribing
                ? "Stop live transcription"
                : "Start live transcription"}
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
              {micOn ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
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
              {camOn ? (
                <Video className="h-4 w-4" />
              ) : (
                <VideoOff className="h-4 w-4" />
              )}
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
              {recording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              {recording ? "Stop rec" : "Record"}
            </button>
            <button
              onClick={() =>
                navigate(
                  `/meeting/${id}/summary?transcript=${encodeURIComponent(transcript)}`,
                )
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
        <div className="w-full lg:w-72 flex-1 lg:flex-none bg-slate-900/70 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col min-h-0 max-h-[45vh] lg:max-h-none overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="font-semibold text-sm">Meeting chat</h2>
            <button
              onClick={() => setShowTaskForm(!showTaskForm)}
              className="flex items-center gap-1 text-xs bg-purple-600 hover:bg-purple-700 px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
            >
              {showTaskForm ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
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

          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.type === "system" ? (
                  <p className="text-center text-slate-500 text-xs py-1">
                    {msg.message}
                  </p>
                ) : (
                  <div
                    className={`flex flex-col ${msg.userName === "You" ? "items-end" : "items-start"}`}
                  >
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
const RemoteVideo = ({ stream, userName, peerId, registerRef }) => {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    registerRef?.(peerId, videoRef.current);
    return () => registerRef?.(peerId, null);
  }, [peerId, registerRef]);

  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden aspect-video shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-medium">
        {userName || "Participant"}
      </div>
    </div>
  );
};

export default MeetingRoom;
