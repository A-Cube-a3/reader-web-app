import { useState } from 'react'
import "./App.css";

const API_BASE_URL = 'http://localhost:8080/api'

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

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const res = await fetch(`${API_BASE_URL}/books/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Upload failed.')
      } else {
        setResponse(data)
      }
    } catch (err) {
      setError('Network error: Could not reach the backend. Is it running on port 8080?',err)
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
      <p className="subtitle">Phase 1 — File Upload MVP</p>

      <div className="section">
        <label className="label">Select a book to upload</label>
        <input
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
        {uploading ? "Uploading..." : "Upload Book"}
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

