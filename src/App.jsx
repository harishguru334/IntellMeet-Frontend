import Layout from "./Components/Layout";
import Dashboard from "./Pages/Dashboard";
import KanbanBoard from "./Pages/Kabanboard";
import MeetingDetail from "./Pages/MeetinDetail";
import MeetingRoom from "./Pages/MeetingRoom";
import MeetingSummary from "./Pages/MeetingSummary";
import Login from "./Pages/Login";
import SignUp from "./Pages/SignUp";
import ProtectedRoute from "./Components/ProtectedRoute";
import { Routes, Route } from "react-router-dom";
import Analytics from "./Pages/Analytics";
import OAuthSuccess from "./Pages/OauthSuccess.jsx";

function App() {
  return (
    <Routes>
      {/* Auth pages — no navbar */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Meeting Room — no navbar */}
      <Route
        path="/meeting/:id"
        element={
          <ProtectedRoute>
            <MeetingRoom />
          </ProtectedRoute>
        }
      />

      {/* Summary — no navbar */}
      <Route
        path="/meeting/:id/summary"
        element={
          <ProtectedRoute>
            <MeetingSummary />
          </ProtectedRoute>
        }
      />

      {/* Pages with Navbar */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/kanban"
        element={
          <ProtectedRoute>
            <Layout>
              <KanbanBoard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Layout>
              <Analytics />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/meeting/:id/detail"
        element={
          <ProtectedRoute>
            <Layout>
              <MeetingDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="/oauth-success" element={<OAuthSuccess />} />
      

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
