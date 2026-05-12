/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppMode = 'whm' | 'cpanel';

export type Screen = 
  | 'dashboard' 
  | 'accounts' 
  | 'account-details' 
  | 'configuration' 
  | 'services' 
  | 'backups' 
  | 'terminal'
  | 'finance'
  | 'plans'
  | 'cpanel-dashboard'
  | 'file-manager'
  | 'email-accounts'
  | 'databases'
  | 'dns-editor'
  | 'dns-config'
  | 'ips'
  | 'php-config'
  | 'ssl-manager'
  | 'cron-jobs'
  | 'onboarding'
  | 'profile'
  | 'support'
  | 'tickets';

export interface SupportTicket {
  id: number;
  subject: string;
  department: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'answered' | 'customer-reply' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface TicketReply {
  id: number;
  ticket_id: number;
  sender_type: 'customer' | 'admin';
  sender_id: number;
  message: string;
  created_at: string;
}

export interface GlobalSettings {
  defaultCurrency: 'USD' | 'NGN' | 'GBP' | 'EUR';
  exchangeRates?: Record<string, number>;
  vatEnabled: boolean;
  vatType: 'percentage' | 'flat';
  vatAmount: number;
  feeEnabled: boolean;
  feeType: 'percentage' | 'flat';
  feeAmount: number;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  specs: string[];
  currency: string;
  disk_space_mb?: number;
  bandwidth_mb?: number;
  max_databases?: number;
  max_db_users?: number;
  max_email_accounts?: number;
  max_ftp_accounts?: number;
  max_addon_domains?: number;
  max_subdomains?: number;
  free_ssl?: boolean;
  litespeed_enabled?: boolean;
  redis_enabled?: boolean;
  dedicated_ip_allowed?: boolean;
  backups_enabled?: boolean;
}

export interface Account {
  id: string;
  domain: string;
  user: string;
  ip: string;
  package: string;
  diskUsage: number;
  diskLimit: number;
  bwUsage: number;
  bwLimit: number;
  ramUsage: number;
  ramLimit: number;
  cpuUsage: number;
  cpuLimit: number;
  dbCount: number;
  emailCount: number;
  // Metadata & Quotas
  max_databases?: number | string;
  max_email_accounts?: number | string;
  // snake_case support for legacy components
  disk_usage?: number;
  disk_limit?: number;
  bw_usage?: number;
  bw_limit?: number;
  db_count?: number;
  email_count?: number;
  status: 'active' | 'suspended' | 'pending';
  statusReason?: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
  partition?: string;
}

export interface BackupSnapshot {
  id: string;
  date: string;
  type: 'Incremental' | 'Full';
  size: string;
  status: 'Healthy' | 'Warning' | 'Error';
}

export interface ServiceStatus {
  id: string;
  name: string;
  version: string;
  uptime: string;
  status: 'UP' | 'RESTARTING' | 'DOWN';
  initial: string;
}

export interface FinanceRecord {
  id: string;
  accountId: string;
  domain: string;
  amountPaid: number;
  vat: number;
  transactionFee: number;
  plan: string;
  nextRenewal: string;
  refund: number;
  currency: string;
  customerEmail: string;
  createdAt: string;
}
