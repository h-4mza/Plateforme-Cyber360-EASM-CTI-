import { apiClient } from './client';
import type {
  User, Organization, TokenPair, RegisterPayload, LoginPayload,
  Invitation, CreateInvitationPayload, AcceptInvitationPayload,
  Domain, CreateDomainPayload, UserRole, Asset, Risk, ComplianceFramework, AttackScenario, OrgBenchmarkResponse, RiskAICopilotResponse, AssetAICopilotResponse
} from '../types';

export const authApi = {
  login: async (payload: LoginPayload): Promise<TokenPair> => {
    const { data } = await apiClient.post<TokenPair>('/auth/login', payload);
    return data;
  },
  register: async (payload: RegisterPayload): Promise<User> => {
    const { data } = await apiClient.post<User>('/auth/register', payload);
    return data;
  },
  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/me');
    return data;
  }
};

export const organizationApi = {
  getMyOrg: async (): Promise<Organization> => {
    const { data } = await apiClient.get<Organization>('/organizations/me');
    return data;
  },
  updateMyOrg: async (payload: Partial<Organization>) => {
    const { data } = await apiClient.put<Organization>('/organizations/me', payload);
    return data;
  },
  getScore: async () => {
    const { data } = await apiClient.get<any>('/organizations/me/score');
    return data;
  },
  getDashboardStats: async () => {
    const { data } = await apiClient.get<any>('/organizations/me/dashboard/stats');
    return data;
  },
  getScoreHistory: async (days: number = 30) => {
    const { data } = await apiClient.get<any[]>('/organizations/me/score/history', { params: { days } });
    return data;
  },
  getFinancialExposure: async () => {
    const { data } = await apiClient.get<any>('/organizations/me/financial-exposure');
    return data;
  },
  getVendors: async () => {
    const { data } = await apiClient.get<any[]>('/organizations/me/vendors');
    return data;
  },
  getBecRisk: async () => {
    const { data } = await apiClient.get<any>('/organizations/me/dashboard/bec-risk');
    return data;
  }
};

export const membersApi = {
  listMembers: async (): Promise<User[]> => {
    const { data } = await apiClient.get<User[]>('/organizations/me/members');
    return data;
  },
  updateMemberRole: async (userId: string, role: UserRole): Promise<User> => {
    const { data } = await apiClient.put<User>(`/organizations/me/members/${userId}/role`, { role });
    return data;
  },
  removeMember: async (userId: string): Promise<void> => {
    await apiClient.delete(`/organizations/me/members/${userId}`);
  }
};

export const invitationsApi = {
  create: async (payload: CreateInvitationPayload): Promise<Invitation> => {
    const { data } = await apiClient.post<Invitation>('/invitations', payload);
    return data;
  },
  list: async (): Promise<Invitation[]> => {
    const { data } = await apiClient.get<Invitation[]>('/invitations');
    return data;
  },
  accept: async (token: string, payload: AcceptInvitationPayload): Promise<void> => {
    await apiClient.post(`/invitations/${token}/accept`, payload);
  },
  cancel: async (invitationId: string): Promise<void> => {
    await apiClient.delete(`/invitations/${invitationId}`);
  }
};

export const brandProtectionApi = {
  getBrandProtection: async () => {
    const { data } = await apiClient.get('/brand-protection/me');
    return data;
  },
  triggerScan: async (type: string) => {
    const { data } = await apiClient.post(`/brand-protection/me/scan/${type}`);
    return data;
  }
};

export const assetsApi = {
  list: async (params?: { search?: string; type?: string; criticality?: string }) => {
    const { data } = await apiClient.get<Asset[]>('/assets', { params });
    return data;
  },
  getAsset: async (id: string) => {
    const { data } = await apiClient.get<Asset>(`/assets/${id}`);
    return data;
  },
  update: async (id: string, payload: Partial<Asset>) => {
    const { data } = await apiClient.patch<Asset>(`/assets/${id}`, payload);
    return data;
  },
  forceCheck: async (id: string) => {
    const { data } = await apiClient.post(`/assets/${id}/check-now`);
    return data;
  },
  checkNow: async (id: string) => {
    const { data } = await apiClient.post(`/assets/${id}/check-now`);
    return data;
  },
  analyzeAI: async (id: string, force: boolean = false) => {
    const { data } = await apiClient.post<AssetAICopilotResponse>(`/assets/${id}/ai-analysis?force=${force}`);
    return data;
  },
  getRecentChecks: async (id: string) => {
    const { data } = await apiClient.get<{type: string, result: string, executed_at: string}[]>(`/assets/${id}/recent-checks`);
    return data;
  },
  getAssetHistory: async (id: string) => {
    const { data } = await apiClient.get(`/assets/${id}/history`);
    return data;
  },
  getAssetShodan: async (id: string) => {
    const { data } = await apiClient.get(`/assets/${id}/shodan`);
    return data;
  },
  getRelations: async (id: string) => {
    const { data } = await apiClient.get<any[]>(`/assets/${id}/relations`);
    return data;
  }
};

