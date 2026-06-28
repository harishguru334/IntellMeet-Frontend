import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import socket from "../socket";


const MeetingRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const userName = localStorage.getItem("userName") || "User";

  const [meeting, setMeeting] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [peers, setPeers] = useState({}); // { socketId: peer }
  const [remoteStreams, setRemoteStreams] = useState({}); // { socketId: stream }
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const messagesEndRef = useRef(null);

  // Meeting fetch
  useEffect(() => {
    const fetchMeeting = async () => {
      const { data } = await axios.get(`/api/meetings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMeeting(data);
    };
    fetchMeeting();
  }, [id]);

  // Camera + Socket setup
  useEffect(() => {
    const init = async () => {
      try {
        // Local camera/mic
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Socket connect
        socket.connect();
        socket.emit("join-meeting", { meetingId: id, userName });

        // Jab dusra user join kare — hum offer bhejte hain
        socket.on("user-joined", ({ socketId, userName: joinedUser }) => {
          setMessages((prev) => [
            ...prev,
            {
              type: "system",
              message: `${joinedUser} joined`,
              time: new Date().toLocaleTimeString(),
            },
          ]);

          // Peer create karo as INITIATOR
          const peer = new SimplePeer({
            initiator: true,
            trickle: true,
            stream: localStreamRef.current,
          });

          peer.on("signal", (offer) => {
            socket.emit("webrtc-offer", { offer, to: socketId });
          });

          peer.on("stream", (remoteStream) => {
            setRemoteStreams((prev) => ({ ...prev, [socketId]: remoteStream }));
          });

          peersRef.current[socketId] = peer;
          setPeers((prev) => ({ ...prev, [socketId]: peer }));
        });

        // Hume offer aaya — answer bhejte hain
        socket.on("webrtc-offer", ({ offer, from }) => {
          const peer = new SimplePeer({
            initiator: false,
            trickle: true,
            stream: localStreamRef.current,
          });

          peer.on("signal", (answer) => {
            socket.emit("webrtc-answer", { answer, to: from });
          });

          peer.on("stream", (remoteStream) => {
            setRemoteStreams((prev) => ({ ...prev, [from]: remoteStream }));
          });

          peer.signal(offer);
          peersRef.current[from] = peer;
          setPeers((prev) => ({ ...prev, [from]: peer }));
        });

        // Answer aaya
        socket.on("webrtc-answer", ({ answer, from }) => {
          peersRef.current[from]?.signal(answer);
        });

        // ICE candidate
        socket.on("webrtc-ice-candidate", ({ candidate, from }) => {
          peersRef.current[from]?.signal(candidate);
        });

        // Chat
        socket.on("receive-message", (data) => {
          setMessages((prev) => [...prev, { type: "chat", ...data }]);
        });

      } catch (err) {
        console.error("Camera error:", err);
        alert("Camera/mic access denied. Please allow permissions.");
      }
    };

    init();

    return () => {
      // Cleanup
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(peersRef.current).forEach((p) => p.destroy());
      socket.disconnect();
    };
  }, [id]);

  // Auto scroll
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

  // Mic toggle
  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  // Camera toggle
  const toggleCam = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCamOn(videoTrack.enabled);
    }
  };

  // Leave meeting
  const leaveMeeting = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    Object.values(peersRef.current).forEach((p) => p.destroy());
    socket.disconnect();
    navigate("/dashboard");
  };

  if (!meeting) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
      Loading...
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">

      {/* Header */}
      <div className="bg-gray-800 px-6 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-bold">{meeting.title}</h1>
          <p className="text-gray-400 text-xs">Code: {meeting.meetingCode}</p>
        </div>
        <button
          onClick={leaveMeeting}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm"
        >
          Leave
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Video Area */}
        <div className="flex-1 bg-gray-950 flex flex-col">

          {/* Videos Grid */}
          <div className="flex-1 p-4 grid grid-cols-2 gap-4 content-start">

            {/* Local Video */}
            <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">
                You {!camOn && "📷 Off"} {!micOn && "🔇"}
              </div>
            </div>

            {/* Remote Videos */}
            {Object.entries(remoteStreams).map(([socketId, stream]) => (
              <RemoteVideo key={socketId} stream={stream} />
            ))}
          </div>

          {/* Controls */}
          <div className="bg-gray-800 py-4 flex justify-center gap-4">
            <button
              onClick={toggleMic}
              className={`px-5 py-2 rounded-full text-sm font-semibold ${
                micOn ? "bg-gray-600 hover:bg-gray-500" : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {micOn ? "🎤 Mute" : "🔇 Unmute"}
            </button>
            <button
              onClick={toggleCam}
              className={`px-5 py-2 rounded-full text-sm font-semibold ${
                camOn ? "bg-gray-600 hover:bg-gray-500" : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {camOn ? "📷 Cam Off" : "📷 Cam On"}
            </button>
            <button
              onClick={leaveMeeting}
              className="bg-red-600 hover:bg-red-700 px-5 py-2 rounded-full text-sm font-semibold"
            >
              📞 Leave
            </button>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="w-72 bg-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-semibold text-sm">Meeting Chat</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.type === "system" ? (
                  <p className="text-center text-gray-500 text-xs py-1">{msg.message}</p>
                ) : (
                  <div className={`flex flex-col ${msg.userName === "You" ? "items-end" : "items-start"}`}>
                    <span className="text-xs text-gray-400 mb-1">
                      {msg.userName} • {msg.time}
                    </span>
                    <div className={`px-3 py-2 rounded-lg max-w-xs text-sm ${
                      msg.userName === "You"
                        ? "bg-blue-600"
                        : "bg-gray-700"
                    }`}>
                      {msg.message}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Message..."
              className="flex-1 bg-gray-700 rounded-lg px-3 py-2 text-sm outline-none"
            />
            <button
              onClick={sendMessage}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm"
            >
              ➤
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
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">
        Participant
      </div>
    </div>
  );
};

export default MeetingRoom;