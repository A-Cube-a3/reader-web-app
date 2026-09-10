import { useEffect, useMemo, useRef, useState } from 'react'
import './ReaderRoute.css'

const EMPTY_TOOLS = { bookmarks: [], highlights: [], notes: [], preferences: {}, restoreWarning: null }

export default function ReaderRoute({ bookId, readerService, navigation }) {
  const stageRef = useRef(null)
  const [session, setSession] = useState(null)
  const [readerState, setReaderState] = useState(null)
  const [toolsState, setToolsState] = useState(EMPTY_TOOLS)
  const [selection, setSelection] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [sidebar, setSidebar] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let active = true
    let unsubscribeEngine = () => {}
    let unsubscribeTools = () => {}
    let openedSession = null

    async function openReader() {
      setError(null)
      setSelection(null)
      setToolsState(EMPTY_TOOLS)
      try {
        const nextSession = await readerService.open(bookId)
        openedSession = nextSession
        if (!active) {
          await closeSession(nextSession)
          return
        }
        unsubscribeEngine = nextSession.engine.subscribe((event) => {
          if (!active) return
          if (event.type === 'state') setReaderState(event.state)
          if (event.type === 'location') setReaderState((current) => ({ ...current, locator: event.locator }))
          if (event.type === 'selection') setSelection({ locator: event.locator, text: event.text })
          if (event.type === 'external-link') setNotice('External publication links are blocked from opening automatically.')
          if (event.type === 'error') setError(messageFor(event.error))
        })
        if (nextSession.tools) {
          setToolsState(nextSession.tools.getState())
          unsubscribeTools = nextSession.tools.subscribe((event) => {
            if (!active) return
            if (event.type === 'change') setToolsState(event.state)
            if (event.type === 'error') setError(messageFor(event.error))
          })
        }
        setSession(nextSession)
        setReaderState(nextSession.engine.getState())
        await nextSession.engine.attach(stageRef.current)
      } catch (cause) {
        if (active) {
          unsubscribeEngine()
          unsubscribeTools()
          await closeSession(openedSession)
          setSession(null)
          setError(messageFor(cause))
        }
      }
    }

    void openReader()
    return () => {
      active = false
      unsubscribeEngine()
      unsubscribeTools()
      void closeSession(openedSession)
    }
  }, [bookId, readerService])

  useEffect(() => {
    function onKeyDown(event) {
      if (!session || event.altKey || event.ctrlKey || event.metaKey) return
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(event.target?.tagName)) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault()
        void runAction(() => session.engine.next())
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        void runAction(() => session.engine.previous())
      }
      if (event.key === 'Escape') navigation.openLibrary()
    }
    globalThis.window?.addEventListener('keydown', onKeyDown)
    return () => globalThis.window?.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    const restoreWarning = toolsState.restoreWarning || readerState?.restoreWarning || readerState?.annotationWarning
    if (restoreWarning) setNotice(restoreWarning)
  }, [readerState?.annotationWarning, readerState?.restoreWarning, toolsState.restoreWarning])

  const toc = useMemo(() => session?.engine.getTableOfContents() || [], [session])
  const format = session?.book.format
  const locator = readerState?.locator
  const preferences = { ...readerState?.preferences, ...toolsState.preferences }
  const progression = Number.isFinite(locator?.progression) ? Math.round(locator.progression * 100) : null

  async function runAction(action, successMessage = null) {
    setError(null)
    try {
      const result = await action()
      if (successMessage) setNotice(successMessage)
      return result
    } catch (cause) {
      setError(messageFor(cause))
      return null
    }
  }

  async function search(event) {
    event.preventDefault()
    if (!searchQuery.trim() || !session) return
    setSearching(true)
    setError(null)
    try {
      const [bookResults, annotationResults] = await Promise.all([
        session.engine.search(searchQuery),
        Promise.resolve(session.tools?.searchAnnotations(searchQuery) || []),
      ])
      setSearchResults([
        ...bookResults.map((result) => ({ ...result, source: 'book' })),
        ...annotationResults.map((result) => ({ ...result, source: result.type })),
      ])
      setSidebar('search')
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setSearching(false)
    }
  }

  async function jumpToPage(event) {
    event.preventDefault()
    const page = Number(new FormData(event.currentTarget).get('page'))
    await runAction(() => session.engine.goTo(page))
  }

  function updatePreferences(changes) {
    return runAction(() => session.tools
      ? session.tools.updatePreferences(changes)
      : session.engine.setViewPreferences(changes))
  }

  function jumpToRecord(record) {
    return runAction(() => session.tools ? session.tools.jumpTo(record) : session.engine.goTo(record.locator))
  }

  return (
    <div className={`readerShell ${format ? `readerFormat-${format}` : ''} readerTheme-${preferences.theme || 'dark'}`}>
      <header className="readerHeader">
        <button className="readerBack" type="button" onClick={navigation.openLibrary}>← Library</button>
        <div className="readerIdentity">
          <strong>{session?.book.title || 'Opening local book…'}</strong>
          <span>{session?.book.author || session?.book.originalFilename || 'Preparing reader'}</span>
        </div>
        <div className="readerHeaderActions">
          <button type="button" onClick={() => setSidebar(sidebar === 'toc' ? null : 'toc')} disabled={!toc.length}>Contents</button>
          <button type="button" onClick={() => setSidebar(sidebar === 'search' ? null : 'search')} disabled={!session}>Search</button>
          {session?.tools && <button type="button" onClick={() => setSidebar(sidebar === 'tools' ? null : 'tools')}>Reading tools</button>}
          {session?.tools && <button type="button" onClick={() => setSidebar(sidebar === 'preferences' ? null : 'preferences')}>Preferences</button>}
          {session?.tools && <button type="button" onClick={() => void runAction(() => session.tools.addBookmark(), 'Bookmark saved locally.')}>Bookmark</button>}
          <span className="readerProgress" aria-live="polite">{progression === null ? '—' : `${progression}%`}</span>
        </div>
      </header>

      <div className="readerWorkspace">
        {sidebar && <aside className="readerSidebar" aria-label={sidebarLabel(sidebar)}>
          <div className="readerSidebarHeading"><h2>{sidebarTitle(sidebar)}</h2><button type="button" onClick={() => setSidebar(null)} aria-label="Close side panel">×</button></div>
          {sidebar === 'toc' && <TocList items={toc} onSelect={(target) => {
            void runAction(() => session.engine.goTo(target))
            setSidebar(null)
          }} />}
          {sidebar === 'search' && <SearchPanel query={searchQuery} results={searchResults} searching={searching} onQuery={setSearchQuery} onSearch={search} onSelect={(result) => {
            void (result.source === 'book' ? runAction(() => session.engine.goTo(result.locator)) : jumpToRecord(result))
            setSidebar(null)
          }} />}
          {sidebar === 'tools' && <ReadingToolsPanel state={toolsState} tools={session.tools} currentLocator={locator} onRun={runAction} onJump={jumpToRecord} />}
          {sidebar === 'preferences' && <PreferencesPanel format={format} preferences={preferences} onChange={updatePreferences} />}
        </aside>}

        <main className="readerMain">
          {error && <div className="readerMessage readerError" role="alert"><strong>Reader could not complete that action</strong><span>{error}</span></div>}
          {notice && <div className="readerMessage" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>Dismiss</button></div>}
          {selection && session?.tools && <SelectionTools selection={selection} tools={session.tools} onRun={runAction} onClose={() => setSelection(null)} />}
          {!session && !error && <div className="readerLoading" role="status">Opening the private local copy…</div>}
          <div ref={stageRef} className="readerStage" aria-label="Book content" />
        </main>
      </div>

      <footer className="readerControls" aria-label="Reader controls">
        <button type="button" onClick={() => void runAction(() => session.engine.previous())} disabled={!session}>Previous</button>
        {format === 'pdf' && <>
          <form className="pageJump" onSubmit={jumpToPage}><label htmlFor="page-number">Page</label><input key={readerState?.page} id="page-number" name="page" type="number" min="1" max={readerState?.pageCount} defaultValue={readerState?.page || 1} /><span>of {readerState?.pageCount || '—'}</span></form>
          <label className="compactControl">View <select value={preferences.fit || 'fit-width'} onChange={(event) => void updatePreferences({ fit: event.target.value })}><option value="fit-width">Fit width</option><option value="fit-page">Fit page</option><option value="custom">Custom</option></select></label>
          <button type="button" onClick={() => void updatePreferences({ fit: 'custom', zoom: (preferences.zoom || 1) - 0.1 })}>−</button>
          <span>{preferences.fit === 'custom' ? `${Math.round((preferences.zoom || 1) * 100)}%` : 'Auto'}</span>
          <button type="button" onClick={() => void updatePreferences({ fit: 'custom', zoom: (preferences.zoom || 1) + 0.1 })}>+</button>
          <button type="button" onClick={() => void updatePreferences({ rotation: (preferences.rotation || 0) + 90 })}>Rotate</button>
        </>}
        {format === 'epub' && <label className="compactControl">Flow <select value={preferences.flow || 'paginated'} onChange={(event) => void updatePreferences({ flow: event.target.value })}><option value="paginated">Paginated</option><option value="scrolled">Scrolling</option></select></label>}
        <button type="button" onClick={() => void runAction(() => session.engine.next())} disabled={!session}>Next</button>
      </footer>
    </div>
  )
}

