/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Briefcase, 
  Globe, 
  CreditCard, 
  ShieldCheck, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Zap,
  Server,
  Monitor,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  Building2,
  MapPin,
  Clock,
  ArrowRight,
  RefreshCw,
  Play,
  FileText,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatCurrency, AlabaIcon } from '../lib/utils';
import { toast } from 'sonner';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { AccountService, type ProvisioningTask } from '../services/api';
import TermsOfService from './TermsOfService';
import PrivacyPolicy from './PrivacyPolicy';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const COUNTRIES = [
  { name: 'United States', states: ['California', 'New York', 'Texas', 'Florida', 'Illinois'] },
  { name: 'United Kingdom', states: ['Greater London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow'] },
  { name: 'Nigeria', states: ['Lagos', 'Abuja', 'Kano', 'Oyo', 'Rivers'] },
  { name: 'Canada', states: ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba'] },
  { name: 'Germany', states: ['Berlin', 'Bavaria', 'Hamburg', 'Hesse', 'Saxony'] },
  { name: 'Australia', states: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia'] },
];

type WizardStep = 1 | 2 | 3 | 4 | 5;

export const RegistrationWizard: React.FC = () => {
  const { step } = useParams<{ step: string }>();
  const navigate = useNavigate();
  const currentStep = step ? parseInt(step) : 1;


  useEffect(() => {
    if (!step || parseInt(step) < 1 || parseInt(step) > 5) {
      navigate('/register/1', { replace: true });
    }
  }, [step, navigate]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);
  const [domainAvailability, setDomainAvailability] = useState<'available' | 'unavailable' | 'idle'>('idle');
  const [provisioningTask, setProvisioningTask] = useState<ProvisioningTask | null>(null);
  const [showToS, setShowToS] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [gateways, setGateways] = useState<any[]>([]);
  const invoiceRef = React.useRef<HTMLDivElement>(null);

  // Form State
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('registration_cart');
    const savedUser = localStorage.getItem('user');
    const user = savedUser ? JSON.parse(savedUser) : null;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (user) {
          parsed.fullName = user.full_name || parsed.fullName;
          parsed.email = user.email || parsed.email;
        }
        return parsed;
      } catch (e) {
        console.error("Failed to parse saved cart", e);
      }
    }
    return {
      // Step 1
      fullName: user?.full_name || '',
      email: user?.email || '',
      phone: '',
      password: '',
      confirmPassword: '',
      // Step 2
      company: '',
      country: 'Nigeria',
      state: 'Lagos',
      address: '',
      // Step 3
      domain: '',
      domainAction: 'existing' as 'new' | 'existing' | 'transfer',
      plan: '',
      billingCycle: 'monthly' as 'monthly' | 'yearly',
      // Step 4
      paymentMethod: 'paystack' as string,
      promoCode: '',
      autoRenew: true,
      invoiceId: null as number | null,
      // Step 5
      acceptToS: false,
      acceptPrivacy: false
    };
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const user = savedUser ? JSON.parse(savedUser) : null;
    if (user && currentStep === 1) {
      // Pre-fill form data with existing user info if not already set
      if (!formData.email) {
        setFormData(prev => ({
          ...prev,
          fullName: user.id === 'admin' ? 'Super Administrator' : (user.full_name || 'Valued Customer'),
          email: user.email,
          country: user.country || 'Nigeria',
          phone: user.phone || ''
        }));
      }
      navigate('/register/2', { replace: true });
    }
  }, [currentStep, navigate, formData.email]);

  const [discountInfo, setDiscountInfo] = useState<{ amount: number; type: 'percentage' | 'flat'; value: number } | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const validateCoupon = async () => {
    if (!formData.promoCode) return;
    setIsValidatingCoupon(true);
    try {
      const coupon = await AccountService.validateCoupon(formData.promoCode);
      setDiscountInfo({
        type: coupon.discount_type,
        value: coupon.discount_value,
        amount: 0 // Will be calculated in priceData
      });
      toast.success(`Coupon applied: ${coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `${formatCurrency(coupon.discount_value, 'USD')}`} discount`);
    } catch (err: any) {
      toast.error(err.message || 'Invalid coupon');
      setDiscountInfo(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Save cart to localStorage
  useEffect(() => {
    localStorage.setItem('registration_cart', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    AccountService.getGlobalSettings().then(setGlobalSettings).catch(err => console.error("Failed to load settings", err));
    AccountService.getPlans().then(data => {
      setPlans(data);
      if (data.length > 0 && !formData.plan) {
        setFormData(prev => ({ ...prev, plan: data[0].id }));
      }
    }).catch(err => console.error("Failed to load plans", err));
    AccountService.getPaymentGateways().then(data => {
      const active = data.filter((g: any) => g.enabled);
      setGateways(active);
      if (active.length > 0 && !formData.paymentMethod) {
        setFormData(prev => ({ ...prev, paymentMethod: active[0].name }));
      } else if (active.length > 0 && !active.find((g: any) => g.name === formData.paymentMethod)) {
        setFormData(prev => ({ ...prev, paymentMethod: active[0].name }));
      }
    }).catch(err => console.error("Failed to load gateways", err));
  }, []);

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const checkDomain = async () => {
    if (!formData.domain) {
      toast.error("Please provide a valid domain name first");
      return;
    }

    if (formData.domainAction === 'existing') {
      const isValid = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(formData.domain);
      if (isValid) {
        setDomainAvailability('available');
        toast.success("Domain format verified for connection.");
      } else {
        setDomainAvailability('unavailable');
        toast.error("Invalid domain format.");
      }
      return;
    }

    setIsCheckingDomain(true);
    setDomainAvailability('idle');
    
    try {
      const { available } = await AccountService.checkDomainAvailability(formData.domain);
      
      setIsCheckingDomain(false);
      setDomainAvailability(available ? 'available' : 'unavailable');
      
      if (available) toast.success(`${formData.domain} is available for instant provisioning!`);
      else toast.error(`${formData.domain} is already taken or unavailable`);
    } catch (err: any) {
      setIsCheckingDomain(false);
      toast.error("Domain check failed. Please try again later.");
    }
  };

  const getPriceData = () => {
    const selectedPlan = plans.find(p => String(p.id) === String(formData.plan));
    const basePrice = selectedPlan ? Number(selectedPlan.price) : 9.99;
    const currency = globalSettings?.defaultCurrency || selectedPlan?.currency || 'USD';
    const rawAmount = formData.billingCycle === 'yearly' ? basePrice * 12 * 0.8 : basePrice;

    let discountAmount = 0;
    if (discountInfo) {
      if (discountInfo.type === 'percentage') {
        discountAmount = rawAmount * (Number(discountInfo.value) / 100);
      } else {
        discountAmount = Number(discountInfo.value);
      }
    }

    const discountedBase = Math.max(0, Number(rawAmount) - Number(discountAmount));
    
    // Taxes and Fees from Global Settings
    let vatAmount = 0;
    let feeAmount = 0;

    if (globalSettings) {
      if (globalSettings.vatEnabled) {
        if (globalSettings.vatType === 'percentage') {
          vatAmount = Number(discountedBase) * (Number(globalSettings.vatAmount) / 100);
        } else {
          vatAmount = Number(globalSettings.vatAmount);
        }
      }

      if (globalSettings.feeEnabled) {
        // Transaction fee usually applies to the total including VAT
        const amountToTax = Number(discountedBase) + Number(vatAmount);
        if (globalSettings.feeType === 'percentage') {
          feeAmount = Number(amountToTax) * (Number(globalSettings.feeAmount) / 100);
        } else {
          feeAmount = Number(globalSettings.feeAmount);
        }
      }
    } else {
      // Fallback to old defaults if settings haven't loaded
      vatAmount = Number(discountedBase) * 0.075;
      feeAmount = (Number(discountedBase) + Number(vatAmount)) * 0.015;
    }

    const totalWithFees = Number(discountedBase) + Number(vatAmount) + Number(feeAmount);

    return {
      subtotal: rawAmount,
      discount: discountAmount,
      discountedBase: discountedBase,
      total: totalWithFees,
      fee: feeAmount,
      vat: vatAmount,
      vatEnabled: globalSettings?.vatEnabled ?? true,
      feeEnabled: globalSettings?.feeEnabled ?? true,
      currency: currency,
      currencySymbol: currency === 'NGN' ? '₦' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$'
    };
  };

  const priceData = getPriceData();
  const isIframe = window.self !== window.top;

  // Dynamic Gateway Configs
  const paystackGateway = gateways.find(g => g.name === 'paystack');
  const flutterwaveGateway = gateways.find(g => g.name === 'flutterwave');

  // Paystack Configuration
  const paystackConfig = {
    reference: (new Date()).getTime().toString(),
    email: formData.email,
    amount: Math.round(priceData.total * 100),
    publicKey: paystackGateway?.public_key || 'pk_live_placeholder',
    currency: priceData.currency
  };

  const initializePaystack = usePaystackPayment(paystackConfig);

  // Flutterwave Configuration
  const flutterwaveConfig = {
    public_key: flutterwaveGateway?.public_key || 'FLWPUBK_TEST_placeholder',
    tx_ref: (new Date()).getTime().toString(),
    amount: priceData.total,
    currency: priceData.currency,
    payment_options: 'card,mobilemoney,ussd',
    customer: {
      email: formData.email,
      phone_number: formData.phone,
      name: formData.fullName,
    },
    customizations: {
      title: 'Alaba',
      description: `Payment for ${formData.plan} plan`,
      logo: 'https://st2.depositphotos.com/4403291/7418/v/450/depositphotos_74189661-stock-illustration-abstract-logo-template.jpg',
    },
  };

  const handleFlutterPayment = useFlutterwave(flutterwaveConfig);

  const onPaymentSuccess = async () => {
    setIsSubmitting(true);
    try {
      const selectedPlan = plans.find(p => String(p.id) === String(formData.plan));
      const planName = selectedPlan?.name || 'Default';
      
      const { taskId, invoiceId } = await AccountService.provisionAccount({
        domain: formData.domain,
        user: formData.fullName,
        package: planName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        country: formData.country,
        domainAction: formData.domainAction,
        paymentMethod: formData.paymentMethod,
        total: priceData.total,
        vat: priceData.vat,
        transactionFee: priceData.fee,
        currency: priceData.currency
      });

      if (invoiceId) {
        setFormData(prev => ({ ...prev, invoiceId }));
      }

      toast.info("Payment confirmed. Initializing service clusters...");

      // Poll for progress
      const pollInterval = setInterval(async () => {
        try {
          const task = await AccountService.getTaskStatus(taskId);
          setProvisioningTask(task);
          
          if (task.status === 'completed') {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            const selectedPlan = plans.find(p => p.id === formData.plan);
            const planDisplayName = selectedPlan ? selectedPlan.name : 'Alaba Host';
            const invoiceParam = invoiceId ? `&invoiceId=${invoiceId}` : '';
            navigate(`/success?domain=${formData.domain}&plan=${planDisplayName}&action=${formData.domainAction}${invoiceParam}`);
            toast.success("Account provisioned successfully!");
          } else if (task.status === 'failed') {
            clearInterval(pollInterval);
            setIsSubmitting(false);
            toast.error("Provisioning failed. Our admins have been notified.");
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 1000);

    } catch (err) {
      setIsSubmitting(false);
      toast.error("An error occurred during provisioning.");
    }
  };

  const onPaymentError = () => {
    setIsSubmitting(false);
    toast.error("Payment failed. Please try again.");
  };

  const handleProcessPayment = async () => {
    setIsSubmitting(true);
    
    if (formData.paymentMethod === 'paystack') {
      initializePaystack({
        onSuccess: () => {
          onPaymentSuccess();
        },
        onClose: () => {
          setIsSubmitting(false);
          toast.info("Payment sequence terminated");
        },
      });
    } else if (formData.paymentMethod === 'flutterwave') {
      handleFlutterPayment({
        callback: (response) => {
          if (response.status === 'successful') {
            onPaymentSuccess();
          } else {
            onPaymentError();
          }
          closePaymentModal();
        },
        onClose: () => {
          setIsSubmitting(false);
          toast.info("Flutterwave sequence terminated");
        },
      });
    } else if (formData.paymentMethod === 'bank_transfer') {
      try {
        // Record pending subscription
        await AccountService.provisionAccount({
          domain: formData.domain,
          user: formData.fullName,
          package: plans.find(p => String(p.id) === String(formData.plan))?.name || 'Default',
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          country: formData.country,
          domainAction: formData.domainAction,
          paymentMethod: 'bank_transfer',
          total: priceData.total,
          currency: priceData.currency
        });
        
        setTimeout(() => {
          setIsSubmitting(false);
          setIsCompleted(true);
          // Clear cart after initiation
          localStorage.removeItem('registration_cart');
          toast.success("Registration initiated. Ledger pending verification.");
        }, 1500);
      } catch (err) {
        setIsSubmitting(false);
        toast.error("Failed to initiate bank transfer registration.");
      }
    } else if (formData.paymentMethod === 'stripe') {
      try {
        const { url } = await AccountService.initiateStripeCheckout({
          planId: formData.plan,
          billingCycle: formData.billingCycle,
          domain: formData.domain,
          promoCode: formData.promoCode
        });
        window.location.href = url;
      } catch (err: any) {
        setIsSubmitting(false);
        toast.error(err.message || "Failed to initiate Stripe payment");
      }
    } else {
      // Fallback for other enabled gateways
      try {
        await AccountService.provisionAccount({
          domain: formData.domain,
          user: formData.fullName,
          package: plans.find(p => String(p.id) === String(formData.plan))?.name || 'Default',
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          country: formData.country,
          domainAction: formData.domainAction,
          paymentMethod: formData.paymentMethod,
          total: priceData.total,
          currency: priceData.currency
        });
        setIsSubmitting(false);
        setIsCompleted(true);
      } catch (err) {
        setIsSubmitting(false);
        toast.error("Failed to initiate registration with selected gateway.");
      }
    }
  };

  const downloadInvoice = async () => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(0, 53, 68); // Alaba branding color
      doc.text("ALABA HOSTING", 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("High-Performance Edge Hosting", 20, 32);
      
      // Invoice Details
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(`Invoice for: ${formData.fullName}`, 20, 50);
      doc.text(`Email: ${formData.email}`, 20, 57);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 64);
      
      // Table
      const selectedPlan = plans.find(p => String(p.id) === String(formData.plan));
      const planName = selectedPlan ? selectedPlan.name : 'Hosting Package';
      
      autoTable(doc, {
        startY: 75,
        head: [['Description', 'Quantity', 'Amount']],
        body: [
          [`${planName} - ${formData.domain}`, '1 Year', `${formatCurrency(priceData.total, priceData.currency)}`]
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 53, 68] }
      });
      
      // Banking Details
      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text("Payment Instructions", 20, finalY);
      
      doc.setFontSize(10);
      doc.text("Bank Name: Standard Platinum Bank", 20, finalY + 8);
      doc.text("Account Name: Alaba Hosting Edge Ltd", 20, finalY + 15);
      doc.text("Account Number: 0129-3847-56", 20, finalY + 22);
      doc.text(`Narration: ${formData.domain}`, 20, finalY + 29);
      
      doc.setTextColor(239, 68, 68); // Error color for emphasis
      doc.setFontSize(8);
      doc.text("* Please use your domain name as the transaction narration.", 20, finalY + 40);
      
      doc.save(`Alaba_Invoice_${formData.domain}.pdf`);
      toast.success("Invoice generated successfully");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF document");
    }
  };

  // Country Auto-detection on mount
  useEffect(() => {
    // Only detect if data is fresh
    const isEditing = formData.fullName || formData.email;
    if (isEditing) return;

    const detectCountry = () => {
      try {
        const locale = navigator.language;
        let detectedCountry = 'United States';
        
        if (locale.includes('GB')) detectedCountry = 'United Kingdom';
        else if (locale.includes('NG')) detectedCountry = 'Nigeria';
        else if (locale.includes('CA')) detectedCountry = 'Canada';
        else if (locale.includes('DE')) detectedCountry = 'Germany';
        else if (locale.includes('AU')) detectedCountry = 'Australia';
        
        const states = COUNTRIES.find(c => c.name === detectedCountry)?.states || [];
        updateFormData({ country: detectedCountry, state: states[0] || '' });
      } catch (err) {
        console.error('Country detection failed:', err);
      }
    };
    detectCountry();
  }, []);

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    // Clear field-specific error when content changes
    const keys = Object.keys(data);
    if (keys.length > 0) {
      setErrors(prev => {
        const next = { ...prev };
        keys.forEach(k => delete next[k]);
        return next;
      });
    }
  };

  const steps = [
    { id: 1, name: 'Account', icon: User },
    { id: 2, name: 'Information', icon: User },
    { id: 3, name: 'Hosting', icon: Globe },
    { id: 4, name: 'Billing', icon: CreditCard },
    { id: 5, name: 'Confirm', icon: ShieldCheck },
  ];

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 1) {
      if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
      else if (formData.fullName.length < 3) newErrors.fullName = "Name is too short";
      
      if (!formData.email.trim()) newErrors.email = "Email address is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Invalid email format";
      
      if (!formData.password) newErrors.password = "Password is required";
      else if (formData.password.length < 8) newErrors.password = "Must be at least 8 characters";
      else if (getPasswordStrength(formData.password) < 2) newErrors.password = "Password is too weak";
      
      if (formData.confirmPassword !== formData.password) {
        newErrors.confirmPassword = "Passwords do not match";
      }
      
      if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    }

    if (step === 2) {
      if (!formData.state.trim()) newErrors.state = "State/City is required";
      if (!formData.address.trim()) newErrors.address = "Address is required";
    }

    if (step === 3) {
      if (!formData.domain.trim()) newErrors.domain = "Domain name is required";
      else if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/.test(formData.domain)) newErrors.domain = "Invalid domain format (e.g. domain.com)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [signupCode, setSignupCode] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const handleNext = async () => {
    console.log("[Wizard] Current Step:", currentStep);
    if (currentStep < 5) {
      if (validateStep(currentStep)) {
        if (currentStep === 1) {
          setIsSubmitting(true);
          try {
            const { available } = await AccountService.checkEmailAvailability(formData.email);
            if (!available) {
              setErrors(prev => ({ ...prev, email: "The email has already been taken" }));
              toast.error("The email has already been taken");
              return;
            }

            // Require 2FA for signup completion
            await AccountService.sendVerificationCode(formData.email);
            setShowVerifyModal(true);
            setIsSubmitting(false);
            return;
          } catch (err) {
            console.error("Email check failed", err);
            setIsSubmitting(false);
          }
        }
        navigate(`/register/${currentStep + 1}`);
      } else {
        console.warn("[Wizard] Validation failed for step:", currentStep, errors);
        toast.error("Please correct the errors before proceeding");
      }
    }
  };

  const handleVerifySignupCode = async () => {
    if (signupCode.length !== 6) {
      toast.error("Code must be 6 digits");
      return;
    }
    setIsVerifyingCode(true);
    try {
      await AccountService.verifySignupCode(formData.email, signupCode);
      setShowVerifyModal(false);
      toast.success("Security verified. Proceeding to information phase.");
      navigate('/register/2');
    } catch (err: any) {
      toast.error(err.message || "Invalid verification code");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      navigate(`/register/${currentStep - 1}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.acceptToS || !formData.acceptPrivacy) {
      toast.error("You must accept the Terms and Privacy Policy to continue");
      return;
    }

    handleProcessPayment();
  };

  if (isSubmitting && provisioningTask) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-surface-container p-12 rounded-[3rem] shadow-2xl space-y-8 border border-outline-variant/30 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-outline-variant/20">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${provisioningTask.progress}%` }}
              className="h-full bg-primary"
            />
          </div>

          <div className="flex flex-col items-center text-center space-y-4">
             <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary relative">
                <RefreshCw size={32} className="animate-spin" />
                <span className="absolute -bottom-1 -right-1 bg-white px-2 py-0.5 rounded-full text-[10px] font-black border border-outline-variant shadow-sm">{provisioningTask.progress}%</span>
             </div>
             <h2 className="text-3xl font-display font-black tracking-tighter">Setting up your Space</h2>
             <p className="text-on-surface-variant font-medium text-sm">
                Status: <span className="font-mono text-primary">Secure Activation</span>
             </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">
              <span>Current Operation</span>
              <span className="text-primary">{provisioningTask.status}</span>
            </div>
            <div className="p-6 bg-surface rounded-2xl border border-outline-variant/20 font-mono text-xs text-primary shadow-inner min-h-[80px] flex items-center justify-center text-center">
               <motion.span
                 key={provisioningTask.currentStep}
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
               >
                 {provisioningTask.currentStep || 'Initializing secure environment...'}
               </motion.span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[10px] font-bold text-on-surface-variant opacity-40 uppercase tracking-[0.2em]">Please keep this page open while we prepare your account</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "w-full bg-surface-container p-12 rounded-[3rem] shadow-2xl text-center space-y-6 border border-outline-variant/30",
            formData.paymentMethod === 'bank_transfer' ? "max-w-2xl" : "max-w-md"
          )}
        >
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
            {formData.paymentMethod === 'bank_transfer' ? <Clock size={48} className="animate-pulse" /> : <CheckCircle2 size={48} className="animate-bounce" />}
          </div>
          <h2 className="text-4xl font-display font-black tracking-tighter">
            {formData.paymentMethod === 'bank_transfer' ? 'Invoice Generated' : 'Welcome Aboard!'}
          </h2>
          <p className="text-on-surface-variant font-medium leading-relaxed">
            {formData.paymentMethod === 'bank_transfer' 
              ? `Your hosting application for ${formData.domain} is pending verification. Please settle the invoice below to activate your hosting.`
              : `Your hosting environment for ${formData.domain} is being provisioned across our global edge hosting.`}
          </p>
          {formData.paymentMethod === 'bank_transfer' && (
             <div className="space-y-4">
                <div ref={invoiceRef} className="bg-surface rounded-2xl p-8 border-2 border-primary/20 border-dashed text-left space-y-4">
                  <div className="flex flex-col items-center border-b border-outline-variant/30 pb-4 mb-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2">
                        <FileText size={24} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface">Standard Invoice</span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="opacity-60">Payment Reference</span>
                        <span className="text-primary font-mono lowercase">{formData.domain}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="opacity-60">Settlement Amount</span>
                        <span className="text-primary font-display font-black text-lg">
                          {formatCurrency(priceData.total, globalSettings?.defaultCurrency || priceData.currency)}
                        </span>
                    </div>
                    
                    <div className="h-px bg-outline-variant/20 my-2" />
                    
                    <div className="grid grid-cols-2 gap-y-3 text-[9px] font-bold uppercase tracking-wider">
                        <div className="text-on-surface-variant">Bank Name</div>
                        <div className="text-right">Standard Platinum Bank</div>
                        
                        <div className="text-on-surface-variant">Account Name</div>
                        <div className="text-right">Alaba Hosting Edge Ltd</div>
                        
                        <div className="text-on-surface-variant">Account Number</div>
                        <div className="text-right font-mono text-primary text-xs">0129-3847-56</div>
                    </div>
                  </div>

                  <div className="bg-primary/5 p-3 rounded-xl border border-primary/10">
                    <p className="text-[9px] font-medium text-primary italic text-center leading-relaxed">
                        * Please ensure the domain name is used as the transfer narration for instant recognition.
                    </p>
                  </div>
                </div>

                <button 
                  onClick={downloadInvoice}
                  className="w-full py-3 bg-primary text-on-primary rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg"
                >
                   <FileText size={14} />
                   Download Invoice (PDF)
                </button>
             </div>
          )}
          <div className="pt-4 flex flex-col gap-3">
             {formData.paymentMethod !== 'bank_transfer' && (
               <button 
                 onClick={() => {
                   const selectedPlan = plans.find(p => String(p.id) === String(formData.plan));
                   const planDisplayName = selectedPlan ? selectedPlan.name : 'Alaba Host';
                   const invoiceParam = formData.invoiceId ? `&invoiceId=${formData.invoiceId}` : '';
                   navigate(`/success?domain=${formData.domain}&plan=${planDisplayName}${invoiceParam}`);
                 }}
                 className="w-full py-4 bg-primary text-on-primary font-black uppercase text-[11px] tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
               >
                 Enter Dashboard
               </button>
             )}
             <button 
               onClick={() => window.location.href = '/login'}
               className="w-full py-4 bg-surface-container-highest text-primary font-black uppercase text-[11px] tracking-widest rounded-2xl border border-outline-variant hover:bg-primary hover:text-on-primary transition-all"
             >
               Go to Client Area
             </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (showToS) {
    return <TermsOfService onBack={() => setShowToS(false)} />;
  }

  if (showPrivacy) {
    return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />;
  }

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto min-h-screen flex flex-col gap-6 md:gap-10">
      <header className="text-center space-y-3 md:space-y-4">
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center p-0 overflow-hidden">
            <AlabaIcon className="w-full h-full" />
          </div>
        </div>
        <h1 className="text-3xl md:text-5xl font-display font-black tracking-tighter text-on-surface">Deploy Your Future</h1>
        <p className="text-on-surface-variant max-w-xl mx-auto font-medium text-xs md:text-base">
          Complete the quick sequence below to instantiate your high-performance hosting instance and secure your global domain identity.
        </p>
      </header>

      {/* Progress Indicator */}
      <div className="relative flex justify-between max-w-3xl mx-auto w-full mb-8 md:mb-12 px-2 md:px-0">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-outline-variant/30 -translate-y-1/2 z-0" />
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0 transition-all duration-500 ease-out" 
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />
        {steps.map((step) => {
          const Icon = step.icon;
          const isActive = currentStep >= step.id;
          const isCurrent = currentStep === step.id;
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-2 md:gap-3">
              <motion.div 
                animate={{ 
                  scale: isCurrent ? 1.2 : 1,
                  backgroundColor: isActive ? 'var(--primary)' : 'var(--surface-container-high)',
                  color: isActive ? 'var(--on-primary)' : 'var(--on-surface-variant)'
                }}
                className={cn(
                  "w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg transition-colors border-2",
                  isActive ? "border-primary" : "border-outline-variant"
                )}
              >
                {isActive && currentStep > step.id ? <Check size={14} className="md:w-5 md:h-5" /> : <Icon size={14} className="md:w-5 md:h-5" />}
              </motion.div>
              <span className={cn(
                "hidden sm:block text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] transition-colors",
                isActive ? "text-primary" : "text-on-surface-variant opacity-40"
              )}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Form Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-0 md:px-4 mb-10">
        <form onSubmit={handleSubmit} className="bg-surface-container rounded-3xl md:rounded-[3rem] shadow-2xl border border-outline-variant/30 overflow-hidden min-h-[500px] flex flex-col">
          <div className="p-6 md:p-12 flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-display font-black tracking-tight">Account Information</h2>
                    <p className="text-on-surface-variant text-sm font-medium">Define your administrative identity for the Alaba platform.</p>
                  </div>
                  
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Full Name</label>
                      <div className="relative">
                        <User className={cn("absolute left-4 top-1/2 -translate-y-1/2", errors.fullName ? "text-error" : "text-on-surface-variant/40")} size={18} />
                        <input 
                          type="text" 
                          value={formData.fullName}
                          onChange={(e) => updateFormData({ fullName: e.target.value })}
                          className={cn(
                            "w-full bg-surface border rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 outline-none transition-all",
                            errors.fullName ? "border-error focus:ring-error/10" : "border-outline-variant/50 focus:ring-primary/10"
                          )}
                          placeholder="e.g. John Doe"
                        />
                      </div>
                      {errors.fullName && <p className="text-[10px] text-error font-medium ml-1">{errors.fullName}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Email</label>
                      <div className="relative">
                        <Mail className={cn("absolute left-4 top-1/2 -translate-y-1/2", errors.email ? "text-error" : "text-on-surface-variant/40")} size={18} />
                        <input 
                          type="email" 
                          value={formData.email}
                          onChange={(e) => updateFormData({ email: e.target.value })}
                          className={cn(
                            "w-full bg-surface border rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 outline-none transition-all",
                            errors.email ? "border-error focus:ring-error/10" : "border-outline-variant/50 focus:ring-primary/10"
                          )}
                          placeholder="john@example.com"
                        />
                      </div>
                      {errors.email && <p className="text-[10px] text-error font-medium ml-1">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Phone Number</label>
                      <div className="relative">
                        <Phone className={cn("absolute left-4 top-1/2 -translate-y-1/2", errors.phone ? "text-error" : "text-on-surface-variant/40")} size={18} />
                        <input 
                          type="tel" 
                          value={formData.phone}
                          onChange={(e) => updateFormData({ phone: e.target.value })}
                          className={cn(
                            "w-full bg-surface border rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 outline-none transition-all",
                            errors.phone ? "border-error focus:ring-error/10" : "border-outline-variant/50 focus:ring-primary/10"
                          )}
                          placeholder="+1 (555) 000-0000"
                        />
                      </div>
                      {errors.phone && <p className="text-[10px] text-error font-medium ml-1">{errors.phone}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Password</label>
                      <div className="relative">
                        <Lock className={cn("absolute left-4 top-1/2 -translate-y-1/2", errors.password ? "text-error" : "text-on-surface-variant/40")} size={18} />
                        <input 
                          type="password" 
                          value={formData.password}
                          onChange={(e) => updateFormData({ password: e.target.value })}
                          className={cn(
                            "w-full bg-surface border rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 outline-none transition-all",
                            errors.password ? "border-error focus:ring-error/10" : "border-outline-variant/50 focus:ring-primary/10"
                          )}
                          placeholder="••••••••••••"
                        />
                      </div>
                      
                      {/* Password Strength Indicator */}
                      <div className="flex flex-col gap-1.5 mt-2 px-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div 
                              key={i} 
                              className={cn(
                                "h-1 flex-1 rounded-full transition-all duration-500",
                                i <= getPasswordStrength(formData.password) 
                                  ? (getPasswordStrength(formData.password) <= 2 ? "bg-orange-500" : "bg-green-500") 
                                  : "bg-outline-variant/20"
                              )}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-widest opacity-40">
                          <span>Cipher Strength</span>
                          <span className={cn(
                            "transition-colors",
                            getPasswordStrength(formData.password) >= 3 ? "text-green-500 opacity-100" : ""
                          )}>
                            {getPasswordStrength(formData.password) === 0 && "Idle"}
                            {getPasswordStrength(formData.password) === 1 && "Weak"}
                            {getPasswordStrength(formData.password) === 2 && "Moderate"}
                            {getPasswordStrength(formData.password) === 3 && "Strong"}
                            {getPasswordStrength(formData.password) === 4 && "Military Grade"}
                          </span>
                        </div>
                      </div>
                      {errors.password && <p className="text-[10px] text-error font-medium ml-1">{errors.password}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Confirm Password</label>
                      <div className="relative">
                        <ShieldCheck className={cn("absolute left-4 top-1/2 -translate-y-1/2", errors.confirmPassword ? "text-error" : "text-on-surface-variant/40")} size={18} />
                        <input 
                          type="password" 
                          value={formData.confirmPassword}
                          onChange={(e) => updateFormData({ confirmPassword: e.target.value })}
                          className={cn(
                            "w-full bg-surface border rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 outline-none transition-all",
                            errors.confirmPassword ? "border-error focus:ring-error/10" : "border-outline-variant/50 focus:ring-primary/10"
                          )}
                          placeholder="••••••••••••"
                        />
                      </div>
                      {errors.confirmPassword && <p className="text-[10px] text-error font-medium ml-1">{errors.confirmPassword}</p>}
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-display font-black tracking-tight">Information</h2>
                    <p className="text-on-surface-variant text-sm font-medium">Verify your regional residency for compliance and localized hosting services.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Company Name (Optional)</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                        <input 
                          type="text" 
                          value={formData.company}
                          onChange={(e) => updateFormData({ company: e.target.value })}
                          className="w-full bg-surface border border-outline-variant/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                          placeholder="e.g. Atlas Hosting Solutions"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Territory / Country</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40" size={18} />
                        <select 
                          value={formData.country}
                          onChange={(e) => {
                            const country = e.target.value;
                            const states = COUNTRIES.find(c => c.name === country)?.states || [];
                            updateFormData({ country, state: states[0] || '' });
                          }}
                          className="w-full bg-surface border border-outline-variant/50 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer"
                        >
                          {COUNTRIES.map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">State / Province / City</label>
                      <div className="relative">
                        <select 
                          value={formData.state}
                          onChange={(e) => updateFormData({ state: e.target.value })}
                          className={cn(
                            "w-full bg-surface border rounded-2xl px-5 py-4 text-sm font-medium focus:ring-4 outline-none transition-all appearance-none cursor-pointer",
                            errors.state ? "border-error focus:ring-error/10" : "border-outline-variant/50 focus:ring-primary/10"
                          )}
                        >
                          {COUNTRIES.find(c => c.name === formData.country)?.states.map(s => (
                            <option key={s} value={s}>{s}</option>
                          )) || <option value="">Select State</option>}
                        </select>
                      </div>
                      {errors.state && <p className="text-[10px] text-error font-medium ml-1">{errors.state}</p>}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Address</label>
                        <div className="relative">
                        <MapPin className={cn("absolute left-4 top-1/2 -translate-y-1/2", errors.address ? "text-error" : "text-on-surface-variant/40")} size={18} />
                        <input 
                          type="text" 
                          value={formData.address}
                          onChange={(e) => updateFormData({ address: e.target.value })}
                          className={cn(
                            "w-full bg-surface border rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:ring-4 outline-none transition-all",
                            errors.address ? "border-error focus:ring-error/10" : "border-outline-variant/50 focus:ring-primary/10"
                          )}
                          placeholder="e.g. 128 Cluster Drive, Silicon Valley"
                        />
                      </div>
                      {errors.address && <p className="text-[10px] text-error font-medium ml-1">{errors.address}</p>}
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-display font-black tracking-tight">Select Plan</h2>
                    <p className="text-on-surface-variant text-sm font-medium">Select your digital frontier and the performance tier required to sustain it.</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Connect Your Domain</label>
                      <div className="relative flex gap-3">
                        <div className="relative flex-1">
                          <Globe className={cn("absolute left-4 top-1/2 -translate-y-1/2", errors.domain ? "text-error" : "text-on-surface-variant/40")} size={18} />
                          <input 
                            type="text" 
                            value={formData.domain}
                            onChange={(e) => {
                              updateFormData({ domain: e.target.value });
                              setDomainAvailability('idle');
                            }}
                            className={cn(
                              "w-full bg-surface border rounded-2xl pl-12 pr-4 py-5 text-lg font-display font-black focus:ring-4 outline-none transition-all placeholder:opacity-20",
                              errors.domain ? "border-error focus:ring-error/10 text-error" : "border-outline-variant text-primary focus:ring-primary/10"
                            )}
                            placeholder="e.g. my-hosting-hub.com"
                          />
                        </div>
                        <button 
                          type="button"
                          onClick={checkDomain}
                          disabled={!formData.domain || !!errors.domain}
                          className="px-6 rounded-2xl bg-surface-container-high border border-outline-variant/30 text-[10px] font-black uppercase tracking-widest hover:bg-surface-container transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                        >
                          <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          <span className="hidden sm:inline">Verify Domain</span>
                        </button>
                      </div>
                      {domainAvailability === 'available' && (
                        <p className="text-[10px] text-green-500 font-bold ml-1 flex items-center gap-1">
                          <Check size={12} /> Domain format verified for connection
                        </p>
                      )}
                      {domainAvailability === 'unavailable' && (
                        <p className="text-[10px] text-error font-bold ml-1 flex items-center gap-1">
                          <Zap size={12} className="fill-error/20" /> Invalid domain format
                        </p>
                      )}
                      <p className="text-[9px] text-on-surface-variant opacity-60 ml-1">
                        * You will need to update your domain's nameservers at your registrar after setup.
                      </p>
                      {errors.domain && <p className="text-[10px] text-error font-medium ml-1">{errors.domain}</p>}
                    </div>

                    <div className="pt-4 space-y-4">
                       <div className="flex items-center justify-between">
                         <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Select Plan</label>
                         <div className="flex bg-surface-container-high/50 p-1 rounded-xl border border-outline-variant/30">
                            <button 
                              type="button"
                              onClick={() => updateFormData({ billingCycle: 'monthly' })}
                              className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", formData.billingCycle === 'monthly' ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant/60")}
                            >Monthly</button>
                            <button 
                              type="button"
                              onClick={() => updateFormData({ billingCycle: 'yearly' })}
                              className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", formData.billingCycle === 'yearly' ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant/60")}
                            >Yearly (-20%)</button>
                         </div>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {plans.map(plan => {
                            const displayPrice = formData.billingCycle === 'yearly' ? Number(plan.price) * 12 * 0.8 : Number(plan.price);
                            
                            return (
                              <button 
                                key={plan.id}
                                type="button"
                                onClick={() => updateFormData({ plan: String(plan.id) })}
                                className={cn(
                                  "relative p-6 rounded-[2rem] border-2 text-center transition-all flex flex-col items-center gap-4",
                                  String(formData.plan) === String(plan.id) ? "bg-primary border-primary text-on-primary shadow-2xl shadow-primary/30 scale-105 z-10" : "bg-surface border-outline-variant/30 opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                                )}
                              >
                                 <div className={cn("p-3 rounded-2xl", String(formData.plan) === String(plan.id) ? "bg-white/10" : "bg-primary/5 text-primary")}>
                                   <Zap size={24} />
                                 </div>
                                 <div className="text-center w-full">
                                   <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">{plan.name}</div>
                                   <div className="text-2xl font-black tracking-tighter">
                                     {formatCurrency(displayPrice, globalSettings?.defaultCurrency || plan.currency || 'USD')}
                                     <span className="text-xs opacity-50 font-medium">/{formData.billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                                   </div>
                                 </div>
                                 <ul className="space-y-1.5 px-4 text-left w-full">
                                   {(Array.isArray(plan.specs) ? plan.specs : (typeof plan.specs === 'string' ? JSON.parse(plan.specs) : [])).map((spec: string, i: number) => (
                                      <li key={i} className="text-[9px] font-bold uppercase tracking-widest opacity-60">• {spec}</li>
                                   ))}
                                 </ul>
                                 {String(formData.plan) === String(plan.id) && (
                                   <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-primary text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">Active Selection</div>
                                 )}
                              </button>
                            );
                          })}
                       </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2">
                    <h2 className="text-3xl font-display font-black tracking-tight">Billing & Payment</h2>
                    <p className="text-on-surface-variant text-sm font-medium">Securely authorize your service subscription.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                         <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Payment Method</label>
                            <div className="space-y-4">
                               {gateways.map(method => {
                                 const isSelected = formData.paymentMethod === method.name;
                                 let Icon = Zap;
                                 if (method.name === 'bank_transfer') Icon = Building2;
                                 if (method.name === 'stripe') Icon = CreditCard;

                                 return (
                                   <button 
                                     key={method.name}
                                     type="button"
                                     onClick={() => updateFormData({ paymentMethod: method.name })}
                                     className={cn(
                                       "w-full p-5 rounded-2xl border-2 flex items-center justify-between transition-all group relative overflow-hidden",
                                       isSelected ? "bg-primary/5 border-primary shadow-xl shadow-primary/5" : "bg-surface border-outline-variant/30 opacity-60"
                                     )}
                                   >
                                     <div className="flex items-center gap-4">
                                       <div className={cn(
                                         "p-3 rounded-xl transition-colors",
                                         isSelected ? "bg-primary text-on-primary" : "bg-outline-variant/10 text-on-surface-variant"
                                       )}>
                                         <Icon size={20} />
                                       </div>
                                       <div className="text-left">
                                         <span className={cn("text-xs font-black uppercase tracking-widest block", isSelected ? "text-primary" : "text-on-surface")}>{method.display_name}</span>
                                         <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">
                                           {method.name === 'bank_transfer' ? 'Manual Verification' : 'Instant Activation'}
                                         </span>
                                       </div>
                                     </div>
                                     <div className={cn(
                                       "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                       isSelected ? "border-primary bg-primary" : "border-outline-variant"
                                     )}>
                                        {isSelected && <Check size={12} className="text-white" />}
                                     </div>
                                   </button>
                                 );
                               })}
                             </div>
                          </div>

                          {formData.paymentMethod === 'bank_transfer' && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="bg-surface-container-high/40 rounded-2xl border border-outline-variant/30 p-6 space-y-4"
                            >
                              <div className="flex items-center gap-3">
                                 <Building2 size={18} className="text-primary" />
                                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface">Alaba Collection Account</span>
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                 <div className="space-y-1">
                                    <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Bank Name</p>
                                    <p className="text-xs font-bold text-on-surface">Standard Platinum Bank</p>
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Account Number</p>
                                    <p className="text-sm font-display font-black text-primary tracking-widest">0129-3847-56</p>
                                 </div>
                                 <div className="space-y-1">
                                    <p className="text-[8px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Account Name</p>
                                    <p className="text-xs font-bold text-on-surface">Alaba Hosting Edge Hosting Ltd</p>
                                 </div>
                              </div>
                              <p className="text-[9px] font-medium text-on-surface-variant italic leading-relaxed">
                                 * Use your domain ({formData.domain || 'domain.com'}) as the payment reference.
                              </p>
                            </motion.div>
                          )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1">Promo / Coupon Code (Optional)</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={formData.promoCode}
                              onChange={(e) => updateFormData({ promoCode: e.target.value.toUpperCase() })}
                              className="flex-1 bg-surface border border-outline-variant/50 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:lowercase placeholder:opacity-30"
                              placeholder="e.g. ALABA-INIT-2026"
                            />
                            <button
                              type="button"
                              onClick={validateCoupon}
                              disabled={isValidatingCoupon || !formData.promoCode}
                              className="px-6 rounded-2xl bg-surface-container-high border border-outline-variant/30 text-[10px] font-black uppercase tracking-widest hover:bg-surface-container transition-all disabled:opacity-50"
                            >
                              {isValidatingCoupon ? <RefreshCw size={14} className="animate-spin" /> : 'Apply'}
                            </button>
                          </div>
                        </div>
                     </div>

                     <div className="bg-surface-container-high/30 p-8 rounded-[2rem] border border-outline-variant/30 flex flex-col justify-between">
                        <div className="space-y-6">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                   <Clock size={16} />
                                </div>
                                <div>
                                   <div className="text-[10px] font-black uppercase tracking-widest text-on-surface">Auto-Renew Status</div>
                                   <div className="text-[9px] font-medium text-on-surface-variant">Prevent service interruption</div>
                                </div>
                             </div>
                             <button 
                               type="button"
                               onClick={() => updateFormData({ autoRenew: !formData.autoRenew })}
                               className={cn(
                                 "w-12 h-6 rounded-full relative transition-colors",
                                 formData.autoRenew ? "bg-primary" : "bg-outline-variant"
                               )}
                             >
                                <motion.div 
                                  animate={{ x: formData.autoRenew ? 26 : 4 }}
                                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                                />
                             </button>
                           </div>

                           <div className="h-px bg-outline-variant/20" />

                           <div className="space-y-3">
                             <div className="flex justify-between text-xs font-medium text-on-surface-variant lowercase">
                               <span>Hosting: {plans.find(p => String(p.id) === String(formData.plan))?.name || formData.plan}</span>
                               <span className="font-mono">{formatCurrency(priceData.subtotal, priceData.currency)}</span>
                             </div>
                             {priceData.discount > 0 && (
                               <div className="flex justify-between text-xs font-bold text-green-500 lowercase">
                                 <span>Discount Applied</span>
                                 <span className="font-mono">-{formatCurrency(priceData.discount, priceData.currency)}</span>
                               </div>
                             )}
                             {priceData.vatEnabled && (
                               <div className="flex justify-between text-xs font-medium text-on-surface-variant lowercase">
                                 <span>VAT</span>
                                 <span className="font-mono">+{formatCurrency(priceData.vat, priceData.currency)}</span>
                               </div>
                             )}
                             {priceData.feeEnabled && (
                               <div className="flex justify-between text-xs font-medium text-on-surface-variant lowercase">
                                 <span>Transaction Fee</span>
                                 <span className="font-mono">+{formatCurrency(priceData.fee, priceData.currency)}</span>
                               </div>
                             )}
                             <div className="pt-4 flex justify-between items-end border-t border-dashed border-outline-variant/30">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant leading-none">Total Due Today</span>
                                <span className="text-3xl font-black text-primary tracking-tighter leading-none">{formatCurrency(priceData.total, priceData.currency)}</span>
                             </div>
                           </div>

                           {isIframe && (
                             <div className="mt-4 p-3 bg-error/5 border border-error/20 rounded-xl">
                                <p className="text-[9px] font-bold text-error uppercase tracking-wider leading-relaxed">
                                   Note: Since you are in preview mode, if the payment popup is blocked, please click the "Open in New Tab" icon at the top right of this page to complete checkout.
                                </p>
                             </div>
                           )}
                        </div>
                        <div className="flex items-start gap-3 mt-8 p-3 bg-white/5 rounded-xl border border-outline-variant/10 leading-none">
                           <ShieldCheck size={16} className="text-primary shrink-0" />
                           <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                             {formData.paymentMethod === 'bank_transfer' ? 'Secure Manual Settlement' : 'Powered By Paystack'}
                           </p>
                        </div>
                     </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 5 && (
                <motion.div 
                  key="step5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="space-y-2 text-center">
                    <h2 className="text-3xl font-display font-black tracking-tight">Consent & Final Initialization</h2>
                    <p className="text-on-surface-variant text-sm font-medium">Verify your configuration one last time and authorize deployment.</p>
                  </div>
                  
                  <div className="max-w-xl mx-auto space-y-6">
                    <div className="bg-surface-container-high/20 rounded-[2rem] border border-outline-variant/30 p-8 space-y-4">
                       <div className="flex flex-col items-center text-center gap-2 mb-4">
                          <CheckCircle2 size={48} className="text-primary opacity-20" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant">Transaction Summary</h4>
                       </div>
                       <div className="space-y-3">
                          {[
                            { label: 'Full Name', value: formData.fullName },
                            { label: 'Email', value: formData.email },
                            { label: 'Domain Identity', value: formData.domain },
                            { label: 'Selected Plan', value: plans.find(p => String(p.id) === String(formData.plan))?.name || formData.plan },
                            { label: 'Cycle Frequency', value: formData.billingCycle }
                          ].map(item => (
                            <div key={item.label} className="flex justify-between items-center text-xs">
                               <span className="text-on-surface-variant font-bold uppercase tracking-widest text-[9px]">{item.label}</span>
                               <span className="font-mono text-on-surface lowercase">{item.value}</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-4 pt-4">
                       <label className="flex items-start gap-4 p-4 rounded-2xl border border-outline-variant/20 hover:bg-surface-container-high/30 cursor-pointer transition-all">
                          <input 
                            type="checkbox" 
                            checked={formData.acceptToS}
                            onChange={(e) => updateFormData({ acceptToS: e.target.checked })}
                            className="mt-1 w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20"
                          />
                          <div>
                             <span className="text-xs font-bold text-on-surface block mb-1">
                               Accept <button type="button" onClick={() => setShowToS(true)} className="text-primary hover:underline">Terms of Service</button>
                             </span>
                             <p className="text-[10px] text-on-surface-variant leading-relaxed">I authorize Alaba to provision resources for my domain and agree to the global infrastructure usage policies.</p>
                          </div>
                       </label>
                       <label className="flex items-start gap-4 p-4 rounded-2xl border border-outline-variant/20 hover:bg-surface-container-high/30 cursor-pointer transition-all">
                          <input 
                            type="checkbox" 
                            checked={formData.acceptPrivacy}
                            onChange={(e) => updateFormData({ acceptPrivacy: e.target.checked })}
                            className="mt-1 w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20"
                          />
                          <div>
                             <span className="text-xs font-bold text-on-surface block mb-1">
                               <button type="button" onClick={() => setShowPrivacy(true)} className="text-primary hover:underline">Privacy & Data Residency Policy</button>
                             </span>
                             <p className="text-[10px] text-on-surface-variant leading-relaxed">I consent to the processing of my transactional data under global privacy standards and secure ledger logging.</p>
                          </div>
                       </label>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Navigation */}
          <div className="p-8 bg-surface-container-high/30 border-t border-outline-variant/10 flex items-center justify-between">
            <button 
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
              className={cn(
                "group px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all border border-outline-variant/50 flex items-center gap-3",
                currentStep === 1 ? "opacity-0 invisible" : "hover:bg-primary-container/20 hover:border-primary/30 text-on-surface-variant hover:text-primary"
              )}
            >
              <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span>Back</span>
            </button>
            <div className="flex gap-4">
              {currentStep < 5 ? (
                <button 
                  type="button"
                  onClick={handleNext}
                  className="px-12 py-4 bg-primary text-on-primary rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 border border-primary hover:bg-white hover:text-primary group"
                >
                  <span>Continue</span>
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "px-12 py-4 bg-primary text-on-primary rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all flex items-center gap-3 border border-primary group",
                    isSubmitting ? "opacity-70 cursor-wait" : "hover:scale-105 active:scale-95 shadow-primary/30 hover:bg-white hover:text-primary"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Securing...</span>
                    </>
                  ) : (
                    <>
                      <span>Checkout</span>
                      <Zap size={18} className="group-hover:scale-110 transition-transform" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <footer className="text-center pb-12">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-on-surface-variant opacity-20">Secure Multi-Pass Authorization System v9.0</p>
      </footer>

      {/* 2FA Verification Modal */}
      <AnimatePresence>
        {showVerifyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVerifyModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-surface-container rounded-[3rem] p-10 max-w-md w-full shadow-2xl border border-outline-variant/30 space-y-8"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary">
                  <ShieldCheck size={40} />
                </div>
                <div>
                  <h2 className="text-2xl font-display font-black tracking-tight">Identity Verification</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mt-1">Multi-Pass Auth Required</p>
                </div>
                <p className="text-sm font-medium text-on-surface-variant leading-relaxed">
                  To complete your signup, please enter the 6-digit synchronization code sent to <span className="text-on-surface font-bold text-base block mt-1">{formData.email}</span>.
                </p>
              </div>

              <div className="space-y-6">
                <div className="relative">
                   <ShieldCheck className="absolute left-6 top-1/2 -translate-y-1/2 text-primary opacity-40" size={24} />
                   <input 
                      type="text" 
                      value={signupCode}
                      onChange={(e) => setSignupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full bg-surface border-2 border-outline-variant rounded-2xl py-6 px-16 text-center text-3xl font-black tracking-[0.5em] focus:border-primary transition-all outline-none"
                   />
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleVerifySignupCode}
                    disabled={isVerifyingCode}
                    className="w-full py-5 bg-primary text-on-primary rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20"
                  >
                    {isVerifyingCode ? <RefreshCw className="animate-spin" size={16} /> : <Check size={16} />}
                    <span>Complete Verification</span>
                  </button>
                  <button 
                    onClick={() => {
                        setShowVerifyModal(false);
                        setSignupCode('');
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors"
                  >
                    Modify Email Address
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
