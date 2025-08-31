import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { validateEmail, validatePassword, authRateLimiter, registrationRateLimiter, logSecurityEvent } from '@/lib/validation';
import { AlertCircle, Check } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretWord, setSecretWord] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailErrors, setEmailErrors] = useState<string[]>([]);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [showPasswordStrength, setShowPasswordStrength] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect authenticated users to main page
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  // Validation functions
  const validateEmailInput = (emailValue: string) => {
    const result = validateEmail(emailValue);
    setEmailErrors(result.errors);
    return result.isValid;
  };

  const validatePasswordInput = (passwordValue: string) => {
    const result = validatePassword(passwordValue);
    setPasswordErrors(result.errors);
    return result.isValid;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limiting check
    if (!authRateLimiter.canAttempt(email)) {
      const remainingTime = Math.ceil(authRateLimiter.getRemainingTime(email) / 1000 / 60);
      toast({
        title: "Too many attempts",
        description: `Please wait ${remainingTime} minutes before trying again.`,
        variant: "destructive",
      });
      return;
    }

    // Validate inputs
    const isEmailValid = validateEmailInput(email);
    if (!isEmailValid) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    // Log security event
    logSecurityEvent({
      type: 'auth_attempt',
      email,
      success: !error,
      error: error?.message,
      userAgent: navigator.userAgent,
    });
    
    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Rate limiting check
    if (!registrationRateLimiter.canAttempt(email)) {
      const remainingTime = Math.ceil(registrationRateLimiter.getRemainingTime(email) / 1000 / 60);
      toast({
        title: "Too many registration attempts",
        description: `Please wait ${remainingTime} minutes before trying again.`,
        variant: "destructive",
      });
      return;
    }

    // Validate inputs
    const isEmailValid = validateEmailInput(email);
    const isPasswordValid = validatePasswordInput(password);
    
    if (!isEmailValid || !isPasswordValid) {
      toast({
        title: "Validation failed",
        description: "Please fix the errors below and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!secretWord.trim()) {
      toast({
        title: "Secret word required",
        description: "Please enter the secret word to register.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await signUp(email, password, secretWord);
    
    // Log security event
    logSecurityEvent({
      type: 'registration_attempt',
      email,
      success: !error,
      error: error?.message,
      userAgent: navigator.userAgent,
    });
    
    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
      // Clear secret word on failed attempts for security
      setSecretWord('');
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link to complete your registration.",
      });
      // Clear all fields on successful signup
      setEmail('');
      setPassword('');
      setSecretWord('');
      setEmailErrors([]);
      setPasswordErrors([]);
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Sign in to your account or create a new one</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                 <div className="space-y-2">
                   <Label htmlFor="signin-email">Email</Label>
                   <Input
                     id="signin-email"
                     type="email"
                     placeholder="Enter your email"
                     value={email}
                     onChange={(e) => {
                       setEmail(e.target.value);
                       if (e.target.value) validateEmailInput(e.target.value);
                     }}
                     className={emailErrors.length > 0 ? 'border-destructive' : ''}
                     required
                   />
                   {emailErrors.length > 0 && (
                     <div className="flex items-center gap-1 text-sm text-destructive">
                       <AlertCircle className="h-4 w-4" />
                       <span>{emailErrors[0]}</span>
                     </div>
                   )}
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="signin-password">Password</Label>
                   <Input
                     id="signin-password"
                     type="password"
                     placeholder="Enter your password"
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     required
                   />
                 </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-secret">Secret Word</Label>
                  <Input
                    id="signup-secret"
                    type="text"
                    placeholder="Enter secret word"
                    value={secretWord}
                    onChange={(e) => setSecretWord(e.target.value)}
                    required
                  />
                  <p className="text-sm text-destructive font-medium">
                    You need to know the secret word to register!
                  </p>
                </div>
                 <div className="space-y-2">
                   <Label htmlFor="signup-email">Email</Label>
                   <Input
                     id="signup-email"
                     type="email"
                     placeholder="Enter your email"
                     value={email}
                     onChange={(e) => {
                       setEmail(e.target.value);
                       if (e.target.value) validateEmailInput(e.target.value);
                     }}
                     className={emailErrors.length > 0 ? 'border-destructive' : ''}
                     required
                   />
                   {emailErrors.length > 0 && (
                     <div className="flex items-center gap-1 text-sm text-destructive">
                       <AlertCircle className="h-4 w-4" />
                       <span>{emailErrors[0]}</span>
                     </div>
                   )}
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="signup-password">Password</Label>
                   <Input
                     id="signup-password"
                     type="password"
                     placeholder="Create a password (min 8 chars, mixed case, numbers, symbols)"
                     value={password}
                     onChange={(e) => {
                       setPassword(e.target.value);
                       setShowPasswordStrength(e.target.value.length > 0);
                       if (e.target.value) validatePasswordInput(e.target.value);
                     }}
                     className={passwordErrors.length > 0 ? 'border-destructive' : ''}
                     required
                   />
                   {showPasswordStrength && (
                     <div className="space-y-1">
                       {passwordErrors.length > 0 ? (
                         <div className="flex items-center gap-1 text-sm text-destructive">
                           <AlertCircle className="h-4 w-4" />
                           <span>{passwordErrors[0]}</span>
                         </div>
                       ) : (
                         <div className="flex items-center gap-1 text-sm text-green-600">
                           <Check className="h-4 w-4" />
                           <span>Password meets security requirements</span>
                         </div>
                       )}
                       <div className="text-xs text-muted-foreground">
                         Password strength: 8+ chars, uppercase, lowercase, number, symbol
                       </div>
                     </div>
                   )}
                 </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;