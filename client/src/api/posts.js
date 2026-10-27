import axios from 'axios'

export const CATEGORIES = [
  'General',
  'Announcements',
  'Questions',
  'Events',
  'Marketplace',
  'Lost & Found',
]

function errorMessage(err) {
  return (
    err.response?.data?.error ||
    (err.request ? 'Cannot reach the server. Is it running?' : 'Something went wrong.')
  )
}

export async function fetchPosts(category, search, page = 1) {
  try {
    const { data } = await axios.get('/api/posts', {
      params: {
        ...(category ? { category } : {}),
        ...(search ? { q: search } : {}),
        page,
      },
      withCredentials: true,
    })
    return data
  } catch (err) {
    throw new Error(errorMessage(err), { cause: err })
  }
}

export async function createPost(post) {
  try {
    const config = { withCredentials: true }
    const { data } = await axios.post('/api/posts', post, config)
    return data.post
  } catch (err) {
    throw new Error(errorMessage(err), { cause: err })
  }
}

export async function purchaseListing(postId, paymentMethod) {
  try {
    const { data } = await axios.post(
      `/api/posts/${postId}/purchase`,
      { paymentMethod },
      { withCredentials: true }
    )
    return data
  } catch (err) {
    throw new Error(errorMessage(err), { cause: err })
  }
}

export async function verifyPurchasePayment(postId, payment) {
  try {
    const { data } = await axios.post(
      `/api/posts/${postId}/purchase/verify`,
      payment,
      { withCredentials: true }
    )
    return data
  } catch (err) {
    throw new Error(errorMessage(err), { cause: err })
  }
}

export async function addReply(postId, payload) {
  try {
    const { data } = await axios.post(`/api/posts/${postId}/replies`, payload, { withCredentials: true })
    return data.reply
  } catch (err) {
    throw new Error(errorMessage(err), { cause: err })
  }
}
