import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../Context/AuthContext";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const navLinks = [
    { path: "/dashboard", label: "🏠 Dashboard" },
    { path: "/kanban", label: "📋 Kanban" },
    { path: "/analytics", label: "📊 Analytics" },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-slate-900/70 backdrop-blur-xl border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
      {/* Logo */}
      <div
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2 cursor-pointer"
      >
        <span className="text-2xl">🤖</span>
        <span className="text-xl font-bold text-white">IntellMeet</span>
      </div>

      {/* Nav Links */}
      <div className="hidden sm:flex items-center gap-2">
        {navLinks.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              isActive(link.path)
                ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/70"
            }`}
          >
            {link.label}
          </button>
        ))}
      </div>

      {/* User + Logout */}
      <div className="flex items-center gap-3">
        <span className="text-slate-400 text-sm hidden sm:block">
          👤 {user?.name}
        </span>
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="bg-red-600/90 hover:bg-red-600 px-3 py-2 rounded-lg text-sm font-medium transition"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;