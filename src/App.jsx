import React from "react";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Landing from "./pages/landing";
import Dashboard from "./pages/dashboard";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}
