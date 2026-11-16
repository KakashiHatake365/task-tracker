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
      <li>
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
    <li aria-busy={busy}>
      <label>
        <input
          type="checkbox"
          checked={task.done}
          disabled={busy}
          onChange={event => {
            const done = event.target.checked
            runAction(() => onUpdateTask(task.id, { done }))
          }}
        />{' '}
        <span style={{ textDecoration: task.done ? 'line-through' : 'none' }}>
          {task.title}
        </span>
      </label>
      {' - '}{task.done ? 'Done' : 'Open'}{' '}
      <button
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
        type="button"
        disabled={busy}
        aria-label={`Delete task: ${task.title}`}
        onClick={() => runAction(() => onDeleteTask(task.id))}
      >
        Delete
      </button>
      {task.description && <p>{task.description}</p>}
      {task.dueDate && <p>Due: <time dateTime={task.dueDate}>{task.dueDate}</time></p>}
      {task.tags?.length > 0 && <p>Tags: {task.tags.join(', ')}</p>}
      {error && <p role="alert">{error}</p>}
    </li>
  )
}
