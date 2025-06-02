// src/App.tsx
import React, { useState, useEffect } from "react";
import "./App.css";
import path from "path-browserify";
import { marked } from "marked";
import DOMPurify from "dompurify";

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]); // Stores full paths of markdown files
  const [selectedNoteContent, setSelectedNoteContent] = useState<string | null>(
    null
  );
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null); // To store the currently selected note's full path
  const [editorContent, setEditorContent] = useState<string>(""); // State for the textarea
  const [isNewNote, setIsNewNote] = useState<boolean>(false); // To track if we're creating a new note
  const [showPreview, setShowPreview] = useState<boolean>(true);

  console.log(
    "App Rendered. selectedNotePath:",
    selectedNotePath,
    "isNewNote:",
    isNewNote,
    "notes count:",
    notes.length
  ); // Keep this for debugging renders

  const handleSelectVault = async () => {
    console.log("handleSelectVault called");
    const selectedPath = await window.electron.openDirectory();
    if (selectedPath) {
      setVaultPath(selectedPath);
      // When vault changes, clear current note selection
      setSelectedNotePath(null);
      setSelectedNoteContent(null);
      setEditorContent("");
      setIsNewNote(false);
      console.log("Selected vault path and reset note states:", selectedPath);
    } else {
      console.log("Vault selection cancelled.");
    }
  };

  // Function to render Markdown
  const renderMarkdown = (markdown: string) => {
    const html = marked.parse(markdown); // Convert markdown to HTML
    const sanitizedHtml = DOMPurify.sanitize(html as string); // Sanitize the HTML. marked.parse can return a Promise, ensure it's handled or cast to string for sync use.
    return { __html: sanitizedHtml }; // Return as object for dangerouslySetInnerHTML
  };

  useEffect(() => {
    const scanVault = async () => {
      console.log(
        "useEffect: scanVault triggered. vaultPath:",
        vaultPath,
        "selectedNotePath (entry):",
        selectedNotePath,
        "isNewNote (entry):",
        isNewNote
      );

      if (!vaultPath) {
        console.log(
          "useEffect: Vault path is null, clearing all notes and states."
        );
        setNotes([]);
        setSelectedNoteContent(null);
        setEditorContent("");
        setSelectedNotePath(null);
        setIsNewNote(false);
        return; // Exit early if no vault
      }

      // Fetch current notes from disk
      const markdownFiles = await window.electron.readDirectory(vaultPath);
      setNotes(markdownFiles);
      console.log(
        "useEffect: notes updated from disk:",
        markdownFiles.map((p) => path.basename(p))
      );

      // --- REFINED LOGIC START ---
      let shouldClearSelection = true; // Assume we will clear unless a condition is met

      if (isNewNote && selectedNotePath) {
        // Case 1: We are currently editing a brand new note that hasn't been saved yet.
        // We must preserve its state and not re-read from disk (as it doesn't exist yet).
        console.log(
          "useEffect: Preserving current NEW note state:",
          selectedNotePath
        );
        // No state updates needed here for content/path, as they are already set by handleNewNote.
        shouldClearSelection = false; // Do NOT clear the selection
      } else if (selectedNotePath && markdownFiles.includes(selectedNotePath)) {
        // Case 2: An existing note was selected (or a new note just saved), and it still exists after scan.
        // Re-read its content to ensure it's fresh (important if saved externally or just created).
        console.log("useEffect: Re-selecting existing note:", selectedNotePath);
        const content = await window.electron.readFile(selectedNotePath);
        setSelectedNoteContent(content);
        setEditorContent(content || "");
        setIsNewNote(false); // It's no longer 'new' if it's now found in markdownFiles
        shouldClearSelection = false; // Do NOT clear the selection
      }
      // If neither of the above conditions is met, shouldClearSelection remains true.

      if (shouldClearSelection) {
        // Case 3: No note is selected, or the previously selected note no longer exists,
        // or a new note was present but not found in markdownFiles (e.g., if saving failed or it's not a new note anymore).
        console.log(
          "useEffect: Clearing selected note states (no valid note to keep active)."
        );
        setSelectedNoteContent(null);
        setEditorContent("");
        setSelectedNotePath(null); // This is crucial for hiding the editor
        setIsNewNote(false);
      }
      // --- REFINED LOGIC END ---
    };
    scanVault();
  }, [vaultPath, selectedNotePath, isNewNote]); // All dependencies must be here

  const handleNoteClick = async (notePath: string) => {
    console.log("handleNoteClick called for:", notePath);
    setIsNewNote(false); // When clicking an existing note, it's definitely not new
    setSelectedNotePath(notePath); // This will trigger the useEffect, which will then re-read it.
    console.log(
      "handleNoteClick: Set selectedNotePath to",
      notePath,
      "and setIsNewNote to false."
    );
    // The useEffect will handle setting content based on selectedNotePath
  };

  const handleNewNote = async () => {
    console.log("handleNewNote called");
    if (!vaultPath) {
      alert("Please select a vault folder first!");
      return;
    }

    const newNoteName = `Untitled-${Date.now()}.md`; // Unique name
    const newNoteFullPath = path.join(vaultPath, newNoteName);

    // Prepare for new note creation. Order of setting states matters for immediate UI update.
    // Set content and path first, then mark as new.
    setEditorContent("");
    setSelectedNoteContent(""); // Ensure initial content is empty
    setSelectedNotePath(newNoteFullPath); // This will make the editor appear
    setIsNewNote(true); // This tells useEffect to preserve its state

    console.log("handleNewNote: Prepared for new note:", newNoteFullPath);
    // The editor should now appear due to selectedNotePath being set.
    // The useEffect will trigger, and the 'isNewNote && selectedNotePath' branch should handle it.
  };

  const handleSaveNote = async () => {
    console.log("handleSaveNote called");
    if (!selectedNotePath || !vaultPath) {
      alert("No note selected or vault not configured to save.");
      return;
    }

    console.log(
      "Saving note:",
      selectedNotePath,
      "Content length:",
      editorContent.length
    );
    const success = await window.electron.writeFile(
      selectedNotePath,
      editorContent
    );

    if (success) {
      alert("Note saved successfully!");
      console.log("Note saved successfully.");
      // After saving, we need to ensure the notes list is updated and the *just saved* note is correctly selected.
      // Simply re-triggering the vault scan will do this, as the `useEffect` is now smarter.
      // Re-setting vaultPath with its current value forces the useEffect to run.
      setVaultPath(vaultPath); // Triggers re-scan and subsequent re-selection logic in useEffect
    } else {
      alert("Failed to save note.");
      console.error("Failed to save note:", selectedNotePath);
    }
  };

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorContent(e.target.value);
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

      <div
        style={{
          display: "flex",
          marginTop: "20px",
          width: "100%",
          height: "calc(100vh - 120px)",
        }}
      >
        {/* Sidebar for Notes List */}
        {vaultPath && (
          <div
            style={{
              width: "25%",
              borderRight: "1px solid #ccc",
              padding: "10px",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <h2>Notes</h2>
              <button
                onClick={handleNewNote}
                style={{ padding: "5px 10px", fontSize: "0.9em" }}
              >
                + New Note
              </button>
            </div>
            {notes.length === 0 && !isNewNote && !selectedNotePath ? (
              <p>No Markdown notes found in this vault.</p>
            ) : (
              <ul>
                {notes.map(
                  (
                    notePathIter // Renamed to avoid conflict with outer notePath
                  ) => (
                    <li
                      key={notePathIter}
                      onClick={() => handleNoteClick(notePathIter)}
                      style={{
                        cursor: "pointer",
                        fontWeight:
                          selectedNotePath === notePathIter && !isNewNote
                            ? "bold"
                            : "normal",
                        backgroundColor:
                          selectedNotePath === notePathIter && !isNewNote
                            ? "#f0f0f0"
                            : "transparent",
                        padding: "5px 0",
                      }}
                    >
                      {path.basename(notePathIter)}
                    </li>
                  )
                )}
                {isNewNote && selectedNotePath && (
                  <li
                    style={{
                      cursor: "pointer",
                      fontWeight: "bold",
                      backgroundColor: "#f0f0f0",
                      padding: "5px 0",
                      fontStyle: "italic",
                    }}
                  >
                    {path.basename(selectedNotePath)} (New)
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        {/* Main Content Area (Editor/Viewer) */}
        <div
          style={{
            flexGrow: 1,
            padding: "10px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2>
            {selectedNotePath
              ? path.basename(selectedNotePath)
              : "Note Content"}
          </h2>
          {selectedNotePath ? (
            <>
              <div style={{ marginBottom: "10px", textAlign: "right" }}>
                <button onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? "Show Editor Only" : "Show Live Preview"}
                </button>
                <button onClick={handleSaveNote} style={{ marginLeft: "10px" }}>
                  Save Note
                </button>
              </div>

              <div style={{ display: "flex", flexGrow: 1 }}>
                {" "}
                {/* Flex container for editor/preview */}
                <textarea
                  value={editorContent}
                  onChange={handleEditorChange}
                  placeholder="Start writing your Markdown note here..."
                  style={{
                    width: showPreview ? "50%" : "100%", // Take half width if preview shown, else full
                    flexGrow: 1,
                    minHeight: "200px",
                    padding: "10px",
                    fontSize: "1em",
                    border: "1px solid #ddd",
                    borderRadius: "5px",
                    resize: "none", // Disable textarea resize
                    marginRight: showPreview ? "10px" : "0", // Space if preview
                  }}
                />
                {showPreview && ( // Conditionally render preview panel
                  <div
                    className="markdown-preview" // Add a class for potential styling
                    style={{
                      width: "50%",
                      flexGrow: 1,
                      border: "1px solid #ddd",
                      borderRadius: "5px",
                      padding: "10px",
                      overflowY: "auto", // Scroll for long content
                      backgroundColor: "#f9f9f9",
                      fontSize: "1em",
                    }}
                    // DANGER! Use with extreme caution! Only after sanitization!
                    dangerouslySetInnerHTML={renderMarkdown(editorContent)}
                  />
                )}
              </div>
            </>
          ) : vaultPath ? (
            <p>Select a note from the sidebar or create a new one.</p>
          ) : (
            <p>Please select a vault folder to get started.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
