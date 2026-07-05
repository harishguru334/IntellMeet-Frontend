import Navbar from "./Navbar";

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800">
      <Navbar />
      <main>{children}</main>
    </div>
  );
};

export default Layout;