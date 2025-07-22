import React, { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./Pages/HomePage"; // In App.jsx
import { TokenAnalysis } from "./Pages/TokenAnalysis.jsx"; // Add curly braces
function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/token/:tokenId" element={<TokenAnalysis />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
