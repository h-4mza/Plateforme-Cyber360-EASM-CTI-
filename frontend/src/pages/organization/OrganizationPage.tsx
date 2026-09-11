import React, { useEffect, useState } from 'react';
import { Building2, Save, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { organizationApi } from '../../api/endpoints';
import { Organization } from '../../types';

const SECTORS = ["Technologie", "Finance", "Santé", "Éducation", "Commerce", "Industrie", "Services", "Gouvernement", "Autre"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];
const COUNTRIES = ["Maroc", "France", "Belgique", "Canada", "Suisse", "Tunisie", "Algérie", "Sénégal", "Côte d'Ivoire", "Autre"];

export const OrganizationPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [org, setOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState<Partial<Organization>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchOrg = async () => {
      try {
        const data = await organizationApi.getMyOrg();
        setOrg(data);
        setFormData(data);
      } catch (error) {
        setMessage({ text: 'Erreur lors du chargement des informations.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrg();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setIsSaving(true);
    setMessage({ text: '', type: '' });
    try {
      const updated = await organizationApi.updateMyOrg({
        name: formData.name,
        sector: formData.sector,
        size: formData.size,
        country: formData.country,
        primary_contact_email: formData.primary_contact_email
      });
      setOrg(updated);
      setMessage({ text: 'Informations mises à jour avec succès.', type: 'success' });
    } catch (error) {
      setMessage({ text: 'Erreur lors de la mise à jour.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Building2 className="w-7 h-7 text-cyan-400" />
          Mon Organisation
        </h1>
        <p className="text-slate-400">Gérez les informations de votre entreprise.</p>
      </div>

      <div className="glass-card p-6 md:p-8">
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'
          } border`}>
            {message.type === 'success' && <Check className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="label-text">Nom de l'organisation</label>
              <input type="text" name="name" value={formData.name || ''} onChange={handleChange} disabled={!isAdmin} className="input-field disabled:opacity-50" required />
            </div>

            <div>
              <label className="label-text">Email de contact principal</label>
              <input type="email" name="primary_contact_email" value={formData.primary_contact_email || ''} onChange={handleChange} disabled={!isAdmin} className="input-field disabled:opacity-50" required />
            </div>

            <div>
              <label className="label-text">Secteur d'activité</label>
              <select name="sector" value={formData.sector || ''} onChange={handleChange} disabled={!isAdmin} className="select-field disabled:opacity-50">
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="label-text">Taille de l'entreprise</label>
              <select name="size" value={formData.size || ''} onChange={handleChange} disabled={!isAdmin} className="select-field disabled:opacity-50">
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="label-text">Pays</label>
              <select name="country" value={formData.country || ''} onChange={handleChange} disabled={!isAdmin} className="select-field disabled:opacity-50">
                {COUNTRIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {isAdmin && (
            <div className="pt-4 border-t border-white/10 flex justify-end">
              <button type="submit" disabled={isSaving} className="btn-primary gap-2">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Enregistrer les modifications
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
