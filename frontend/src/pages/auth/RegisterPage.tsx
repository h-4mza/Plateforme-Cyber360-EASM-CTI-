import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { RegisterPayload } from '../../types';

const SECTORS = ["Technologie", "Finance", "Santé", "Éducation", "Commerce", "Industrie", "Services", "Gouvernement", "Autre"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const COUNTRIES = ["Maroc", "France", "Belgique", "Canada", "Suisse", "Tunisie", "Algérie", "Sénégal", "Côte d'Ivoire", "Autre"];

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    organization_name: '',
    sector: SECTORS[0],
    size: SIZES[0],
    country: COUNTRIES[0],
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: RegisterPayload = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        organization_name: formData.organization_name,
        sector: formData.sector,
        size: formData.size,
        country: formData.country,
        primary_contact_email: formData.email
      };
      await register(payload);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Une erreur est survenue lors de la création du compte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen auth-bg flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-4xl animate-slide-up">
        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 shadow-[0_0_15px_rgba(6,182,212,0.4)] mb-4 hover:scale-105 transition-transform">
            <Shield className="w-6 h-6 text-white" />
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">Créer votre compte Cyber360</h1>
          <p className="text-slate-400">Rejoignez-nous pour sécuriser votre surface d'attaque externe</p>
        </div>

        <div className="glass-card p-6 md:p-8">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Left Column: User Info */}
              <div className="space-y-5">
                <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Informations personnelles</h3>
                
                <div>
                  <label className="label-text">Nom complet</label>
                  <input type="text" required name="full_name" value={formData.full_name} onChange={handleChange} className="input-field" placeholder="Jean Dupont" />
                </div>
                
                <div>
                  <label className="label-text">Adresse email professionnelle</label>
                  <input type="email" required name="email" value={formData.email} onChange={handleChange} className="input-field" placeholder="jean@entreprise.com" />
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
              </div>

              {/* Right Column: Organization Info */}
              <div className="space-y-5">
                <h3 className="text-lg font-medium text-white border-b border-white/10 pb-2">Informations de l'organisation</h3>
                
                <div>
                  <label className="label-text">Nom de l'organisation</label>
                  <input type="text" required name="organization_name" value={formData.organization_name} onChange={handleChange} className="input-field" placeholder="Entreprise SA" />
                </div>

                <div>
                  <label className="label-text">Secteur d'activité</label>
                  <select name="sector" value={formData.sector} onChange={handleChange} className="select-field">
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label-text">Taille de l'entreprise</label>
                  <select name="size" value={formData.size} onChange={handleChange} className="select-field">
                    {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label-text">Pays</label>
                  <select name="country" value={formData.country} onChange={handleChange} className="select-field">
                    {COUNTRIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col items-center gap-4">
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full md:w-auto md:min-w-[200px] py-3 text-lg">
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Créer mon compte'}
              </button>
              
              <Link to="/login" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                Déjà un compte ? Se connecter
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
