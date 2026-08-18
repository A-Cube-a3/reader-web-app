import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import './App.css'
import { localApplication } from './app/createLocalLibrary.js'
import { webPwaService } from './platform/web/pwaService.js'
import {
  filterLibrary,
  getContinueReading,
  getRecentBooks,
} from './services/library/libraryView.js'

export default function App({
  libraryService = localApplication.library,
  pwaService = webPwaService,
}) {
  const [books, setBooks] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formatFilter, setFormatFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [storage, setStorage] = useState(null)
  const [storageError, setStorageError] = useState(null)
  const pwa = useSyncExternalStore(
    pwaService.subscribe,
    pwaService.getSnapshot,
    pwaService.getSnapshot,
  )

  const selectedBook = useMemo(
    () => books.find(({ id }) => id === selectedBookId) || null,
    [books, selectedBookId],
  )
  const filteredBooks = useMemo(
    () => filterLibrary(books, { query: searchQuery, format: formatFilter }),
    [books, searchQuery, formatFilter],
  )
  const continueReading = useMemo(() => getContinueReading(books), [books])
  const recentBooks = useMemo(() => getRecentBooks(books), [books])

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
        if (active) {
          setStorage(status)
          setStorageError(null)
        }
      } catch (cause) {
        if (active) setStorageError(messageFor(cause))
      }
    }
    initialize()
    return () => { active = false }
  }, [libraryService])

  async function refreshStorage() {
    try {
      const status = await libraryService.inspectStorage()
      setStorage(status)
      setStorageError(null)
      return status
    } catch (cause) {
      setStorageError(messageFor(cause))
      return null
    }
  }

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
      void refreshStorage()
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
      setBooks((current) => current.map((book) => (
        book.id === updated.id ? { ...updated, progress: book.progress } : book
      )))
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
      void refreshStorage()
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
      setStorageError(null)
      setNotice(status.persisted
        ? 'The browser granted durable local storage.'
        : 'Durable storage was not granted. Keep your original book files backed up.')
    } catch (cause) {
      setStorageError(messageFor(cause))
    }
  }

  async function applyUpdate() {
    try {
      await pwaService.applyUpdate()
    } catch {
      setError('The update could not be applied. Your local library is unchanged.')
    }
  }

  function clearMessages() {
    setError(null)
    setNotice(null)
  }

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="brandBlock">
          <img src="/icons/reader.svg" alt="" width="48" height="48" />
          <div>
            <p className="eyebrow">Local-first reader</p>
            <h1>My Library</h1>
            <p className="headerCopy">Private books, ready without an account or server.</p>
          </div>
        </div>
        <div className="headerActions">
          {!pwa.online && <span className="offlineBadge" role="status">Offline · local library ready</span>}
          {pwa.installAvailable && !pwa.installed && (
            <button className="secondaryButton" type="button" onClick={() => pwaService.install()}>
              Install app
            </button>
          )}
          <StorageSummary storage={storage} onRequest={requestPersistence} />
        </div>
      </header>

      <main className="appMain">
        <PwaNotices status={pwa} service={pwaService} onApplyUpdate={applyUpdate} />
        {storageError && (
          <div className="noticeBanner warningBanner" role="status">
            <div>
              <strong>Private storage needs attention</strong>
              <span>{storageError} Existing library records remain available.</span>
            </div>
            <button type="button" onClick={refreshStorage}>Check again</button>
          </div>
        )}
        {error && <p className="message errorMessage" role="alert">{error}</p>}
        {notice && <p className="message successMessage" role="status">{notice}</p>}

        <section className="dashboardGrid" aria-label="Library overview">
          <LibraryStrip
            title="Continue Reading"
            eyebrow="Pick up where you left off"
            books={continueReading}
            empty="Books you start reading will appear here."
            onSelect={setSelectedBookId}
            showProgress
          />
          <LibraryStrip
            title="Recent Books"
            eyebrow="Latest on this device"
            books={recentBooks}
            empty="Your newest imports will appear here."
            onSelect={setSelectedBookId}
          />
        </section>

        <div className="libraryLayout">
          <section className="libraryPanel" aria-label="My Library">
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
                <small>PDF or EPUB, up to 512 MB. Copied into private app storage.</small>
              </div>
              <button className="primaryButton" disabled={working || !selectedFile} type="submit">
                {working ? 'Working…' : 'Import Book'}
              </button>
            </form>

            <div className="catalogHeading">
              <div>
                <p className="eyebrow">On this device</p>
                <h2 id="library-heading">All Books</h2>
              </div>
              <span aria-live="polite">
                {filteredBooks.length} of {books.length} {books.length === 1 ? 'book' : 'books'}
              </span>
            </div>

            <div className="libraryTools">
              <label className="searchField" htmlFor="library-search">
                <span>Search local metadata</span>
                <input
                  id="library-search"
                  type="search"
                  value={searchQuery}
                  placeholder="Title, author, publisher, ISBN…"
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
              <div className="formatFilters" aria-label="Filter books by format">
                {['all', 'pdf', 'epub'].map((format) => (
                  <button
                    key={format}
                    aria-pressed={formatFilter === format}
                    onClick={() => setFormatFilter(format)}
                    type="button"
                  >
                    {format === 'all' ? 'All' : format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="emptyState">Opening your local library…</p>
            ) : books.length === 0 ? (
              <div className="emptyState">
                <h3>Your shelf is ready</h3>
                <p>Import a PDF or EPUB. No sign-in or backend connection is needed.</p>
              </div>
            ) : filteredBooks.length === 0 ? (
              <div className="emptyState">
                <h3>No local books match</h3>
                <p>Change the search text or format filter. No network search is performed.</p>
                <button type="button" onClick={() => { setSearchQuery(''); setFormatFilter('all') }}>
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="bookGrid">
                {filteredBooks.map((book) => (
                  <li key={book.id}>
                    <BookCard
                      book={book}
                      selected={book.id === selectedBookId}
                      onSelect={setSelectedBookId}
                    />
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
                <p>Select a local book to inspect or edit its metadata.</p>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}

function PwaNotices({ status, service, onApplyUpdate }) {
  return (
    <>
      {status.updateAvailable && (
        <div className="noticeBanner updateBanner" role="status">
          <div><strong>Reader update ready</strong><span>Apply it when you are ready to reload.</span></div>
          <div>
            <button type="button" onClick={onApplyUpdate}>Update now</button>
            <button type="button" onClick={service.dismissUpdate}>Later</button>
          </div>
        </div>
      )}
      {status.offlineReady && (
        <div className="noticeBanner readyBanner" role="status">
          <div><strong>Ready offline</strong><span>The application shell is saved on this device.</span></div>
          <button type="button" onClick={service.dismissOfflineReady}>Got it</button>
        </div>
      )}
      {status.registrationError && (
        <div className="noticeBanner warningBanner" role="status">
          <div><strong>Offline installation unavailable</strong><span>{status.registrationError}</span></div>
          <button type="button" onClick={service.dismissRegistrationError}>Dismiss</button>
        </div>
      )}
    </>
  )
}

function LibraryStrip({ title, eyebrow, books, empty, onSelect, showProgress = false }) {
  return (
    <section className="overviewPanel" aria-labelledby={`overview-${title.replaceAll(' ', '-').toLowerCase()}`}>
      <div className="overviewHeading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={`overview-${title.replaceAll(' ', '-').toLowerCase()}`}>{title}</h2>
        </div>
        <span>{books.length}</span>
      </div>
      {books.length === 0 ? (
        <p className="overviewEmpty">{empty}</p>
      ) : (
        <ul className="stripList">
          {books.map((book) => (
            <li key={book.id}>
              <button type="button" onClick={() => onSelect(book.id)}>
                <span className="formatBadge">{book.format}</span>
                <span><strong>{book.title}</strong><small>{book.author || 'Unknown author'}</small></span>
                {showProgress && <ProgressLabel progress={book.progress} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ProgressLabel({ progress }) {
  if (!Number.isFinite(progress?.progression)) return <small>Resume</small>
  const percentage = Math.max(0, Math.min(100, Math.round(progress.progression * 100)))
  return <small>{percentage}%</small>
}

function BookCard({ book, selected, onSelect }) {
  return (
    <button
      className={`bookCard ${selected ? 'bookCardSelected' : ''}`}
      onClick={() => onSelect(book.id)}
      type="button"
    >
      <span className="formatBadge">{book.format}</span>
      <strong>{book.title}</strong>
      <span>{book.author || 'Unknown author'}</span>
      <small>{formatBytes(book.fileSize)} · {formatDate(book.importedAt)}</small>
    </button>
  )
}

function StorageSummary({ storage, onRequest }) {
  if (!storage) return <div className="storageStatus">Checking device storage…</div>
  const lowStorage = storage.quota > 0 && storage.available / storage.quota < 0.1
  return (
    <div className={`storageStatus ${storage.persisted ? 'storageDurable' : 'storageWarning'} ${lowStorage ? 'storageLow' : ''}`}>
      <strong>{lowStorage ? 'Storage nearly full' : storage.persisted ? 'Durable storage' : 'Storage may be cleared'}</strong>
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
      <small className="deleteNote">Deleting also removes this book's saved local progress.</small>
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
