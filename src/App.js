import { useEffect, useMemo, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider, googleLogout } from '@react-oauth/google';
import './App.css';

const STORAGE_KEY = 'journal-share-state';
const moodOptions = ['Calm', 'Grateful', 'Happy', 'Focused', 'Reflective', 'Stressed', 'Tired'];
const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseJwt = (token) => {
  if (!token || typeof atob !== 'function') {
    return null;
  }
  const segments = token.split('.');
  if (segments.length < 2) {
    return null;
  }
  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join('')
    );
    return JSON.parse(json);
  } catch (error) {
    return null;
  }
};

const formatDate = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const buildShareText = (entry, friendNames) => {
  const lines = [
    `Journal: ${entry.title}`,
    entry.body,
    entry.mood ? `Mood: ${entry.mood}` : null,
    entry.tags?.length ? `Tags: ${entry.tags.join(', ')}` : null,
    friendNames.length ? `Shared with: ${friendNames.join(', ')}` : 'Shared with: Just you',
    entry.createdAt ? `Written on ${formatDate(entry.createdAt)}` : null,
  ].filter(Boolean);

  return lines.join('\n');
};

const initialEntryState = {
  title: '',
  body: '',
  mood: '',
  tags: '',
  shareWith: [],
};

const getInitials = (name) => {
  if (!name) {
    return 'JS';
  }
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

function App() {
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const [user, setUser] = useState(null);
  const [journals, setJournals] = useState([]);
  const [friends, setFriends] = useState([]);
  const [entryForm, setEntryForm] = useState(initialEntryState);
  const [friendForm, setFriendForm] = useState({ name: '', email: '' });
  const [entryError, setEntryError] = useState('');
  const [friendError, setFriendError] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setUser(parsed.user || null);
      setFriends(Array.isArray(parsed.friends) ? parsed.friends : []);
      setJournals(Array.isArray(parsed.journals) ? parsed.journals : []);
    } catch (error) {
      // ignore invalid storage
    }
  }, []);

  useEffect(() => {
    const payload = {
      user: user
        ? {
            name: user.name,
            email: user.email,
            picture: user.picture,
          }
        : null,
      friends,
      journals,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [user, friends, journals]);

  useEffect(() => {
    if (!shareNotice) {
      return undefined;
    }
    const timer = setTimeout(() => setShareNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [shareNotice]);

  useEffect(() => {
    if (!authNotice) {
      return undefined;
    }
    const timer = setTimeout(() => setAuthNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [authNotice]);

  const isSignedIn = Boolean(user);

  const friendLookup = useMemo(() => {
    const lookup = new Map();
    friends.forEach((friend) => lookup.set(friend.id, friend));
    return lookup;
  }, [friends]);

  const sortedJournals = useMemo(() => {
    return [...journals].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [journals]);

  const stats = useMemo(() => {
    const sharedCount = journals.filter((entry) => (entry.sharedWith || []).length > 0).length;
    return {
      totalEntries: journals.length,
      sharedEntries: sharedCount,
      friends: friends.length,
    };
  }, [journals, friends]);

  const handleGoogleSuccess = (credentialResponse) => {
    const payload = parseJwt(credentialResponse?.credential);
    if (!payload) {
      setAuthNotice('Google sign-in failed to decode profile.');
      return;
    }
    setUser({
      name: payload.name || 'Google User',
      email: payload.email || '',
      picture: payload.picture || '',
    });
    setAuthNotice('Signed in with Google.');
  };

  const handleGoogleError = () => {
    setAuthNotice('Google sign-in failed. Try again.');
  };

  const handleDemoLogin = () => {
    setUser({
      name: 'Demo Writer',
      email: 'demo@journalshare.app',
      picture: '',
    });
    setAuthNotice('Signed in with a demo account.');
  };

  const handleSignOut = () => {
    try {
      googleLogout();
    } catch (error) {
      // ignore logout errors
    }
    setUser(null);
    setAuthNotice('Signed out.');
  };

  const handleEntryChange = (field) => (event) => {
    setEntryForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleEntryShareToggle = (friendId) => {
    setEntryForm((prev) => {
      const isSelected = prev.shareWith.includes(friendId);
      return {
        ...prev,
        shareWith: isSelected
          ? prev.shareWith.filter((id) => id !== friendId)
          : [...prev.shareWith, friendId],
      };
    });
  };

  const handleEntrySubmit = (event) => {
    event.preventDefault();
    setEntryError('');
    if (!isSignedIn) {
      setEntryError('Sign in with Google to save entries.');
      return;
    }
    if (!entryForm.title.trim() || !entryForm.body.trim()) {
      setEntryError('Add a title and journal entry before saving.');
      return;
    }
    const tags = entryForm.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const newEntry = {
      id: createId(),
      title: entryForm.title.trim(),
      body: entryForm.body.trim(),
      mood: entryForm.mood,
      tags,
      sharedWith: entryForm.shareWith,
      createdAt: new Date().toISOString(),
    };

    setJournals((prev) => [newEntry, ...prev]);
    setEntryForm(initialEntryState);
    setShareNotice('Entry saved to your journal.');
  };

  const handleEntryDelete = (entryId) => {
    setJournals((prev) => prev.filter((entry) => entry.id !== entryId));
    setShareNotice('Entry removed.');
  };

  const handleFriendChange = (field) => (event) => {
    setFriendForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleFriendSubmit = (event) => {
    event.preventDefault();
    setFriendError('');
    if (!isSignedIn) {
      setFriendError('Sign in to add friends.');
      return;
    }
    const name = friendForm.name.trim();
    const email = friendForm.email.trim().toLowerCase();
    if (!name || !email) {
      setFriendError('Add a friend name and email.');
      return;
    }
    if (!/.+@.+\..+/.test(email)) {
      setFriendError('Enter a valid email address.');
      return;
    }
    const newFriend = {
      id: createId(),
      name,
      email,
    };
    setFriends((prev) => [...prev, newFriend]);
    setFriendForm({ name: '', email: '' });
  };

  const handleFriendRemove = (friendId) => {
    setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
    setJournals((prev) =>
      prev.map((entry) => ({
        ...entry,
        sharedWith: (entry.sharedWith || []).filter((id) => id !== friendId),
      }))
    );
    setEntryForm((prev) => ({
      ...prev,
      shareWith: prev.shareWith.filter((id) => id !== friendId),
    }));
  };

  const handleShareEntry = async (entry) => {
    if (!isSignedIn) {
      setShareNotice('Sign in to share entries.');
      return;
    }
    const sharedNames = (entry.sharedWith || [])
      .map((id) => friendLookup.get(id)?.name)
      .filter(Boolean);
    const shareText = buildShareText(entry, sharedNames);

    try {
      if (navigator.share) {
        await navigator.share({
          title: entry.title,
          text: shareText,
        });
        setShareNotice('Shared using your device.');
        return;
      }
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareText);
        setShareNotice('Share summary copied to clipboard.');
        return;
      }
      setShareNotice('Share not supported. Copy the summary manually.');
    } catch (error) {
      setShareNotice('Share cancelled or failed.');
    }
  };

  return (
    <div className="App">
      <div className="app-shell">
        <header className="card app-hero">
          <div className="app-brand">
            <div className="brand-mark">JS</div>
            <div>
              <p className="eyebrow">Android-ready journaling</p>
              <h1>JournalShare</h1>
              <p className="hero-copy">
                Sign in with Gmail, capture daily moments, and share meaningful entries with
                friends.
              </p>
            </div>
          </div>
          <div className="hero-tags">
            <span className="hero-pill">Google sign-in</span>
            <span className="hero-pill">Offline friendly</span>
            <span className="hero-pill">Share-ready</span>
          </div>
        </header>

        <section className="card auth-card">
          <div className="auth-summary">
            <h2>Sign in & sync</h2>
            <p className="muted">
              Gmail login keeps your journal consistent across devices. Use a demo account for
              local previews.
            </p>
            <ul className="feature-list">
              <li>Save entries locally while offline.</li>
              <li>Choose who can see each entry.</li>
              <li>Share using Android system share.</li>
            </ul>
          </div>
          <div className="auth-panel">
            {isSignedIn ? (
              <div className="user-card">
                <div className="user-avatar">
                  {user.picture ? (
                    <img src={user.picture} alt={user.name} />
                  ) : (
                    <span>{getInitials(user.name)}</span>
                  )}
                </div>
                <div>
                  <p className="user-name">{user.name}</p>
                  <p className="muted">{user.email}</p>
                </div>
                <button type="button" className="ghost-button" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            ) : (
              <div className="auth-actions">
                {googleClientId ? (
                  <GoogleOAuthProvider clientId={googleClientId}>
                    <GoogleLogin onSuccess={handleGoogleSuccess} onError={handleGoogleError} />
                  </GoogleOAuthProvider>
                ) : (
                  <div className="notice warning">
                    Set REACT_APP_GOOGLE_CLIENT_ID to enable Gmail sign-in.
                  </div>
                )}
                <button type="button" className="secondary-button" onClick={handleDemoLogin}>
                  Continue with demo account
                </button>
              </div>
            )}
            {authNotice ? <p className="notice">{authNotice}</p> : null}
          </div>
        </section>

        <section className="stats-grid">
          <div className="card stat-card">
            <span className="stat-label">Entries</span>
            <span className="stat-value">{stats.totalEntries}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Shared</span>
            <span className="stat-value">{stats.sharedEntries}</span>
          </div>
          <div className="card stat-card">
            <span className="stat-label">Friends</span>
            <span className="stat-value">{stats.friends}</span>
          </div>
        </section>

        {shareNotice ? (
          <div className="notice-bar">
            <span>{shareNotice}</span>
          </div>
        ) : null}

        <main className="app-main">
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Write a journal entry</h2>
                <p className="muted">Capture how you feel and choose who you want to share with.</p>
              </div>
              {!isSignedIn ? <span className="pill">Sign in required</span> : null}
            </div>
            <form className="form-grid" onSubmit={handleEntrySubmit}>
              <label className="input-group">
                Title
                <input
                  type="text"
                  value={entryForm.title}
                  onChange={handleEntryChange('title')}
                  placeholder="Morning reflections"
                  disabled={!isSignedIn}
                />
              </label>
              <label className="input-group">
                Journal entry
                <textarea
                  value={entryForm.body}
                  onChange={handleEntryChange('body')}
                  placeholder="Write your thoughts..."
                  rows="5"
                  disabled={!isSignedIn}
                />
              </label>
              <div className="entry-row">
                <label className="input-group">
                  Mood
                  <select
                    value={entryForm.mood}
                    onChange={handleEntryChange('mood')}
                    disabled={!isSignedIn}
                  >
                    <option value="">Select a mood</option>
                    {moodOptions.map((mood) => (
                      <option key={mood} value={mood}>
                        {mood}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-group">
                  Tags
                  <input
                    type="text"
                    value={entryForm.tags}
                    onChange={handleEntryChange('tags')}
                    placeholder="gratitude, work, family"
                    disabled={!isSignedIn}
                  />
                </label>
              </div>
              <div className="share-box">
                <div className="share-header">
                  <h3>Share with friends</h3>
                  <p className="muted">Pick the friends who can read this entry.</p>
                </div>
                {friends.length ? (
                  <div className="share-grid">
                    {friends.map((friend) => (
                      <label key={friend.id} className="share-item">
                        <input
                          type="checkbox"
                          checked={entryForm.shareWith.includes(friend.id)}
                          onChange={() => handleEntryShareToggle(friend.id)}
                          disabled={!isSignedIn}
                        />
                        <span>
                          {friend.name}
                          <span className="muted small"> {friend.email}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Add friends to share journal entries.</p>
                )}
              </div>
              {entryError ? <p className="notice warning">{entryError}</p> : null}
              <div className="button-row">
                <button type="submit" className="primary-button" disabled={!isSignedIn}>
                  Save entry
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setEntryForm(initialEntryState)}
                  disabled={!isSignedIn}
                >
                  Clear
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <div className="card-header">
              <div>
                <h2>Friends</h2>
                <p className="muted">Build your sharing circle and keep notes private.</p>
              </div>
              {!isSignedIn ? <span className="pill">Sign in required</span> : null}
            </div>
            <form className="form-grid" onSubmit={handleFriendSubmit}>
              <label className="input-group">
                Friend name
                <input
                  type="text"
                  value={friendForm.name}
                  onChange={handleFriendChange('name')}
                  placeholder="Avery Chen"
                  disabled={!isSignedIn}
                />
              </label>
              <label className="input-group">
                Email address
                <input
                  type="email"
                  value={friendForm.email}
                  onChange={handleFriendChange('email')}
                  placeholder="avery@gmail.com"
                  disabled={!isSignedIn}
                />
              </label>
              {friendError ? <p className="notice warning">{friendError}</p> : null}
              <button type="submit" className="primary-button" disabled={!isSignedIn}>
                Add friend
              </button>
            </form>
            <div className="list">
              {friends.length ? (
                friends.map((friend) => (
                  <div key={friend.id} className="list-item">
                    <div>
                      <p className="list-title">{friend.name}</p>
                      <p className="muted small">{friend.email}</p>
                    </div>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => handleFriendRemove(friend.id)}
                      disabled={!isSignedIn}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">No friends added yet.</p>
              )}
            </div>
          </section>

          <section className="card entries-card">
            <div className="card-header">
              <div>
                <h2>Recent entries</h2>
                <p className="muted">Review what you have written and share again anytime.</p>
              </div>
              {!isSignedIn ? <span className="pill">Sign in required</span> : null}
            </div>
            <div className="entry-list">
              {!isSignedIn ? (
                <p className="muted">Sign in to view your journal entries.</p>
              ) : sortedJournals.length ? (
                sortedJournals.map((entry) => {
                  const sharedNames = (entry.sharedWith || [])
                    .map((id) => friendLookup.get(id)?.name)
                    .filter(Boolean);
                  return (
                    <article key={entry.id} className="entry-card">
                      <div className="entry-header">
                        <div>
                          <h3>{entry.title}</h3>
                          <p className="muted small">{formatDate(entry.createdAt)}</p>
                        </div>
                        {entry.mood ? <span className="pill">{entry.mood}</span> : null}
                      </div>
                      <p className="entry-body">{entry.body}</p>
                      {entry.tags?.length ? (
                        <div className="tag-row">
                          {entry.tags.map((tag) => (
                            <span key={`${entry.id}-${tag}`} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="share-summary">
                        <span className="muted small">
                          Shared with: {sharedNames.length ? sharedNames.join(', ') : 'Just you'}
                        </span>
                      </div>
                      <div className="button-row">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleShareEntry(entry)}
                          disabled={!isSignedIn}
                        >
                          Share
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleEntryDelete(entry.id)}
                          disabled={!isSignedIn}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="muted">No entries yet. Start with your first journal note.</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
