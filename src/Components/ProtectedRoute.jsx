  import { Navigate } from "react-router-dom";
  import { useAuth } from "../Context/AuthContext";

  const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
      return (
        <div className="flex items-center justify-center h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800">
          <div className="flex items-center gap-3 text-slate-400 text-lg">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        </div>
      );
    }

    if (!user) {
      return <Navigate to="/login" replace />;
    }

    return children;
  };

  export default ProtectedRoute;