import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const OAuthSuccess = () => {
  const [SearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = SearchParams.get("token");
    const name = SearchParams.get("name");

    console.log("Token:", token);
    console.log("Name:", name);

    if (token) {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify({ name: name }));
      localStorage.setItem("userName", name);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login");
      console.log("No token!");
    }
  }, []);

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center text-white">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">🔐</div>
        <p className="text-slate-400">Logging you in...</p>
      </div>
    </div>
  );
};
export default OAuthSuccess;