import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './Context/AuthContext.jsx'
import './index.css'
import App from './App.jsx'
import { Toaster } from "react-hot-toast";


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
<Toaster position="top-right" toastOptions={{
  style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' }
}} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)