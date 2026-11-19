import { useState } from 'react'

export default function LoginForm({ onLogin, onShowSignup }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')

    try {
      await onLogin({
        email: email.trim(),
        password,
      })
      setPassword('')
    } catch (err) {
      setError(err.message || 'Could not log in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="auth-form card" onSubmit={handleSubmit}>
      <h2>Log in</h2>

      <fieldset disabled={loading}>
        <legend>Your account</legend>

        <p>
          <label htmlFor="login-email">Email</label>{' '}
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
        </p>

        <p>
          <label htmlFor="login-password">Password</label>{' '}
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
          />
        </p>

        <button type="submit">
          {loading ? 'Logging in...' : 'Log in'}
        </button>
        {' '}
        <button className="button-secondary" type="button" onClick={onShowSignup}>Create an account</button>
      </fieldset>

      {error && <p role="alert">{error}</p>}
    </form>
  )
}
