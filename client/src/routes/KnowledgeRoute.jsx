import { useMemo, useState } from 'react'
import { downloadLocalFile } from '../platform/web/exportFile.js'

export default function KnowledgeRoute({ snapshot, service, exportService, navigation, onRefresh, onError, onNotice }) {
  const [query, setQuery] = useState('')
  const [bookId, setBookId] = useState('all')
  const [tag, setTag] = useState('all')
  const [type, setType] = useState('all')
  const [exporting, setExporting] = useState(false)
  const booksById = useMemo(() => new Map(snapshot.books.map((book) => [book.id, book])), [snapshot.books])
  const records = useMemo(() => [...snapshot.notes.map((item) => ({ ...item, type: 'note', text: item.body })), ...snapshot.highlights.map((item) => ({ ...item, type: 'highlight', text: item.quote?.exact || '' }))]
    .filter((item) => type === 'all' || item.type === type)
    .filter((item) => bookId === 'all' || item.bookId === bookId)
    .filter((item) => tag === 'all' || item.tags?.includes(tag))
    .filter((item) => `${item.text} ${(item.tags || []).join(' ')}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [bookId, query, snapshot, tag, type])

  async function run(action, message) {
    try {
      await action()
      await onRefresh()
      if (message) onNotice(message)
    } catch (error) {
      onError(error)
    }
  }

  async function exportRecords(format) {
    setExporting(true)
    try {
      const noteIds = new Set(records.filter((item) => item.type === 'note').map((item) => item.id))
      const highlightIds = new Set(records.filter((item) => item.type === 'highlight').map((item) => item.id))
      const file = await exportService.create(format, {
        books: snapshot.books,
        notes: snapshot.notes.filter((item) => noteIds.has(item.id)),
        highlights: snapshot.highlights.filter((item) => highlightIds.has(item.id)),
      })
      downloadLocalFile(file)
      onNotice(`${format === 'text' ? 'Plain text' : format.toUpperCase()} export created locally.`)
    } catch (error) {
      onError(error)
    } finally {
      setExporting(false)
    }
  }

  return <section className="workspacePanel" aria-labelledby="knowledge-heading">
    <div className="workspaceHeading"><div><p className="eyebrow">Private and offline</p><h2 id="knowledge-heading">Knowledge workspace</h2><p>Search, edit, tag, and export notes and highlights stored on this device.</p></div><div className="exportActions"><button disabled={exporting} onClick={() => void exportRecords('markdown')} type="button">Markdown</button><button disabled={exporting} onClick={() => void exportRecords('text')} type="button">Plain text</button><button disabled={exporting} onClick={() => void exportRecords('pdf')} type="button">PDF</button></div></div>
    <div className="knowledgeFilters">
      <label>Search<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label>Book<select value={bookId} onChange={(event) => setBookId(event.target.value)}><option value="all">All books</option>{snapshot.books.map((book) => <option value={book.id} key={book.id}>{book.title}</option>)}</select></label>
      <label>Type<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">Notes and highlights</option><option value="note">Notes</option><option value="highlight">Highlights</option></select></label>
      <label>Tag<select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">All tags</option>{snapshot.tags.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    <p className="resultCount">{records.length} local {records.length === 1 ? 'record' : 'records'}</p>
    {!records.length ? <div className="emptyState"><h3>No knowledge records match</h3><p>Create notes and highlights while reading, or change these filters.</p></div> : <ul className="knowledgeList">{records.map((record) => <KnowledgeCard key={`${record.type}-${record.id}-${record.updatedAt}`} record={record} book={booksById.get(record.bookId)} service={service} navigation={navigation} run={run} />)}</ul>}
  </section>
}

function KnowledgeCard({ record, book, service, navigation, run }) {
  const [body, setBody] = useState(record.text)
  const [tags, setTags] = useState((record.tags || []).join(', '))
  const tagValues = () => tags.split(',').map((item) => item.trim()).filter(Boolean)
  return <li className="knowledgeCard">
    <div className="knowledgeCardHeader"><div><span className="recordType">{record.type}</span><strong>{book?.title || 'Unknown book'}</strong></div><small>{formatDate(record.updatedAt)}</small></div>
    {record.type === 'note' ? <textarea aria-label={`Edit note from ${book?.title || 'unknown book'}`} value={body} onChange={(event) => setBody(event.target.value)} rows="4" /> : <blockquote>{record.text}</blockquote>}
    <label className="tagEditor">Tags, separated by commas<input value={tags} onChange={(event) => setTags(event.target.value)} /></label>
    <div className="knowledgeCardActions">
      {record.type === 'note' && <button type="button" onClick={() => void run(() => service.updateNote(record.id, body), 'Note updated locally.')}>Save note</button>}
      <button type="button" onClick={() => void run(() => service.updateTags(record.type, record.id, tagValues()), 'Tags updated locally.')}>Save tags</button>
      {record.locator && <button type="button" onClick={() => navigation.openReader(record.bookId, record.locator)}>Open source</button>}
      <button className="dangerText" type="button" onClick={() => void run(() => record.type === 'note' ? service.deleteNote(record.id) : service.deleteHighlight(record.id), `${record.type === 'note' ? 'Note' : 'Highlight'} deleted.`)}>Delete</button>
    </div>
  </li>
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}
