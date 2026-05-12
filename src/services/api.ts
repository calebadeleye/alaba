import { type Account } from '../types';

export interface ProvisioningTask {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
}

const API_BASE = '/api';

const getHeaders = (headers: Record<string, string> = {}) => {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  } else {
    console.warn('[API] getHeaders called but NO token found in localStorage');
  }
  return authHeaders;
};

export const AccountService = {
  async getAccounts(): Promise<Account[]> {
    const res = await fetch(`${API_BASE}/accounts`, { headers: getHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch accounts: ${res.status}`);
    }
    return res.json();
  },

  async provisionAccount(data: { domain: string; user: string; package: string; email: string; password?: string; phone?: string; country?: string; domainAction?: string; paymentMethod?: string; total?: number; vat?: number; transactionFee?: number; currency?: string }): Promise<{ taskId: string; invoiceId?: number }> {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start registration');
    }
    return res.json();
  },

  async checkDomainAvailability(domain: string): Promise<{ available: boolean }> {
    const res = await fetch(`${API_BASE}/domains/check?domain=${domain}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to check domain availability');
    return res.json();
  },

  async getTaskStatus(taskId: string): Promise<ProvisioningTask> {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch task status');
    return res.json();
  },

  // --- Email Services ---
  async getEmailAccounts(accountId?: string): Promise<any[]> {
    const url = accountId ? `${API_BASE}/emails?account_id=${accountId}` : `${API_BASE}/emails`;
    console.log(`[API] Fetching emails from: ${url}`);
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) {
      if (res.status === 401) {
        console.error('[API] Authentication required for /emails');
      }
      throw new Error(`Failed to fetch email accounts: ${res.status}`);
    }
    return res.json();
  },

  async createEmailAccount(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/emails`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create email account');
    return res.json();
  },

  async updateEmailAccount(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/emails/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update email account');
    return res.json();
  },

  async deleteEmailAccount(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/emails/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete email account');
  },

  async getPHPDomains(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/php-domains`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch PHP domains');
    return res.json();
  },

  async getDNSRecords(domain?: string): Promise<any[]> {
    const url = domain ? `${API_BASE}/dns-records?domain=${domain}` : `${API_BASE}/dns-records`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch DNS records');
    return res.json();
  },

  async createDNSRecord(data: { domain: string; type: string; name: string; content: string; ttl?: number; proxied?: boolean }): Promise<void> {
    const res = await fetch(`${API_BASE}/dns-records`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create DNS record');
  },

  async deleteDNSRecord(domain: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/dns-records/${domain}/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete DNS record');
  },

  async getSSOPhpMyAdmin(dbName: string): Promise<{ url: string }> {
    const res = await fetch(`${API_BASE}/sso/phpmyadmin/${dbName}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to initialize phpMyAdmin SSO');
    return res.json();
  },

  async getSSOWebmail(email: string): Promise<{ url: string }> {
    const res = await fetch(`${API_BASE}/sso/webmail/${email}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to initialize Webmail SSO');
    return res.json();
  },

  async updateDNSRecord(domain: string, id: string, data: any): Promise<void> {
    const res = await fetch(`${API_BASE}/dns-records/${domain}/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update DNS record');
  },

  async getSQLDatabases(): Promise<{ databases: any[], users: any[] }> {
    const res = await fetch(`${API_BASE}/databases`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch SQL databases');
    return res.json();
  },

  async createDatabase(data: { name: string; hosting_account_id: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/databases/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create database');
    }
    return res.json();
  },

  async createDatabaseUser(data: { user: string; password: any; hosting_account_id: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/databases/users/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create database user');
    }
    return res.json();
  },

  async assignUserToDatabase(data: { database_id: number; db_user_id: number; privileges: string[] }): Promise<any> {
    const res = await fetch(`${API_BASE}/databases/assign-user`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to assign user to database');
    }
    return res.json();
  },

  async deleteDatabase(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/databases/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete database');
  },

  async deleteDatabaseUser(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/databases/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete database user');
  },

  async getServerStats() {
    const res = await fetch(`${API_BASE}/stats`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch system stats');
    return res.json();
  },

  async getGlobalHistory(): Promise<{ cpu: number[], ram: number[], bw: number[] }> {
    const res = await fetch(`${API_BASE}/stats/history`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch global history');
    return res.json();
  },

  async getFinanceData(): Promise<{ stats: any, records: any[] }> {
    const res = await fetch(`${API_BASE}/finance`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch finance data');
    return res.json();
  },

  async getPlans(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/plans`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch plans');
    return res.json();
  },

  async createPlan(data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/plans`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create plan');
    return res.json();
  },

  async updatePlan(id: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/plans/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update plan');
    return res.json();
  },

  async deletePlan(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/plans/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete plan');
  },

  async getAccount(id: string): Promise<Account> {
    const res = await fetch(`${API_BASE}/accounts/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch account');
    return res.json();
  },

  async getEnforcementLogs(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/admin/enforcement-logs`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch enforcement logs');
    return res.json();
  },

  async getSSLCertificates(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/ssl-certificates`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch SSL certificates');
    return res.json();
  },

  async runAutoSSL(hostingAccountId: string): Promise<{ taskId: string }> {
    const res = await fetch(`${API_BASE}/ssl-certificates/autossl`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ hosting_account_id: hostingAccountId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'AutoSSL failed');
    }
    return res.json();
  },

  async installSSLCertificate(data: { hosting_account_id: string; domain: string; certificate: string; private_key: string; ca_bundle?: string }): Promise<void> {
    const res = await fetch(`${API_BASE}/ssl-certificates/install`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Certificate installation failed');
    }
  },

  async getBackupSnapshots(accountId?: string): Promise<any[]> {
    const url = accountId ? `${API_BASE}/backups?accountId=${accountId}` : `${API_BASE}/backups`;
    const res = await fetch(url, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch backups');
    return res.json();
  },

  async getMonitoredServices(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/monitored-services`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch monitored services');
    return res.json();
  },

  async restartService(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/services/${id}/restart`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to restart service');
    return res.json();
  },

  async getAccountHistory(id: string): Promise<{ cpu: number[], ram: number[], disk: number[], bw: number[] }> {
    const res = await fetch(`${API_BASE}/accounts/${id}/history`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch account history');
    return res.json();
  },

  async updateAccount(id: string, data: Partial<Account>): Promise<Account> {
    const res = await fetch(`${API_BASE}/accounts/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update account');
    return res.json();
  },

  async approveAccount(id: string): Promise<{ success: boolean; account: Account }> {
    const res = await fetch(`${API_BASE}/accounts/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to approve account');
    return res.json();
  },

  async terminateAccount(id: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE}/accounts/${id}/terminate`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Termination failed');
    }
  },

  async adminResetCustomerPassword(accountId: string, newPassword: any): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/reset-customer-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ accountId, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Identity restoration failed');
    }
  },

  async getGlobalSettings(): Promise<any> {
    const res = await fetch(`${API_BASE}/settings`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async updateGlobalSettings(settings: any): Promise<any> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  async getPaymentGateways(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/payment-gateways`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch payment gateways');
    return res.json();
  },

  async updatePaymentGateway(name: string, data: any): Promise<any> {
    const res = await fetch(`${API_BASE}/payment-gateways/${name}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update payment gateway');
    return res.json();
  },

  async getCoupons(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/coupons`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch coupons');
    return res.json();
  },

  async validateCoupon(code: string): Promise<any> {
    const res = await fetch(`${API_BASE}/coupons/validate?code=${code}`, { headers: getHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid coupon');
    }
    return res.json();
  },

  async createCoupon(data: any): Promise<void> {
    const res = await fetch(`${API_BASE}/coupons`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create coupon');
    }
  },

  async deleteCoupon(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/coupons/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete coupon');
  },

  async initiateStripeCheckout(data: any): Promise<{ url: string }> {
    const res = await fetch(`${API_BASE}/checkout/stripe`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to initiate Stripe checkout');
    }
    return res.json();
  },
  
  async getPendingTransfers(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/finance/pending`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch pending transfers');
    return res.json();
  },

  async approveTransfer(taskId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/finance/approve/${taskId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to approve transfer');
    return res.json();
  },

  async revertTransfer(taskId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/finance/revert/${taskId}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to revert transfer');
    return res.json();
  },

  async checkEmailAvailability(email: string): Promise<{ available: boolean }> {
    const res = await fetch(`${API_BASE}/auth/check-email?email=${email}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to check email availability');
    return res.json();
  },

  async sendVerificationCode(email: string): Promise<{ code?: string }> {
    const res = await fetch(`${API_BASE}/auth/send-verification`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error('Failed to send verification code');
    return res.json();
  },

  async verifySignupCode(email: string, code: string): Promise<void> {
    const res = await fetch(`${API_BASE}/auth/verify-code`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, code })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Verification failed');
    }
  },

  async login(credentials: { email: string; password: any }): Promise<{ user: any; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) throw new Error('Authentication failed');
    return res.json();
  },

  // --- Terminal & File APIs ---
  async executeTerminalCommand(command: string): Promise<{ output: string }> {
    const res = await fetch(`${API_BASE}/admin/terminal`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ command }),
    });
    if (!res.ok) throw new Error('Terminal execution failed');
    return res.json();
  },

  async getFiles(accountId: string, path: string = '/'): Promise<any[]> {
    const res = await fetch(`${API_BASE}/files?account_id=${accountId}&path=${path}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch files: ${res.status}`);
    return res.json();
  },

  async createFile(accountId: string, file: any): Promise<void> {
    const res = await fetch(`${API_BASE}/files`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ...file, account_id: accountId }),
    });
    if (!res.ok) throw new Error('Failed to save file');
  },

  async deleteFile(accountId: string, name: string, path: string = '/'): Promise<void> {
    const res = await fetch(`${API_BASE}/files?account_id=${accountId}&name=${name}&path=${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete file');
  },

  async searchFiles(accountId: string, query: string): Promise<any[]> {
    const res = await fetch(`${API_BASE}/files/search?account_id=${accountId}&query=${query}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },

  async extractZip(accountId: string, name: string, path: string = '/'): Promise<void> {
    const res = await fetch(`${API_BASE}/files/extract`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ account_id: accountId, name, path }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Extraction failed');
    }
  },

  // --- Profile & 2FA ---
  async updatePassword(data: { currentPassword: any; newPassword: any }): Promise<void> {
    const res = await fetch(`${API_BASE}/auth/update-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update password');
    }
  },

  async toggle2FA(data: { enabled: boolean; code?: string }): Promise<{ secret?: string }> {
    const res = await fetch(`${API_BASE}/auth/2fa/toggle`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to toggle 2FA');
    }
    return res.json();
  },

  async verify2FA(code: string): Promise<{ token: string }> {
    const res = await fetch(`${API_BASE}/auth/2fa/verify`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid verification code');
    }
    return res.json();
  },

  // --- Support Tickets ---
  async getTickets(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/tickets`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch tickets');
    return res.json();
  },

  async getTicket(id: number): Promise<{ ticket: any; replies: any[] }> {
    const res = await fetch(`${API_BASE}/tickets/${id}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch ticket details');
    return res.json();
  },

  async createTicket(data: { subject: string; department: string; priority: string; message: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/tickets`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create ticket');
    return res.json();
  },

  async replyTicket(id: number, message: string): Promise<any> {
    const res = await fetch(`${API_BASE}/tickets/${id}/reply`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error('Failed to send reply');
    return res.json();
  }
};
