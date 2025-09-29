import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n"; // Inicializar i18n antes de renderizar

createRoot(document.getElementById("root")!).render(<App />);
