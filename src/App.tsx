import { HashRouter, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import Today from './screens/Today';
import SessionRunner from './screens/SessionRunner';
import Progress from './screens/Progress';
import Body from './screens/Body';
import Program from './screens/Program';
import Review from './screens/Review';
import Settings from './screens/Settings';
import Auth from './screens/Auth';

const TABS = [
  { to: '/', label: 'Today' },
  { to: '/progress', label: 'Progress' },
  { to: '/body', label: 'Body' },
  { to: '/program', label: 'Program' },
  { to: '/more', label: 'More' },
];

function TabBar() {
  return (
    <nav className="flex h-14 shrink-0 border-t border-line bg-surface">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) =>
            `flex flex-1 min-w-11 min-h-11 items-center justify-center text-xs uppercase tracking-wide ${
              isActive ? 'text-text' : 'text-muted'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl text-text">Not found</h1>
      <p className="mt-2 text-sm text-muted">
        That page doesn't exist.{' '}
        <button className="underline" onClick={() => navigate('/')}>
          Back to Today
        </button>
      </p>
    </div>
  );
}

function TabbedLayout() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
      <TabBar />
    </div>
  );
}

function App() {
  return (
    <Auth>
      <HashRouter>
        <Routes>
          <Route element={<TabbedLayout />}>
            <Route path="/" element={<Today />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/body" element={<Body />} />
            <Route path="/program" element={<Program />} />
            <Route path="/more" element={<Settings />} />
            <Route path="/review" element={<Review />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/session/:date/:block" element={<SessionRunner />} />
        </Routes>
      </HashRouter>
    </Auth>
  );
}

export default App;
