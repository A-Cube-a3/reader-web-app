import { useState } from 'react'
import "./App.css";
import { uploadLegacyBook } from './services/legacyBooksApi.js'

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    setSelectedFile(file || null)
    setResponse(null)
    setError(null)
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first.')
      return
    }

    const fileName = selectedFile.name.toLowerCase()
    if (!fileName.endsWith('.pdf') && !fileName.endsWith('.epub')) {
      setError('Only PDF and EPUB files are supported.')
      return
    }

    setUploading(true)
    setResponse(null)
    setError(null)

    try {
      const data = await uploadLegacyBook(selectedFile)
      setResponse(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
  <div className="page">
    <div className="card">
      <h1 className="title">📚 Reader App</h1>
      <p className="subtitle">Phase 1 — Stabilized legacy cloud upload</p>
      <p>
        This temporary upload needs the optional backend. Local, offline import replaces it in Phase 2.
      </p>

      <div className="section">
        <label className="label" htmlFor="book-upload">Select a book to upload</label>
        <input
          id="book-upload"
          type="file"
          accept=".pdf,.epub"
          onChange={handleFileChange}
          className="fileInput"
        />
        {selectedFile && (
          <p className="fileInfo">
            <strong>{selectedFile.name}</strong> — {formatFileSize(selectedFile.size)}
          </p>
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading || !selectedFile}
        className={`button ${uploading || !selectedFile ? "buttonDisabled" : ""}`}
      >
        {uploading ? "Uploading..." : "Upload to Legacy Backend"}
      </button>

      {error && (
        <div className="errorBox">
          <strong>Error:</strong> {error}
        </div>
      )}

      {response && (
        <div className="successBox">
          <h3 className="successTitle">✅ Upload Successful</h3>
          <pre className="pre">
            {JSON.stringify(response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  </div>
  );
}
