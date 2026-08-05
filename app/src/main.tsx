import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ProvedorDeDados } from "./data/ProvedorDeDados";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ProvedorDeDados>
      <App />
    </ProvedorDeDados>
  </React.StrictMode>,
);
