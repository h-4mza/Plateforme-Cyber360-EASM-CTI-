export type UserRole = 'admin' | 'analyst' | 'readonly';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  sector: string;
  size: string;
  country: string;
  primary_contact_email: string;
  created_at: string;
  updated_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterPayload {
  email: string;
  password?: string;
  full_name: string;
  organization_name: string;
  sector: string;
  size: string;
  country: string;
  primary_contact_email: string;
}

export interface LoginPayload {
  email: string;
  password?: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface Invitation {
  id: string;
  email: string;
  role: UserRole;
  organization_id: string;
  invited_by_id: string;
  token: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
}

export interface CreateInvitationPayload {
  email: string;
  role: UserRole;
}

export interface AcceptInvitationPayload {
  password?: string;
  full_name: string;
}

export type DomainStatus = 'pending' | 'discovering' | 'active' | 'error';

export interface Domain {
  id: string;
  name: string;
  status: DomainStatus;
  organization_id: string;
  verification_token: string | null;
  ownership_verified: boolean;
  verified_at: string | null;
  added_by_id: string | null;
  last_discovery_at: string | null;
  dns_records?: {
    MX?: string[];
    NS?: string[];
    TXT?: string[];
  };
  security_checks?: any | null;
  active_recon_state: string;
  last_active_recon_at?: string | null;
  created_at: string;
  updated_at: string;
  relationship: 'own' | 'vendor';
}

export interface CreateDomainPayload {
  name: string;
  relationship?: 'own' | 'vendor';
}

export interface Asset {
  id: string;
  organization_id: string;
  type: 'root_domain' | 'subdomain' | 'ip' | 'certificate';
  hostname?: string | null;
  ip_address: string | null;
  status: string;
  domain_id: string;
  technology?: string | null;
  criticality: 'high' | 'medium' | 'low';
  cert_subject?: string;
  cert_issuer: string | null;
  cert_expires_at: string | null;
  cert_san: string | null;
  is_eol: boolean;
  eol_since: string | null;
  created_at: string;
  updated_at: string;
  open_risks_count: number;
}

export interface Risk {
  id: string;
  organization_id: string;
  asset_id: string;
  rule_key: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'resolved';
  first_detected_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  title: string;
  category: string;
  explanation: string;
  impact: string;
  recommendation: string;
  asset_target?: string;
  domain_id?: string;
  domain_name?: string;
  details?: any | null;
  is_active_recon?: boolean;
}

export interface CopilotAnalysis {
  explanation: string;
  business_impact: string;
  remediation_steps: string[];
  suggested_mitre_techniques: string[];
  confidence: number;
}

export interface RiskAICopilotResponse {
  id?: string;
  risk_id: string;
  status: 'success' | 'failed' | 'in_progress';
  error?: string;
  payload?: CopilotAnalysis;
  generated_at?: string;
  model_used?: string;
  validated_by_user: boolean;
}

export interface AssetCopilotAnalysis {
  summary: string;
  exposure_level: string;
  security_anomalies: string[];
  hardening_recommendations: string[];
  confidence: number;
}

export interface AssetAICopilotResponse {
  id?: string;
  asset_id: string;
  status: 'success' | 'failed' | 'in_progress';
  error?: string;
  payload?: AssetCopilotAnalysis;
  generated_at?: string;
  model_used?: string;
}

export interface ComplianceRiskDetail {
  id: string;
  rule_key: string;
  title: string;
  asset_target?: string;
}

export interface ComplianceControl {
  control_id: string;
  domain: string;
  title: string;
  mapped_rule_keys: string[];
  status: 'conforme' | 'non_conforme' | 'non_evaluable';
  open_risks_count: number;
  open_risks_details: ComplianceRiskDetail[];
  message?: string;
}

export interface ComplianceFramework {
  framework_key: string;
  name: string;
  authority: string;
  controls: ComplianceControl[];
  score: number;
  compliant_total: number;
  evaluable_total: number;
  non_evaluable_total: number;
  evaluated_at: string;
}

export interface ScenarioRiskDetail {
  id: string;
  rule_key: string;
  asset_target?: string;
  attack_techniques: string[];
}

export interface AttackScenario {
  id: string;
  scenario_key: string;
  title: string;
  severity: string;
  explanation: string;
  status: string;
  created_at: string;
  risks: ScenarioRiskDetail[];
}

export interface OrgBenchmarkResponse {
  is_available: boolean;
  sector?: string;
  org_score?: number;
  percentile_25?: number;
  percentile_50?: number;
  percentile_75?: number;
  position_text?: string;
}
