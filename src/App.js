import React from "react";
import { GameCanvas } from "./components/GameCanvas.js";

export function App() {
  return React.createElement(
    "main",
    { className: "app" },
    React.createElement(GameCanvas),
  );
}
