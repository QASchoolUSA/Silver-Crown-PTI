import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { subscribeToAuthState, getFirebaseDb, type AppUser } from '@silver-crown/shared';
import type { User } from 'firebase/auth';

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return subscribeToAuthState((firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      } else {
        setProfile(null);
        setLoading(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      doc(getFirebaseDb(), 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ uid: user.uid, ...snap.data() } as AppUser);
        } else {
          setProfile(null);
        }
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  return <AuthContext.Provider value={{ user, profile, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
