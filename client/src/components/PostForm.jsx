import { useMemo, useState } from 'react'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { CATEGORIES, createPost } from '../api/posts'

const EMPTY = {
  title: '',
  content: '',
  category: 'General',
  price: '0.00',
  paymentMethods: ['cash'],
  payoutUpiId: '',
  images: [],
}

export default function PostForm({ onCreated, user }) {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const supportsMedia = useMemo(
    () => ['Announcements', 'Events', 'Marketplace', 'Lost & Found'].includes(form.category),
    [form.category]
  )

  const update = (field) => (event) => {
    setForm({ ...form, [field]: event.target.value })
    setSuccess('')
    setError('')
  }

  function handleFileChange(event) {
    setForm({ ...form, images: Array.from(event.target.files || []) })
    setSuccess('')
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const payload = new FormData()
      payload.append('title', form.title)
      payload.append('content', form.content)
      payload.append('category', form.category)

      form.images.forEach((file) => {
        payload.append('images', file)
      })

      if (form.category === 'Marketplace') {
        payload.append('price', form.price || '0')
        payload.append('paymentMethods', JSON.stringify(form.paymentMethods))
        if (form.paymentMethods.some((method) => method !== 'cash')) {
          payload.append('payoutUpiId', form.payoutUpiId.trim())
        }
      }

      const post = await createPost(payload)
      setForm(EMPTY)
      setSuccess(post.marketplace?.sellerPayoutUpiId
        ? `Posted successfully. ${post.marketplace.sellerPayoutUpiId} was saved as your private manual-settlement UPI reference.`
        : 'Posted successfully.')
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="card panel-box">
        <p className="eyebrow muted">Post update</p>
        <h2>Share an update</h2>
        <p className="muted-text">Sign in to start posting with your campus account.</p>
      </div>
    )
  }

  return (
    <form className="card post-form" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow muted">Share</p>
          <h2>Share an update</h2>
        </div>
      </div>

      <label className="field-label">
        <span>Category</span>
        <select value={form.category} onChange={update('category')}>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </label>

      <label className="field-label">
        <span>Title</span>
        <input value={form.title} onChange={update('title')} maxLength={100} required />
        <span className="counter">{form.title.length}/100</span>
      </label>

      <label className="field-label">
        <span>What&apos;s happening?</span>
        <textarea
          value={form.content}
          onChange={update('content')}
          maxLength={2000}
          rows={4}
          required
        />
        <span className="counter">{form.content.length}/2000</span>
      </label>

      {supportsMedia && (
        <label className="field-label">
          <span>Photos</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleFileChange}
          />
          {form.images.length > 0 && (
            <span className="counter">{form.images.length} image(s) selected</span>
          )}
        </label>
      )}

      {form.category === 'Marketplace' && (
        <div className="marketplace-fields">
          <label className="field-label">
            <span>Selling price (₹, enter 0 for Free)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={update('price')}
              placeholder="0.00"
              required
            />
          </label>

          <fieldset className="payment-methods">
            <legend>Accepted payment methods</legend>
            {[
              ['cash', 'Cash'],
              ['upi', 'UPI through Razorpay'],
            ].map(([method, label]) => (
              <label key={method} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.paymentMethods.includes(method)}
                  disabled={form.paymentMethods.length === 1 && form.paymentMethods.includes(method)}
                  onChange={(event) => {
                    const paymentMethods = event.target.checked
                      ? [...form.paymentMethods, method]
                      : form.paymentMethods.filter((value) => value !== method)
                    setForm({ ...form, paymentMethods })
                    setSuccess('')
                    setError('')
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          {Number(form.price) > 0 && form.paymentMethods.some((method) => method !== 'cash') && (
            <>
              <label className="field-label">
                <span>Seller UPI ID for manual settlement</span>
                <input
                  type="text"
                  value={form.payoutUpiId}
                  onChange={update('payoutUpiId')}
                  maxLength={100}
                  placeholder="name@bank"
                  autoComplete="off"
                  required
                />
              </label>
              <p className="muted-text payment-note">
                Razorpay collects the payment into the platform account. The platform settles with you separately using this UPI ID; do not enter a bank password or PIN.
              </p>
            </>
          )}

        </div>
      )}

      {error && (
        <div className="inline-feedback error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="inline-feedback success" role="status">
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      <button type="submit" className="primary-button" disabled={submitting}>
        {submitting ? (
          <>
            <LoaderCircle size={16} className="spin" />
            Posting...
          </>
        ) : (
          'Post'
        )}
      </button>
    </form>
  )
}
