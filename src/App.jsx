import React from "react";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Landing from "./pages/landing";
import Dashboard from "./pages/dashboard";
import ChooseCat1 from "./pages/choosecat1";
import ChooseCat2 from "./pages/choosecat2";
import ChooseCat3 from "./pages/choosecat3";
import Session from "./pages/session";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/choosecat1" element={<ChooseCat1 />} />
        <Route path="/choosecat2" element={<ChooseCat2 />} />
        <Route path="/choosecat3" element={<ChooseCat3 />} />
        <Route path="/session" element={<Session />} />
      </Routes>
    </Router>
  );
}
