/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

const TermsOfService: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-surface p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors font-bold uppercase text-[10px] tracking-widest"
        >
          <ArrowLeft size={16} />
          Back to Registration
        </button>

        <header className="space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-black tracking-tighter text-on-surface">Terms of Service</h1>
          <p className="text-on-surface-variant font-medium text-lg">Last updated: April 25, 2026</p>
        </header>

        <div className="bg-surface-container rounded-[2.5rem] p-8 md:p-12 border border-outline-variant shadow-xl prose prose-invert max-w-none prose-p:text-on-surface-variant prose-headings:text-on-surface prose-headings:font-display prose-headings:font-black">
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing and using Alaba's hosting services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>

          <h2>2. Service Provisioning</h2>
          <p>Alaba provides cloud hosting and infrastructure services. We reserve the right to modify or discontinue services at any time. We are not responsible for data loss due to user negligence or failure to maintain backups.</p>

          <h2>3. User Responsibilities</h2>
          <p>Users are responsible for maintaining the security of their accounts and passwords. Any illegal activity performed using Alaba resources will result in immediate termination of service without refund.</p>

          <h2>4. Billing and Payments</h2>
          <p>Subscription fees are billed in advance. All payments are processed through secure third-party gateways (Paystack/Flutterwave). Refunds are handled on a case-by-case basis according to our refund policy.</p>

          <h2>5. Service Level Agreement (SLA)</h2>
          <p>We aim for 99.9% uptime. Scheduled maintenance will be communicated via the dashboard or email at least 24 hours in advance.</p>

          <h2>6. Limitation of Liability</h2>
          <p>Alaba shall not be liable for any indirect, incidental, or consequential damages resulting from the use or inability to use our services.</p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
