import { useId, useState } from 'react'

export default function TaskForm({ onSave, initialTask = null, onCancel, disabled = false }) {
  const formId = useId()
  const [title, setTitle] = useState(initialTask?.title ?? '')
  const [description, setDescription] = useState(initialTask?.description ?? '')
  const [dueDate, setDueDate] = useState(initialTask?.dueDate ?? '')
  const [tags, setTags] = useState((initialTask?.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving || disabled) return

    if (!title.trim()) {
      setError('Please enter a task title.')
      return
    }

    setSaving(true)
    setError('')

    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        dueDate: dueDate || null,
        tags: [...new Set(tags.split(',').map(tag => tag.trim()).filter(Boolean))],
        done: initialTask?.done ?? false,
      })
      setTitle('')
      setDescription('')
      setDueDate('')
      setTags('')
    } catch (err) {
      setError(err.message || 'Could not save the task. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="task-form card" onSubmit={handleSubmit}>
      <h2>{initialTask ? 'Edit task' : 'Add a task'}</h2>
      <fieldset disabled={disabled || saving}>
        <legend>Task details</legend>
        <p>
          <label htmlFor={`${formId}-title`}>Title (required)</label>{' '}
          <input
            id={`${formId}-title`}
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </p>
        <p>
          <label htmlFor={`${formId}-description`}>Description</label>{' '}
          <textarea
            id={`${formId}-description`}
            value={description}
            onChange={event => setDescription(event.target.value)}
          />
        </p>
        <p>
          <label htmlFor={`${formId}-due-date`}>Due date</label>{' '}
          <input
            id={`${formId}-due-date`}
            type="date"
            value={dueDate}
            onChange={event => setDueDate(event.target.value)}
          />
        </p>
        <p>
          <label htmlFor={`${formId}-tags`}>Tags (separate with commas)</label>{' '}
          <input
            id={`${formId}-tags`}
            value={tags}
            onChange={event => setTags(event.target.value)}
            placeholder="work, learning"
          />
        </p>
        <button type="submit">
          {saving ? 'Saving...' : initialTask ? 'Save changes' : 'Add task'}
        </button>
        {onCancel && <button className="button-secondary" type="button" onClick={onCancel}>Cancel</button>}
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
