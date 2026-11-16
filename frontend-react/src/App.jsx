import { useEffect, useState } from 'react'
import TaskList from './components/TaskList'
import TaskForm from './components/TaskForm'
import FilterBar from './components/FilterBar'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')

async function taskRequest(path, options) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, options)
  } catch {
    throw new Error('Could not reach the backend. Please try again.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Could not update tasks. Please try again.')
  }
  // DELETE succeeds with an empty response body.
  return response.status === 204 ? null : response.json()
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('all')
  const [tag, setTag] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadTasks() {
      try {
        const response = await fetch(`${API_URL}/api/tasks`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Could not load tasks.')
        }

        const data = await response.json()
        if (!controller.signal.aborted) setTasks(data)
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('Could not load tasks. Check that your backend is running.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadTasks()

    return () => controller.abort()
  }, [])

  async function addTask(task) {
    let response
    try {
      response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      })
    } catch {
      throw new Error('Could not reach the backend. Please try again.')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Could not save the task.')
    }

    const createdTask = await response.json()
    setTasks(currentTasks => [...currentTasks, createdTask])
  }

  async function updateTask(id, changes) {
    const updatedTask = await taskRequest(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    setTasks(currentTasks => currentTasks.map(task => task.id === id ? updatedTask : task))
  }

  async function deleteTask(id) {
    await taskRequest(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
    setTasks(currentTasks => currentTasks.filter(task => task.id !== id))
  }

  // Keep the full list in state and derive the visible list from the filters.
  const selectedTag = tag.trim()
  const visibleTasks = tasks.filter(task => {
    const matchesStatus = status === 'all' ||
      (status === 'done' ? task.done === true : task.done === false)
    const matchesTag = !selectedTag || (task.tags ?? []).includes(selectedTag)
    return matchesStatus && matchesTag
  })

  return (
    <main>
      <h1>Task Tracker</h1>

      <TaskForm onSave={addTask} disabled={loading || Boolean(error)} />
      <FilterBar
        status={status}
        tag={tag}
        onStatusChange={setStatus}
        onTagChange={setTag}
      />

      {loading ? (
        <p>Loading tasks...</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <TaskList
          tasks={visibleTasks}
          isFiltered={status !== 'all' || Boolean(selectedTag)}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
        />
      )}
    </main>
  )
}
