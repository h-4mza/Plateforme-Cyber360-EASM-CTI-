import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { invitationsApi } from '../../api/endpoints';

export const AcceptInvitationPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    full_name: '',
    password: '',
    confirm_password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password && formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (!token) {
      setError('Jeton d\'invitation manquant.');
      return;
    }

    setIsSubmitting(true);
    try {
      await invitationsApi.accept(token, {
        full_name: formData.full_name,
        password: formData.password || undefined
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'L\'invitation est invalide ou a expiré.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen auth-bg flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center mx-auto mb-4 border border-green-500/30">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Invitation acceptée !</h2>
          <p className="text-slate-400 mb-6">Votre compte a été créé avec succès.</p>
          <p className="text-sm text-slate-500">Redirection vers la page de connexion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 shadow-[0_0_20px_rgba(6,182,212,0.4)] mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Rejoindre l'organisation</h1>
          <p className="text-slate-400">Complétez votre profil pour accepter l'invitation</p>
        </div>

        <div className="glass-card p-8">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-text">Nom complet</label>
              <input type="text" required name="full_name" value={formData.full_name} onChange={handleChange} className="input-field" placeholder="Jean Dupont" />
            </div>

            <div>
              <label className="label-text">Mot de passe</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required name="password" value={formData.password} onChange={handleChange} className="input-field pr-10" placeholder="Min. 8 caractères" minLength={8} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="label-text">Confirmer le mot de passe</label>
              <input type={showPassword ? "text" : "password"} required name="confirm_password" value={formData.confirm_password} onChange={handleChange} className="input-field" placeholder="Min. 8 caractères" />
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full mt-4 py-2.5">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Accepter l\'invitation'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/login" className="text-sm text-slate-400 hover:text-white transition-colors">
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
