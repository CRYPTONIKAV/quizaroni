import { lazy, ReactNode, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Landing from 'views/Landing/Landing';
import LoadingIndicator from 'shared/components/LoadingIndicator/LoadingIndicator';
import Login from 'views/Login/Login';
import Signup from 'views/Signup/Signup';
import Callback from 'views/Callback/Callback';
import { useLogto } from '@logto/react';

// Route-level code splitting: keep Landing eager (first paint for logged-out
// visitors); lazy-load everything else so heavy deps (jsPDF, data-grid,
// framer-motion, react-color, dicebear) stay out of the entry chunk.
const Home = lazy(() => import('views/Home/Home'));
const CreateSet = lazy(() => import('views/Create/CreateSet'));
const Profile = lazy(() => import('views/Profile/Profile'));
const ViewStudySet = lazy(() => import('views/ViewStudySet/ViewStudySet'));
const CombineSets = lazy(() => import('views/CombineSets/CombineSets'));
const Explore = lazy(() => import('views/Explore/Explore'));
const NotFound = lazy(() => import('views/NotFound/NotFound'));
const StudyMode = lazy(() => import('views/Study/StudyMode'));
const PublicStudySet = lazy(
    () => import('views/PublicStudySet/PublicStudySet')
);

type RequireAuthProps = {
    children: ReactNode;
    authenticated: boolean;
};

const RequireAuth = ({ children, authenticated }: RequireAuthProps) => {
    const location = useLocation();
    const from = location.pathname + location.search;
    return authenticated ? (
        <>{children}</>
    ) : (
        <Navigate to="/login" state={{ from }} replace />
    );
};

const AppRoutes = () => {
    const { isAuthenticated: authenticated } = useLogto();

    const protectedRoutes = [
        { path: '/create', element: <CreateSet /> },
        { path: '/create/:id', element: <CreateSet /> },
        { path: '/profile', element: <Profile /> },
        { path: '/explore', element: <Explore /> },
        { path: '/combine/:id', element: <CombineSets /> },
        { path: '/edit/:id', element: <CreateSet /> },
        { path: '/study/:studysetId/:mode', element: <StudyMode /> },
    ];

    return (
        <Suspense fallback={<LoadingIndicator />}>
            <Routes>
                {/* Public Routes */}
                <Route
                    path="/"
                    element={authenticated ? <Home /> : <Landing />}
                />
                <Route path="/login" element={<Login />} />
                <Route path="/signUp" element={<Signup />} />
                <Route path="/callback" element={<Callback />} />

                {/* Study set view — full owner experience when authenticated,
                    read-only public page (via the no-auth endpoint) otherwise.
                    ViewStudySet itself falls back to that public page when the
                    set isn't in the signed-in user's library. Keeping the same
                    URL means existing share links keep working for logged-out
                    visitors and crawlers. */}
                <Route
                    path="/view/:id"
                    element={
                        authenticated ? <ViewStudySet /> : <PublicStudySet />
                    }
                />

                {/* Protected Routes */}
                {protectedRoutes.map(({ path, element }) => (
                    <Route
                        key={path}
                        path={path}
                        element={
                            <RequireAuth authenticated={authenticated}>
                                {element}
                            </RequireAuth>
                        }
                    />
                ))}

                <Route path="*" element={<NotFound />} />
            </Routes>
        </Suspense>
    );
};

export default AppRoutes;
