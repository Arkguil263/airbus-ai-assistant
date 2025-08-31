import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, secretWord: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  verifySecretWord: (secretWord: string) => Promise<{ isValid: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const verifySecretWord = async (secretWord: string) => {
    try {
      // Call the secure edge function to verify the secret word
      const { data, error } = await supabase.functions.invoke('verify-secret', {
        body: { secretWord }
      });

      if (error) {
        console.error('Error calling verify-secret function:', error);
        return { isValid: false, error: "Error verifying secret word. Please try again." };
      }

      return { 
        isValid: data.isValid, 
        error: data.error 
      };
    } catch (err) {
      console.error('Unexpected error in verifySecretWord:', err);
      return { isValid: false, error: "Error verifying secret word. Please try again." };
    }
  };

  const signUp = async (email: string, password: string, secretWord: string) => {
    // First verify the secret word
    const secretVerification = await verifySecretWord(secretWord);
    if (!secretVerification.isValid) {
      return { error: { message: secretVerification.error } };
    }

    // If secret word is valid, proceed with registration
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      verifySecretWord,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}