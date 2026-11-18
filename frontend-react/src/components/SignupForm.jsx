import { useState } from 'react'

export default function SignupForm({ onSignup, onShowLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return
    setError('')

    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }

    const passwordLength = new TextEncoder().encode(password).length
    if (passwordLength < 1 || passwordLength > 72) {
      setError('Password must be between 1 and 72 bytes.')
      return
    }

    setLoading(true)
    try {
      await onSignup({ email: email.trim(), password })
      setPassword('')
      setConfirmation('')
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="auth-form card" onSubmit={handleSubmit}>
      <h2>Sign up</h2>
      <fieldset disabled={loading}>
        <legend>Create your account</legend>
        <p>
          <label htmlFor="signup-email">Email</label>{' '}
          <input
            id="signup-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
        </p>
        <p>
          <label htmlFor="signup-password">Password</label>{' '}
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
          />
        </p>
        <p>
          <label htmlFor="signup-confirmation">Confirm password</label>{' '}
          <input
            id="signup-confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            required
          />
        </p>
        <button type="submit">{loading ? 'Creating account...' : 'Create account'}</button>{' '}
        <button className="button-secondary" type="button" onClick={onShowLogin}>Already have an account? Log in</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
