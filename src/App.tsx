// src/App.tsx
import React, { useState, useEffect } from "react";
import "./App.css"; // Ensure this is imported
import path from "path-browserify";
import { marked } from "marked";
import DOMPurify from "dompurify";

function App() {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [selectedNoteContent, setSelectedNoteContent] = useState<string | null>(
    null
  );
  const [selectedNotePath, setSelectedNotePath] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>("");
  const [isNewNote, setIsNewNote] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(true); // New state for toggling preview

  console.log(
    "App Rendered. selectedNotePath:",
    selectedNotePath,
    "isNewNote:",
    isNewNote,
    "notes count:",
    notes.length
  );

  const handleSelectVault = async () => {
    console.log("handleSelectVault called");
    const selectedPath = await window.electron.openDirectory();
    if (selectedPath) {
      setVaultPath(selectedPath);
      setSelectedNotePath(null);
      setSelectedNoteContent(null);
      setEditorContent("");
      setIsNewNote(false);
      console.log("Selected vault path and reset note states:", selectedPath);
    } else {
      console.log("Vault selection cancelled.");
    }
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
        return;
      }

      const markdownFiles = await window.electron.readDirectory(vaultPath);
      setNotes(markdownFiles);
      console.log(
        "useEffect: notes updated from disk:",
        markdownFiles.map((p) => path.basename(p))
      );

      let shouldClearSelection = true;

      if (isNewNote && selectedNotePath) {
        console.log(
          "useEffect: Preserving current NEW note state:",
          selectedNotePath
        );
        shouldClearSelection = false;
      } else if (selectedNotePath && markdownFiles.includes(selectedNotePath)) {
        console.log("useEffect: Re-selecting existing note:", selectedNotePath);
        const content = await window.electron.readFile(selectedNotePath);
        setSelectedNoteContent(content);
        setEditorContent(content || "");
        setIsNewNote(false);
        shouldClearSelection = false;
      }

      if (shouldClearSelection) {
        console.log(
          "useEffect: Clearing selected note states (no valid note to keep active)."
        );
        setSelectedNoteContent(null);
        setEditorContent("");
        setSelectedNotePath(null);
        setIsNewNote(false);
      }
    };
    scanVault();
  }, [vaultPath, selectedNotePath, isNewNote]);

  const handleNoteClick = async (notePath: string) => {
    console.log("handleNoteClick called for:", notePath);
    setIsNewNote(false);
    setSelectedNotePath(notePath);
    console.log(
      "handleNoteClick: Set selectedNotePath to",
      notePath,
      "and setIsNewNote to false."
    );
  };

  const handleNewNote = async () => {
    console.log("handleNewNote called");
    if (!vaultPath) {
      alert("Please select a vault folder first!");
      return;
    }

    const newNoteName = `Untitled-${Date.now()}.md`;
    const newNoteFullPath = path.join(vaultPath, newNoteName);

    setEditorContent("");
    setSelectedNoteContent("");
    setSelectedNotePath(newNoteFullPath);
    setIsNewNote(true);

    console.log("handleNewNote: Prepared for new note:", newNoteFullPath);
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
      setVaultPath(vaultPath);
    } else {
      alert("Failed to save note.");
      console.error("Failed to save note:", selectedNotePath);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNotePath || !vaultPath) {
      alert("No note selected to delete.");
      return;
    }

    if (isNewNote) {
      setSelectedNotePath(null);
      setSelectedNoteContent(null);
      setEditorContent("");
      setIsNewNote(false);
      alert("New note discarded.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${path.basename(
        selectedNotePath
      )}"? This action cannot be undone.`
    );
    if (!confirmDelete) {
      return;
    }

    console.log("Attempting to delete note:", selectedNotePath);
    const success = await window.electron.deleteFile(selectedNotePath);

    if (success) {
      alert("Note deleted successfully!");
      setSelectedNotePath(null);
      setSelectedNoteContent(null);
      setEditorContent("");
      setIsNewNote(false);
      setVaultPath(vaultPath);
    } else {
      alert("Failed to delete note.");
    }
  };

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorContent(e.target.value);
  };

  const renderMarkdown = (markdown: string) => {
    const html = marked.parse(markdown);
    const sanitizedHtml = DOMPurify.sanitize(html as string);
    return { __html: sanitizedHtml };
  };

  const handleRenameNote = async () => {
    if (!selectedNotePath) {
      alert("Please select a note to rename.");
      return;
    }

    const currentNoteName = path.basename(selectedNotePath, ".md");
    const newNoteName = prompt(
      `Enter new name for "${currentNoteName}":`,
      currentNoteName
    );

    if (!newNoteName || newNoteName.trim() === "") {
      alert("Rename cancelled or new name is empty.");
      return;
    }

    const sanitizedNewNoteName = newNoteName.replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      ""
    ); // Basic sanitization
    if (sanitizedNewNoteName !== newNoteName) {
      alert("Invalid characters removed from new name. Please check.");
    }
    const newFileName = `${sanitizedNewNoteName}.md`;

    // Construct the new full path
    const parentDir = path.dirname(selectedNotePath);
    const newNotePath = path.join(parentDir, newFileName);

    if (newNotePath === selectedNotePath) {
      alert("New name is the same as the old name.");
      return;
    }

    try {
      const success = await window.electron.renameFile(
        selectedNotePath,
        newNotePath
      );

      if (success) {
        alert("Note renamed successfully!");
        // After renaming, we need to refresh the note list
        // and update the currently selected note if it was the one renamed.
        if (vaultPath) {
          await loadNotesFromVault(vaultPath); // Refresh the list of notes
        }
        // Update the selected note path to the new path
        setSelectedNotePath(newNotePath);
        // Reload content of the renamed note if it was currently open
        const renamedNoteContent = await window.electron.readFile(newNotePath);
        setNoteContent(renamedNoteContent || "");
      } else {
        alert("Failed to rename note. Check console for details.");
      }
    } catch (error) {
      console.error("Error renaming note:", error);
      alert("An unexpected error occurred during rename. Check console.");
    }
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
          display: "flex", // Keep flex here for layout
          marginTop: "20px",
          width: "100%",
          height:
            "calc(100vh - 80px)" /* Adjusted height to fit header and leave space */,
        }}
      >
        {/* Sidebar for Notes List */}
        {vaultPath && (
          <div className="notes-sidebar">
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
                {notes.map((notePathIter) => (
                  <li
                    key={notePathIter}
                    onClick={() => handleNoteClick(notePathIter)}
                    className={
                      selectedNotePath === notePathIter && !isNewNote
                        ? "selected"
                        : ""
                    }
                  >
                    {path.basename(notePathIter)}
                  </li>
                ))}
                {isNewNote && selectedNotePath && (
                  <li className="new-note">
                    {path.basename(selectedNotePath)} (New)
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        {/* Main Content Area (Editor/Viewer) */}
        <div className="main-content">
          <h2>
            {selectedNotePath
              ? path.basename(selectedNotePath)
              : "Note Content"}
          </h2>
          {selectedNotePath ? (
            <>
              <div className="editor-controls">
                <button onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? "Show Editor Only" : "Show Live Preview"}
                </button>
                <button onClick={handleSaveNote}>Save Note</button>
                <button onClick={handleDeleteNote} className="delete-button">
                  Delete Note
                </button>
              </div>

              <div className="editor-area-container">
                <textarea
                  value={editorContent}
                  onChange={handleEditorChange}
                  placeholder="Start writing your Markdown note here..."
                  style={{
                    width: showPreview ? "50%" : "100%",
                    marginRight: showPreview ? "10px" : "0",
                  }}
                />
                {showPreview && (
                  <div
                    className="markdown-preview"
                    style={{ width: "50%" }}
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
