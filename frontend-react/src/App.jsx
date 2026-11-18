import { useCallback, useEffect, useRef, useState } from 'react'
import TaskList from './components/TaskList'
import TaskForm from './components/TaskForm'
import FilterBar from './components/FilterBar'
import LoginForm from './components/LoginForm'
import SignupForm from './components/SignupForm'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')

async function taskRequest(path, options, token) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Could not reach the backend. Please try again.', { cause: error })
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error(data.error || 'Could not update tasks. Please try again.')
    error.status = response.status
    throw error
  }
  // DELETE succeeds with an empty response body.
  return response.status === 204 ? null : response.json()
}

export default function App() {
  const [token, setToken] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('all')
  const [tag, setTag] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [showSignup, setShowSignup] = useState(false)
  // Ignore responses from requests belonging to a previous login.
  const sessionVersion = useRef(0)

  const handleLogout = useCallback((message = '') => {
    sessionVersion.current += 1
    setToken('')
    setTasks([])
    setStatus('all')
    setTag('')
    setError('')
    setLoading(true)
    setAuthMessage(message)
    setShowSignup(false)
  }, [])

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    const version = sessionVersion.current

    async function loadTasks() {
      try {
        const data = await taskRequest('/api/tasks', {
          signal: controller.signal,
        }, token)
        if (!controller.signal.aborted && version === sessionVersion.current) {
          setTasks(data)
        }
      } catch (err) {
        if (controller.signal.aborted || version !== sessionVersion.current) return
        if (err.status === 401) {
          handleLogout('Your session expired or is no longer valid. Please log in again.')
        } else if (err.name !== 'AbortError') {
          setError(err.message)
        }
      } finally {
        if (!controller.signal.aborted && version === sessionVersion.current) {
          setLoading(false)
        }
      }
    }

    loadTasks()

    return () => controller.abort()
  }, [token, handleLogout])

  async function authenticatedRequest(path, options) {
    const version = sessionVersion.current
    try {
      const data = await taskRequest(path, options, token)
      if (version !== sessionVersion.current) {
        throw new Error('This request belongs to a previous session.')
      }
      return data
    } catch (error) {
      if (error.status === 401 && version === sessionVersion.current) {
        handleLogout('Your session expired or is no longer valid. Please log in again.')
      }
      throw error
    }
  }

  async function addTask(task) {
    const createdTask = await authenticatedRequest('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    })
    setTasks(currentTasks => [...currentTasks, createdTask])
  }

  async function updateTask(id, changes) {
    const updatedTask = await authenticatedRequest(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    })
    setTasks(currentTasks => currentTasks.map(task => task.id === id ? updatedTask : task))
  }

  async function deleteTask(id) {
    await authenticatedRequest(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
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

  async function handleLogin(credentials) {
    let response

    try {
      response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
    } catch {
      throw new Error('Could not reach the backend.')
    }

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.error || 'Could not log in.')
    }

    if (typeof data.token !== 'string' || !data.token) {
      throw new Error('The server did not return a login token.')
    }

    setTasks([])
    sessionVersion.current += 1
    setAuthMessage('')
    setError('')
    setStatus('all')
    setTag('')
    setLoading(true)
    setToken(data.token)
  }

  async function handleSignup(credentials) {
    let response
    try {
      response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })
    } catch {
      throw new Error('Could not reach the backend.')
    }

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || 'Could not create your account.')
    }

    setShowSignup(false)
    setAuthMessage('Account created. Log in with your email and password.')
  }

  if (!token) {
    return (
      <main>
        <h1>Task Tracker</h1>
        {authMessage && <p role="status">{authMessage}</p>}
        {showSignup ? (
          <SignupForm
            onSignup={handleSignup}
            onShowLogin={() => {
              setShowSignup(false)
              setAuthMessage('')
            }}
          />
        ) : (
          <LoginForm
            onLogin={handleLogin}
            onShowSignup={() => {
              setShowSignup(true)
              setAuthMessage('')
            }}
          />
        )}
      </main>
    )
  }

  return (
    <main>
      <h1>Task Tracker</h1>
      <button type="button" onClick={() => handleLogout()}>Log out</button>

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
