import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Compass,
  Download,
  FlaskConical,
  GraduationCap,
  House,
  Info,
  LibraryBig,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import {
  Avatar,
  Button,
  Check,
  Empty,
  Feedback,
  Field,
  Form,
  Logo,
  QueryState,
  field,
} from './components/ui';
import { WorkspaceProvider, useAction, useRows, useWorkspace } from './hooks/workspace';
import { supabase, callbackUrl } from './lib/supabase';
import { liveStore } from './services/live';
import { demoPeople, demoStore } from './services/demo';
import { errorText, today } from './lib/format';
import { Home } from './pages/Home';

const Connect = lazy(() => import('./pages/Connect'));
const Communities = lazy(() => import('./pages/Communities'));
const Study = lazy(() => import('./pages/Study'));
const Resources = lazy(() => import('./pages/Resources'));
const Profile = lazy(() => import('./pages/Profile'));
const Admin = lazy(() => import('./pages/Admin'));
const Overview = lazy(() => import('./pages/Overview'));
const nav = [
  { to: '/', label: 'Home', icon: House },
  { to: '/connect', label: 'Connect', icon: Compass },
  { to: '/communities', label: 'Communities', icon: UsersRound },
  { to: '/study', label: 'Study', icon: BookOpen },
  { to: '/resources', label: 'Resources', icon: LibraryBig },
  { to: '/profile', label: 'Profile', icon: UserRound },
];
function Auth({
  recover,
  done,
  enterDemo,
}: {
  recover: boolean;
  done: () => void;
  enterDemo: () => void;
}) {
  const client = supabase;
  const [mode, setMode] = useState('Login'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const submit = async (d: FormData) => {
    if (!client) {
      setError('Supabase configuration is required for real accounts.');
      return false;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const email = field(d, 'email'),
        password = String(d.get('password') || '');
      const redirect = callbackUrl();
      if (recover) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        done();
      } else if (mode === 'Register') {
        if (!d.has('adult')) throw new Error('Confirm that you are 18 or older.');
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect, data: { adult: true } },
        });
        if (error) throw error;
        setNotice('Check your email for the verification link, then open it in this browser.');
      } else if (mode === 'Recovery') {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (error) throw error;
        setNotice('If an account exists, check your email for the recovery link.');
      } else {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      return false;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Logo />
        <div>
          <BookOpen size={36} />
          <h1>
            Learn together.
            <br />
            Grow together.
          </h1>
          <p>Find a study partner, get unstuck and make time for the topics that matter.</p>
        </div>
        <Link to="/overview">
          Project overview <ChevronRight size={16} />
        </Link>
      </section>
      <section className="auth-form">
        <div>
          <h2>
            {recover
              ? 'Set a new password'
              : mode === 'Register'
                ? 'Join StudyCircle'
                : mode === 'Recovery'
                  ? 'Reset your password'
                  : 'Welcome back'}
          </h2>
          <p className="muted">
            {recover
              ? 'Choose a password with at least 10 characters.'
              : 'Your student workspace for peer learning.'}
          </p>
          <Feedback error={error} notice={notice} />
          <Form reset={false} onSubmit={submit}>
            {!recover && (
              <Field
                label="Email address"
                type="email"
                name="email"
                autoComplete="email"
                required
              />
            )}
            {mode !== 'Recovery' && (
              <Field
                label={recover ? 'New password' : 'Password'}
                name="password"
                type="password"
                minLength={recover || mode === 'Register' ? 10 : undefined}
                required
                autoComplete={mode === 'Login' && !recover ? 'current-password' : 'new-password'}
              />
            )}
            {mode === 'Register' && (
              <Check name="adult" required>
                I am at least 18 and agree to the{' '}
                <Link to="/overview#guidelines">community guidelines</Link>.
              </Check>
            )}
            <Button type="submit" className="primary" disabled={busy}>
              {recover
                ? 'Save password'
                : mode === 'Register'
                  ? 'Create account'
                  : mode === 'Recovery'
                    ? 'Send recovery link'
                    : 'Log in'}
            </Button>
          </Form>
          {!recover && (
            <div className="auth-links">
              <Button
                onClick={() => {
                  setMode(mode === 'Login' ? 'Register' : 'Login');
                  setError('');
                  setNotice('');
                }}
              >
                {mode === 'Login' ? 'Create an account' : 'Back to login'}
              </Button>
              <button
                className="subtle"
                onClick={() => {
                  setMode('Recovery');
                  setError('');
                  setNotice('');
                }}
              >
                Forgot password?
              </button>
              <button className="subtle" onClick={enterDemo}>
                <FlaskConical size={16} /> Open classroom demo
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
function Notifications() {
  const { db, user } = useWorkspace();
  const notifications = useRows(
    'notifications',
    { where: { user_id: user }, order: 'created_at', desc: true, limit: 40 },
    true,
  );
  const [open, setOpen] = useState(false);
  const action = useAction();
  const unread = notifications.data.filter((n) => !n.read_at);
  return (
    <div className="notification-wrap">
      <Button
        aria-label={unread.length ? 'Notifications, ' + unread.length + ' unread' : 'Notifications'}
        className="icon-button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <Bell size={19} />
        {unread.length > 0 && <i className="notification-dot" />}
      </Button>
      {open && (
        <div className="popover">
          <div className="popover-heading">
            <h2>Notifications</h2>
            <Button
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </Button>
          </div>
          <QueryState {...notifications} />
          <Feedback {...action} />
          {notifications.data.map((n) => (
            <Link
              className={'list-row ' + (!n.read_at ? 'unread' : '')}
              to={n.href || '/profile'}
              key={n.id}
              onClick={() => {
                setOpen(false);
                if (!n.read_at)
                  void action.run(() =>
                    db.update(
                      'notifications',
                      { id: n.id! },
                      { read_at: new Date().toISOString() },
                    ),
                  );
              }}
            >
              <Bell size={16} />
              <span>{n.title}</span>
            </Link>
          ))}
          {!notifications.loading && !notifications.data.length && (
            <Empty title="You’re all caught up" />
          )}
          {!!unread.length && (
            <Button
              onClick={() =>
                void action.run(() =>
                  Promise.all(
                    unread.map((n) =>
                      db.update(
                        'notifications',
                        { id: n.id! },
                        { read_at: new Date().toISOString() },
                      ),
                    ),
                  ),
                )
              }
            >
              Mark all read
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
function Shell({
  switchPerson,
  exitDemo,
  theme,
  toggleTheme,
  install,
}: {
  switchPerson: (v: string) => void;
  exitDemo: () => void;
  theme: string;
  toggleTheme: () => void;
  install: (() => void) | null;
}) {
  const { user, demo, role, db } = useWorkspace();
  const profile = useRows('profiles', { where: { id: user } });
  const location = useLocation(),
    navigate = useNavigate();
  const item = nav.find((n) => n.to === location.pathname);
  const me = profile.data[0],
    name = me?.display_name || me?.alias || 'Your profile';
  const [search, setSearch] = useState('');
  useEffect(() => {
    const sync = () => {
      void db.rpc('sync_reminders', { local_day: today() }).catch(console.warn);
    };
    sync();
    const timer = setInterval(sync, 60000);
    return () => clearInterval(timer);
  }, [db]);
  useEffect(() => {
    document.getElementById('app-content')?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (search.trim())
      navigate('/communities?tab=Questions&q=' + encodeURIComponent(search.trim()));
  };
  return (
    <div className="shell">
      <a
        href="#workspace-main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('workspace-main')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/" aria-label="StudyCircle home">
          <Logo />
        </Link>
        <nav aria-label="Main navigation">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} end={to === '/'} to={to}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/overview">
            <Info size={18} /> Project overview
          </NavLink>
          {role !== 'student' && (
            <NavLink to="/admin">
              <ShieldCheck size={18} /> {role === 'admin' ? 'Administration' : 'Moderation'}
            </NavLink>
          )}
          {install && (
            <button className="side-button" onClick={install}>
              <Download size={18} /> Install StudyCircle
            </button>
          )}
          <Link className="side-person" to="/profile">
            <Avatar name={name} tone={me?.avatar} />
            <span>
              <strong>{name}</strong>
              <small>
                {role === 'student'
                  ? 'Student workspace'
                  : role === 'admin'
                    ? 'Administrator'
                    : 'Moderator'}
              </small>
            </span>
            <ChevronRight size={15} />
          </Link>
        </div>
      </aside>
      <div className="app-main" id="app-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {item?.label || (location.pathname === '/admin' ? 'Moderation' : 'Project overview')}
            </strong>
          </div>
          <Link className="mobile-brand" to="/">
            <Logo />
          </Link>
          <form className="global-search" role="search" onSubmit={submitSearch}>
            <Search size={17} />
            <input
              aria-label="Search academic questions"
              placeholder="Search questions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <div className="header-actions">
            <Button
              className="icon-button mobile-search"
              aria-label="Search questions"
              onClick={() => navigate('/communities?tab=Questions')}
            >
              <Search size={18} />
            </Button>
            <Button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="icon-button"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <Notifications />
            <Link to="/profile" aria-label="Your profile">
              <Avatar name={name} tone={me?.avatar} />
            </Link>
          </div>
        </header>
        <main className="workspace" id="workspace-main" tabIndex={-1}>
          {demo && (
            <div className="demo-ribbon">
              <div>
                <FlaskConical size={16} />
                <strong>Classroom demo</strong>
                <span>Fictional workspace</span>
              </div>
              <div className="demo-actions">
                <label>
                  <span className="sr-only">Demo student</span>
                  <select value={user} onChange={(e) => switchPerson(e.target.value)}>
                    {demoPeople.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.id === 'leena' ? ' · Moderator' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={13} />
                </label>
                {supabase && (
                  <button onClick={exitDemo} className="subtle">
                    Exit demo
                  </button>
                )}
              </div>
            </div>
          )}
          <Suspense fallback={<QueryState loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/connect" element={<Connect />} />
              <Route path="/communities" element={<Communities />} />
              <Route path="/study" element={<Study />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/profile" element={<Profile install={install} exitDemo={exitDemo} />} />
              <Route path="/overview" element={<Overview />} />
              <Route
                path="/admin"
                element={role !== 'student' ? <Admin /> : <Navigate to="/" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} end={to === '/'} to={to}>
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function App() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(Boolean(supabase)),
    [recovery, setRecovery] = useState(false),
    [demo, setDemo] = useState(!supabase),
    [person, setPerson] = useState('maya'),
    [role, setRole] = useState<{ id: string; value: string } | null>(null),
    [authError, setAuthError] = useState('');
  const [theme, setTheme] = useState(
    () =>
      localStorage.getItem('studycircle-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  const [installer, setInstaller] = useState<InstallEvent | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const user = demo ? person : session?.user.id;
  const db = useMemo(
    () => (demo ? demoStore(person) : supabase ? liveStore() : null),
    [demo, person],
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('studycircle-theme', theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#171b30' : '#f7f8fc');
  }, [theme]);
  useEffect(() => {
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstaller(event as InstallEvent);
    };
    const installed = () => setInstaller(null);
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  useEffect(() => {
    if (!supabase) return;
    const subscription = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(newSession);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ error }) => {
      if (error) {
        setAuthError(error.message);
        setLoading(false);
      }
    });
    return () => subscription.data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let ignore = false;
    if (db && user && !demo)
      void db.rpc<string>('my_role').then(
        (value) => {
          if (!ignore) setRole({ id: user, value });
        },
        (error) => {
          if (!ignore) setAuthError(errorText(error));
        },
      );
    return () => {
      ignore = true;
    };
  }, [db, user, demo]);
  const enterDemo = () => {
    setDemo(true);
    navigate('/');
  };
  const exitDemo = () => {
    setDemo(false);
    navigate('/');
  };
  const install = installer
    ? () => {
        void installer
          .prompt()
          .then(() => installer.userChoice)
          .then(() => setInstaller(null));
      }
    : null;
  if (loading)
    return (
      <div className="launch">
        <Logo />
        <QueryState loading />
      </div>
    );
  if (recovery || !user || !db) {
    if (location.pathname === '/overview' && !recovery)
      return (
        <div className="public-overview">
          <Link to="/">
            <Logo />
          </Link>
          <Suspense fallback={<QueryState loading />}>
            <Overview />
          </Suspense>
        </div>
      );
    return (
      <>
        <Feedback error={authError} />
        <Auth
          recover={recovery}
          done={() => {
            setRecovery(false);
            navigate('/');
          }}
          enterDemo={enterDemo}
        />
      </>
    );
  }
  return (
    <WorkspaceProvider
      db={db}
      user={user}
      demo={demo}
      role={
        demo
          ? person === 'leena'
            ? 'moderator'
            : 'student'
          : role?.id === user
            ? role.value
            : 'student'
      }
      key={user}
    >
      <Shell
        switchPerson={setPerson}
        exitDemo={exitDemo}
        theme={theme}
        toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        install={install}
      />
    </WorkspaceProvider>
  );
}
