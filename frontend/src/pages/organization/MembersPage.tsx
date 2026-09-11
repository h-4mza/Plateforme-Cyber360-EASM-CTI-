import React, { useEffect, useState } from 'react';
import { Users, Mail, Loader2, Trash2, Shield, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { membersApi, invitationsApi } from '../../api/endpoints';
import { User, Invitation, UserRole } from '../../types';
import { RoleBadge } from '../../components/badges';

export const MembersPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [members, setMembers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('readonly');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState({ text: '', type: '' });

  const fetchData = async () => {
    try {
      const [membersData, invitesData] = await Promise.all([
        membersApi.listMembers(),
        isAdmin ? invitationsApi.list() : Promise.resolve([])
      ]);
      setMembers(membersData);
      setInvitations(invitesData);
    } catch (error) {
      console.error("Erreur de chargement", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setInviteMsg({ text: '', type: '' });
    try {
      await invitationsApi.create({ email: inviteEmail, role: inviteRole });
      setInviteMsg({ text: 'Invitation envoyée avec succès', type: 'success' });
      setInviteEmail('');
      fetchData();
    } catch (error: any) {
      setInviteMsg({ text: error.response?.data?.detail || 'Erreur lors de l\'invitation', type: 'error' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvite = async (id: string) => {
    if (!window.confirm("Annuler cette invitation ?")) return;
    try {
      await invitationsApi.cancel(id);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await membersApi.updateMemberRole(userId, newRole);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm("Retirer ce membre de l'organisation ?")) return;
    try {
      await membersApi.removeMember(userId);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Users className="w-7 h-7 text-purple-400" />
          Gestion des Membres
        </h1>
        <p className="text-slate-400">Gérez les accès à votre organisation.</p>
      </div>

      {isAdmin && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-cyan-400" />
            Inviter un nouveau membre
          </h2>
          
          {inviteMsg.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm border ${inviteMsg.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {inviteMsg.text}
            </div>
          )}

          <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="label-text">Adresse email</label>
              <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="input-field" placeholder="collegue@entreprise.com" />
            </div>
            <div className="w-full md:w-48">
              <label className="label-text">Rôle</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value as UserRole)} className="select-field">
                <option value="readonly">Lecture seule</option>
                <option value="analyst">Analyste</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <button type="submit" disabled={isInviting} className="btn-primary w-full md:w-auto h-[46px]">
              {isInviting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Envoyer l\'invitation'}
            </button>
          </form>

          {invitations.length > 0 && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <h3 className="text-sm font-medium text-slate-400 mb-4">Invitations en attente</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="table-header rounded-tl-lg">Email</th>
                      <th className="table-header">Rôle</th>
                      <th className="table-header">Date d'expiration</th>
                      <th className="table-header rounded-tr-lg text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map(inv => (
                      <tr key={inv.id} className="table-row">
                        <td className="table-cell">{inv.email}</td>
                        <td className="table-cell"><RoleBadge role={inv.role} /></td>
                        <td className="table-cell">{new Date(inv.expires_at).toLocaleDateString()}</td>
                        <td className="table-cell text-right">
                          <button onClick={() => handleCancelInvite(inv.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors" title="Annuler">
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-header">Membre</th>
                <th className="table-header">Rôle</th>
                <th className="table-header">Inscrit le</th>
                {isAdmin && <th className="table-header text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map(member => (
                <tr key={member.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{member.full_name} {member.id === user?.id && '(Vous)'}</span>
                      <span className="text-xs text-slate-400">{member.email}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    {isAdmin && member.id !== user?.id ? (
                      <select 
                        value={member.role} 
                        onChange={e => handleRoleChange(member.id, e.target.value as UserRole)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-300 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="readonly">Lecture seule</option>
                        <option value="analyst">Analyste</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </td>
                  <td className="table-cell">{new Date(member.created_at).toLocaleDateString()}</td>
                  {isAdmin && (
                    <td className="table-cell text-right">
                      {member.id !== user?.id && (
                        <button 
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Retirer le membre"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