export const domainsApi = {
  create: async (payload: CreateDomainPayload): Promise<Domain> => {
    const { data } = await apiClient.post<Domain>('/domains', payload);
    return data;
  },
  list: async (): Promise<Domain[]> => {
    const { data } = await apiClient.get<Domain[]>('/domains');
    return data;
  },
  getById: async (id: string): Promise<Domain> => {
    const { data } = await apiClient.get<Domain>(`/domains/${id}`);
    return data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/domains/${id}`);
  },
  getAssets: async (id: string): Promise<Asset[]> => {
    const { data } = await apiClient.get<Asset[]>(`/domains/${id}/assets`);
    return data;
  },
  verify: async (id: string) => {
    const { data } = await apiClient.post(`/domains/${id}/verify`);
    return data;
  },
  triggerActiveRecon: async (id: string) => {
    const { data } = await apiClient.post(`/domains/${id}/active-recon`);
    return data;
  }
};

export const risksApi = {
  listOrgRisks: async (orgId: string, params?: { status?: string; severity?: string; category?: string; asset_id?: string; has_ai?: boolean }) => {
    const { data } = await apiClient.get<Risk[]>(`/organizations/${orgId}/risks`, { params });
    return data;
  },
  getById: async (id: string) => {
    const { data } = await apiClient.get<Risk>(`/risks/${id}`);
    return data;
  },
  resolveBulk: async (orgId: string, riskIds: string[]) => {
    const { data } = await apiClient.post(`/organizations/${orgId}/risks/bulk-resolve`, { risk_ids: riskIds });
    return data;
  },
  analyzeAI: async (riskId: string, force: boolean = false) => {
    const { data } = await apiClient.post<RiskAICopilotResponse>(`/risks/${riskId}/ai-analysis`, null, { params: { force } });
    return data;
  },
  validateAITechnique: async (riskId: string, techniqueId: string) => {
    const { data } = await apiClient.post(`/risks/${riskId}/ai-analysis/validate-technique`, { technique_id: techniqueId });
    return data;
  }
};
export const complianceApi = {
  list: (orgId: string): Promise<ComplianceFramework[]> =>
    apiClient.get(`/organizations/${orgId}/compliance`).then((res: any) => res.data),
};

export const scenariosApi = {
  list: (orgId: string): Promise<AttackScenario[]> =>
    apiClient.get(`/organizations/${orgId}/scenarios`).then((res: any) => res.data),
  getPath: (scenarioId: string): Promise<any> =>
    apiClient.get(`/scenarios/${scenarioId}/path`).then((res: any) => res.data),
};

export const benchmarksApi = {
  getOrgBenchmark: (orgId: string): Promise<OrgBenchmarkResponse> =>
    apiClient.get(`/organizations/${orgId}/benchmark`).then((res: any) => res.data),
};

export const attackApi = {
  getMatrix: async (domainId: string) => {
    const { data } = await apiClient.get<any>(`/attack/matrix?domain_id=${domainId}`);
    return data;
  },
  getTechnique: async (techniqueId: string, domainId: string) => {
    const { data } = await apiClient.get<any>(`/attack/technique/${techniqueId}?domain_id=${domainId}`);
    return data;
  },
  getGroup: async (groupId: string, domainId: string) => {
    const { data } = await apiClient.get<any>(`/attack/group/${groupId}?domain_id=${domainId}`);
    return data;
  },
  getCoverage: async (domainId: string) => {
    const { data } = await apiClient.get<any>(`/attack/coverage/${domainId}`);
    return data;
  },
  sync: async () => {
    const { data } = await apiClient.post<any>('/attack/sync');
    return data;
  }
};

export const threatLandscapeApi = {
  getBriefing: async (orgId: string, domainId?: string) => {
    const url = domainId ? `/organizations/${orgId}/threat-landscape/briefing?domain_id=${domainId}` : `/organizations/${orgId}/threat-landscape/briefing`;
    const { data } = await apiClient.get<any>(url);
    return data;
  },
  getActors: async (orgId: string, domainId?: string) => {
    const url = domainId ? `/organizations/${orgId}/threat-landscape/actors?domain_id=${domainId}` : `/organizations/${orgId}/threat-landscape/actors`;
    const { data } = await apiClient.get<any>(url);
    return data;
  }
};