function TocList({ items, onSelect }) {
  if (!items.length) return <p className="readerEmpty">This publication has no table of contents.</p>
  return <ul className="tocList">{items.map((item, index) => <li key={`${item.label}-${index}`}>
    {(item.locator || item.target) ? <button type="button" onClick={() => onSelect(item.locator || item.target)}>{item.label}</button> : <span>{item.label}</span>}
    {item.children?.length > 0 && <TocList items={item.children} onSelect={onSelect} />}
  </li>)}</ul>
}

function SearchPanel({ query, results, searching, onQuery, onSearch, onSelect }) {
  return <div><form className="readerSearch" onSubmit={onSearch}><label htmlFor="book-search">Find book text, notes, and highlights</label><div><input id="book-search" type="search" value={query} onChange={(event) => onQuery(event.target.value)} /><button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Find'}</button></div></form><SearchResults results={results} onSelect={onSelect} /></div>
}

function SearchResults({ results, onSelect }) {
  if (!results.length) return <p className="readerEmpty">Search results stay on this device.</p>
  return <ol className="searchResults">{results.map((result, index) => <li key={`${result.source}-${result.id || result.label}-${index}`}>{result.locator
    ? <button type="button" onClick={() => onSelect(result)}><SearchResultContent result={result} /></button>
    : <div className="searchResultWithoutLocation"><SearchResultContent result={result} /><span>Book-level note · no source location</span></div>}
  </li>)}</ol>
}

