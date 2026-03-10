import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const MAX_DRAFTS  = 10;
const DRAFT_TTL   = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'wholesaleDrafts';

export const useDraftManager = () => {
  const [savedDrafts,    setSavedDrafts]    = useState([]);
  const [currentDraftId, setCurrentDraftId] = useState(null);

  useEffect(() => { _load(); }, []);

  const _persist = (drafts) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    setSavedDrafts(drafts);
  };

  const _load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return setSavedDrafts([]);
      const parsed = JSON.parse(raw);
      const valid  = parsed.filter(d => Date.now() - d.timestamp < DRAFT_TTL);
      if (valid.length !== parsed.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
      setSavedDrafts(valid);
    } catch { setSavedDrafts([]); }
  };

  const saveDraft = (formData, orderItems, gstEnabled) => {
    const empty = !formData.buyerContact && orderItems.length === 1 && !orderItems[0].design;
    if (empty) return;

    const name  = formData.businessName || formData.buyerName || 'Unnamed Draft';
    const draft = {
      id: currentDraftId || Date.now(),
      name, formData, orderItems, gstEnabled,
      timestamp: Date.now()
    };

    let drafts = [...savedDrafts];
    const idx  = drafts.findIndex(d => d.id === draft.id);

    if (idx >= 0) {
      drafts[idx] = draft;
    } else {
      if (drafts.length >= MAX_DRAFTS) {
        drafts.sort((a, b) => a.timestamp - b.timestamp);
        drafts.shift();
      }
      drafts.push(draft);
    }

    _persist(drafts);
    setCurrentDraftId(draft.id);
  };

  const loadDraft = (draft, callbacks) => {
    callbacks.setFormData(draft.formData);
    callbacks.setOrderItems(draft.orderItems);
    callbacks.setGstEnabled?.(draft.gstEnabled);
    setCurrentDraftId(draft.id);
    toast.success(`Draft "${draft.name}" loaded!`);
  };

  const deleteDraft = (draftId) => {
    if (!window.confirm('Delete this draft?')) return;
    _persist(savedDrafts.filter(d => d.id !== draftId));
    toast.success('Draft deleted!');
  };

  const deleteCurrentDraft = () => {
    if (!currentDraftId) return;
    _persist(savedDrafts.filter(d => d.id !== currentDraftId));
    setCurrentDraftId(null);
  };

  const clearAllDrafts = () => {
    if (!window.confirm('Delete ALL drafts?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setSavedDrafts([]);
    toast.success('All drafts cleared!');
  };

  return {
    savedDrafts, currentDraftId,
    saveDraft, loadDraft,
    deleteDraft, deleteCurrentDraft, clearAllDrafts,
  };
};
