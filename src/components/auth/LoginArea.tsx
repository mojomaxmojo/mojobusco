// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { useState, useEffect, lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { AccountSwitcher } from './AccountSwitcher';
import { cn } from '@/lib/utils';

// Lazy geladen: Dialoge erst beim ersten Öffnen nachladen (TBT-Optimierung –
// hält Form-Stack + Dialog-Code aus dem initialen Bundle)
const LoginDialog = lazy(() => import('./LoginDialog'));
const SignupDialog = lazy(() => import('./SignupDialog'));

export interface LoginAreaProps {
  className?: string;
}

export function LoginArea({ className }: LoginAreaProps) {
  const { currentUser } = useLoggedInAccounts();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [signupDialogOpen, setSignupDialogOpen] = useState(false);
  // Nach erstem Öffnen gemounted lassen → Close-Animation bleibt erhalten,
  // Chunk wird nicht erneut geladen
  const [loginMounted, setLoginMounted] = useState(false);
  const [signupMounted, setSignupMounted] = useState(false);

  const openLoginDialog = () => {
    setLoginMounted(true);
    setLoginDialogOpen(true);
  };

  const openSignupDialog = () => {
    setSignupMounted(true);
    setSignupDialogOpen(true);
  };

  // Listen for show-login event to open dialog from anywhere in the app
  useEffect(() => {
    const handleShowLogin = () => {
      openLoginDialog();
    };

    window.addEventListener('show-login', handleShowLogin);

    return () => {
      window.removeEventListener('show-login', handleShowLogin);
    };
  }, []);

  const handleLogin = () => {
    setLoginDialogOpen(false);
    setSignupDialogOpen(false);
  };

  return (
    <div className={cn("inline-flex items-center justify-center", className)}>
      {currentUser ? (
        <AccountSwitcher onAddAccountClick={openLoginDialog} />
      ) : (
        // EIN Button statt zwei (User-Wunsch 2026-10-01): „Log in" öffnet den
        // LoginDialog — der enthält bereits die prominente Sign-Up-Sektion,
        // über die der SignupDialog (onSignup-Flow) erreicht wird. Der
        // separate Header-Sign-Up-Button war redundant.
        <Button
          onClick={openLoginDialog}
          className='flex items-center gap-3 h-9 px-3 rounded-lg bg-transparent text-gray-900 dark:text-gray-100 text-sm font-medium transition-all hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95'
        >
          <span>Log in</span>
        </Button>
      )}

      {loginMounted && (
        <Suspense fallback={null}>
          <LoginDialog
            isOpen={loginDialogOpen}
            onClose={() => setLoginDialogOpen(false)}
            onLogin={handleLogin}
            onSignup={openSignupDialog}
          />
        </Suspense>
      )}

      {signupMounted && (
        <Suspense fallback={null}>
          <SignupDialog
            isOpen={signupDialogOpen}
            onClose={() => setSignupDialogOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}