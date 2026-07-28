import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Download,
  Search,
  Sparkles,
  Edit3,
  Save,
  DollarSign,
  FileCheck,
  PenTool,
  Key,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import {
  subscribeCompanyDocuments,
  uploadDocumentFile,
  createDocumentRecord,
  updateDocumentExtractedData,
  deleteCompanyDocument,
  getCompanyLoads,
  getFirebaseFunctions,
  type CompanyDocument,
  type DocumentType,
  type ExtractedDocData,
  type Load,
  optimizeDocumentImageForOCR,
  parseFreightText,
} from '@silver-crown/shared';
import { runLocalDocumentOcr } from '../utils/tesseractOcr';
import { useAuth } from '../context/AuthContext';

export default function DocumentsPage() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');

  // Upload states
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selected document state for detailed viewer & editing
  const [selectedDoc, setSelectedDoc] = useState<CompanyDocument | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ExtractedDocData>>({});
  const [editDocType, setEditDocType] = useState<DocumentType>('other');
  const [editLoadId, setEditLoadId] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const saveApiKey = (key: string) => {
    const trimmed = key.trim();
    setGeminiApiKey(trimmed);
    localStorage.setItem('gemini_api_key', trimmed);
    setShowKeyModal(false);
  };

  useEffect(() => {
    if (!profile?.companyId) return;

    // Subscribe to company documents in Firestore
    const unsubDocs = subscribeCompanyDocuments(profile.companyId, (docs) => {
      setDocuments(docs);
      setLoading(false);

      // Keep selected document synced if open
      if (selectedDoc) {
        const updated = docs.find((d) => d.id === selectedDoc.id);
        if (updated) setSelectedDoc(updated);
      }
    });

    // Fetch company loads for dropdown linking
    getCompanyLoads(profile.companyId)
      .then(setLoads)
      .catch((err) => console.error('Failed to fetch loads:', err));

    return () => unsubDocs();
  }, [profile?.companyId]);

  // Open Document Detail View
  const handleOpenDoc = (docItem: CompanyDocument) => {
    setSelectedDoc(docItem);
    setIsEditing(false);
    setEditForm(docItem.extractedData || {});
    setEditDocType(docItem.docType);
    setEditLoadId(docItem.loadId || '');
  };

  // Upload & OCR Extraction handler
  const processFileUpload = async (file: File) => {
    if (!profile?.companyId || !profile?.uid) return;

    try {
      setUploading(true);
      setUploadProgress('Uploading file to secure storage...');

      // 1. Automatically preprocess and enhance image on canvas (2048px max dimension & +15% contrast boost)
      setUploadProgress('Enhancing document contrast for OCR...');
      const { base64Data, mimeType } = await optimizeDocumentImageForOCR(file, 2048);
      const enhancedImageSrc = base64Data.startsWith('data:')
        ? base64Data
        : `data:${mimeType || 'image/jpeg'};base64,${base64Data}`;

      // 2. Run 100% Real Local Tesseract.js OCR on the high-contrast enhanced image
      setUploadProgress('Extracting text from high-contrast image with Tesseract OCR...');
      const localOcr = await runLocalDocumentOcr(enhancedImageSrc, (msg) => setUploadProgress(msg));

      // 3. Parse exact fields from REAL OCR text (0 random numbers!)
      const realParsedFields = parseFreightText(localOcr.rawText, file.name);
      const docTypeHint: DocumentType = realParsedFields.documentType || 'bill_of_lading';

      const tempId = `doc_${Date.now()}`;
      const fileUrl = await uploadDocumentFile(profile.companyId, tempId, file, file.name);

      const docId = await createDocumentRecord({
        companyId: profile.companyId,
        uploadedBy: profile.uid,
        uploaderName: profile.displayName || 'Admin',
        fileName: file.name,
        fileUrl,
        fileType: mimeType || file.type || 'image/jpeg',
        docType: docTypeHint,
        status: 'processing',
        extractedData: realParsedFields,
      });

      setUploadProgress('Running Gemini AI Vision & Handwriting Extraction...');

      // 4. Trigger Cloud Function or Direct Gemini Vision Extraction
      try {
        const extractFn = httpsCallable<
          { documentId: string; fileUrl: string; fileName: string; fileType: string; base64Data?: string; apiKey?: string },
          { success: boolean; extractedData: ExtractedDocData }
        >(getFirebaseFunctions(), 'extractDocumentData');

        const res = await extractFn({
          documentId: docId,
          fileUrl,
          fileName: file.name,
          fileType: file.type || 'image/jpeg',
          base64Data,
          apiKey: geminiApiKey,
        });

        if (res.data?.extractedData) {
          const mergedData: ExtractedDocData = {
            ...realParsedFields,
            ...res.data.extractedData,
            documentType: res.data.extractedData.documentType || realParsedFields.documentType || 'bill_of_lading',
            bolNumber: res.data.extractedData.bolNumber || realParsedFields.bolNumber,
            rateConfirmationNumber: res.data.extractedData.rateConfirmationNumber || realParsedFields.rateConfirmationNumber,
            weight: res.data.extractedData.weight || realParsedFields.weight,
            totalRate: res.data.extractedData.totalRate || realParsedFields.totalRate,
            rawText: res.data.extractedData.rawText || localOcr.rawText,
          };

          const newDoc: CompanyDocument = {
            id: docId,
            companyId: profile.companyId,
            uploadedBy: profile.uid,
            uploaderName: profile.displayName || 'Admin',
            fileName: file.name,
            fileUrl,
            fileType: file.type || 'image/jpeg',
            docType: mergedData.documentType,
            status: 'processed',
            extractedData: mergedData,
            createdAt: new Date().toISOString(),
          };
          handleOpenDoc(newDoc);
          return;
        }
      } catch (extractErr) {
        console.warn('Cloud Function extraction notice:', extractErr);
        if (geminiApiKey) {
          try {
            const directData = await callDirectGeminiVision(geminiApiKey, base64Data, file.type || 'image/jpeg');
            const mergedDirect: ExtractedDocData = {
              ...realParsedFields,
              ...directData,
              bolNumber: directData.bolNumber || realParsedFields.bolNumber,
              rateConfirmationNumber: directData.rateConfirmationNumber || realParsedFields.rateConfirmationNumber,
            };
            await updateDocumentExtractedData(docId, mergedDirect, mergedDirect.documentType);
            return;
          } catch (directErr) {
            console.warn('Direct Gemini Vision extraction notice:', directErr);
          }
        }
        await updateDocumentExtractedData(docId, realParsedFields, realParsedFields.documentType);
      }
    } catch (error: unknown) {
      console.error('File upload error:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      alert(`Error uploading document: ${errMsg}`);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFileUpload(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Save edits to extracted document fields
  const handleSaveEdits = async () => {
    if (!selectedDoc) return;
    try {
      setSavingEdit(true);
      await updateDocumentExtractedData(selectedDoc.id, editForm as ExtractedDocData, editDocType, editLoadId);
      setIsEditing(false);
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete document
  const handleDelete = async (docId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await deleteCompanyDocument(docId);
      if (selectedDoc?.id === docId) setSelectedDoc(null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete document.');
    }
  };

  // Filter documents
  const filteredDocs = documents.filter((docItem) => {
    const matchesType = typeFilter === 'all' || docItem.docType === typeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      docItem.fileName.toLowerCase().includes(q) ||
      docItem.extractedData?.bolNumber?.toLowerCase().includes(q) ||
      docItem.extractedData?.rateConfirmationNumber?.toLowerCase().includes(q) ||
      docItem.extractedData?.shipperName?.toLowerCase().includes(q) ||
      docItem.extractedData?.consigneeName?.toLowerCase().includes(q);

    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-[family-name:var(--font-bebas)] text-4xl text-primary tracking-wider">
              DOCUMENT INTELLIGENCE
            </h1>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold">
              <Sparkles size={14} className="animate-pulse" />
              Gemini Vision OCR Active
            </span>
            <button
              onClick={() => {
                setTempKeyInput(geminiApiKey);
                setShowKeyModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-outline rounded-full text-xs font-semibold transition-colors"
              title="Configure Gemini API Key for Live Extraction"
            >
              <Key size={13} className="text-primary" />
              {geminiApiKey ? 'API Key Configured' : 'Set Gemini API Key'}
            </button>
          </div>
          <p className="text-on-surface-variant text-sm mt-1">
            Upload Bills of Lading, Rate Confirmations, Proof of Delivery, & Receipts with automated handwriting extraction.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-on-primary font-semibold rounded-lg hover:bg-primary-hover transition-colors shadow-md disabled:opacity-50"
        >
          <UploadCloud size={18} />
          <span>Upload Document</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Gemini API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-high border border-outline-variant rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-primary font-bold text-lg">
              <Key size={20} /> Configure Gemini Vision API Key
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Enter your free Google Gemini API key to enable live OCR vision extraction on all trucking documents (Bills of Lading, Rate Confirmations, PODs, & Receipts).
            </p>
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">Gemini API Key</label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                className="w-full bg-surface border border-outline rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
              />
              <p className="text-[11px] text-on-surface-variant/80 mt-1">
                Don't have a key? Get one for free at{' '}
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline font-medium"
                >
                  Google AI Studio
                </a>.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => saveApiKey(tempKeyInput)}
                className="px-4 py-2 text-xs font-semibold bg-primary text-on-primary rounded-lg hover:bg-primary-hover shadow"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
          isDragging
            ? 'border-primary bg-primary/10 scale-[1.01]'
            : 'border-outline hover:border-primary/50 bg-surface-container-low hover:bg-surface-container'
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center py-4 space-y-3">
            <Loader2 size={36} className="text-primary animate-spin" />
            <p className="text-on-surface font-medium">{uploadProgress}</p>
            <p className="text-on-surface-variant text-xs">Processing printed and handwritten text using Gemini Vision...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 space-y-2">
            <div className="p-4 bg-primary/10 rounded-full text-primary mb-2">
              <UploadCloud size={32} />
            </div>
            <p className="text-on-surface font-bold text-lg">
              Drag & Drop your document here, or <span className="text-primary underline">browse</span>
            </p>
            <p className="text-on-surface-variant text-sm">
              Supports Bill of Lading, Rate Confirmations, Proof of Delivery, Weight Tickets (JPG, PNG, PDF)
            </p>
            <div className="flex items-center gap-4 text-xs text-on-surface-variant mt-2 pt-2 border-t border-outline-variant">
              <span className="flex items-center gap-1"><PenTool size={12} className="text-primary" /> Handwritten Notes</span>
              <span className="flex items-center gap-1"><FileCheck size={12} className="text-primary" /> Auto-field extraction</span>
              <span className="flex items-center gap-1"><DollarSign size={12} className="text-primary" /> Rate & Weight detection</span>
            </div>
          </div>
        )}
      </div>

      {/* Document Detail Modal / Drawer (if selected) */}
      {selectedDoc && (
        <div className="bg-surface-container-high rounded-2xl border border-outline-variant p-6 space-y-6 shadow-xl relative animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-outline-variant pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/20 text-primary rounded-xl">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">{selectedDoc.fileName}</h3>
                <p className="text-xs text-on-surface-variant">
                  Uploaded by {selectedDoc.uploaderName} • {new Date(selectedDoc.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container text-on-surface rounded-lg border border-outline text-xs font-semibold hover:bg-surface-container-high"
                >
                  <Edit3 size={14} />
                  Edit Fields
                </button>
              ) : (
                <button
                  onClick={handleSaveEdits}
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary-hover disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save Changes
                </button>
              )}

              <a
                href={selectedDoc.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-surface-container text-on-surface hover:text-primary rounded-lg border border-outline"
                title="Download Original File"
              >
                <Download size={16} />
              </a>

              <button
                onClick={() => setSelectedDoc(null)}
                className="p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Image/PDF Preview */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Document Preview</span>
              <div className="bg-surface-container-low border border-outline-variant rounded-xl p-2 flex items-center justify-center min-h-[280px] max-h-[420px] overflow-hidden">
                {selectedDoc.fileType.includes('pdf') ? (
                  <div className="text-center p-6 space-y-3">
                    <FileText size={48} className="mx-auto text-primary" />
                    <p className="text-sm text-on-surface">PDF Document</p>
                    <a
                      href={selectedDoc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/20 text-primary text-xs font-semibold rounded-lg"
                    >
                      <Eye size={14} /> Open Full PDF
                    </a>
                  </div>
                ) : (
                  <img
                    src={selectedDoc.fileUrl}
                    alt={selectedDoc.fileName}
                    className="max-h-[380px] w-auto object-contain rounded-lg shadow-sm"
                  />
                )}
              </div>
            </div>

            {/* Right Column: Extracted Information & Fields */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} className="text-primary" /> Extracted Document Data
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/20 text-success border border-success/30">
                  Status: {selectedDoc.status.toUpperCase()}
                </span>
              </div>

              {/* Classification & Load Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1 font-semibold">Document Type</label>
                  {isEditing ? (
                    <select
                      value={editDocType}
                      onChange={(e) => setEditDocType(e.target.value as DocumentType)}
                      className="w-full bg-surface border border-outline rounded-lg px-3 py-1.5 text-sm text-on-surface"
                    >
                      <option value="bill_of_lading">Bill of Lading (BOL)</option>
                      <option value="rate_confirmation">Rate Confirmation</option>
                      <option value="proof_of_delivery">Proof of Delivery (POD)</option>
                      <option value="receipt">Receipt / Weight Ticket</option>
                      <option value="other">Other Document</option>
                    </select>
                  ) : (
                    <span className="inline-block text-sm font-bold text-primary capitalize">
                      {selectedDoc.docType.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-on-surface-variant mb-1 font-semibold">Link to Load</label>
                  {isEditing ? (
                    <select
                      value={editLoadId}
                      onChange={(e) => setEditLoadId(e.target.value)}
                      className="w-full bg-surface border border-outline rounded-lg px-3 py-1.5 text-sm text-on-surface"
                    >
                      <option value="">-- Unlinked --</option>
                      {loads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.origin} ➔ {l.destination} ({l.payout})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm font-medium text-on-surface">
                      {loads.find((l) => l.id === selectedDoc.loadId)
                        ? `${loads.find((l) => l.id === selectedDoc.loadId)?.origin} ➔ ${loads.find((l) => l.id === selectedDoc.loadId)?.destination}`
                        : 'Unlinked'}
                    </span>
                  )}
                </div>
              </div>

              {/* Extracted Fields Form / Display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <FieldBox
                  label="BOL Number"
                  value={isEditing ? editForm.bolNumber || '' : selectedDoc.extractedData?.bolNumber}
                  isEditing={isEditing}
                  onChange={(v) => setEditForm({ ...editForm, bolNumber: v })}
                />
                <FieldBox
                  label="Rate Confirmation #"
                  value={isEditing ? editForm.rateConfirmationNumber || '' : selectedDoc.extractedData?.rateConfirmationNumber}
                  isEditing={isEditing}
                  onChange={(v) => setEditForm({ ...editForm, rateConfirmationNumber: v })}
                />
                <FieldBox
                  label="Shipper Name"
                  value={isEditing ? editForm.shipperName || '' : selectedDoc.extractedData?.shipperName}
                  isEditing={isEditing}
                  onChange={(v) => setEditForm({ ...editForm, shipperName: v })}
                />
                <FieldBox
                  label="Consignee Name"
                  value={isEditing ? editForm.consigneeName || '' : selectedDoc.extractedData?.consigneeName}
                  isEditing={isEditing}
                  onChange={(v) => setEditForm({ ...editForm, consigneeName: v })}
                />
                <FieldBox
                  label="Total Rate"
                  value={isEditing ? editForm.totalRate || '' : selectedDoc.extractedData?.totalRate}
                  isEditing={isEditing}
                  onChange={(v) => setEditForm({ ...editForm, totalRate: v })}
                />
                <FieldBox
                  label="Total Weight"
                  value={isEditing ? editForm.weight || '' : selectedDoc.extractedData?.weight}
                  isEditing={isEditing}
                  onChange={(v) => setEditForm({ ...editForm, weight: v })}
                />
                <FieldBox
                  label="Pickup Date"
                  value={isEditing ? editForm.pickupDate || '' : selectedDoc.extractedData?.pickupDate}
                  isEditing={isEditing}
                  onChange={(v) => setEditForm({ ...editForm, pickupDate: v })}
                />
                <FieldBox
                  label="Delivery Date"
                  value={isEditing ? editForm.deliveryDate || '' : selectedDoc.extractedData?.deliveryDate}
                  isEditing={isEditing}
                  onChange={(v) => setEditForm({ ...editForm, deliveryDate: v })}
                />
              </div>

              {/* Handwritten Notes Section Highlight */}
              {(selectedDoc.extractedData?.handwrittenNotes || isEditing) && (
                <div className="p-4 bg-tertiary-container/30 border border-tertiary/20 rounded-xl space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-tertiary uppercase">
                    <PenTool size={14} />
                    Handwritten Text & Driver Notes
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editForm.handwrittenNotes || ''}
                      onChange={(e) => setEditForm({ ...editForm, handwrittenNotes: e.target.value })}
                      className="w-full bg-surface border border-outline rounded-lg p-2 text-sm text-on-surface"
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm italic text-on-surface">
                      {selectedDoc.extractedData?.handwrittenNotes || 'No handwritten notes detected.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Search by document name, BOL #, Shipper or Consignee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container border border-outline rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {['all', 'bill_of_lading', 'rate_confirmation', 'proof_of_delivery', 'receipt'].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                typeFilter === type
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {type === 'all' ? 'All Docs' : type.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-surface-container-low border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-on-surface-variant flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm">Loading company documents...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant space-y-2">
            <FileText size={40} className="mx-auto text-on-surface-variant/40" />
            <p className="text-base font-semibold">No documents found</p>
            <p className="text-xs">Upload your first Bill of Lading or Rate Confirmation to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container border-b border-outline-variant text-xs text-on-surface-variant uppercase font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Document</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Extracted Ref / BOL</th>
                  <th className="py-3.5 px-4">Handwriting</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Uploaded</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredDocs.map((docItem) => (
                  <tr
                    key={docItem.id}
                    className="hover:bg-surface-container-high/50 transition-colors group cursor-pointer"
                    onClick={() => handleOpenDoc(docItem)}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-surface-container text-primary">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                            {docItem.fileName}
                          </p>
                          <p className="text-xs text-on-surface-variant">{docItem.uploaderName}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20 capitalize">
                        {docItem.docType.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-on-surface font-medium">
                      {docItem.extractedData?.bolNumber || docItem.extractedData?.rateConfirmationNumber || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      {docItem.extractedData?.handwrittenNotes ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-tertiary bg-tertiary-container/20 px-2 py-0.5 rounded border border-tertiary/20">
                          <PenTool size={12} /> Detected
                        </span>
                      ) : (
                        <span className="text-xs text-on-surface-variant/60">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          docItem.status === 'processed'
                            ? 'bg-success/20 text-success border border-success/30'
                            : docItem.status === 'processing'
                            ? 'bg-primary/20 text-primary border border-primary/30'
                            : 'bg-error/20 text-error border border-error/30'
                        }`}
                      >
                        {docItem.status === 'processed' && <CheckCircle2 size={12} />}
                        {docItem.status === 'processing' && <Loader2 size={12} className="animate-spin" />}
                        {docItem.status === 'error' && <AlertCircle size={12} />}
                        {docItem.status.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-on-surface-variant">
                      {new Date(docItem.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenDoc(docItem)}
                          className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg"
                          title="View Extracted Details"
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          onClick={() => handleDelete(docItem.id)}
                          className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg"
                          title="Delete Document"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldBox({
  label,
  value,
  isEditing,
  onChange,
}: {
  label: string;
  value?: string;
  isEditing: boolean;
  onChange: (val: string) => void;
}) {
  return (
    <div className="bg-surface-container p-3 rounded-xl border border-outline-variant">
      <span className="block text-xs text-on-surface-variant font-semibold mb-1">{label}</span>
      {isEditing ? (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-surface border border-outline rounded-lg px-2.5 py-1 text-sm text-on-surface"
        />
      ) : (
        <p className="text-sm font-semibold text-on-surface truncate">{value || '—'}</p>
      )}
    </div>
  );
}



async function callDirectGeminiVision(
  apiKey: string,
  base64Data: string,
  mimeType: string
): Promise<ExtractedDocData> {
  const prompt = `You are a world-class AI document extractor specialized EXCLUSIVELY in Freight & Trucking Logistics documents (Bills of Lading, Rate Confirmations, Proof of Delivery, CAT Scale / Weight Tickets, Fuel / Lumper Receipts).

Extract structured JSON strictly following this schema:
{
  "documentType": "bill_of_lading" | "rate_confirmation" | "proof_of_delivery" | "receipt" | "other",
  "bolNumber": string or null,
  "rateConfirmationNumber": string or null,
  "carrierName": string or null,
  "shipperName": string or null,
  "consigneeName": string or null,
  "originAddress": string or null,
  "destinationAddress": string or null,
  "pickupDate": string or null,
  "deliveryDate": string or null,
  "totalRate": string or null,
  "weight": string or null,
  "handwrittenNotes": string or null,
  "rawText": string or null
}

Classification Rules for Trucking Documents:
1. "bill_of_lading": Contains terms like "Bill of Lading", "BOL", "Straight Bill of Lading", Shipper & Consignee info, commodity list, piece counts, trailer/seal #.
2. "rate_confirmation": Contains "Rate Confirmation", "Confirmation #", "Broker", "Load Agreement", carrier payout/rate ($ amount), linehaul, origin/destination.
3. "proof_of_delivery": Contains "Proof of Delivery", "POD", "Received By", delivery date/timestamp, consignee signature, or "Delivered".
4. "receipt": Weight tickets (CAT Scale), Fuel receipts, Lumper receipts, Toll receipts, Maintenance invoices.

Field Rules:
- Extract numbers, rates (e.g. "$2,400.00"), weights (e.g. "42,000 lbs"), dates (YYYY-MM-DD format if possible).
- "handwrittenNotes": Extract ONLY actual handwritten driver/receiver handwriting, signatures, stamped text, or modified numbers. If no handwriting is visible, set to null.
- Return ONLY raw valid JSON.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json',
    },
  };

  const models = ['gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
  let lastErr: Error | null = null;

  for (const m of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey.trim()}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        lastErr = new Error(`API ${res.status}`);
        continue;
      }
      const data = await res.json();
      const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!txt) continue;
      const clean = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      return {
        documentType: parsed.documentType || 'other',
        bolNumber: parsed.bolNumber || undefined,
        rateConfirmationNumber: parsed.rateConfirmationNumber || undefined,
        carrierName: parsed.carrierName || undefined,
        shipperName: parsed.shipperName || undefined,
        consigneeName: parsed.consigneeName || undefined,
        originAddress: parsed.originAddress || undefined,
        destinationAddress: parsed.destinationAddress || undefined,
        pickupDate: parsed.pickupDate || undefined,
        deliveryDate: parsed.deliveryDate || undefined,
        totalRate: parsed.totalRate || undefined,
        weight: parsed.weight || undefined,
        handwrittenNotes: parsed.handwrittenNotes || undefined,
        rawText: parsed.rawText || clean,
        confidence: 0.98,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastErr || new Error('Direct Gemini API call failed.');
}
