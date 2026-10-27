import { useState } from 'react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, LoaderCircle } from 'lucide-react'

const EMPTY_FORM = {
  email: '',
  password: '',
  displayName: '',
}

export default function AuthForm({ mode, setMode, onSubmit, submitting, error }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [showPassword, setShowPassword] = useState(false)

  const passwordIsValid = form.password.length >= 8

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit({
      email: form.email.trim(),
      password: form.password,
      displayName: form.displayName.trim(),
    })
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`toggle-button ${mode === 'login' ? 'active' : ''}`}
          onClick={() => setMode('login')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={`toggle-button ${mode === 'register' ? 'active' : ''}`}
          onClick={() => setMode('register')}
        >
          Create account
        </button>
      </div>

      {mode === 'register' && (
        <label className="field-label">
          <span>Display name</span>
          <input
            type="text"
            value={form.displayName}
            onChange={updateField('displayName')}
            maxLength={50}
            autoComplete="name"
            placeholder="Alex Johnson"
            required
          />
        </label>
      )}

      <label className="field-label">
        <span>Email</span>
        <input
          type="email"
          value={form.email}
          onChange={updateField('email')}
          autoComplete="email"
          placeholder="student@college.edu"
          required
        />
      </label>

      <label className="field-label">
        <span>Password</span>
        <div className="password-field">
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={updateField('password')}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="Enter your password"
            minLength={8}
            required
          />
          <button
            type="button"
            className="icon-button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>

      {mode === 'register' && (
        <div className={`password-rules ${form.password ? (passwordIsValid ? 'valid' : 'invalid') : ''}`}>
          <span className={passwordIsValid ? 'success' : ''}>
            {passwordIsValid ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            At least 8 characters
          </span>
        </div>
      )}

      {error && (
        <div className="inline-feedback error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button type="submit" className="primary-button" disabled={submitting}>
        {submitting ? (
          <>
            <LoaderCircle size={16} className="spin" />
            {mode === 'login' ? 'Signing in...' : 'Creating account...'}
          </>
        ) : mode === 'login' ? (
          'Sign in'
        ) : (
          'Create account'
        )}
      </button>
    </form>
  )
}
