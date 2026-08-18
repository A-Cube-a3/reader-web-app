import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { localApplication } from './app/createLocalLibrary.js'

export default function App({ libraryService = localApplication.library }) {
  const [books, setBooks] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [storage, setStorage] = useState(null)

  const selectedBook = useMemo(
    () => books.find(({ id }) => id === selectedBookId) || null,
    [books, selectedBookId],
  )

  useEffect(() => {
    let active = true
    async function initialize() {
      try {
        const localBooks = await libraryService.initialize()
        if (active) setBooks(localBooks)
      } catch (cause) {
        if (active) setError(messageFor(cause))
      } finally {
        if (active) setLoading(false)
      }

      try {
        const status = await libraryService.inspectStorage()
        if (active) setStorage(status)
      } catch (cause) {
        if (active) setError(messageFor(cause))
      }
    }
    initialize()
    return () => { active = false }
  }, [libraryService])

  async function importBook(event) {
    event.preventDefault()
    const form = event.currentTarget
    if (!selectedFile) {
      setError('Choose a PDF or EPUB file to import.')
      return
    }
    setWorking(true)
    clearMessages()
    try {
      const imported = await libraryService.importBook(selectedFile)
      setBooks((current) => [imported, ...current])
      setSelectedBookId(imported.id)
      setSelectedFile(null)
      form.reset()
      setNotice(`Imported “${imported.title}” into this device.`)
      setStorage(await libraryService.inspectStorage())
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setWorking(false)
    }
  }

  async function saveMetadata(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setWorking(true)
    clearMessages()
    try {
      const updated = await libraryService.updateBook(selectedBook.id, {
        title: form.get('title'),
        author: form.get('author'),
        description: form.get('description'),
        publisher: form.get('publisher'),
        language: form.get('language'),
        identifier: form.get('identifier'),
      })
      setBooks((current) => current.map((book) => book.id === updated.id ? updated : book))
      setNotice('Book details saved locally.')
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setWorking(false)
    }
  }

  async function deleteBook() {
    if (!selectedBook) return
    setWorking(true)
    clearMessages()
    try {
      const result = await libraryService.deleteBook(selectedBook.id)
      setBooks((current) => current.filter(({ id }) => id !== selectedBook.id))
      setSelectedBookId(null)
      setNotice(result.cleanupPending
        ? 'Book removed. Private file cleanup will retry automatically.'
        : 'Book and its local file were deleted.')
      setStorage(await libraryService.inspectStorage())
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setWorking(false)
    }
  }

  async function requestPersistence() {
    clearMessages()
    try {
      const status = await libraryService.requestPersistentStorage()
      setStorage(status)
      setNotice(status.persisted
        ? 'The browser granted durable local storage.'
        : 'Durable storage was not granted. Keep your original book files backed up.')
    } catch (cause) {
      setError(messageFor(cause))
    }
  }

  function clearMessages() {
    setError(null)
    setNotice(null)
  }

  return (
    <div className="appShell">
      <header className="appHeader">
        <div>
          <p className="eyebrow">Local-first reader</p>
          <h1>My Library</h1>
          <p className="headerCopy">Your books live on this device and open without an account or server.</p>
        </div>
        <StorageSummary storage={storage} onRequest={requestPersistence} />
      </header>

      <main className="libraryLayout">
        <section className="libraryPanel" aria-labelledby="library-heading">
          <form className="importBar" onSubmit={importBook}>
            <div>
              <label htmlFor="book-import">Import a local book</label>
              <input
                id="book-import"
                type="file"
                accept=".pdf,.epub,application/pdf,application/epub+zip"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] || null)
                  clearMessages()
                }}
              />
              <small>PDF or EPUB, up to 512 MB. The file is copied into private app storage.</small>
            </div>
            <button className="primaryButton" disabled={working || !selectedFile} type="submit">
              {working ? 'Working…' : 'Import Book'}
            </button>
          </form>

          {error && <p className="message errorMessage" role="alert">{error}</p>}
          {notice && <p className="message successMessage" role="status">{notice}</p>}

          <div className="sectionHeading">
            <div>
              <p className="eyebrow">On this device</p>
              <h2 id="library-heading">Books</h2>
            </div>
            <span>{books.length} {books.length === 1 ? 'book' : 'books'}</span>
          </div>

          {loading ? (
            <p className="emptyState">Opening your local library…</p>
          ) : books.length === 0 ? (
            <div className="emptyState">
              <h3>Your shelf is ready</h3>
              <p>Import a PDF or EPUB. No sign-in or backend connection is needed.</p>
            </div>
          ) : (
            <ul className="bookGrid">
              {books.map((book) => (
                <li key={book.id}>
                  <button
                    className={`bookCard ${book.id === selectedBookId ? 'bookCardSelected' : ''}`}
                    onClick={() => setSelectedBookId(book.id)}
                    type="button"
                  >
                    <span className="formatBadge">{book.format}</span>
                    <strong>{book.title}</strong>
                    <span>{book.author || 'Unknown author'}</span>
                    <small>{formatBytes(book.fileSize)} · {formatDate(book.importedAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="detailPanel" aria-label="Book details">
          {selectedBook ? (
            <BookDetails
              key={`${selectedBook.id}-${selectedBook.updatedAt}`}
              book={selectedBook}
              disabled={working}
              onSave={saveMetadata}
              onDelete={deleteBook}
            />
          ) : (
            <div className="detailPlaceholder">
              <span aria-hidden="true">↖</span>
              <h2>Book details</h2>
              <p>Select a book to inspect or edit its local metadata.</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}

function StorageSummary({ storage, onRequest }) {
  if (!storage) return <div className="storageStatus">Checking device storage…</div>
  return (
    <div className={`storageStatus ${storage.persisted ? 'storageDurable' : 'storageWarning'}`}>
      <strong>{storage.persisted ? 'Durable storage' : 'Storage may be cleared'}</strong>
      {storage.quota !== null && (
        <span>{formatBytes(storage.usage || 0)} of {formatBytes(storage.quota)} used</span>
      )}
      {!storage.persisted && <button type="button" onClick={onRequest}>Protect local books</button>}
    </div>
  )
}

function BookDetails({ book, disabled, onSave, onDelete }) {
  return (
    <form className="detailsForm" onSubmit={onSave}>
      <div className="detailTitle">
        <span className="formatBadge">{book.format}</span>
        <div>
          <h2>{book.title}</h2>
          <p>{book.originalFilename}</p>
        </div>
      </div>
      <label>Title<input name="title" defaultValue={book.title} required /></label>
      <label>Author<input name="author" defaultValue={book.author} /></label>
      <label>Publisher<input name="publisher" defaultValue={book.publisher} /></label>
      <div className="fieldRow">
        <label>Language<input name="language" defaultValue={book.language} /></label>
        <label>ISBN / identifier<input name="identifier" defaultValue={book.identifier} /></label>
      </div>
      <label>Description<textarea name="description" defaultValue={book.description} rows="4" /></label>
      <dl className="bookFacts">
        <div><dt>Size</dt><dd>{formatBytes(book.fileSize)}</dd></div>
        <div><dt>Pages</dt><dd>{book.pageCount || '—'}</dd></div>
        <div><dt>Metadata</dt><dd>{book.metadataSource?.type || 'filename'}</dd></div>
      </dl>
      <div className="detailActions">
        <button className="primaryButton" disabled={disabled} type="submit">Save details</button>
        <button className="dangerButton" disabled={disabled} onClick={onDelete} type="button">
          Delete local book
        </button>
      </div>
    </form>
  )
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value) {
  if (!value) return 'Unknown date'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function messageFor(error) {
  return error instanceof Error ? error.message : 'The local library could not complete that action.'
}