function SearchResultContent({ result }) {
  return <><small>{result.source === 'book' ? 'Book text' : result.source}</small><strong>{result.label}</strong>{result.excerpt && <span>{result.excerpt}</span>}</>
}

function SelectionTools({ selection, tools, onRun, onClose }) {
  const [color, setColor] = useState('yellow')
  const [note, setNote] = useState('')
  async function highlight() {
    const saved = await onRun(() => tools.addHighlight(selection, color), 'Highlight saved locally.')
    if (saved) onClose()
  }
  async function highlightAndNote(event) {
    event.preventDefault()
    const saved = await onRun(async () => {
      const highlightRecord = await tools.addHighlight(selection, color)
      return tools.addNote({ body: note, highlightId: highlightRecord.id })
    }, 'Highlight and note saved locally.')
    if (saved) onClose()
  }
  return <section className="selectionTools" aria-label="Selected text actions"><div><strong>Selected text</strong><button type="button" onClick={onClose} aria-label="Close selected text actions">×</button></div><blockquote>{selection.text}</blockquote><label>Highlight color <select value={color} onChange={(event) => setColor(event.target.value)}><option value="yellow">Yellow</option><option value="green">Green</option><option value="blue">Blue</option><option value="pink">Pink</option></select></label><button type="button" onClick={() => void highlight()}>Save highlight</button><form onSubmit={highlightAndNote}><label htmlFor="selection-note">Note about this highlight</label><textarea id="selection-note" value={note} onChange={(event) => setNote(event.target.value)} required /><button type="submit">Save highlight + note</button></form></section>
}

function ReadingToolsPanel({ state, tools, currentLocator, onRun, onJump }) {
  const [bookNote, setBookNote] = useState('')
  const [anchorBookNote, setAnchorBookNote] = useState(false)
  return <div className="readingToolsPanel"><section><div className="toolSectionHeading"><h3>Bookmarks</h3><button type="button" onClick={() => void onRun(() => tools.addBookmark(), 'Bookmark saved locally.')}>Add current</button></div><RecordList records={state.bookmarks} empty="No bookmarks yet." onJump={onJump} onDelete={(id) => onRun(() => tools.deleteBookmark(id))} label={(item) => item.label} /></section><section><h3>Highlights</h3><RecordList records={state.highlights} empty="Select book text to create a highlight." onJump={onJump} onDelete={(id) => onRun(() => tools.deleteHighlight(id))} label={(item) => item.quote.exact} /></section><section><h3>Notes</h3>{state.notes.length ? <ul className="toolRecords">{state.notes.map((note) => <NoteCard key={note.id} note={note} tools={tools} onRun={onRun} onJump={onJump} />)}</ul> : <p className="readerEmpty">No notes yet.</p>}<form className="toolForm" onSubmit={(event) => {
    event.preventDefault()
    void onRun(() => tools.addNote({ body: bookNote, locator: anchorBookNote ? currentLocator : null }), 'Note saved locally.').then((saved) => { if (saved) setBookNote('') })
  }}><label htmlFor="book-note">New book note</label><textarea id="book-note" value={bookNote} onChange={(event) => setBookNote(event.target.value)} required /><label className="checkControl"><input type="checkbox" checked={anchorBookNote} onChange={(event) => setAnchorBookNote(event.target.checked)} /> Attach current reading location</label><button type="submit">Save note</button></form></section></div>
}

