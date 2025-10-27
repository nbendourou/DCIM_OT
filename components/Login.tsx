import React, { useState } from 'react';
import type { User } from '../types.ts';
import { PowerIcon, LoadingSpinnerIcon } from './icons.tsx';

interface LoginProps {
  onLogin: (user: User) => void;
  loginFn: (username: string, password: string) => Promise<User>;
}

const Login: React.FC<LoginProps> = ({ onLogin, loginFn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPasswordMessage, setShowForgotPasswordMessage] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowForgotPasswordMessage(false);
    setLoading(true);
    try {
      const user = await loginFn(username, password);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleForgotPassword = () => {
    setShowForgotPasswordMessage(true);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl p-8">
            <div className="flex flex-col items-center mb-6">
                <PowerIcon className="h-12 w-12 text-primary mb-3" />
                <h1 className="text-2xl font-bold text-slate-100">OT Power & Capacity</h1>
                <p className="text-slate-400">Veuillez vous connecter pour continuer</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="username" className="block text-sm font-medium text-slate-300">Nom d'utilisateur</label>
                    <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="mt-1 block w-full bg-slate-900 border border-slate-600 rounded-md shadow-sm p-3 focus:ring-primary focus:border-primary"
                    />
                </div>
                <div>
                    <label htmlFor="password"className="block text-sm font-medium text-slate-300">Mot de passe</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="mt-1 block w-full bg-slate-900 border border-slate-600 rounded-md shadow-sm p-3 focus:ring-primary focus:border-primary"
                    />
                </div>
                
                {error && (
                    <div className="bg-danger-red/20 text-danger-red text-sm p-3 rounded-md">
                        {error}
                    </div>
                )}
                
                {showForgotPasswordMessage && (
                    <div className="bg-sky-500/20 text-sky-300 text-sm p-3 rounded-md text-center">
                        Veuillez contacter votre administrateur à l'adresse <a href="mailto:orangetech.dc@gmail.com" className="font-bold text-sky-200 hover:underline">orangetech.dc@gmail.com</a> pour réinitialiser votre mot de passe.
                    </div>
                )}

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-hover disabled:bg-slate-600 disabled:cursor-wait"
                    >
                        {loading ? <LoadingSpinnerIcon className="w-5 h-5"/> : 'Se connecter'}
                    </button>
                </div>
            </form>

            <div className="mt-6 text-center text-sm">
                <button type="button" onClick={handleForgotPassword} className="text-primary hover:underline">
                    Mot de passe oublié ?
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;