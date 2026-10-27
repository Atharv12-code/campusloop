import axios from 'axios'

function errorMessage(err) {
  return (
    err.response?.data?.error ||
    (err.request ? 'Cannot reach the server. Is it running?' : 'Something went wrong.')
  )
}

export async function registerUser(form) {
  try {
    const { data } = await axios.post('/api/auth/register', form, { withCredentials: true })
    return data.user
  } catch (err) {
    throw new Error(errorMessage(err), { cause: err })
  }
}

export async function loginUser(form) {
  try {
    const { data } = await axios.post('/api/auth/login', form, { withCredentials: true })
    return data.user
  } catch (err) {
    throw new Error(errorMessage(err), { cause: err })
  }
}

export async function logoutUser() {
  try {
    await axios.post('/api/auth/logout', {}, { withCredentials: true })
  } catch (err) {
    throw new Error(errorMessage(err), { cause: err })
  }
}

export async function fetchMe() {
  try {
    const { data } = await axios.get('/api/auth/me', { withCredentials: true })
    return data.user
  } catch {
    return null
  }
}
