export default function FilterBar({ status, tag, onStatusChange, onTagChange }) {
  return (
    <fieldset>
      <legend>Filter tasks</legend>
      <label htmlFor="status-filter">Status</label>{' '}
      <select
        id="status-filter"
        value={status}
        onChange={event => onStatusChange(event.target.value)}
      >
        <option value="all">All</option>
        <option value="open">Open</option>
        <option value="done">Done</option>
      </select>{' '}
      <label htmlFor="tag-filter">Tag</label>{' '}
      <input
        id="tag-filter"
        value={tag}
        onChange={event => onTagChange(event.target.value)}
        placeholder="e.g. work"
      />{' '}
      <button
        type="button"
        onClick={() => {
          onStatusChange('all')
          onTagChange('')
        }}
      >
        Clear filters
      </button>
    </fieldset>
  )
}
