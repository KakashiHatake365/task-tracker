export default function FilterBar({ status, tag, search, onStatusChange, onTagChange, onSearchChange }) {
  return (
    <fieldset className="filter-bar card">
      <legend>Filter tasks</legend>
      <div className="filter-field search-field">
        <label htmlFor="task-search">Search tasks</label>
        <input
          id="task-search"
          type="search"
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Search titles or descriptions"
        />
      </div>
      <div className="filter-field">
      <label htmlFor="status-filter">Status</label>
      <select
        id="status-filter"
        value={status}
        onChange={event => onStatusChange(event.target.value)}
      >
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="done">Done</option>
      </select>
      </div>
      <div className="filter-field">
      <label htmlFor="tag-filter">Tag</label>
      <input
        id="tag-filter"
        value={tag}
        onChange={event => onTagChange(event.target.value)}
        placeholder="e.g. work"
      />
      </div>
      <button
        className="button-secondary"
        type="button"
        onClick={() => {
          onStatusChange('all')
          onTagChange('')
          onSearchChange('')
        }}
      >
        Clear filters
      </button>
    </fieldset>
  )
}
