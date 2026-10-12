import macaroniDance from 'resources/images/macaroni_dance.gif';
import { Card, Typography } from '@mui/material/';
import { useTranslation } from 'react-i18next';

type Props = {
    page: string;
};

const LoginMessage = (props: Props) => {
    const { page } = props;
    const { t } = useTranslation('auth');
    const key =
        (
            {
                createSet: 'messages.createSet',
                login: 'messages.alreadyLoggedIn',
                signup: 'messages.logoutToSignup',
                profile: 'messages.loginToViewProfile',
                home: 'messages.loginToViewHome',
            } as Record<string, string>
        )[page] ?? page;

    const messageStyling = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-60%, -70%)',
        minWidth: '40rem',
        maxWidth: '40rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '1.25rem',
        textAlign: 'center',
    };

    return (
        <Card sx={messageStyling} raised>
            <Typography variant="h5" style={{ fontWeight: 'bold' }}>
                {t(key)}
            </Typography>
            <img src={macaroniDance} alt="Macaroni dancing" />
        </Card>
    );
};

export default LoginMessage;
