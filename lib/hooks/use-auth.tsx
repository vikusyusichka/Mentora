"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onIdTokenChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import type { Role } from "@/lib/types";

export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "needs-onboarding" // увійшов, але роль ще не призначена
  | "authenticated";

interface AuthState {
  user: User | null;
  role: Role | null;
  status: AuthStatus;
  /** Примусово оновлює токен і перечитує роль із claims. */
  refreshRole: () => Promise<Role | null>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    // onIdTokenChanged спрацьовує і на зміну користувача, і на оновлення токена
    // (напр. після setCustomUserClaims + getIdToken(true)).
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole(null);
        setStatus("unauthenticated");
        return;
      }
      const token = await u.getIdTokenResult();
      const r = (token.claims.role as Role | undefined) ?? null;
      setUser(u);
      setRole(r);
      setStatus(r ? "authenticated" : "needs-onboarding");
    });
    return unsub;
  }, []);

  async function refreshRole(): Promise<Role | null> {
    const u = auth.currentUser;
    if (!u) return null;
    const token = await u.getIdTokenResult(true);
    const r = (token.claims.role as Role | undefined) ?? null;
    setRole(r);
    setStatus(r ? "authenticated" : "needs-onboarding");
    return r;
  }

  return (
    <AuthContext.Provider value={{ user, role, status, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth має використовуватись усередині <AuthProvider>");
  return ctx;
}
