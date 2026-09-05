import { useEffect, useMemo, useRef, useState } from 'react'
import './ReaderRoute.css'

export default function ReaderRoute({ bookId, readerService, navigation }) {
  const stageRef = useRef(null)
  const [session, setSession] = useState(null)
  const [readerState, setReaderState] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [sidebar, setSidebar] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    let openedEngine = null

    async function openReader() {
      setError(null)
      try {
        const nextSession = await readerService.open(bookId)
        openedEngine = nextSession.engine
        if (!active) {
          await openedEngine.close()
          return
        }
        unsubscribe = openedEngine.subscribe((event) => {
          if (!active) return
          if (event.type === 'state') setReaderState(event.state)
          if (event.type === 'location') {
            setReaderState((current) => ({ ...current, locator: event.locator }))
          }
          if (event.type === 'selection') setNotice(`Selected ${event.text.length} characters locally.`)
          if (event.type === 'external-link') setNotice('External publication links are blocked from opening automatically.')
          if (event.type === 'error') setError(messageFor(event.error))
        })
        setSession(nextSession)
        setReaderState(openedEngine.getState())
        await openedEngine.attach(stageRef.current)
      } catch (cause) {
        if (active) {
          unsubscribe()
          await openedEngine?.close()
          setSession(null)
          setError(messageFor(cause))
        }
      }
    }

    void openReader()
    return () => {
      active = false
      unsubscribe()
      void openedEngine?.close()
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

  const toc = useMemo(() => session?.engine.getTableOfContents() || [], [session])
  const format = session?.book.format
  const locator = readerState?.locator
  const progression = Number.isFinite(locator?.progression)
    ? Math.round(locator.progression * 100)
    : null

  async function runAction(action) {
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(messageFor(cause))
    }
  }

  async function search(event) {
    event.preventDefault()
    if (!searchQuery.trim() || !session) return
    setSearching(true)
    setError(null)
    try {
      setSearchResults(await session.engine.search(searchQuery))
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

  return (
    <div className={`readerShell ${format ? `readerFormat-${format}` : ''}`}>
      <header className="readerHeader">
        <button className="readerBack" type="button" onClick={navigation.openLibrary}>
          ← Library
        </button>
        <div className="readerIdentity">
          <strong>{session?.book.title || 'Opening local book…'}</strong>
          <span>{session?.book.author || session?.book.originalFilename || 'Preparing reader'}</span>
        </div>
        <div className="readerHeaderActions">
          <button type="button" onClick={() => setSidebar(sidebar === 'toc' ? null : 'toc')} disabled={!toc.length}>
            Contents
          </button>
          <button type="button" onClick={() => setSidebar(sidebar === 'search' ? null : 'search')} disabled={!session}>
            Search
          </button>
          <span className="readerProgress" aria-live="polite">
            {progression === null ? '—' : `${progression}%`}
          </span>
        </div>
      </header>

      <div className="readerWorkspace">
        {sidebar && (
          <aside className="readerSidebar" aria-label={sidebar === 'toc' ? 'Table of contents' : 'Search book'}>
            <div className="readerSidebarHeading">
              <h2>{sidebar === 'toc' ? 'Contents' : 'Search book'}</h2>
              <button type="button" onClick={() => setSidebar(null)} aria-label="Close side panel">×</button>
            </div>
            {sidebar === 'toc' ? (
              <TocList items={toc} onSelect={(target) => {
                void runAction(() => session.engine.goTo(target))
                setSidebar(null)
              }} />
            ) : (
              <div>
                <form className="readerSearch" onSubmit={search}>
                  <label htmlFor="book-search">Find text in this book</label>
                  <div><input id="book-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /><button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Find'}</button></div>
                </form>
                <SearchResults results={searchResults} onSelect={(result) => {
                  void runAction(() => session.engine.goTo(result.locator))
                  setSidebar(null)
                }} />
              </div>
            )}
          </aside>
        )}

        <main className="readerMain">
          {error && <div className="readerMessage readerError" role="alert"><strong>Reader could not complete that action</strong><span>{error}</span></div>}
          {notice && <div className="readerMessage" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)}>Dismiss</button></div>}
          {!session && !error && <div className="readerLoading" role="status">Opening the private local copy…</div>}
          <div ref={stageRef} className="readerStage" aria-label="Book content" />
        </main>
      </div>

      <footer className="readerControls" aria-label="Reader controls">
        <button type="button" onClick={() => void runAction(() => session.engine.previous())} disabled={!session}>Previous</button>
        {format === 'pdf' && (
          <>
            <form className="pageJump" onSubmit={jumpToPage}>
              <label htmlFor="page-number">Page</label>
              <input key={readerState?.page} id="page-number" name="page" type="number" min="1" max={readerState?.pageCount} defaultValue={readerState?.page || 1} />
              <span>of {readerState?.pageCount || '—'}</span>
            </form>
            <label className="compactControl">View
              <select value={readerState?.preferences?.fit || 'fit-width'} onChange={(event) => void runAction(() => session.engine.setViewPreferences({ fit: event.target.value }))}>
                <option value="fit-width">Fit width</option>
                <option value="fit-page">Fit page</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <button type="button" onClick={() => void runAction(() => session.engine.setViewPreferences({ fit: 'custom', zoom: (readerState?.preferences?.zoom || 1) - 0.1 }))}>−</button>
            <span>{readerState?.preferences?.fit === 'custom' ? `${Math.round((readerState?.preferences?.zoom || 1) * 100)}%` : 'Auto'}</span>
            <button type="button" onClick={() => void runAction(() => session.engine.setViewPreferences({ fit: 'custom', zoom: (readerState?.preferences?.zoom || 1) + 0.1 }))}>+</button>
            <button type="button" onClick={() => void runAction(() => session.engine.setViewPreferences({ rotation: (readerState?.preferences?.rotation || 0) + 90 }))}>Rotate</button>
          </>
        )}
        {format === 'epub' && (
          <label className="compactControl">Flow
            <select value={readerState?.preferences?.flow || 'paginated'} onChange={(event) => void runAction(() => session.engine.setViewPreferences({ flow: event.target.value }))}>
              <option value="paginated">Paginated</option>
              <option value="scrolled">Scrolling</option>
            </select>
          </label>
        )}
        <button type="button" onClick={() => void runAction(() => session.engine.next())} disabled={!session}>Next</button>
      </footer>
    </div>
  )
}

function TocList({ items, onSelect }) {
  if (!items.length) return <p className="readerEmpty">This publication has no table of contents.</p>
  return (
    <ul className="tocList">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`}>
          {(item.locator || item.target) ? (
            <button type="button" onClick={() => onSelect(item.locator || item.target)}>{item.label}</button>
          ) : <span>{item.label}</span>}
          {item.children?.length > 0 && <TocList items={item.children} onSelect={onSelect} />}
        </li>
      ))}
    </ul>
  )
}

function SearchResults({ results, onSelect }) {
  if (!results.length) return <p className="readerEmpty">Search results will stay on this device.</p>
  return (
    <ol className="searchResults">
      {results.map((result, index) => (
        <li key={`${result.label}-${index}`}>
          <button type="button" onClick={() => onSelect(result)}>
            <strong>{result.label}</strong><span>{result.excerpt}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

function messageFor(error) {
  return error instanceof Error ? error.message : 'The local reader encountered an unexpected error.'
}
