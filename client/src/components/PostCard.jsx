import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { addReply, purchaseListing, verifyPurchasePayment } from '../api/posts'

let razorpayScriptPromise

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve()
  if (razorpayScriptPromise) return razorpayScriptPromise

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => {
      if (window.Razorpay) resolve()
      else reject(new Error('Razorpay Checkout did not initialize. Check the browser console or network connection.'))
    }
    script.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check the browser network or content-blocker settings. Your listing reservation remains active for 5 minutes.'))
    document.head.appendChild(script)
  }).catch((error) => {
    razorpayScriptPromise = null
    throw error
  })

  return razorpayScriptPromise
}

function formatRelativeTime(iso) {
  const date = new Date(iso)
  const diffMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000))

  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
}

function formatFullDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatPrice(minor) {
  if (!Number.isFinite(minor) || minor < 0) return '—'
  return minor === 0 ? 'Free' : `₹${(minor / 100).toFixed(2)}`
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U'
}

export default function PostCard({ post, user, onRefresh }) {
  const marketplace = post.marketplace || null
  const purchase = marketplace?.purchase || null
  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [purchaseMethod, setPurchaseMethod] = useState('upi')
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false)
  const [purchaseError, setPurchaseError] = useState('')
  const [purchaseSuccess, setPurchaseSuccess] = useState('')
  const [localReservationExpiresAt, setLocalReservationExpiresAt] = useState(null)
  const [clock, setClock] = useState(0)

  const categoryClass = `category-${(post.category || 'General').toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-')}`
  const replyCount = post.replies?.length || 0
  const isSeller = Boolean(user && post.user && String(user.id) === String(post.user._id || post.user))
  const isSold = marketplace?.status === 'sold'
  const acceptedPaymentMethods = marketplace?.paymentMethods?.length
    ? marketplace.paymentMethods
    : ['cash']
  const selectedPurchaseMethod = acceptedPaymentMethods.includes(purchaseMethod)
    ? purchaseMethod
    : acceptedPaymentMethods[0] || 'cash'
  const reservationExpiresAt = localReservationExpiresAt &&
    new Date(localReservationExpiresAt).getTime() > clock
    ? localReservationExpiresAt
    : purchase?.status === 'reserved' ? purchase.expiresAt : null
  const reservationActive = Boolean(
    reservationExpiresAt && (clock === 0 || new Date(reservationExpiresAt).getTime() > clock)
  )
  const purchaseSecondsRemaining = reservationActive
    ? clock === 0
      ? purchase?.secondsLeft || 300
      : Math.max(0, Math.ceil((new Date(reservationExpiresAt).getTime() - clock) / 1000))
    : 0
  const canPurchase = Boolean(user && marketplace && !isSeller && !isSold && !reservationActive)

  useEffect(() => {
    if (!reservationActive) return undefined
    const intervalId = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [reservationActive, reservationExpiresAt])

  async function handlePurchase(event) {
    event.preventDefault()
    setPurchaseError('')
    setPurchaseSuccess('')
    setPurchaseSubmitting(true)

    try {
      const method = marketplace.priceMinor === 0 ? 'cash' : selectedPurchaseMethod
      const result = await purchaseListing(post._id, method)
      if (result.status === 'sold') {
        setPurchaseSuccess(result.message)
        onRefresh?.()
        return
      }

      setLocalReservationExpiresAt(result.expiresAt)
      await loadRazorpayCheckout()
      if (!window.Razorpay) {
        throw new Error('Razorpay Checkout did not initialize. Your reservation remains active for 5 minutes.')
      }

      const checkout = new window.Razorpay({
        key: result.keyId,
        order_id: result.order.id,
        amount: result.order.amount,
        currency: result.order.currency,
        name: 'CampusLoop',
        description: post.title,
        prefill: result.buyer,
        method: { upi: true },
        theme: { color: '#3b82f6' },
        handler: async (payment) => {
          try {
            const confirmed = await verifyPurchasePayment(post._id, payment)
            setLocalReservationExpiresAt(null)
            setPurchaseSuccess(confirmed.message)
            onRefresh?.()
          } catch (err) {
            setPurchaseError(err.message)
          }
        },
        modal: {
          ondismiss: () => {
            setPurchaseError('Checkout closed. Your listing reservation remains active until its 5-minute timer ends.')
          },
        },
      })
      checkout.on('payment.failed', (failure) => {
        setPurchaseError(failure.error?.description || 'Payment failed. Your reservation remains active until its 5-minute timer ends.')
      })
      checkout.open()
    } catch (err) {
      setPurchaseError(err.message)
    } finally {
      setPurchaseSubmitting(false)
    }
  }

  async function handleReplySubmit(event) {
    event.preventDefault()
    setReplyError('')
    setReplySubmitting(true)

    try {
      await addReply(post._id, { content: replyText })
      setReplyText('')
      onRefresh?.()
    } catch (err) {
      setReplyError(err.message)
    } finally {
      setReplySubmitting(false)
    }
  }

  return (
    <article className="card post">
      <div className="post-head">
        <div className="author-block">
          <span className="avatar-circle small" aria-hidden="true">{getInitials(post.author)}</span>
          <div>
            <strong>{post.author}</strong>
            <time dateTime={post.createdAt} title={formatFullDate(post.createdAt)}>
              {formatRelativeTime(post.createdAt)}
            </time>
          </div>
        </div>
        <span className={`badge ${categoryClass}`}>{post.category}</span>
      </div>

      <h3>{post.title}</h3>
      <p className="post-content">{post.content}</p>

      {post.images?.length > 0 && (
        <div className="post-gallery" aria-label="Post images">
          {post.images.map((image, index) => (
            <img key={`${post._id}-${index}`} src={image.url} alt={image.alt || `Post image ${index + 1}`} />
          ))}
        </div>
      )}

      {post.category === 'Marketplace' && marketplace && (
        <div className="marketplace-box">
          <div className="marketplace-row">
            <span>Fixed price</span>
            <strong>{formatPrice(marketplace.priceMinor)}</strong>
          </div>
          <div className="marketplace-row">
            <span>Payment options</span>
            <strong>{marketplace.priceMinor === 0
              ? 'Free'
              : acceptedPaymentMethods.map((method) => method.toUpperCase()).join(', ')}</strong>
          </div>
          {isSold && (
            <p className="listing-status">{isSeller ? 'This listing is marked sold.' : 'Sold'}</p>
          )}
        </div>
      )}

      {post.category === 'Marketplace' && marketplace && (
        <>
          {reservationActive && !isSold && (
            <p className="reservation-status" role="status">
              Someone is completing this purchase · available in {formatCountdown(purchaseSecondsRemaining)}
            </p>
          )}
          {canPurchase && (
            <form className="purchase-form" onSubmit={handlePurchase}>
              {marketplace.priceMinor > 0 && acceptedPaymentMethods.length > 1 && (
                <label className="field-label">
                  <span>Choose payment method</span>
                  <select value={selectedPurchaseMethod} onChange={(event) => setPurchaseMethod(event.target.value)}>
                    {acceptedPaymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method === 'cash' ? 'Cash with seller' : 'UPI (Razorpay)'}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {marketplace.priceMinor > 0 && acceptedPaymentMethods.length === 1 && (
                <p className="muted-text">
                  {acceptedPaymentMethods[0] === 'cash' ? 'Pay cash to the seller.' : 'Pay by UPI using Razorpay.'}
                </p>
              )}
              <button type="submit" className="primary-button" disabled={purchaseSubmitting}>
                {purchaseSubmitting
                  ? <><LoaderCircle size={16} className="spin" /> Starting purchase...</>
                  : marketplace.priceMinor === 0
                    ? 'Claim free item'
                    : selectedPurchaseMethod === 'upi'
                      ? `Pay with UPI · ${formatPrice(marketplace.priceMinor)}`
                      : `Purchase with cash · ${formatPrice(marketplace.priceMinor)}`}
              </button>
            </form>
          )}
          {!user && !isSold && (
            <p className="muted-text">Sign in to purchase this listing.</p>
          )}
          {purchaseError && <p className="field-error" role="alert">{purchaseError}</p>}
          {purchaseSuccess && <p className="listing-status" role="status">{purchaseSuccess}</p>}
        </>
      )}

      <div className="reply-thread">
        <div className="reply-header-row">
          <strong>Replies</strong>
          <button type="button" className="ghost-link" onClick={() => setShowReplies((value) => !value)}>
            {showReplies ? 'Hide replies' : `See replies (${replyCount})`}
          </button>
        </div>

        {showReplies && (
          <>
            {replyCount > 0 ? (
              <div className="reply-list">
                {post.replies.map((reply) => (
                  <div key={reply._id} className="reply-item">
                    <div className="reply-meta">
                      <strong>{reply.author}</strong>
                      <time dateTime={reply.createdAt}>{formatRelativeTime(reply.createdAt)}</time>
                    </div>
                    <p>{reply.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-text">No replies yet. Start the conversation.</p>
            )}

            {user && (
              <form className="reply-form" onSubmit={handleReplySubmit}>
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Write a reply..."
                  maxLength={500}
                />
                <div className="reply-actions">
                  <span className="counter">{replyText.length}/500</span>
                  <button type="submit" className="primary-button small-button" disabled={replySubmitting || !replyText.trim()}>
                    {replySubmitting ? <LoaderCircle size={16} className="spin" /> : 'Reply'}
                  </button>
                </div>
                {replyError && <p className="field-error">{replyError}</p>}
              </form>
            )}
          </>
        )}
      </div>
    </article>
  )
}
