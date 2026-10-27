/**
 * Routes (one per screen) and the data refresh wiring.
 * Whenever the demo data or the signed-in user changes, all screens refetch.
 *
 * Two views share the same addresses: the Simple view (src/simple/, the default) and the Full view
 * (src/components/Layout.tsx and src/pages/). <ByView> picks the page for the current view, so the
 * Simple / Full switch keeps you on the same page. Pages without a Simple version yet show their
 * Full version inside the Simple frame.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { subscribe } from './demo/store'
import { subscribeSession } from './demo/session'
import { useSessionUserId } from './api/hooks'
import { usePrefs, useTextSize, useThemeClass } from './components/prefs'
import { AppShell } from './components/Layout'
import { ToastProvider } from './components/toast'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage, ArchivePage } from './pages/DashboardPage'
import { NewProjectPage } from './pages/NewProjectPage'
import { ProjectHomePage } from './pages/ProjectHomePage'
import { TeamPage } from './pages/TeamPage'
import { IntakePage } from './pages/intake/IntakePage'
import { MyWorkPage } from './pages/MyWorkPage'
import { DocumentPage } from './pages/document/DocumentPage'
import { ChangesPage } from './pages/ChangesPage'
import { DecisionsPage } from './pages/DecisionsPage'
import { ChatRedirect, MessagesPage } from './pages/chat/ChatPage'
import { TestingPage } from './pages/testing/TestingPage'
import { DefectPage } from './pages/testing/DefectPage'
import { NotificationsPage, MailboxPage } from './pages/NotificationsPage'
import { AdminPage } from './pages/AdminPage'
import { AuditPage } from './pages/AuditPage'
import { OpenQuestionsPage, HowItWorksPage } from './pages/InfoPages'
import { PrintPage } from './pages/PrintPage'
import { SimpleShell } from './simple/SimpleShell'
import { TodoPage } from './simple/TodoPage'
import { ProjectsPage } from './simple/ProjectsPage'
import { SimpleProjectPage } from './simple/ProjectPage'
import { SimpleDocumentPage } from './simple/DocumentPage'
import { SimpleQuestionsPage } from './simple/QuestionsPage'
import { HelpPage } from './simple/HelpPage'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false } } })

function DataRefresh() {
  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries()
    const a = subscribe(refresh)
    const b = subscribeSession(refresh)
    return () => {
      a()
      b()
    }
  }, [])
  return null
}

/** Light or dark mode and the text size on <html>. The print view is always light and normal size, like paper. */
function Theme() {
  const location = useLocation()
  const print = location.pathname.startsWith('/print/')
  useThemeClass(print)
  useTextSize(print)
  return null
}

/** The Simple or Full frame, as chosen with the Simple / Full switch. */
function Shell() {
  const { view } = usePrefs()
  return view === 'simple' ? <SimpleShell /> : <AppShell />
}

/** The page for the current view. */
function ByView({ simple, full }: { simple: ReactNode; full: ReactNode }) {
  const { view } = usePrefs()
  return <>{view === 'simple' ? simple : full}</>
}

function RequireLogin({ children }: { children: ReactNode }) {
  const uid = useSessionUserId()
  const location = useLocation()
  if (!uid) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <>{children}</>
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <DataRefresh />
          <Theme />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/print/:versionId" element={<RequireLogin><PrintPage /></RequireLogin>} />
            <Route element={<RequireLogin><Shell /></RequireLogin>}>
              <Route path="/" element={<ByView simple={<TodoPage />} full={<DashboardPage />} />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/questions" element={<ByView simple={<SimpleQuestionsPage />} full={<Navigate to="/my-work?tab=questions" replace />} />} />
              <Route path="/reports" element={<DashboardPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/archive" element={<ArchivePage />} />
              <Route path="/projects/new" element={<NewProjectPage />} />
              <Route path="/projects/:pid" element={<ByView simple={<SimpleProjectPage />} full={<ProjectHomePage />} />} />
              <Route path="/projects/:pid/team" element={<TeamPage />} />
              <Route path="/projects/:pid/intake" element={<IntakePage />} />
              <Route path="/projects/:pid/docs/:type" element={<ByView simple={<SimpleDocumentPage />} full={<DocumentPage />} />} />
              <Route path="/projects/:pid/docs/:type/tools" element={<DocumentPage />} />
              <Route path="/projects/:pid/changes" element={<ChangesPage />} />
              <Route path="/projects/:pid/decisions" element={<DecisionsPage />} />
              <Route path="/projects/:pid/chat" element={<ChatRedirect />} />
              <Route path="/projects/:pid/chat/:chatId" element={<ChatRedirect />} />
              <Route path="/projects/:pid/testing/:stage" element={<TestingPage />} />
              <Route path="/projects/:pid/defects/:defectId" element={<DefectPage />} />
              <Route path="/projects/:pid/audit" element={<AuditPage />} />
              <Route path="/my-work" element={<MyWorkPage />} />
              <Route path="/inbox/questions" element={<Navigate to="/my-work?tab=questions" replace />} />
              <Route path="/inbox/tests" element={<Navigate to="/my-work?tab=tests" replace />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/mailbox" element={<MailboxPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:chatId" element={<MessagesPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/open-questions" element={<OpenQuestionsPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="*" element={<div className="text-sm text-muted">Page not found.</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
