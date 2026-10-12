import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Paper } from '@mui/material/';
import { useLogto } from '@logto/react';
import { PAGE_TITLES, POST_SIGN_IN_REDIRECT_KEY } from 'shared/constants';
import useBrowserTitle from 'hooks/useBrowserTitle';
import { LoginPageContainer, LoginContainer, LoginTitle } from './LoginStyles';

type Props = {};

// Logto has no embeddable sign-in form (unlike Amplify's <Authenticator>) —
// it redirects to its own hosted sign-in page. This view's only job is to
// kick off that redirect; /callback (Callback.tsx) picks the user back up.
const Login = (props: Props) => {
    const { t } = useTranslation('auth');
    useBrowserTitle(PAGE_TITLES.LOGIN);
    const { signIn, isAuthenticated } = useLogto();
    const location = useLocation();

    useEffect(() => {
        if (!isAuthenticated) {
            // RequireAuth (AppRoutes.tsx) passes the path it redirected from
            // as router state, but that state doesn't survive the full-page
            // redirect to Logto's hosted domain below — stash it so
            // Callback.tsx can send the user back where they started.
            const from = (location.state as { from?: string } | null)?.from;
            if (from) {
                sessionStorage.setItem(POST_SIGN_IN_REDIRECT_KEY, from);
            }
            signIn(`${window.location.origin}/callback`);
        }
    }, [isAuthenticated, signIn, location.state]);

    return (
        <LoginPageContainer role="page">
            <Paper elevation={6}>
                <LoginContainer>
                    <LoginTitle variant="h5">
                        {t('redirectingToSignIn')}
                    </LoginTitle>
                </LoginContainer>
            </Paper>
        </LoginPageContainer>
    );
};

export default Login;
