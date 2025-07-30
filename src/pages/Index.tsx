import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold mb-4">Welcome to Your Chat Agent</h1>
          <p className="text-xl text-muted-foreground mb-6">Sign in to start chatting</p>
          <Button asChild>
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Chat Agent</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Signed in as {user.email}
            </span>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4">
        <div className="text-center py-12">
          <h2 className="text-3xl font-bold mb-4">Welcome to Your Chat Agent</h2>
          <p className="text-xl text-muted-foreground">
            Ready to build your OpenAI assistant integration!
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
