import { useState } from 'react';
import { supabase } from './supabase';
import { Sparkles, Mail, Lock, LogIn, UserPlus, AlertCircle } from 'lucide-react';

export default function Login() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setSuccessMsg('Check your email for the confirmation link!');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                // Navigation is handled automatically by AuthContext + Router ProtectedRoutes
            }
        } catch (error: any) {
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-x-hidden">
            {/* Background blobs for premium feel */}
            <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-500/10 blur-[120px] mix-blend-screen pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-500/10 blur-[120px] mix-blend-screen pointer-events-none"></div>

            <div className="w-full max-w-md z-10">
                <div className="glass-card flex flex-col justify-center rounded-2xl p-8 transition-all h-full">
                    <header className="text-center mb-8">
                        <div className="inline-flex items-center justify-center p-3 bg-white/5 rounded-xl mb-6 ring-1 ring-white/10 shadow-xl">
                            <Sparkles className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2 tracking-tight text-white drop-shadow-sm">
                            {isSignUp ? 'Create Account' : 'Welcome Back'}
                        </h1>
                        <p className="text-slate-300 text-sm">
                            {isSignUp ? 'Sign up to start optimizing your resume' : 'Log in to continue optimizing'}
                        </p>
                    </header>

                    <form onSubmit={handleAuth} className="flex flex-col gap-4">

                        {/* Email Field */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                                <Mail className="w-5 h-5" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email Address"
                                required
                                className="w-full pl-11 pr-4 py-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                            />
                        </div>

                        {/* Password Field */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-400 transition-colors">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                required
                                className="w-full pl-11 pr-4 py-4 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
                            />
                        </div>

                        {errorMsg && (
                            <div className="mt-2 flex gap-2 text-rose-300 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 text-sm">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <p>{errorMsg}</p>
                            </div>
                        )}

                        {successMsg && (
                            <div className="mt-2 flex gap-2 text-emerald-300 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 text-sm">
                                <Sparkles className="w-5 h-5 flex-shrink-0" />
                                <p>{successMsg}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-4 w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] disabled:opacity-80 transition-all"
                        >
                            {loading ? 'Processing...' : isSignUp ? (
                                <><UserPlus className="w-5 h-5" /> Sign Up</>
                            ) : (
                                <><LogIn className="w-5 h-5" /> Sign In</>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="text-sm text-slate-300 hover:text-white transition-colors"
                        >
                            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
