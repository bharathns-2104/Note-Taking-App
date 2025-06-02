// src/App.tsx
import React, { useState, useEffect } from "react";
import "./App.css"; // Assuming you have App.css for basic styling
import path from "path-browserify"; // Import path-browserify for path manipulation in renderer

// Fix for path-browserify: install it first
// npm install path-browserify

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]); // Stores full paths of markdown files
  const [selectedNoteContent, setSelectedNoteContent] = useState<string | null>(
    null
  );
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null); // To store the currently selected note's full path

  const handleSelectVault = async () => {
    const path = await window.electron.openDirectory();
    if (path) {
      setVaultPath(path);
      console.log("Selected vault path:", path);
      // Don't scan here, use useEffect below
    } else {
      console.log("Vault selection cancelled.");
    }
  };

  // Effect to scan for notes whenever vaultPath changes
  useEffect(() => {
    const scanVault = async () => {
      if (vaultPath) {
        console.log("Scanning vault:", vaultPath);
        const markdownFiles = await window.electron.readDirectory(vaultPath);
        setNotes(markdownFiles);
        setSelectedNoteContent(null); // Clear content when vault changes
        setSelectedNotePath(null); // Clear selected note when vault changes
      } else {
        setNotes([]); // Clear notes if no vault is selected
      }
    };
    scanVault();
  }, [vaultPath]); // Rerun this effect when vaultPath changes

  const handleNoteClick = async (notePath: string) => {
    setSelectedNotePath(notePath); // Set the full path of the selected note
    console.log("Attempting to read note:", notePath);
    const content = await window.electron.readFile(notePath);
    setSelectedNoteContent(content);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>My Notes App</h1>
        <button onClick={handleSelectVault}>Select Vault Folder</button>
        {vaultPath && (
          <p>
            Vault Folder Selected: <strong>{vaultPath}</strong>
          </p>
        )}
      </header>

      <div style={{ display: "flex", marginTop: "20px", width: "100%" }}>
        {/* Sidebar for Notes List */}
        {vaultPath && (
          <div
            style={{
              width: "25%",
              borderRight: "1px solid #ccc",
              padding: "10px",
            }}
          >
            <h2>Notes</h2>
            {notes.length === 0 ? (
              <p>No Markdown notes found in this vault.</p>
            ) : (
              <ul>
                {notes.map((notePath) => (
                  <li
                    key={notePath}
                    onClick={() => handleNoteClick(notePath)}
                    style={{
                      cursor: "pointer",
                      fontWeight:
                        selectedNotePath === notePath ? "bold" : "normal",
                      backgroundColor:
                        selectedNotePath === notePath
                          ? "#f0f0f0"
                          : "transparent",
                      padding: "5px 0",
                    }}
                  >
                    {path.basename(notePath)} {/* Display only the file name */}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Main Content Area (Editor/Viewer) */}
        <div style={{ flexGrow: 1, padding: "10px" }}>
          <h2>Note Content</h2>
          {selectedNoteContent === null ? (
            vaultPath ? (
              <p>Select a note from the sidebar to view its content.</p>
            ) : (
              <p>Please select a vault folder to get started.</p>
            )
          ) : (
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {selectedNoteContent}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
