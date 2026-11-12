import React from "react";
import { createRoot } from "react-dom/client";

function App(): React.ReactElement {
  return <div>Echo Cover — coming in Step 22</div>;
}

const root = document.getElementById("root");
if (!root) throw new Error("No root element");
createRoot(root).render(<App />);
