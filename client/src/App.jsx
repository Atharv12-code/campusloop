import { useEffect, useState } from 'react'
import { ArrowRight, LoaderCircle, LogOut, Search, Sparkles, UserRound, X } from 'lucide-react'
import { CATEGORIES, fetchPosts } from './api/posts'
import { fetchMe, loginUser, logoutUser, registerUser } from './api/auth'
import AuthForm from './components/AuthForm'
import PostForm from './components/PostForm'
import PostCard from './components/PostCard'
import './App.css'

const filterOptions = ['All', ...CATEGORIES]

export default function App() {
  const [posts, setPosts] = useState([])
  const [category, setCategory] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [reservationSyncError, setReservationSyncError] = useState('')
  const [moreError, setMoreError] = useState('')
  const [user, setUser] = useState(null)
  const [mode, setMode] = useState('login')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    let ignore = false

    fetchMe()
      .then((currentUser) => {
        if (!ignore) setUser(currentUser)
      })
      .catch(() => {
        if (!ignore) setUser(null)
      })

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    let ignore = false

    fetchPosts(category, search, page)
      .then((data) => {
        if (ignore) return
        setPosts((current) => page === 1 ? data.posts : [...current, ...data.posts])
        setHasMore(data.hasMore)
        if (page === 1) setError('')
      })
      .catch((err) => {
        if (ignore) return
        if (page === 1) setError(err.message)
        else setMoreError(err.message)
      })
      .finally(() => {
        if (ignore) return
        if (page === 1) setLoading(false)
        else setLoadingMore(false)
      })

    return () => {
      ignore = true
    }
  }, [category, search, page, reloadKey])

  useEffect(() => {
    let ignore = false

    const refreshPurchaseStatus = () => {
      if (document.visibilityState === 'hidden') return
      if (category && category !== 'Marketplace') return
      Promise.all(Array.from({ length: page }, (_, index) => fetchPosts(category, search, index + 1)))
        .then((pages) => {
          if (ignore) return
          const refreshedPosts = new Map(pages.flatMap((data) => data.posts).map((post) => [post._id, post]))
          setPosts((current) => current.map((post) => refreshedPosts.get(post._id) || post))
          setReservationSyncError('')
        })
        .catch((err) => {
          if (!ignore) setReservationSyncError(`Live purchase status could not refresh: ${err.message}`)
        })
    }

    const intervalId = window.setInterval(refreshPurchaseStatus, 5000)
    return () => {
      ignore = true
      window.clearInterval(intervalId)
    }
  }, [category, search, page])

  const resetFeed = () => {
    setPage(1)
    setLoading(true)
    setLoadingMore(false)
    setError('')
    setMoreError('')
    setReservationSyncError('')
  }

  const reload = () => {
    resetFeed()
    setReloadKey((value) => value + 1)
  }

  const handleSearch = (event) => {
    event.preventDefault()
    const nextSearch = searchInput.trim()
    if (nextSearch === search && page === 1) {
      reload()
      return
    }
    resetFeed()
    setSearch(nextSearch)
  }

  const clearSearch = () => {
    if (!search && page === 1) return
    resetFeed()
    setSearchInput('')
    setSearch('')
  }

  const renderFeedControls = () => (
    <>
      <form className="search-form" onSubmit={handleSearch}>
        <label className="feed-search">
          <Search size={18} aria-hidden="true" />
          <span className="visually-hidden">Search campus posts</span>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            maxLength={100}
            placeholder="Search posts, people, or topics"
          />
          {searchInput && (
            <button type="button" className="clear-search" onClick={clearSearch} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>
        <button type="submit" className="ghost-button search-button">Search</button>
      </form>
      <div className="feed-chip-row" aria-label="Category filter">
        {filterOptions.map((option) => {
          const isActive = (option === 'All' && category === '') || category === option
          return (
            <button
              key={option}
              type="button"
              className={`chip ${isActive ? 'active' : ''}`}
              onClick={() => {
                const nextCategory = option === 'All' ? '' : option
                if (nextCategory !== category) {
                  resetFeed()
                  setCategory(nextCategory)
                }
              }}
            >
              {option}
            </button>
          )
        })}
      </div>
    </>
  )

  const handleAuthSubmit = async ({ email, password, displayName }) => {
    setAuthError('')
    setAuthLoading(true)

    try {
      const payload = mode === 'register'
        ? await registerUser({ email, password, displayName })
        : await loginUser({ email, password })

      setUser(payload)
      setMode('login')
    } catch (err) {
      setAuthError(err.message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logoutUser()
      setUser(null)
    } catch (err) {
      setAuthError(err.message)
    }
  }

  const renderFeed = () => {
    if (loading) {
      return (
        <div className="skeleton-stack" aria-label="Loading posts">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="state error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={reload}>Try again</button>
        </div>
      )
    }

    if (posts.length === 0) {
      return (
        <div className="state empty-state" role="status">
          <Sparkles size={24} />
          <p>
            {search
              ? `No posts matched “${search}”. Try a different search.`
              : 'No posts yet. Be the first to share something with your campus.'}
          </p>
          {search && <button type="button" className="ghost-button" onClick={clearSearch}>Clear search</button>}
        </div>
      )
    }

    return (
      <>
        {reservationSyncError && (
          <div className="inline-feedback error" role="status">
            {reservationSyncError}
          </div>
        )}
        {posts.map((post) => <PostCard key={post._id} post={post} user={user} onRefresh={reload} />)}
        {moreError && (
          <div className="inline-feedback error" role="alert">
            <span>{moreError}</span>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setLoadingMore(true)
                setMoreError('')
                setReloadKey((value) => value + 1)
              }}
            >
              Try again
            </button>
          </div>
        )}
        {hasMore && (
          <div className="load-more-row">
            <button
              type="button"
              className="ghost-button"
              disabled={loadingMore}
              onClick={() => {
                setLoadingMore(true)
                setPage((current) => current + 1)
              }}
            >
              {loadingMore ? <><LoaderCircle size={16} className="spin" /> Loading...</> : 'Load more posts'}
            </button>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-label="CampusLoop home">
          <div className="brand-badge">C</div>
          <div>
            <strong>CampusLoop</strong>
          </div>
        </div>

        {user ? (
          <div className="user-menu">
            <div className="user-pill">
              <span className="avatar-circle" aria-hidden="true">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </span>
              <span>{user.displayName}</span>
            </div>
            <button type="button" className="ghost-button" onClick={handleLogout}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        ) : (
          <button type="button" className="ghost-button" onClick={() => setMode('login')}>
            <UserRound size={16} />
            Sign in
          </button>
        )}
      </header>

      {!user ? (
        <>
          <main className="auth-page">
            <section className="brand-panel">
              <p className="eyebrow">Campus community</p>
              <h1>Stay connected to life on campus.</h1>
              <p className="strapline">
                Share campus updates, ask questions, and discover events and items nearby.
              </p>

              <ul className="benefits-list" aria-label="CampusLoop benefits">
                <li><ArrowRight size={16} /> Share campus updates</li>
                <li><ArrowRight size={16} /> Ask questions</li>
                <li><ArrowRight size={16} /> Find events and items</li>
              </ul>
            </section>

            <section className="auth-panel" aria-label="Authentication panel">
              <AuthForm
                mode={mode}
                setMode={setMode}
                onSubmit={handleAuthSubmit}
                submitting={authLoading}
                error={authError}
              />
            </section>
          </main>

          <section className="public-feed" aria-labelledby="public-feed-title">
            <div className="feed-header-row">
              <div>
                <p className="eyebrow muted">Public feed</p>
                <h2 id="public-feed-title">What students are talking about</h2>
              </div>
            </div>

            {renderFeedControls()}

            {renderFeed()}
          </section>
        </>
      ) : (
        <main className="dashboard-shell">
          <aside className="sidebar-column">
            <PostForm user={user} onCreated={reload} />
          </aside>

          <section className="feed-column" aria-labelledby="feed-title">
            <div className="feed-header-row">
              <div>
                <p className="eyebrow muted">Latest updates</p>
                <h2 id="feed-title">Campus feed</h2>
              </div>
            </div>

            {renderFeedControls()}

            {renderFeed()}
          </section>
        </main>
      )}
    </div>
  )
}
