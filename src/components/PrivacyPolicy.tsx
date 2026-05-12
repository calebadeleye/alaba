/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

const PrivacyPolicy: React.FC<{ onBack: () => void }> = ({ onBack }) => {
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
            <Lock size={32} />
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-black tracking-tighter text-on-surface">Privacy & Data Residency</h1>
          <p className="text-on-surface-variant font-medium text-lg">Your data, globally secured and locally respected.</p>
        </header>

        <div className="bg-surface-container rounded-[2.5rem] p-8 md:p-12 border border-outline-variant shadow-xl prose prose-invert max-w-none prose-p:text-on-surface-variant prose-headings:text-on-surface prose-headings:font-display prose-headings:font-black">
          <h2>1. Data Collection</h2>
          <p>We collect personal information such as your name, email, phone number, and address to provide and improve our hosting services. We also collect technical data including IP addresses and access logs for security purposes.</p>

          <h2>2. Data Usage</h2>
          <p>Your data is used to manage your account, process payments, and provide customer support. We do not sell your personal data to third parties.</p>

          <h2>3. Data Residency & Sovereignty</h2>
          <p>Alaba operates nodes in multiple geographic regions. By default, your account data is stored in the region closest to your registration address to ensure low latency and compliance with local data protection laws (e.g., GDPR, CCPA, NDPR).</p>

          <h2>4. Security Measures</h2>
          <p>We use industry-standard encryption (AES-256) to protect your data at rest and in transit. Payments are processed by PCI-DSS compliant providers.</p>

          <h2>5. Cookies and Tracking</h2>
          <p>We use functional cookies to maintain your session and preferences. Analytics tracking is used to optimize server performance and UI experience.</p>

          <h2>6. Your Rights</h2>
          <p>You have the right to access, correct, or delete your personal data. Please contact our support center for any data-related requests.</p>

          <h2>7. Data Retention</h2>
          <p>We retain your data for as long as your account is active. Upon cancellation, data is securely purged after 30 days unless required otherwise by law.</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
