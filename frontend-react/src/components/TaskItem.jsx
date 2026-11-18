import { useState } from 'react'
import TaskForm from './TaskForm'

export default function TaskItem({ task, onUpdateTask, onDeleteTask }) {
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function runAction(action) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err.message || 'Could not update this task. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <li className="task-item task-item-editing">
        <TaskForm
          initialTask={task}
          onSave={async changes => {
            await onUpdateTask(task.id, changes)
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className={`task-item${task.done ? ' is-done' : ''}`} aria-busy={busy}>
      <div className="task-row">
      <label className="task-check">
        <input
          type="checkbox"
          checked={task.done}
          disabled={busy}
          onChange={event => {
            const done = event.target.checked
            runAction(() => onUpdateTask(task.id, { done }))
          }}
        />{' '}
        <span className="task-title">
          {task.title}
        </span>
      </label>
      <span className={`status-badge${task.done ? ' status-done' : ''}`}>
        {task.done ? 'Done' : 'Open'}
      </span>
      </div>
      <div className="task-actions">
      <button
        className="button-secondary"
        type="button"
        disabled={busy}
        aria-label={`Edit task: ${task.title}`}
        onClick={() => {
          setError('')
          setEditing(true)
        }}
      >
        Edit
      </button>{' '}
      <button
        className="button-danger"
        type="button"
        disabled={busy}
        aria-label={`Delete task: ${task.title}`}
        onClick={() => runAction(() => onDeleteTask(task.id))}
      >
        Delete
      </button>
      </div>
      {task.description && <p className="task-description">{task.description}</p>}
      {task.dueDate && <p className="task-meta">Due <time dateTime={task.dueDate}>{task.dueDate}</time></p>}
      {task.tags?.length > 0 && (
        <ul className="tag-list" aria-label="Tags">
          {task.tags.map((tag, index) => <li className="tag" key={`${tag}-${index}`}>{tag}</li>)}
        </ul>
      )}
      {error && <p role="alert">{error}</p>}
    </li>
  )
}
