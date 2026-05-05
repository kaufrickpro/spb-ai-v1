import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  /** True while the initial session is being resolved from storage. */
  loading: boolean;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    // Resolve the current session on mount.
    void supabase.auth.getSession().then(({ data }) => {
      setState({
        session: data.session,
        user: data.session?.user ?? null,
        loading: false,
      });
    });

    // Keep state in sync with Supabase auth events (login, logout, refresh).
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState({ session, user: session?.user ?? null, loading: false });
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
