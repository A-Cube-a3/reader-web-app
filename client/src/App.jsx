import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import './App.css'
import { localApplication } from './app/createLocalLibrary.js'
import { webPwaService } from './platform/web/pwaService.js'
import { webNavigation } from './platform/web/navigation.js'
import ReaderRoute from './routes/ReaderRoute.jsx'
import KnowledgeRoute from './routes/KnowledgeRoute.jsx'
import StatisticsRoute from './routes/StatisticsRoute.jsx'
import { READING_STATUSES } from './domain/books/book.js'
import {
  filterLibrary,
  getContinueReading,
  getRecentBooks,
} from './services/library/libraryView.js'

export default function App({
  libraryService = localApplication.library,
  readerService = localApplication.reader,
  knowledgeService = localApplication.knowledge,
  exportService = localApplication.export,
  pwaService = webPwaService,
  navigation = webNavigation,
}) {
  const [books, setBooks] = useState([])
  const [knowledge, setKnowledge] = useState({ collections: [], notes: [], highlights: [], tags: [], statistics: emptyStatistics(), books: [] })
  const [view, setView] = useState('library')
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [formatFilter, setFormatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [collectionFilter, setCollectionFilter] = useState('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
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
  const readerBookId = useSyncExternalStore(
    navigation.subscribe,
    navigation.getSnapshot,
    navigation.getSnapshot,
  )

  const selectedBook = useMemo(
    () => books.find(({ id }) => id === selectedBookId) || null,
    [books, selectedBookId],
  )
  const filteredBooks = useMemo(() => {
    const metadataMatches = filterLibrary(books, { query: searchQuery, format: formatFilter })
    const collection = knowledge.collections.find((item) => item.id === collectionFilter)
    return metadataMatches
      .filter((book) => statusFilter === 'all' || book.readingStatus === statusFilter)
      .filter((book) => !favoritesOnly || book.favorite)
      .filter((book) => !collection || collection.bookIds.includes(book.id))
  }, [books, collectionFilter, favoritesOnly, formatFilter, knowledge.collections, searchQuery, statusFilter])
  const continueReading = useMemo(() => getContinueReading(books), [books])
  const recentBooks = useMemo(() => getRecentBooks(books), [books])

  useEffect(() => {
    if (readerBookId) return undefined
    let active = true
    async function initialize() {
      const storageResult = libraryService.inspectStorage()
        .then((status) => ({ status }))
        .catch((cause) => ({ cause }))
      try {
        const localBooks = await libraryService.initialize()
        const localKnowledge = await knowledgeService.load(localBooks)
        if (active) {
          setBooks(localBooks)
          setKnowledge(localKnowledge)
        }
      } catch (cause) {
        if (active) setError(messageFor(cause))
      } finally {
        if (active) setLoading(false)
      }

      const { status, cause } = await storageResult
      if (status) {
        if (active) {
          setStorage(status)
          setStorageError(null)
        }
      } else if (active) setStorageError(messageFor(cause))
    }
    initialize()
    return () => { active = false }
  }, [knowledgeService, libraryService, readerBookId])

  async function refreshKnowledge(nextBooks = books) {
    const snapshot = await knowledgeService.load(nextBooks)
    setKnowledge(snapshot)
    return snapshot
  }

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
      const nextBooks = [imported, ...books]
      setBooks(nextBooks)
      await refreshKnowledge(nextBooks)
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
      const nextBooks = books.filter(({ id }) => id !== selectedBook.id)
      setBooks(nextBooks)
      await refreshKnowledge(nextBooks)
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

  if (readerBookId) {
    return <ReaderRoute bookId={readerBookId} initialLocator={navigation.getReaderLocator?.(readerBookId)} readerService={readerService} navigation={navigation} />
  }

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="brandBlock">
          <img src="/icons/reader.svg" alt="" width="48" height="48" />
          <div>
            <p className="eyebrow">Local-first reader</p>
            <h1>{view === 'library' ? 'My Library' : view === 'knowledge' ? 'Knowledge' : 'Statistics'}</h1>
            <p className="headerCopy">Private books, ready without an account or server.</p>
          </div>
        </div>
        <div className="headerActions">
          <nav className="appNav" aria-label="Application"><button aria-current={view === 'library' ? 'page' : undefined} onClick={() => setView('library')} type="button">Library</button><button aria-current={view === 'knowledge' ? 'page' : undefined} onClick={() => setView('knowledge')} type="button">Knowledge</button><button aria-current={view === 'statistics' ? 'page' : undefined} onClick={() => setView('statistics')} type="button">Statistics</button></nav>
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

        {view === 'knowledge' ? <KnowledgeRoute snapshot={{ ...knowledge, books }} service={knowledgeService} exportService={exportService} navigation={navigation} onRefresh={() => refreshKnowledge()} onError={(cause) => setError(messageFor(cause))} onNotice={setNotice} /> : view === 'statistics' ? <StatisticsRoute statistics={knowledge.statistics} /> : <><section className="dashboardGrid" aria-label="Library overview">
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
            <div className="organizationFilters">
              <label>Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value={READING_STATUSES.WANT_TO_READ}>Want to Read</option><option value={READING_STATUSES.CURRENTLY_READING}>Currently Reading</option><option value={READING_STATUSES.COMPLETED}>Completed</option><option value={READING_STATUSES.DROPPED}>Dropped</option></select></label>
              <label>Collection<select value={collectionFilter} onChange={(event) => setCollectionFilter(event.target.value)}><option value="all">All collections</option>{knowledge.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>
              <label className="favoriteFilter"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} /> Favorites only</label>
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
                onOpen={() => navigation.openReader(selectedBook.id)}
                collections={knowledge.collections}
                onOrganize={async (changes, collectionIds) => {
                  setWorking(true)
                  clearMessages()
                  try {
                    const updated = await knowledgeService.updateBookOrganization(selectedBook.id, changes)
                    for (const collection of knowledge.collections) await knowledgeService.setBookInCollection(collection.id, selectedBook.id, collectionIds.includes(collection.id))
                    const nextBooks = books.map((book) => book.id === updated.id ? { ...updated, progress: book.progress } : book)
                    setBooks(nextBooks)
                    await refreshKnowledge(nextBooks)
                    setNotice('Book organization saved locally.')
                  } catch (cause) { setError(messageFor(cause)) } finally { setWorking(false) }
                }}
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
        <CollectionsManager collections={knowledge.collections} service={knowledgeService} onRefresh={() => refreshKnowledge()} onError={(cause) => setError(messageFor(cause))} onNotice={setNotice} />
        </>}
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

function BookDetails({ book, collections, disabled, onSave, onDelete, onOpen, onOrganize }) {
  return (
    <div className="detailsForm">
      <div className="detailTitle">
        <span className="formatBadge">{book.format}</span>
        <div>
          <h2>{book.title}</h2>
          <p>{book.originalFilename}</p>
        </div>
      </div>
      <form onSubmit={onSave}><label>Title<input name="title" defaultValue={book.title} required /></label>
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
      <div className="detailActions"><button className="primaryButton" disabled={disabled} onClick={onOpen} type="button">Open book</button>
        <button className="primaryButton" disabled={disabled} type="submit">Save details</button>
        <button className="dangerButton" disabled={disabled} onClick={onDelete} type="button">
          Delete local book
        </button>
      </div>
      <small className="deleteNote">Deleting also removes this book's local progress, annotations, activity, and collection membership.</small>
      </form>
      <form className="organizationForm" onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        void onOrganize({ readingStatus: form.get('readingStatus'), favorite: form.get('favorite') === 'on' }, form.getAll('collections'))
      }}><h3>Organization</h3><label>Reading status<select name="readingStatus" defaultValue={book.readingStatus}><option value={READING_STATUSES.WANT_TO_READ}>Want to Read</option><option value={READING_STATUSES.CURRENTLY_READING}>Currently Reading</option><option value={READING_STATUSES.COMPLETED}>Completed</option><option value={READING_STATUSES.DROPPED}>Dropped</option></select></label><label className="checkLabel"><input name="favorite" type="checkbox" defaultChecked={book.favorite} /> Favorite</label>{collections.length > 0 && <fieldset><legend>Collections</legend>{collections.map((collection) => <label className="checkLabel" key={collection.id}><input name="collections" type="checkbox" value={collection.id} defaultChecked={collection.bookIds.includes(book.id)} /> {collection.name}</label>)}</fieldset>}<button className="secondaryButton" disabled={disabled} type="submit">Save organization</button></form>
    </div>
  )
}

function CollectionsManager({ collections, service, onRefresh, onError, onNotice }) {
  async function run(action, message) { try { await action(); await onRefresh(); onNotice(message) } catch (cause) { onError(cause) } }
  return <section className="collectionsPanel"><div><p className="eyebrow">Shelves</p><h2>Collections</h2><p>Deleting a collection never deletes its books.</p></div><form onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const name = new FormData(form).get('name'); void run(() => service.createCollection(name), 'Collection created locally.').then(() => form.reset()) }}><input name="name" aria-label="New collection name" placeholder="New collection" required /><button type="submit">Create</button></form><ul>{collections.map((collection) => <li key={collection.id}><form onSubmit={(event) => { event.preventDefault(); void run(() => service.renameCollection(collection.id, new FormData(event.currentTarget).get('name')), 'Collection renamed.') }}><input name="name" aria-label={`Rename ${collection.name}`} defaultValue={collection.name} required /><span>{collection.bookIds.length} books</span><button type="submit">Rename</button><button className="dangerText" type="button" onClick={() => void run(() => service.deleteCollection(collection.id), 'Collection deleted; its books remain in the library.')}>Delete</button></form></li>)}</ul></section>
}

function emptyStatistics() {
  return { completedBooks: 0, totalReadingTimeMs: 0, pdfPagesVisitedEstimate: 0, epubLocationChanges: 0, activeDays: 0, currentStreakDays: 0, monthlyActivity: [] }
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
