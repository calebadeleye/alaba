/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Folder, 
  File, 
  Search, 
  Upload, 
  Download, 
  Trash2, 
  Edit3, 
  Key, 
  MoreVertical, 
  ChevronRight, 
  Home, 
  FolderPlus, 
  FilePlus, 
  Copy, 
  Move,
  X,
  Save,
  Mail as MailIcon,
  ChevronDown,
  Check,
  Clipboard,
  Shield,
  Eye,
  History,
  Lock as LockIcon,
  Server,
  PlusCircle,
  ShieldAlert,
  FileArchive,
  RefreshCcw,
  Zap as ZapIcon,
  ExternalLink,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { AccountService } from '../services/api';

interface FileEntity {
  name: string;
  type: 'folder' | 'file';
  size: string;
  modified: string;
  perm: string;
  content?: string;
}

const PDFPreview: React.FC<{ content: string; name: string }> = ({ content, name }) => {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    try {
      const binary = atob(content.startsWith('b64:') ? content.substring(4) : content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } catch (e) {
      console.error("PDF Blob error:", e);
      setError(true);
    }
  }, [content]);

  if (error) return <div className="p-12 text-center text-error font-black uppercase tracking-widest text-xs">Failed to load PDF node. Data corruption in cluster.</div>;
  if (!url) return <div className="p-12 text-center text-on-surface/40 font-black uppercase tracking-widest text-xs">Initializing PDF cluster stream...</div>;

  return (
    <div className="w-full h-full flex flex-col p-4">
      <object 
        data={url} 
        type="application/pdf" 
        className="w-full h-full rounded-2xl bg-white shadow-inner"
        onLoad={() => console.log("PDF Loaded")}
      >
        <div className="flex flex-col items-center justify-center h-full p-12 bg-surface-container-high rounded-3xl border-2 border-dashed border-outline-variant/30">
          <FileText size={48} className="text-primary mb-6 opacity-40" />
          <h4 className="text-xl font-black text-on-surface mb-2 tracking-tighter">Preview Blocked</h4>
          <p className="text-sm text-on-surface-variant mb-8 opacity-60 max-w-sm text-center font-medium leading-relaxed">Your browser security policy is preventing the PDF from being rendered inside the dashboard.</p>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-8 py-4 bg-primary text-on-primary rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:scale-105 transition-all"
          >
            <ExternalLink size={14} />
            Open in New Workspace
          </a>
        </div>
      </object>
    </div>
  );
};

