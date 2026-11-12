import React from "react";
import { createRoot } from "react-dom/client";

function App(): React.ReactElement {
  return <div>Echo Care — coming in Step 19</div>;
}

const root = document.getElementById("root");
if (!root) throw new Error("No root element");
createRoot(root).render(<App />);