function RecordList({ records, empty, onJump, onDelete, label }) {
  if (!records.length) return <p className="readerEmpty">{empty}</p>
  return <ul className="toolRecords">{records.map((record) => <li key={record.id}><button className="recordJump" type="button" onClick={() => void onJump(record)}>{label(record)}</button><button className="recordDelete" type="button" onClick={() => void onDelete(record.id)} aria-label={`Delete ${label(record)}`}>Delete</button></li>)}</ul>
}

function NoteCard({ note, tools, onRun, onJump }) {
  const [body, setBody] = useState(note.body)
  return <li className="noteCard"><textarea aria-label="Note text" value={body} onChange={(event) => setBody(event.target.value)} /><div>{note.locator && <button type="button" onClick={() => void onJump(note)}>Jump</button>}<button type="button" disabled={body === note.body} onClick={() => void onRun(() => tools.updateNote(note.id, body), 'Note updated locally.')}>Save</button><button type="button" onClick={() => void onRun(() => tools.deleteNote(note.id))}>Delete</button></div></li>
}

function PreferencesPanel({ format, preferences, onChange }) {
  return <form className="preferencesPanel" onSubmit={(event) => event.preventDefault()}>{format === 'epub' ? <>
    <label>Font size <output>{preferences.fontSize || 100}%</output><input type="range" min="70" max="200" step="5" value={preferences.fontSize || 100} onChange={(event) => void onChange({ fontSize: Number(event.target.value) })} /></label>
    <label>Font family <select value={preferences.fontFamily || 'serif'} onChange={(event) => void onChange({ fontFamily: event.target.value })}><option value="serif">Serif</option><option value="sans-serif">Sans serif</option></select></label>
    <label>Line spacing <input type="range" min="1.1" max="2.2" step="0.1" value={preferences.lineHeight || 1.5} onChange={(event) => void onChange({ lineHeight: Number(event.target.value) })} /></label>
    <label>Content width <output>{preferences.contentWidth || 720}px</output><input type="range" min="420" max="1100" step="20" value={preferences.contentWidth || 720} onChange={(event) => void onChange({ contentWidth: Number(event.target.value) })} /></label>
    <label>Theme <select value={preferences.theme || 'paper'} onChange={(event) => void onChange({ theme: event.target.value })}><option value="paper">Paper</option><option value="sepia">Sepia</option><option value="night">Night</option></select></label>
    <label>Reading flow <select value={preferences.flow || 'paginated'} onChange={(event) => void onChange({ flow: event.target.value })}><option value="paginated">Paginated</option><option value="scrolled">Scrolling</option></select></label>
  </> : <><p>PDF controls affect page presentation, not the type embedded in the document.</p><label>Reader surround <select value={preferences.theme || 'dark'} onChange={(event) => void onChange({ theme: event.target.value })}><option value="dark">Dark</option><option value="light">Light</option><option value="sepia">Sepia</option></select></label><label>Page fit <select value={preferences.fit || 'fit-width'} onChange={(event) => void onChange({ fit: event.target.value })}><option value="fit-width">Fit width</option><option value="fit-page">Fit page</option><option value="custom">Custom zoom</option></select></label><label>Zoom <output>{Math.round((preferences.zoom || 1) * 100)}%</output><input type="range" min="0.5" max="4" step="0.1" value={preferences.zoom || 1} onChange={(event) => void onChange({ fit: 'custom', zoom: Number(event.target.value) })} /></label></>}</form>
}

function sidebarTitle(sidebar) { return { toc: 'Contents', search: 'Search', tools: 'Reading tools', preferences: 'Preferences' }[sidebar] }
function sidebarLabel(sidebar) { return { toc: 'Table of contents', search: 'Search book and annotations', tools: 'Bookmarks, highlights, and notes', preferences: 'Reader preferences' }[sidebar] }
async function closeSession(session) { if (session?.close) await session.close(); else await session?.engine?.close?.() }
function messageFor(error) { return error instanceof Error ? error.message : 'The local reader encountered an unexpected error.' }