export const FileManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [accountDomain, setAccountDomain] = useState<string>('user');
  const [files, setFiles] = useState<FileEntity[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [account, setAccount] = useState<any>(null);

  const fetchFiles = async (accountId: string, path: string, updateSidebar: boolean = false) => {
    setIsLoadingFiles(true);
    try {
      const data = await AccountService.getFiles(accountId, path);
      
      // Sort: folders first, then files. public_html always at the very top.
      const sortedData = data.sort((a, b) => {
        if (a.name === 'public_html') return -1;
        if (b.name === 'public_html') return 1;
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });
      
      setFiles(sortedData);
      if (path === '/' || updateSidebar) {
         // If we are at root, or explicitly told to update sidebar, fetch root folders
         let rootData = data;
         if (path !== '/') {
           rootData = await AccountService.getFiles(accountId, '/');
         }
         const folders = rootData.filter(f => f.type === 'folder').map(f => f.name);
         
         // Custom sort: public_html always first
         const sortedFolders = folders.sort((a, b) => {
           if (a === 'public_html') return -1;
           if (b === 'public_html') return 1;
           return a.localeCompare(b);
         });
         
         setRootFolders(sortedFolders);
      }
    } catch (err) {
      toast.error('Failed to load files from Alaba cluster');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (id) {
      AccountService.getAccounts().then(accounts => {
        const acc = accounts.find((a: any) => String(a.id) === id);
        if (acc) {
          setAccount(acc);
          setAccountDomain(acc.domain);
          setCurrentPath('/');
          fetchFiles(id, '/');
        }
      });
    }
  }, [id]);

  useEffect(() => {
    if (id && currentPath) {
      fetchFiles(id, currentPath);
    }
  }, [currentPath, id]);

  const handleFolderClick = (folderName: string) => {
    setCurrentPath(prev => prev === '/' ? `/${folderName}` : `${prev}/${folderName}`);
  };

  const goBack = () => {
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    setCurrentPath('/' + parts.join('/'));
  };
  const [showBackupImport, setShowBackupImport] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rootFolders, setRootFolders] = useState<string[]>(['public_html', 'mail', 'logs', 'etc', 'tmp', '.ssh']);
  const [isPublicHtmlOpen, setIsPublicHtmlOpen] = useState(true);
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<FileEntity | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleBackupRestore = async (file: FileEntity) => {
    toast.loading(`Restoring backup: ${file.name}...`, { duration: 3000 });
    setTimeout(() => {
      toast.success('Backup restoration complete. All files and configurations saved and updated.');
    }, 3000);
  };

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);

  const handleExtractZip = async (file: FileEntity) => {
    setIsExtracting(true);
    setExtractProgress(0);
    
    toast.promise(
      new Promise(async (resolve, reject) => {
        try {
          if (!id) throw new Error("No account ID");
          
          let progress = 0;
          const interval = setInterval(() => {
            progress += 5;
            setExtractProgress(progress);
            if (progress >= 95) clearInterval(interval);
          }, 200);

          await AccountService.extractZip(id, file.name, currentPath);

          clearInterval(interval);
          setExtractProgress(100);
          
          setTimeout(() => {
            setIsExtracting(false);
            setExtractProgress(0);
            fetchFiles(id, currentPath);
            resolve(true);
          }, 500);
        } catch (err: any) {
          setIsExtracting(false);
          setExtractProgress(0);
          reject(err);
        }
      }), 
      {
        loading: `Extracting cluster archive: ${file.name}...`,
        success: 'Extraction complete. Virtual directory structure updated.',
        error: (err) => `Extraction failed: ${err.message}`
      }
    );
  };

  const handleImportCPanel = () => {
    setShowBackupImport(true);
  };
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isMoving, setIsMoving] = useState<string | null>(null);
  const [moveDestination, setMoveDestination] = useState('/public_html');
  const [clipboard, setClipboard] = useState<FileEntity[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropFiles = Array.from(e.dataTransfer.files);
    if (dropFiles.length > 0 && id) {
      await performUpload(dropFiles);
    }
  };

  const performUpload = async (uploadFiles: File[]) => {
    if (uploadFiles.length === 0 || !id) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    let completed = 0;
    const total = uploadFiles.length;

    for (const file of uploadFiles) {
      try {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        await AccountService.createFile(id, {
          name: file.name,
          type: 'file',
          size: `${(file.size / 1024).toFixed(1)} KB`,
          modified: new Date().toISOString(),
          perm: '0644',
          path: currentPath,
          content: isCode(file.name) ? `b64:${content}` : content
        });
        
        completed++;
        setUploadProgress(Math.round((completed / total) * 100));
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(0);
    toast.success(`Successfully uploaded ${completed} of ${total} file(s)`);
    fetchFiles(id, currentPath);
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const uploadFiles = Array.from((e.target as HTMLInputElement).files || []);
      await performUpload(uploadFiles);
    };
    input.click();
  };

  const [showSSHManager, setShowSSHManager] = useState(false);
  const [sshKeys, setSshKeys] = useState([
    { id: '1', name: 'MacBook Pro Key', key: 'ssh-rsa AAAAB3Nza...[truncated]', created: 'Oct 12, 2023' },
    { id: '2', name: 'Deployment Bot', key: 'ssh-ed25519 AAAAC3Nza...[truncated]', created: 'Jan 05, 2024' },
  ]);
  const [editingPermissions, setEditingPermissions] = useState<FileEntity | null>(null);
  const [previewFile, setPreviewFile] = useState<FileEntity | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(['index.php', 'config', 'uploads']);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'delete' | 'warning' | 'info';
  } | null>(null);

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim() || !id) {
       fetchFiles(id!, currentPath);
       return;
    }
    
    setIsSearching(true);
    try {
      const results = await AccountService.searchFiles(id, searchQuery);
      setFiles(results);
      if (searchQuery.trim() && !recentSearches.includes(searchQuery.trim())) {
        setRecentSearches(prev => [searchQuery.trim(), ...prev].slice(0, 5));
      }
    } catch (err) {
      toast.error('Global search failed');
    } finally {
      setIsSearching(false);
      setShowSearchHistory(false);
    }
  };

  const toggleSelectAll = () => {
    if (checkedFiles.size === filteredFiles.length) {
      setCheckedFiles(new Set());
    } else {
      setCheckedFiles(new Set(filteredFiles.map(f => f.name)));
    }
  };

  const toggleFileCheck = (name: string) => {
    const newChecked = new Set(checkedFiles);
    if (newChecked.has(name)) {
      newChecked.delete(name);
    } else {
      newChecked.add(name);
    }
    setCheckedFiles(newChecked);
  };

  const handleDelete = (names: string[]) => {
    setConfirmation({
      show: true,
      title: 'Confirm Deletion',
      message: `Are you sure you want to permanently delete ${names.length} item(s)? This action cannot be reversed on the cluster storage.`,
      type: 'delete',
      onConfirm: async () => {
        if (!id) return;
        try {
          for (const name of names) {
            await AccountService.deleteFile(id, name, currentPath);
          }
          fetchFiles(id, currentPath);
          setCheckedFiles(new Set());
          setSelectedFile(null);
          setConfirmation(null);
          toast.error(`Deleted ${names.length} item(s)`, {
            icon: <Trash2 size={14} />
          });
        } catch (err) {
          toast.error('Failed to delete some files from Alaba cluster');
        }
      }
    });
  };

  const handleDownload = (names: string[]) => {
    toast.success(`Downloading ${names.length} item(s)...`, {
      description: 'Your browser will notify you when the transfer is complete.'
    });
  };

  const handleCopy = (names: string[]) => {
    const itemsToCopy = files.filter(f => names.includes(f.name));
    setClipboard(itemsToCopy);
    toast.info(`Copied ${names.length} item(s) to clipboard`, {
      description: 'Use the "Paste" action in any directory to finalize.'
    });
  };

  const handlePaste = async () => {
    if (clipboard.length === 0 || !id) return;
    try {
      for (const item of clipboard) {
        await AccountService.createFile(id, {
          ...item,
          name: `${item.name}-copy-${Math.floor(Math.random() * 1000)}`,
          path: currentPath
        });
      }
      fetchFiles(id, currentPath);
      setClipboard([]);
      toast.success(`Successfully pasted ${clipboard.length} item(s)`);
    } catch (err) {
      toast.error('Failed to paste some items');
    }
  };

  const handleRename = async () => {
    if (!isRenaming || !newName || !id) return;
    try {
      const file = files.find(f => f.name === isRenaming);
      if (file) {
        await AccountService.deleteFile(id, isRenaming, currentPath);
        await AccountService.createFile(id, { ...file, name: newName, path: currentPath });
        fetchFiles(id, currentPath);
        toast.success(`Renamed to ${newName}`);
      }
    } catch (err) {
      toast.error('Failed to rename file');
    }
    setIsRenaming(null);
    setNewName('');
  };

  const handleMove = async (name: string) => {
    if (!id) return;
    try {
      const file = files.find(f => f.name === name);
      if (file) {
        await AccountService.deleteFile(id, name, currentPath);
        await AccountService.createFile(id, { ...file, path: moveDestination });
        fetchFiles(id, currentPath);
        toast.warning(`Moved ${name} successfully`, {
          description: `The resource has been re-routed to ${moveDestination}.`
        });
      }
    } catch (err) {
      toast.error('Failed to move file');
    }
    setIsMoving(null);
  };

  const handlePermissionsSave = async (newPerm: string) => {
    if (editingPermissions && id) {
      try {
        await AccountService.deleteFile(id, editingPermissions.name, currentPath);
        await AccountService.createFile(id, { ...editingPermissions, perm: newPerm, path: currentPath });
        fetchFiles(id, currentPath);
        toast.success(`Updated permissions for ${editingPermissions.name} to ${newPerm}`);
      } catch (err) {
        toast.error('Failed to update permissions');
      }
      setEditingPermissions(null);
    }
  };

  const generateSSHKey = () => {
    const newKey = {
      id: Math.random().toString(36).substr(2, 9),
      name: `New Key ${new Date().toLocaleDateString()}`,
      key: `ssh-ed25519 AAAAC3Nza...[auto-generated-${Math.random().toString(36).substr(2, 5)}]`,
      created: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    };
    setSshKeys([...sshKeys, newKey]);
    toast.success("New SSH RSA Key generated and deployed.");
  };

  const revokeSSHKey = (id: string) => {
    setSshKeys(sshKeys.filter(k => k.id !== id));
    toast.error("SSH Key access revoked immediately.");
  };



  const handleSaveEdit = async () => {
    if (editingFile && id) {
      try {
        // Encode content back to base64 for storage consistency
        const contentToSave = isCode(editingFile.name) 
          ? encodeToBase64(editingFile.content || '') 
          : editingFile.content;

        await AccountService.deleteFile(id, editingFile.name, currentPath);
        await AccountService.createFile(id, { 
          ...editingFile, 
          content: contentToSave,
          path: currentPath 
        });
        fetchFiles(id, currentPath);
        toast.success(`Saved changes to ${editingFile.name}`);
      } catch (err) {
        toast.error('Failed to save file changes');
      }
      setEditingFile(null);
    }
  };

  const getFileExtension = (name: string) => name.split('.').pop()?.toLowerCase() || '';

  const isImage = (name: string) => {
    const ext = getFileExtension(name);
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext);
  };

  const isPDF = (name: string) => getFileExtension(name) === 'pdf';

  const isCode = (name: string) => {
    const ext = getFileExtension(name).toLowerCase();
    const codeExts = [
      'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'php', 'py', 'rb', 'sh', 
      'md', 'sql', 'yaml', 'yml', 'txt', 'conf', 'ini', 'env', 'htaccess',
      'gitignore', 'npmrc', 'dockerignore', 'dockerfile', 'editorconfig',
      'xml', 'svg', 'lock', 'log', 'config', 'properties', 'svelte', 'vue', 'astro'
    ];
    return codeExts.includes(ext) || name.toLowerCase() === 'makefile' || name.toLowerCase() === 'dockerfile';
  };

  const tryDecodeBase64 = (str: string, filename?: string) => {
    if (!str) return '';
    const trimmed = str.trim();
    
    // 1. Check for explicit prefix (New management style)
    if (trimmed.startsWith('b64:')) {
      try {
        const binary = atob(trimmed.substring(4));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new TextDecoder().decode(bytes);
      } catch (e) {
        return trimmed.substring(4);
      }
    }

    // 2. Legacy/Upload support for images - return as is for <img> src
    if (filename && isImage(filename)) return trimmed;

    // 3. Backward compatibility: If it looks like base64 and it's code, try decoding
    if (filename && isCode(filename) && /^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 10) {
      try {
        const binary = atob(trimmed);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const decoded = new TextDecoder().decode(bytes);
        // Only return if it doesn't look like corrupted binary noise (no null bytes usually in code)
        if (!decoded.includes('\0')) return decoded;
      } catch (e) {}
    }

    return str;
  };

  const encodeToBase64 = (str: string) => {
    try {
      const bytes = new TextEncoder().encode(str);
      const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
      return 'b64:' + btoa(binary);
    } catch (e) {
      return 'b64:' + btoa(str);
    }
  };

  const handleDownloadFile = (file: FileEntity) => {
    if (!file.content) return;
    try {
      // Check if it's base64 or raw
      let blob;
      if (/^[A-Za-z0-9+/=]+$/.test(file.content.trim())) {
        const byteCharacters = atob(file.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'application/octet-stream' });
      } else {
        blob = new Blob([file.content], { type: 'text/plain' });
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Failed to process download");
    }
  };

  return (
    <div 
      className={cn(
        "flex flex-col h-[calc(100vh-64px)] overflow-hidden transition-all duration-300",
        isDragOver && "bg-primary/5 ring-4 ring-inset ring-primary/20 scale-[0.99] rounded-[3rem]"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
           <motion.div 
             initial={{ scale: 0.8, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-primary text-on-primary p-12 rounded-[3.5rem] shadow-2xl flex flex-col items-center gap-6"
           >
              <Upload size={80} strokeWidth={3} className="animate-bounce" />
              <div className="text-center">
                <h2 className="text-3xl font-display font-black uppercase tracking-widest">Drop to Deploy</h2>
                <p className="font-bold opacity-60 text-sm mt-2">ALABA CLUSTER RESOURCE SAVE</p>
              </div>
           </motion.div>
        </div>
      )}

      {/* Backup Import Modal */}
      <AnimatePresence>
        {showBackupImport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-surface-dim/40 backdrop-blur-sm"
              onClick={() => setShowBackupImport(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-10 space-y-8"
            >
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/10 text-primary rounded-3xl">
                  <ZapIcon size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-on-surface tracking-tighter">Import CPanel Package</h3>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-[0.2em] opacity-60">Full Account Migration Node</p>
                </div>
              </div>

              <div className="p-6 bg-surface border-2 border-dashed border-outline-variant/50 rounded-[2rem] flex flex-col items-center justify-center text-center gap-4 group hover:border-primary/50 transition-all cursor-pointer">
                 <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-primary/40 group-hover:scale-110 transition-transform">
                   <FileArchive size={32} />
                 </div>
                 <div className="space-y-1">
                   <p className="text-sm font-bold text-on-surface">Select .tar.gz or .zip CPanel backup</p>
                   <p className="text-[10px] font-medium text-on-surface-variant uppercase tracking-widest">Maximum Package Size: 5GB</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                   <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Auto-detect MySQL databases and users</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                   <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Restore mail configurations and forwarders</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                   <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">Map DNS zones to Alaba local clusters</span>
                 </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowBackupImport(false)}
                  className="flex-1 py-5 text-[10px] font-black uppercase text-on-surface-variant tracking-[0.2em] hover:bg-surface-variant rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    toast.success('Initiating full account migration...');
                    setShowBackupImport(false);
                  }}
                  className="flex-1 py-5 bg-primary text-on-primary font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Start Import
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <header className="px-8 py-6 bg-surface-container border-b border-outline-variant flex flex-col gap-6 shrink-0 shadow-sm relative z-20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-black text-on-surface tracking-tighter">Asset Explorer</h1>
            <p className="text-on-surface-variant font-medium text-sm opacity-70">Infrastructure File Management</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                if (!id) return;
                setIsRefreshing(true);
                Promise.all([
                  fetchFiles(id, currentPath, true), // Force sidebar update
                  AccountService.getAccounts().then(accounts => {
                    const acc = accounts.find((a: any) => String(a.id) === id);
                    if (acc) setAccount(acc);
                  })
                ]).finally(() => {
                  setTimeout(() => setIsRefreshing(false), 800);
                });
              }}
              disabled={isLoadingFiles || isRefreshing}
              className="p-2.5 bg-surface border border-outline-variant rounded-xl text-on-surface-variant hover:text-primary transition-all active:scale-95 disabled:opacity-50"
              title="Reload File Manager"
            >
              <RefreshCcw size={18} className={cn((isLoadingFiles || isRefreshing) && "animate-spin")} />
            </button>
            <div className="px-4 py-2 bg-primary/5 rounded-xl border border-primary/10">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.15em]">
                Storage: {account ? (((account.disk_usage || account.diskUsage || 0)/1024).toFixed(2)) : '0'}GB / {account ? ((account.disk_limit || account.diskLimit || 2048)/1024).toFixed(0) : '0'}GB
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-outline-variant/30 shadow-inner">
            <button 
              onClick={async () => {
                const name = prompt('Enter file name:');
                if (name && id) {
                  await AccountService.createFile(id, { name, type: 'file', path: currentPath });
                  fetchFiles(id, currentPath);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-primary hover:bg-primary-container rounded-lg transition-all active:scale-95 uppercase tracking-widest"
            >
              <FilePlus size={16} />
              <span>File</span>
            </button>
            <button 
              onClick={async () => {
                const name = prompt('Enter folder name:');
                if (name && id) {
                  await AccountService.createFile(id, { name, type: 'folder', path: currentPath });
                  fetchFiles(id, currentPath);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-primary hover:bg-primary-container rounded-lg transition-all active:scale-95 uppercase tracking-widest"
            >
              <FolderPlus size={16} />
              <span>Folder</span>
            </button>
          </div>

          <div className="h-8 w-px bg-outline-variant mx-2 opacity-30" />

          <div className="flex items-center gap-1">
            {[
              { icon: Upload, label: 'Upload', action: handleUpload },
              { icon: ZapIcon, label: 'Import CPanel', action: handleImportCPanel },
              { icon: Download, label: 'Download', action: () => {
                if (checkedFiles.size > 0) handleDownload(Array.from(checkedFiles));
                else if (selectedFile) handleDownload([selectedFile]);
              } },
              { icon: Copy, label: 'Copy', action: () => {
                if (checkedFiles.size > 0) handleCopy(Array.from(checkedFiles));
                else if (selectedFile) handleCopy([selectedFile]);
              } },
              { icon: Clipboard, label: 'Paste', action: handlePaste, hidden: clipboard.length === 0 },
              { icon: Move, label: 'Move', action: () => selectedFile && setIsMoving(selectedFile) },
              { icon: Edit3, label: 'Edit', action: () => {
                const f = files.find(f => f.name === selectedFile);
                if (f) {
                  if (f.type === 'file' && isCode(f.name)) {
                    const decoded = tryDecodeBase64(f.content || '', f.name);
                    setEditingFile({ ...f, content: decoded });
                  } else {
                    setEditingFile(f);
                  }
                }
              }},
              { icon: Eye, label: 'Preview', action: () => {
                const f = files.find(f => f.name === selectedFile);
                if (f) setPreviewFile(f);
              }},
              { icon: LockIcon, label: 'Permissions', action: () => {
                const f = files.find(f => f.name === selectedFile);
                if (f) setEditingPermissions(f);
              }},
              { icon: Trash2, label: 'Delete', action: () => {
                if (checkedFiles.size > 0) {
                  handleDelete(Array.from(checkedFiles));
                } else if (selectedFile) {
                  handleDelete([selectedFile]);
                }
              }, variant: 'error' },
              { icon: Key, label: 'Rename', action: () => {
                if (selectedFile) {
                  setIsRenaming(selectedFile);
                  setNewName(selectedFile);
                }
              } },
            ].filter(t => !t.hidden).map((tool, i) => (
              <button 
                key={i} 
                onClick={tool.action}
                disabled={(!selectedFile && checkedFiles.size === 0 && tool.label !== 'Upload' && tool.label !== 'Paste') || (checkedFiles.size > 0 && (tool.label === 'Edit' || tool.label === 'Rename'))}
                title={tool.label}
                className={cn(
                  "p-2.5 rounded-xl transition-all hover:bg-surface-variant disabled:opacity-20 disabled:grayscale relative",
                  tool.variant === 'error' ? "text-error hover:bg-error-container/20" : "text-on-surface-variant",
                  tool.label === 'Paste' && "text-primary animate-pulse"
                )}
              >
                <tool.icon size={18} />
                {tool.label === 'Paste' && (
                  <span className="absolute -top-1 -right-1 bg-primary text-on-primary text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black">
                    {clipboard.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 max-w-md ml-auto">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onFocus={() => setShowSearchHistory(true)}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search files..."
                  className="w-full bg-surface border border-outline-variant pl-10 pr-4 py-2.5 rounded-full text-xs focus:ring-4 focus:ring-primary/10 transition-all font-bold text-on-surface outline-none"
                />
              <AnimatePresence>
                {showSearchHistory && recentSearches.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSearchHistory(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 w-full mt-2 bg-surface shadow-2xl rounded-2xl border border-outline-variant z-20 overflow-hidden"
                    >
                      <div className="px-4 py-2 border-b border-outline-variant/30 flex items-center gap-2">
                        <History size={12} className="text-on-surface-variant opacity-40" />
                        <span className="text-[9px] font-black uppercase text-on-surface-variant opacity-40 tracking-widest">Recent Queries</span>
                      </div>
                      {recentSearches.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setSearchQuery(s);
                            setShowSearchHistory(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-on-surface-variant hover:bg-primary-container/20 hover:text-primary transition-all text-left"
                        >
                          <Search size={14} className="opacity-20" />
                          <span>{s}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </form>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 bg-surface-container border-r border-outline-variant flex flex-col pt-6 shrink-0 relative z-10">
          <div className="px-6 mb-6">
            <h3 className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] opacity-40">Navigation Tree</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
            <nav className="space-y-1">
              {/* Dynamic folder tree based on files state at root or cached folders */}
              {rootFolders.map((rootFolder) => {
                const isOpen = (rootFolder === 'public_html' && isPublicHtmlOpen) || (rootFolder === 'mail' && isMailOpen);
                const toggle = () => {
                   if (rootFolder === 'public_html') {
                     setIsPublicHtmlOpen(!isPublicHtmlOpen);
                     if (!isPublicHtmlOpen) setCurrentPath('/public_html');
                   } else if (rootFolder === 'mail') {
                     setIsMailOpen(!isMailOpen);
                     if (!isMailOpen) setCurrentPath('/mail');
                   } else {
                     setCurrentPath('/' + rootFolder);
                   }
                };
                
                return (
                   <div key={rootFolder}>
                     <button 
                       onClick={toggle}
                       className={cn(
                         "w-full flex items-center gap-2 p-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all",
                         (currentPath.startsWith('/' + rootFolder) || (rootFolder === 'public_html' && isPublicHtmlOpen) || (rootFolder === 'mail' && isMailOpen)) ? "text-primary bg-primary-container/20" : "text-on-surface-variant hover:bg-surface-variant"
                       )}
                     >
                       <motion.div animate={{ rotate: ((rootFolder === 'public_html' && isPublicHtmlOpen) || (rootFolder === 'mail' && isMailOpen)) ? 90 : 0 }}>
                         <ChevronRight size={14} className="opacity-40" />
                       </motion.div>
                       {rootFolder === 'public_html' ? (
                         <Home size={16} className={cn(isPublicHtmlOpen && "text-primary")} />
                       ) : (rootFolder === 'mail' || rootFolder.includes('mail')) ? (
                         <MailIcon size={16} className={cn(isMailOpen && rootFolder === 'mail' && "text-primary")} />
                       ) : (
                         <Folder size={16} />
                       )}
                       <span>{rootFolder}</span>
                     </button>
                    
                    {((rootFolder === 'public_html' && isPublicHtmlOpen) || (rootFolder === 'mail' && isMailOpen)) && (
                      <AnimatePresence>
                        {((rootFolder === 'public_html' && isPublicHtmlOpen) || (rootFolder === 'mail' && isMailOpen)) && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="ml-5 overflow-hidden"
                          >
                            <div className="mt-1 space-y-0.5 border-l border-outline-variant/30 pl-2">
                              {/* Filter real folders if we are in this root, otherwise use defaults */}
                              {files.filter(f => f.type === 'folder').map((item: any) => (
                                <div 
                                  key={item.name} 
                                  onClick={() => handleFolderClick(item.name)}
                                  className={cn(
                                    "flex items-center gap-2 p-2 text-on-surface-variant hover:bg-surface-variant rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors group",
                                    currentPath.endsWith('/' + item.name) && "text-primary bg-primary/5"
                                  )}
                                >
                                   <Folder size={14} className="opacity-40" />
                                   <span>{item.name}</span>
                                </div>
                              ))}
                              {files.filter(f => f.type === 'folder').length === 0 && (
                                <div className="p-2 text-[9px] text-on-surface-variant/40 italic">
                                  No subdirectories found
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="p-4 mt-auto space-y-4">
             <button 
               onClick={() => setShowSSHManager(true)}
               className="w-full flex items-center gap-3 p-3 bg-primary text-on-primary rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
             >
               <Shield size={16} />
               <span>Manage SSH Access</span>
             </button>

             <div className="bg-surface p-4 rounded-2xl border border-outline-variant/30 space-y-3 shadow-inner">
                <div className="flex justify-between items-center">
                   <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant">Cluster Load</span>
                   <span className="text-[10px] font-mono font-bold text-primary">0.14</span>
                </div>
                <div className="h-1.5 bg-surface-container-high rounded-full overflow-hidden">
                   <div className="h-full w-1/4 bg-primary" />
                </div>
             </div>
          </div>
        </aside>

        <section className="flex-1 flex flex-col bg-surface overflow-hidden relative">
          <nav className="px-8 py-3 bg-surface-container-low/30 border-b border-outline-variant/10 flex items-center justify-between">
            <div className="flex items-center text-[9px] font-black tracking-[0.2em] uppercase text-on-surface-variant">
              <span onClick={() => {
                setSearchQuery('');
                setCurrentPath('/');
              }} className="hover:text-primary cursor-pointer transition-colors opacity-40 uppercase">Root</span>
              {!searchQuery && currentPath !== '/' && currentPath.split('/').filter(p => p).map((part, i, arr) => (
                <React.Fragment key={i}>
                  <ChevronRight size={12} className="mx-2 opacity-10" />
                  <span 
                    onClick={() => setCurrentPath('/' + arr.slice(0, i + 1).join('/'))}
                    className={cn(
                      "hover:text-primary cursor-pointer transition-colors",
                      i === arr.length - 1 ? "text-primary opacity-100" : "opacity-40"
                    )}
                  >
                    {part}
                  </span>
                </React.Fragment>
              ))}
              {searchQuery && (
                <>
                  <ChevronRight size={12} className="mx-2 opacity-10" />
                  <span className="text-primary">Search Results for "{searchQuery}"</span>
                </>
              )}
            </div>
            {(currentPath !== '/' || searchQuery) && (
              <div className="flex items-center gap-4">
                {searchQuery ? (
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      fetchFiles(id!, currentPath);
                    }}
                    className="flex items-center gap-1 text-[10px] bg-primary/10 px-3 py-1.5 rounded-lg font-black uppercase text-primary hover:bg-primary/20 transition-all shadow-sm"
                  >
                    <X size={14} />
                    <span>Clear Search</span>
                  </button>
                ) : (
                  <button 
                    onClick={goBack} 
                    className="flex items-center gap-1 text-[10px] bg-primary/10 px-3 py-1.5 rounded-lg font-black uppercase text-primary hover:bg-primary/20 transition-all shadow-sm"
                  >
                    <ChevronDown size={14} className="rotate-90" />
                    <span>Back</span>
                  </button>
                )}
                <div className="h-4 w-px bg-outline-variant opacity-20" />
                <button onClick={goBack} className="text-[9px] font-black uppercase text-primary hover:underline">
                  Up One level
                </button>
              </div>
            )}
          </nav>

          <AnimatePresence>
            {(isUploading || isExtracting) && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-primary/5 px-8 py-3 border-b border-primary/10 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-primary">
                  <div className="flex items-center gap-2">
                    <RefreshCcw size={12} className="animate-spin" />
                    <span>{isExtracting ? 'Extracting ZIP Archive...' : 'Uploading Cluster Resource...'}</span>
                  </div>
                  <span>{isExtracting ? extractProgress : uploadProgress}%</span>
                </div>
                <div className="h-1 bg-surface rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${isExtracting ? extractProgress : uploadProgress}%` }}
                    className="h-full bg-primary"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-surface/90 backdrop-blur-md z-10">
                <tr className="border-b border-outline-variant/30">
                  <th className="px-8 py-5 w-12 text-center">
                     <button 
                       onClick={toggleSelectAll}
                       className={cn(
                         "mx-auto h-5 w-5 rounded-md border-2 border-outline-variant flex items-center justify-center cursor-pointer transition-all",
                         checkedFiles.size > 0 && checkedFiles.size === filteredFiles.length ? "bg-primary border-primary" : 
                         checkedFiles.size > 0 ? "bg-primary/50 border-primary/50" : "bg-transparent"
                       )}
                     >
                        {checkedFiles.size > 0 && checkedFiles.size === filteredFiles.length && <Check size={12} className="text-on-primary" strokeWidth={4} />}
                        {checkedFiles.size > 0 && checkedFiles.size < filteredFiles.length && <div className="h-0.5 w-2 bg-on-primary rounded-full" />}
                     </button>
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Name Cluster</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-right">Data Size</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Save Date</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-on-surface-variant text-center">Perms</th>
                  <th className="px-8 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filteredFiles.map((file, i) => (
                  <tr 
                    key={i} 
                    onClick={() => setSelectedFile(file.name)}
                    onDoubleClick={() => file.type === 'folder' && handleFolderClick(file.name)}
                    className={cn(
                      "group transition-all cursor-pointer select-none border-l-4",
                      selectedFile === file.name ? "bg-primary/5 border-primary" : "hover:bg-surface-variant/50 border-transparent",
                      checkedFiles.has(file.name) && "bg-primary/5"
                    )}
                  >
                    <td className="px-8 py-4 text-center">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           toggleFileCheck(file.name);
                         }}
                         className={cn(
                           "mx-auto h-5 w-5 rounded-md border-2 transition-all flex items-center justify-center",
                           checkedFiles.has(file.name) ? "bg-primary border-primary" : "border-outline-variant group-hover:border-primary/50 bg-transparent"
                         )}
                       >
                          {checkedFiles.has(file.name) && <Check size={12} className="text-on-primary" strokeWidth={4} />}
                       </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "p-2 rounded-lg transition-transform group-hover:scale-110",
                          file.type === 'folder' ? "bg-secondary/5 text-secondary" : "bg-primary/5 text-primary"
                        )}>
                          {file.name === 'public_html'
                            ? <Home size={18} className="text-primary" />
                            : file.type === 'folder' 
                              ? <Folder size={18} fill="currentColor" fillOpacity={0.1} /> 
                              : <File size={18} />
                          }
                        </div>
                        <span className="text-sm font-bold text-on-surface tracking-tight">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-[11px] font-mono font-bold text-on-surface-variant/70">{file.size}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-semibold text-on-surface-variant/60">{file.modified}</span>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant text-[10px] font-black font-mono border border-outline-variant/20 tracking-tighter">
                        {file.perm}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right overflow-visible relative">
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           setActiveMenu(activeMenu === file.name ? null : file.name);
                         }}
                         className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container"
                       >
                          <MoreVertical size={18} />
                       </button>

               {/* Row Kebab Menu */}
               <AnimatePresence>
                 {activeMenu === file.name && (
                   <>
                     <div className="fixed inset-0 z-40" onClick={() => setActiveMenu(null)} />
                     <motion.div 
                       initial={{ opacity: 0, scale: 0.95, y: -10 }}
                       animate={{ opacity: 1, scale: 1, y: 0 }}
                       exit={{ opacity: 0, scale: 0.95, y: -10 }}
                       className="absolute right-12 top-0 mt-2 w-48 bg-surface border border-outline-variant rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col p-1.5"
                     >
                       {[
                         { icon: Edit3, label: 'Rename', action: () => { setIsRenaming(file.name); setNewName(file.name); } },
                         { icon: Eye, label: 'Preview', action: () => setPreviewFile(file) },
                         { icon: isCode(file.name) ? Edit3 : LockIcon, label: isCode(file.name) ? 'Edit Code' : 'Permissions', action: () => {
                           if (isCode(file.name)) {
                             const decoded = tryDecodeBase64(file.content || '', file.name);
                             setEditingFile({ ...file, content: decoded });
                           } else {
                             setEditingPermissions(file);
                           }
                         }},
                         { icon: LockIcon, label: 'Permissions', action: () => setEditingPermissions(file), hidden: isCode(file.name) },
                         { icon: Copy, label: 'Copy', action: () => handleCopy([file.name]) },
                         { icon: Move, label: 'Move', action: () => setIsMoving(file.name) },
                         { icon: Download, label: 'Download', action: () => handleDownload([file.name]) },
                         { icon: FileArchive, label: 'Extract', action: () => handleExtractZip(file), hidden: !file.name.endsWith('.zip') },
                         { icon: ZapIcon, label: 'Restore Backup', action: () => handleBackupRestore(file), hidden: !file.name.endsWith('.gz') && !file.name.endsWith('.tar') },
                         { icon: Trash2, label: 'Delete', action: () => handleDelete([file.name]), className: 'text-error' },
                       ].filter(a => !a.hidden).map((action, idx) => (
                                 <button 
                                   key={idx}
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     action.action();
                                     setActiveMenu(null);
                                   }}
                                   className={cn(
                                     "w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-surface-variant rounded-xl transition-all",
                                     action.className || "text-on-surface-variant hover:text-primary"
                                   )}
                                 >
                                   <action.icon size={14} />
                                   <span>{action.label}</span>
                                 </button>
                               ))}
                             </motion.div>
                           </>
                         )}
                       </AnimatePresence>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Rename Modal */}
          <AnimatePresence>
            {isRenaming && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-surface-dim/40 backdrop-blur-sm"
                  onClick={() => setIsRenaming(null)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-md bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-8 space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                      <Edit3 size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-on-surface tracking-tighter">Rename Asset</h3>
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">ID: cluster-node-rename-01</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 opacity-70">Resource Identity</label>
                    <input 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-surface border border-outline-variant/50 rounded-2xl px-5 py-4 text-sm font-bold text-on-surface focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      placeholder="Enter new resource name..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsRenaming(null)}
                      className="flex-1 py-4 text-[10px] font-black uppercase text-on-surface-variant tracking-widest hover:bg-surface-variant rounded-2xl transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleRename}
                      className="flex-1 py-4 bg-primary text-on-primary font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Commit
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Move Modal */}
          <AnimatePresence>
            {isMoving && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-surface-dim/40 backdrop-blur-sm"
                  onClick={() => setIsMoving(null)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-md bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-8 space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
                      <Move size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-on-surface tracking-tighter">Relocate Cluster</h3>
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Routing Logic Provider</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant ml-1 opacity-70">Target Destination</label>
                      <div className="relative">
                        <Folder className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 w-4 h-4" />
                        <input 
                          value={moveDestination}
                          onChange={(e) => setMoveDestination(e.target.value)}
                          className="w-full bg-surface border border-outline-variant/50 rounded-2xl pl-11 pr-4 py-4 text-sm font-bold text-on-surface focus:ring-4 focus:ring-secondary/10 outline-none transition-all"
                          placeholder="/path/to/destination"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-surface rounded-2xl border border-outline-variant/20 italic text-[11px] text-on-surface-variant">
                      Target: "{isMoving}" will be relocated to the specified node.
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant ml-1 opacity-40">Presourced Nodes</p>
                      {['/etc', '/logs', '/tmp', '/public_html'].map(dest => (
                        <button 
                          key={dest}
                          onClick={() => setMoveDestination(dest)}
                          className={cn(
                            "w-full flex items-center justify-between p-4 bg-surface hover:bg-primary/5 rounded-2xl border transition-all group",
                            moveDestination === dest ? "border-primary/50 bg-primary/5 shadow-sm" : "border-outline-variant/10"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Folder size={16} className={cn(
                              "transition-colors",
                              moveDestination === dest ? "text-primary" : "text-on-surface-variant/40 group-hover:text-primary"
                            )} />
                            <span className={cn(
                              "text-xs font-bold transition-colors",
                              moveDestination === dest ? "text-primary" : "text-on-surface-variant group-hover:text-primary"
                            )}>{dest}</span>
                          </div>
                          {moveDestination === dest && <Check size={14} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsMoving(null)}
                      className="flex-1 py-4 text-[10px] font-black uppercase text-on-surface-variant tracking-widest hover:bg-surface-variant rounded-2xl transition-all"
                    >
                      Abort
                    </button>
                    <button 
                      onClick={() => handleMove(isMoving)}
                      className="flex-1 py-4 bg-secondary text-on-secondary font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Relocate
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          <footer className="px-8 py-4 bg-surface-container-low border-t border-outline-variant flex items-center justify-between shadow-2xl relative z-10 shrink-0">
            <div className="flex items-center gap-6">
              <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-[0.2em] opacity-40">
                Resource Index: <span className="text-primary">{files.length} ITEMS</span>
              </span>
              <div className="h-4 w-px bg-outline-variant opacity-20" />
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]" />
                <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-80">Sub-system Operational</span>
              </div>
            </div>
            <div className="text-[9px] font-black text-on-surface-variant/30 uppercase tracking-[0.3em]">
              Alaba Cluster Node: FRA-04
            </div>
          </footer>

          {/* SSH Key Manager Modal */}
          <AnimatePresence>
            {showSSHManager && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-surface-dim/40 backdrop-blur-sm"
                  onClick={() => setShowSSHManager(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-2xl bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-8 space-y-6 flex flex-col max-h-[80vh]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                        <Shield size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-on-surface tracking-tighter">SSH Key Management</h3>
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Authorize Cluster Access</p>
                      </div>
                    </div>
                    <button 
                      onClick={generateSSHKey}
                      className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      <PlusCircle size={14} />
                      <span>Generate Key</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
                    {sshKeys.map(k => (
                      <div key={k.id} className="p-4 bg-surface rounded-2xl border border-outline-variant/20 flex flex-col gap-3 group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Server size={18} className="text-primary" />
                            <span className="font-bold text-sm">{k.name}</span>
                            <span className="text-[10px] text-on-surface-variant font-medium opacity-50">Created {k.created}</span>
                          </div>
                          <button 
                            onClick={() => revokeSSHKey(k.id)}
                            className="p-2 text-error hover:bg-error-container/20 rounded-xl transition-all"
                            title="Revoke Key"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="bg-surface-container-high p-3 rounded-xl border border-outline-variant/10">
                          <code className="text-[10px] font-mono break-all opacity-60">{k.key}</code>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => setShowSSHManager(false)}
                    className="w-full py-4 text-[10px] font-black uppercase text-on-surface-variant tracking-widest hover:bg-surface-variant rounded-2xl transition-all border border-outline-variant/30"
                  >
                    Close Secure Manager
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Permissions Editor Modal */}
          <AnimatePresence>
            {editingPermissions && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-surface-dim/40 backdrop-blur-sm"
                  onClick={() => setEditingPermissions(null)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-lg bg-surface-container border border-outline-variant/30 rounded-[2.5rem] shadow-2xl p-8 space-y-8"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
                      <LockIcon size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-on-surface tracking-tighter">chmod: {editingPermissions.name}</h3>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Configuration Management</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-6">
                    <div className="col-start-2 text-center text-[10px] font-black uppercase text-on-surface-variant opacity-40 tracking-widest">R</div>
                    <div className="text-center text-[10px] font-black uppercase text-on-surface-variant opacity-40 tracking-widest">W</div>
                    <div className="text-center text-[10px] font-black uppercase text-on-surface-variant opacity-40 tracking-widest">X</div>
                    
                    {['Owner', 'Group', 'World'].map((role) => (
                      <React.Fragment key={role}>
                        <div className="text-xs font-bold self-center">{role}</div>
                        {[4, 2, 1].map((bit) => {
                          const octalIdx = role === 'Owner' ? 1 : role === 'Group' ? 2 : 3;
                          const currentVal = parseInt(editingPermissions.perm[octalIdx]);
                          const isActive = (currentVal & bit) !== 0;

                          return (
                            <div key={bit} className="flex justify-center">
                              <button 
                                onClick={() => {
                                  let newOctal = editingPermissions.perm.split('');
                                  let val = parseInt(newOctal[octalIdx]);
                                  val = isActive ? val - bit : val + bit;
                                  newOctal[octalIdx] = val.toString();
                                  setEditingPermissions({ ...editingPermissions, perm: newOctal.join('') });
                                }}
                                className={cn(
                                  "w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all active:scale-90 bg-surface group",
                                  isActive ? "border-secondary bg-secondary/5" : "border-outline-variant hover:border-secondary/40"
                                )}
                              >
                                <Check size={18} className={cn("transition-all", isActive ? "text-secondary scale-100" : "text-secondary opacity-0 scale-50 group-hover:opacity-20")} />
                              </button>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="bg-surface-container-high p-6 rounded-2xl border border-outline-variant/20 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Octal Representative</span>
                      <p className="text-4xl font-black text-secondary tracking-tighter mt-1">{editingPermissions.perm}</p>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Recursive Mode</span>
                       <button className="block ml-auto mt-2 w-12 h-6 bg-secondary/20 rounded-full relative">
                          <div className="absolute right-1 top-1 w-4 h-4 bg-secondary rounded-full" />
                       </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setEditingPermissions(null)}
                      className="flex-1 py-4 text-[10px] font-black uppercase text-on-surface-variant tracking-widest hover:bg-surface-variant rounded-2xl transition-all"
                    >
                      Cancel Attributes
                    </button>
                    <button 
                      onClick={() => handlePermissionsSave(editingPermissions.perm)}
                      className="flex-1 py-4 bg-secondary text-on-secondary font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg shadow-secondary/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      Apply Changes
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* File Preview Modal */}
          <AnimatePresence>
            {previewFile && (
              <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-surface-dim/40 backdrop-blur-md"
                  onClick={() => setPreviewFile(null)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 30 }}
                  className="relative w-full max-w-5xl bg-surface-container border border-outline-variant/30 rounded-[3rem] shadow-2xl flex flex-col h-[85vh] overflow-hidden"
                >
                  <header className="p-8 border-b border-outline-variant/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                         <Eye size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-on-surface tracking-tighter">Preview: {previewFile.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Type: {getFileExtension(previewFile.name).toUpperCase()}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant opacity-60">Size: {previewFile.size}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => {
                           handleDownloadFile(previewFile);
                         }}
                         className="flex items-center gap-2 px-6 py-2.5 bg-surface-container-high text-on-surface text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-secondary hover:text-on-secondary transition-all shadow-sm"
                       >
                         <Download size={14} />
                         <span>Download</span>
                       </button>
                       {isCode(previewFile.name) && (
                         <button 
                           onClick={() => {
                             const decodedContent = tryDecodeBase64(previewFile.content || '', previewFile.name);
                             setPreviewFile(null);
                             setEditingFile({ ...previewFile, content: decodedContent });
                           }}
                           className="flex items-center gap-2 px-6 py-2.5 bg-surface-container-high text-on-surface text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary hover:text-on-primary transition-all shadow-sm"
                         >
                           <Edit3 size={14} />
                           <span>Open Full Editor</span>
                         </button>
                       )}
                       <button 
                         onClick={() => setPreviewFile(null)}
                         className="p-2.5 bg-surface-container-high text-on-surface-variant hover:text-error rounded-xl transition-all"
                       >
                         <X size={20} />
                       </button>
                    </div>
                  </header>
                  <div className="flex-1 overflow-hidden bg-black flex items-center justify-center">
                     {isImage(previewFile.name) ? (
                        <div className="w-full h-full p-8 flex items-center justify-center overflow-auto custom-scrollbar">
                           <img 
                             src={`data:image/${getFileExtension(previewFile.name)};base64,${previewFile.content}`} 
                             alt={previewFile.name}
                             className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                             referrerPolicy="no-referrer"
                           />
                        </div>
                     ) : isPDF(previewFile.name) ? (
                        <PDFPreview content={previewFile.content || ''} name={previewFile.name} />
                     ) : (
                        <div className="w-full h-full p-12 overflow-y-auto custom-scrollbar font-mono text-sm">
                           <pre className="text-green-400 opacity-80 leading-relaxed whitespace-pre-wrap break-all">
                              <code>{tryDecodeBase64(previewFile.content || '', previewFile.name) || '// Buffer empty or binary data detected.'}</code>
                           </pre>
                        </div>
                     )}
                  </div>
                  <footer className="p-6 bg-surface-container-low border-t border-outline-variant/10 flex items-center justify-between shrink-0">
                     <p className="text-[10px] font-black text-on-surface-variant opacity-40 uppercase tracking-[0.2em]">Alaba Read-Only Preview Engine</p>
                     {['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(getFileExtension(previewFile.name)) && (
                       <p className="text-[10px] font-bold text-primary uppercase animate-pulse">Large Document detected - Download recommended for full fidelity</p>
                     )}
                  </footer>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Confirmation Dialog */}
          <AnimatePresence>
            {confirmation?.show && (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-surface-dim/60 backdrop-blur-sm"
                  onClick={() => setConfirmation(null)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="relative w-full max-w-sm bg-surface-container border border-outline-variant/40 rounded-[2.5rem] shadow-2xl p-8 space-y-6 text-center"
                >
                  <div className={cn(
                    "mx-auto w-16 h-16 rounded-full flex items-center justify-center",
                    confirmation.type === 'delete' ? "bg-error/10 text-error" : "bg-primary/10 text-primary"
                  )}>
                    {confirmation.type === 'delete' ? <Trash2 size={32} /> : <ShieldAlert size={32} />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-on-surface tracking-tighter">{confirmation.title}</h3>
                    <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">{confirmation.message}</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setConfirmation(null)}
                      className="flex-1 py-4 text-[10px] font-black uppercase text-on-surface-variant tracking-widest hover:bg-surface-variant rounded-2xl transition-all"
                    >
                      Go Back
                    </button>
                    <button 
                      onClick={confirmation.onConfirm}
                      className={cn(
                        "flex-1 py-4 font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-lg transition-all",
                        confirmation.type === 'delete' ? "bg-error text-white shadow-error/20" : "bg-primary text-on-primary shadow-primary/20"
                      )}
                    >
                      Confirm
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Edit Modal / Simulation Overlay */}
          <AnimatePresence>
            {editingFile && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-surface flex flex-col"
              >
                <header className="px-8 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-xl">
                      <Edit3 size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-on-surface tracking-tighter">Edit: {editingFile.name}</h3>
                      <p className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest opacity-60">Real-time Code Injection</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setEditingFile(null)}
                      className="px-6 py-2.5 text-[10px] font-black text-on-surface-variant uppercase tracking-widest hover:bg-surface-variant rounded-xl transition-all"
                    >
                      Discard
                    </button>
                    <button 
                      onClick={handleSaveEdit}
                      className="px-8 py-2.5 bg-primary text-on-primary text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
                    >
                      <Save size={14} />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </header>
                <div className="flex-1 p-8 bg-black">
                   <textarea 
                     value={editingFile.content || ''}
                     onChange={(e) => setEditingFile({ ...editingFile, content: e.target.value })}
                     className="w-full h-full bg-transparent text-green-400 font-mono text-sm resize-none outline-none leading-relaxed caret-white p-4"
                     spellCheck={false}
                   />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
};
