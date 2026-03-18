'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
// import ScriptManager from "../dashboard/ScriptManager";

function StatCard({ title, value }) {
  return (
    <div className="card">
      <h3>{value}</h3>
      <p>{title}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const k = (status || '').toLowerCase();
  return <span className={`badge ${k}`}>{status}</span>;
}

function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const updateValue = () => {
    onChange(editorRef.current?.innerHTML || '');
  };

  const runCommand = (command, val = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, val);
    updateValue();
  };

  const onPaste = (e) => {
    const html = e.clipboardData?.getData('text/html');
    if (html) {
      e.preventDefault();
      runCommand('insertHTML', html);
      return;
    }

    const text = e.clipboardData?.getData('text/plain');
    if (text) {
      e.preventDefault();
      const normalized = String(text).replace(/\r\n/g, "\n");
      const escaped = normalized
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      // Preserve line breaks and spacing when clipboard has only plain text.
      const wrapped = `<div style="white-space:pre-wrap;font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">${escaped}</div>`;
      runCommand("insertHTML", wrapped);
    }
  };

  return (
    <div className="wysiwyg-wrap">
      <div className="wysiwyg-toolbar row">
        <select className="select wysiwyg-select" defaultValue="" onChange={(e) => runCommand('fontName', e.target.value)}>
          <option value="" disabled>Font</option>
          <option value="Arial">Arial</option>
          <option value="'Times New Roman'">Times New Roman</option>
          <option value="Calibri">Calibri</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
        </select>
        <select className="select wysiwyg-select" defaultValue="" onChange={(e) => runCommand('fontSize', e.target.value)}>
          <option value="" disabled>Size</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Medium</option>
          <option value="5">Large</option>
          <option value="6">XL</option>
        </select>
        <button type="button" className="button secondary" onClick={() => runCommand('bold')}>B</button>
        <button type="button" className="button secondary" onClick={() => runCommand('italic')}><i>I</i></button>
        <button type="button" className="button secondary" onClick={() => runCommand('underline')}><u>U</u></button>
        <button type="button" className="button secondary" onClick={() => runCommand('insertUnorderedList')}>List</button>
        <button type="button" className="button secondary" onClick={() => runCommand('justifyLeft')}>Left</button>
        <button type="button" className="button secondary" onClick={() => runCommand('justifyCenter')}>Center</button>
        <button type="button" className="button secondary" onClick={() => runCommand('justifyRight')}>Right</button>
        <button type="button" className="button secondary" onClick={() => runCommand('removeFormat')}>Clear Format</button>
      </div>
      <div
        ref={editorRef}
        className="wysiwyg-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || 'Compose your draft here...'}
        onInput={updateValue}
        onBlur={updateValue}
        onPaste={onPaste}
      />
    </div>
  );
}
const PROJECT_PRESET_SENDERS = {
  tec: [
    'sam@theentrepreneurialchronicle.com',
    'clara@theentrepreneurialchronicle.com',
    'sophia@theentrepreneurialchronicle.com',
    'jess@theentrepreneurialchronicle.com',
    'diana@theentrepreneurialchronicle.com',
    'victoria@theentrepreneurialchronicle.com',
    'alina@theentrepreneurialchronicle.com',
    'amelia@theentrepreneurialchronicle.com',
    'grace@theentrepreneurialchronicle.com',
    'eliana@theentrepreneurialchronicle.com',
    'liam@theentrepreneurialchronicle.com',
    'emma@theentrepreneurialchronicle.com',
    'fiona@theentrepreneurialchronicle.com',
    'daniel@theentrepreneurialchronicle.com',
    'lacy@theentrepreneurialchronicle.com'
  ],
  tut: [
    'matt@theunicorntimes.com',
    'jordan@theunicorntimes.com',
    'jessica@theunicorntimes.com',
    'ethan@theunicorntimes.com',
    'lily@theunicorntimes.com',
    'jasmin@theunicorntimes.com',
    'kevin@theunicorntimes.com',
    'peter@theunicorntimes.com',
    'tyler@theunicorntimes.com',
    'olivia@theunicorntimes.com'
  ]
};

const normalizeEmail = (value = '') => String(value || '').toLowerCase();

const filterAccountsByProject = (list = [], projectKey = '') => {
  const project = String(projectKey || '').toLowerCase();
  const allowedList = PROJECT_PRESET_SENDERS[project] || [];
  const hasAllowed = allowedList.length > 0;
  const allowedSet = new Set(allowedList.map((email) => email.toLowerCase()));
  return list.filter((account) => {
    const fromEmail = normalizeEmail(account?.from);
    if (hasAllowed && allowedSet.has(fromEmail)) {
      return true;
    }
    if (!hasAllowed) {
      return true;
    }
    const projectHint = String(account?.project || '').toLowerCase();
    return projectHint === project;
  });
};

const DRAFT_CATEGORIES = [
  { label: "Cover Story", value: "cover_story" },
  { label: "Reminder", value: "reminder" },
  { label: "Follow Up", value: "follow_up" },
  { label: "Updated Cost", value: "updated_cost" },
  { label: "Final Cost", value: "final_cost" }
];


export default function DashboardPage() {
  const [stats, setStats] = useState({ totalUploaded: 0, sent: 0, pending: 0, failed: 0 });
  const [lists, setLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [preview, setPreview] = useState([]);
  const [previewColumns, setPreviewColumns] = useState([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [campaignName, setCampaignName] = useState('New Campaign');
  const [delaySeconds, setDelaySeconds] = useState(5);
  const [batchSize, setBatchSize] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [project, setProject] = useState('tec');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [activeAccount, setActiveAccount] = useState('');
  const projectAccounts = useMemo(() => filterAccountsByProject(accounts, project), [accounts, project]);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [selectedDraft, setSelectedDraft] = useState('cover_story');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');

  const [showAddDraft, setShowAddDraft] = useState(false);
  const [newDraftCategory, setNewDraftCategory] = useState("cover_story");
  const [newDraftSubject, setNewDraftSubject] = useState("");
  const [newDraftBody, setNewDraftBody] = useState("");

  const loadScript = (script) => {
    setDraftSubject(script.subject);
    setDraftBody(script.body);
  };

  const [savedDrafts, setSavedDrafts] = useState([]);
  const [activeSavedDraftId, setActiveSavedDraftId] = useState(null);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [newDraftTitle, setNewDraftTitle] = useState("");
  const [selectedCampaignIds, setSelectedCampaignIds] = useState([]);
  const handleSavedDraftSelect = (draft) => {
    const id = draft._id || draft.id;
    setActiveSavedDraftId(id);
    loadScript(draft);
  };


const startEditingDraft = (draft) => {
  setEditingDraftId(draft._id || draft.id);
  setNewDraftTitle(draft.title);
  setNewDraftCategory(draft.category);
  setNewDraftSubject(draft.subject);
  setNewDraftBody(draft.body);
  setShowAddDraft(true);
};

const handleDeleteDraft = async (draft) => {
  const id = draft._id || draft.id;
  if (!id) return;
  if (!window.confirm('Delete this draft?')) return;
  try {
    await safeFetchJson(`/api/drafts/${id}`, { method: 'DELETE' });
    if (activeSavedDraftId === id) {
      setActiveSavedDraftId(null);
      setDraftSubject('');
      setDraftBody('');
    }
    loadSavedDrafts();
  } catch (err) {
    alert(err.message || 'Failed to delete draft');
  }
};

  const loadSavedDrafts = async () => {
    try {
      const data = await safeFetchJson('/api/drafts');
      setSavedDrafts(data.drafts || data || []);
    } catch (err) {
      console.error('Failed to load drafts', err);
    }
  };


  const toggleCampaignSelection = (campaignId) => {
    setSelectedCampaignIds((prev) => {
      if (prev.includes(campaignId)) {
        return prev.filter((id) => id !== campaignId);
      }
      return [...prev, campaignId];
    });
  };

  const toggleSelectAllCampaigns = () => {
    if (allCampaignsSelected) {
      setSelectedCampaignIds([]);
      return;
    }
    setSelectedCampaignIds(allCampaignIds);
  };

  const deleteSelectedCampaigns = async () => {
    if (!selectedCampaignIds.length) return;
    if (!window.confirm('Delete selected campaigns? This cannot be undone.')) return;
    try {
      await Promise.all(
        selectedCampaignIds.map((id) =>
          safeFetchJson(`/api/campaigns/${id}`, { method: 'DELETE' })
        )
      );
      setSelectedCampaignIds([]);
      await loadAll();
    } catch (err) {
      alert(err.message || 'Failed to delete selected campaigns');
    }
  };

  const addNewDraft = async () => {
    if (!newDraftSubject || !newDraftBody) {
      alert("Please enter subject and body");
      return;
    }

    try {
      const count = savedDrafts.filter((d) => d.category === newDraftCategory).length;
      const baseTitle = newDraftTitle
        ? newDraftTitle
        : `${DRAFT_CATEGORIES.find((c) => c.value === newDraftCategory)?.label || newDraftCategory} Draft ${count + 1}`;
      const payload = {
        category: newDraftCategory,
        title: baseTitle,
        subject: newDraftSubject,
        body: newDraftBody
      };
      const isEditing = Boolean(editingDraftId);
      const url = isEditing ? `/api/drafts/${editingDraftId}` : '/api/drafts';
      const method = isEditing ? 'PATCH' : 'POST';
      const result = await safeFetchJson(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setNewDraftSubject("");
      setNewDraftBody("");
      setNewDraftTitle("");
      setShowAddDraft(false);
      setEditingDraftId(null);
      alert("Draft Script Added");
      const saved = result.draft;
      if (isEditing && saved) {
        setSavedDrafts((prev) => prev.map((d) => (d._id === saved._id ? saved : d)));
      } else if (saved) {
        setSavedDrafts((prev) => [...prev, saved]);
      }
      await loadSavedDrafts();
    } catch (err) {
      alert(err.message || 'Failed to save draft');
    }
  };
  const activeCampaign = useMemo(() => campaigns.find((c) => c.status === 'Running' || c.status === 'Paused'), [campaigns]);
  const progressText = activeCampaign ? `${activeCampaign.stats?.sent || 0}/${activeCampaign.stats?.total || 0} emails sent` : '0/0 emails sent';
  const selectedAcc = useMemo(() => projectAccounts.find((a) => a.id === selectedAccount) || null, [projectAccounts, selectedAccount]);
  const allCampaignIds = useMemo(() => campaigns.map((c) => c._id), [campaigns]);
  const allCampaignsSelected = allCampaignIds.length > 0 && allCampaignIds.every((id) => selectedCampaignIds.includes(id));

  useEffect(() => {
    if (!projectAccounts.length) {
      setSelectedAccount('');
      setActiveAccount('');
      return;
    }
    const match = projectAccounts.find((a) => a.id === selectedAccount);
    if (match) {
      setActiveAccount(match.from || '');
      return;
    }
    const next = projectAccounts[0];
    setSelectedAccount(next.id);
    setActiveAccount(next.from || '');
  }, [projectAccounts, selectedAccount]);

  const draftTemplates = {
    cover_story: {
      label: "Cover Story",
      subject: "Cover Story: {{Name}} Shortlisted for The Most Eminent Robotics Leaders Driving Intelligent Automation - 2026",
      body: `<div style="font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">Dear {{Name}},</p>
  <p style="margin:0 0 12px;">I hope you are doing well.</p>
  <p style="margin:0 0 12px;">I am writing to inform you that our editorial team at The Entrepreneurial Chronicles Magazine has shortlisted you for inclusion in one of our upcoming 2026 leadership editions, "The Most Eminent Robotics Leaders Driving Intelligent Automation - 2026", recognizing professionals who are driving innovation, growth, and meaningful impact within their respective industries.</p>
  <p style="margin:0 0 12px;">This edition highlights distinguished leaders who are advancing the industry through strategic vision, operational excellence, and forward-thinking leadership. Based on our editorial review, we believe your professional journey and contributions align strongly with the purpose of this feature.</p>
  <p style="margin:0 0 8px;"><strong>Cover Story Feature - Key Inclusions:</strong></p>
  <ul style="margin:0 0 12px;padding-left:18px;">
    <li>A dedicated 12+ page editorial profile in the print and digital magazine, covering your leadership journey, achievements, and future vision</li>
    <li>Your professional image featured on the cover of the edition</li>
    <li>A high-resolution, print-ready PDF version of your profile with reprint rights</li>
    <li>Official recognition logo for use on your website, media, and professional communications</li>
    <li>A digital certificate and commemorative recognition trophy</li>
    <li>10 to 20 complimentary hard copies</li>
    <li>Two full-page advertisements for your organization, usable within 12 months</li>
    <li>Two full-page CXO profile features</li>
    <li>Video feature promotion across our digital and social media platforms</li>
    <li>Additional visibility through our website, including announcements and press releases</li>
    <li>A direct backlink to your company website</li>
    <li>One full back-page advertisement in an upcoming edition</li>
  </ul>
  <p style="margin:0 0 8px;"><strong>Sponsorship and Production Cost:</strong></p>
  <p style="margin:0 0 12px;">The total investment for this complete editorial and branding package is USD 1,600, which covers editorial development, design, publication, and promotional activities associated with your feature.</p>
  <p style="margin:0 0 12px;">If this aligns with your current branding and visibility objectives, I would be happy to share the formal proposal and next steps for your review.</p>
  <p style="margin:0 0 12px;">Please feel free to reply with your interest or suggest a convenient time if you would like to discuss this further.</p>
  <p style="margin:0 0 12px;">To connect with us, please provide your convenient time here.</p>
  <p style="margin:0;">Warm regards,<br/>Victoria Langley | Marketing Coordinator<br/>The Entrepreneurial Chronicle</p>
</div>`,
    },
    reminder: {
      label: "Reminder",
      subject: "Reminder: Feature Opportunity in The Visionary Leader Shaping the Future of Industry - 2026",
      body: `<div style="font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">Hello {{Name}},</p>
  <p style="margin:0 0 12px;">This is a gentle reminder about the exclusive feature opportunity we shared with you recently.</p>
  <p style="margin:0 0 12px;">Our upcoming Special Edition, "The Visionary Leader Shaping the Future of Industry - 2026," aims to spotlight leaders transforming the healthcare industry, and we believe your story would be a strong fit.</p>
  <p style="margin:0 0 12px;">The package includes a multi-page profile, cover feature, digital promotions, and year-long branding support.</p>
  <p style="margin:0 0 12px;">Please let us know if you're interested or would like to confirm your participation so we can proceed with the next steps.</p>
  <p style="margin:0;">Best regards,<br/>Victoria Langley</p>
</div>`,
    },
    follow_up: {
      label: "Follow Up",
      subject: "Follow-Up on Cover Story Proposal - The Most Eminent Robotics Leaders Driving Intelligent Automation - 2026",
      body: `<div style="font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">Dear {{Name}},</p>
  <p style="margin:0 0 12px;">I hope you're doing well.</p>
  <p style="margin:0 0 12px;">I wanted to kindly follow up on the proposal I shared regarding our upcoming special edition, "The Most Eminent Robotics Leaders Driving Intelligent Automation - 2026." We believe your leadership journey would be an excellent fit for this feature, and the cover story package offers a strong platform to showcase your success and inspire a global audience.</p>
  <p style="margin:0 0 12px;">May I ask if you've had a chance to review the details? I'd be happy to discuss the next steps at a time that works best for you.</p>
  <p style="margin:0 0 12px;">Looking forward to your thoughts.</p>
  <p style="margin:0;">Warm Regards,<br/>Victoria Langley</p>
</div>`,
    },
    updated_cost: {
      label: "Updated Cost",
      subject: "Updated Sponsorship Details - The Most Eminent Robotics Leaders Driving Intelligent Automation - 2026",
      body: `<div style="font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">Hello {{Name}},</p>
  <p style="margin:0 0 12px;">I hope everything is going great on your end.</p>
  <p style="margin:0 0 12px;">I'm reaching out regarding our proposal to feature you in our upcoming special edition, "The Most Eminent Robotics Leaders Driving Intelligent Automation - 2026." Your remarkable contributions to the industry make you an excellent fit, and we'd be delighted to showcase your journey to our 295,000+ C-Suite subscribers and 370,000 readers worldwide.</p>
  <p style="margin:0 0 12px;">As the Halloween offer has now ended, the updated sponsorship cost for your feature is $1,000 USD (revised from the original $1,600 USD). This still includes all the benefits outlined in the original proposal from your cover story feature and editorial write-up to digital promotions, advertisements, and recognition awards.</p>
  <p style="margin:0 0 12px;">We'd love to confirm your participation and reserve your spot in this upcoming edition. Please let me know your thoughts, and I'll share the updated Media Partnership Contract for your review and signature.</p>
  <p style="margin:0 0 12px;">Looking forward to your positive response and confirmation.</p>
  <p style="margin:0;">Warm regards,<br/>Victoria Langley</p>
</div>`,
    },
    final_cost: {
      label: "Final Call",
      subject: "Final Call: Special Rate for The Most Eminent Robotics Leaders Driving Intelligent Automation - 2026",
      body: `<div style="font-family:'Times New Roman', Times, serif;font-size:15px;line-height:1.6;">
  <p style="margin:0 0 12px;">Dear {{Name}},</p>
  <p style="margin:0 0 12px;">I wanted to reach out one last time regarding your feature in "The Most Eminent Robotics Leaders Driving Intelligent Automation - 2026."</p>
  <p style="margin:0 0 12px;">To make this opportunity even more exciting, we are offering a final special rate of $700 USD for the full premium package, which includes your cover story, multi-page profile, digital promotions, social media features, advertisements, recognition awards, and a back-link to your website.</p>
  <p style="margin:0 0 12px;">This is a limited-time offer, and we would love to confirm your participation to secure your spot in this edition. Don't miss the chance to showcase your leadership to our 295,000+ C-Suite subscribers and 370,000 readers worldwide.</p>
  <p style="margin:0 0 12px;">Please confirm at your earliest convenience so we can proceed with the next steps.</p>
  <p style="margin:0;">Warm regards,<br/>Victoria Langley</p>
</div>`,
    }
  };


  useEffect(() => {
    const tpl = draftTemplates[selectedDraft];
    if (tpl) {
      setDraftSubject(tpl.subject || "");
      setDraftBody(tpl.body || "");
    }
  }, [selectedDraft]);

  const safeFetchJson = async (url, options) => {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        data = {};
      }
    }

    if (!res.ok) {
      throw new Error(data.error || `Request failed: ${url}`);
    }

    return data;
  };

  const loadAll = async () => {
    try {
      const [st, tpl, cps, accRes] = await Promise.all([
        safeFetchJson('/api/stats'),
        safeFetchJson('/api/templates'),
        safeFetchJson('/api/campaigns'),
        safeFetchJson(`/api/accounts?project=${encodeURIComponent(project)}`)
      ]);

      setError('');
      setStats(st);
      setLists(st.lists || []);
      setTemplates(tpl.templates || []);
      setCampaigns(cps.campaigns || []);
      setSelectedCampaignIds((prev) => 
        (cps.campaigns || []).map((c) => c._id).filter((id) => prev.includes(id))
      );
      setAccounts(accRes.accounts || []);

      const accList = accRes.accounts || [];
      if (selectedAccount && !accList.find((a) => a.id === selectedAccount)) {
        setSelectedAccount(accList[0]?.id || "");
        setActiveAccount(accList[0]?.from || "");
      }

      if (!selectedListId && st.lists?.[0]?._id) {
        setSelectedListId(st.lists[0]._id);
      }
      if (!selectedTemplateId && tpl.templates?.[0]?._id) {
        setSelectedTemplateId(tpl.templates[0]._id);
      }
      if (!selectedAccount && accRes.accounts?.[0]?.id) {
        setSelectedAccount(accRes.accounts[0].id);
        setActiveAccount(accRes.accounts[0].from || '');
      }
    } catch (e) {
      setError(e.message || 'Failed to load dashboard data');
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadSavedDrafts();
  }, []);

  useEffect(() => {
    loadAll();
  }, [project]);


  useEffect(() => {
    const id = setInterval(loadAll, 5000);
    return () => clearInterval(id);
  }, [selectedListId, selectedTemplateId, project]);

  useEffect(() => {
    const loadListPreview = async () => {
      if (!selectedListId) {
        setPreview([]);
        setPreviewColumns([]);
        return;
      }

      try {
        const data = await safeFetchJson(`/api/lists/${selectedListId}`);
        const leads = data.leads || [];
        const columns = data.columns?.length
          ? data.columns
          : Array.from(
              new Set(
                leads.flatMap((lead) => Object.keys(lead?.data || {})).filter(Boolean)
              )
            );
        setPreviewColumns(columns);
        setPreview(leads.slice(0, 20).map((lead) => lead.data || {}));
      } catch (e) {
        console.error('Failed to load list preview', e);
      }
    };

    loadListPreview();
  }, [selectedListId]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const form = new FormData();
    form.append('file', file);

    try {
      const data = await safeFetchJson('/api/uploads', { method: 'POST', body: form });
      setLoading(false);
      setPreviewColumns(data.previewColumns || []);
      setPreview(data.previewRows || []);
      setSelectedListId(data.listId);
      await loadAll();
    } catch (e) {
      setLoading(false);
      alert(e.message || 'Upload failed');
    }
  };

  const createCampaign = async () => {
    try {
      await safeFetchJson('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          listId: selectedListId,
          templateId: null,
          draftType: selectedDraft,
          inlineTemplate: { subject: draftSubject, body: draftBody },
          senderAccountId: selectedAccount || null,
          options: { batchSize: Number(batchSize), delaySeconds: Number(delaySeconds) }
        })
      });
      await loadAll();
    } catch (e) {
      alert(e.message || 'Failed to create campaign');
    }
  };

  const startGraphOAuth = (expectedEmail = "") => {
    const returnTo = window.location.pathname + window.location.search;
    let u = "/api/graph-oauth/start?returnTo=" + encodeURIComponent(returnTo);
    if (expectedEmail) u += "&expectedEmail=" + encodeURIComponent(expectedEmail) + "&loginHint=" + encodeURIComponent(expectedEmail);
    window.location.href = u;
  };

  const connectSelectedAccount = async () => {
    const acc = accounts.find((a) => a.id === selectedAccount);
    if (!acc) return alert('Select sender account');
    if (acc.provider === "graph_oauth" && String(acc.status || "").toLowerCase() !== "connected") {
      startGraphOAuth(acc.from || "");
      return;
    }
    try {
      await safeFetchJson('/api/accounts/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: acc.id })
      });
      setActiveAccount(acc.from || '');
      alert('Account connected');
    } catch (e) {
      alert(e.message || 'Account connection failed');
    }
  };


  const sendTestEmail = async () => {
  const acc = accounts.find((a) => a.id === selectedAccount);
  if (!acc) return alert('Select sender account');
  if (!testEmailTo) return alert('Enter test recipient email');
  try {
    await safeFetchJson('/api/send-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: acc.id,
        to: testEmailTo,
        subject: draftSubject,
        body: draftBody
      })
    });
    alert('Test email sent');
  } catch (e) {
    alert(e.message || 'Test email failed');
  }
};

const normalizeSelectedListEmails = async () => {
    if (!selectedListId) {
      alert('Select a list first');
      return;
    }
    try {
      const data = await safeFetchJson(`/api/lists/${selectedListId}/normalize-emails`, { method: 'POST' });
      alert(`Email normalization complete. Updated rows: ${data.changed || 0}`);
      await loadAll();
    } catch (e) {
      alert(e.message || 'Failed to normalize emails');
    }
  };

  const startCampaign = async (campaignId) => {
    try {
      const data = await safeFetchJson(`/api/campaigns/${campaignId}/start`, { method: 'POST' });
      if (data.started === false && data.message) {
        alert(data.message);
      }
      await loadAll();
    } catch (e) {
      alert(e.message || 'Failed to start campaign');
    }
  };

  const pauseCampaign = async (campaignId) => {
    try {
      await safeFetchJson(`/api/campaigns/${campaignId}/pause`, { method: 'POST' });
      await loadAll();
    } catch (e) {
      alert(e.message || 'Failed to pause campaign');
    }
  };

  const resumeCampaign = async (campaignId) => {
    try {
      await safeFetchJson(`/api/campaigns/${campaignId}/resume`, { method: 'POST' });
      await loadAll();
    } catch (e) {
      alert(e.message || 'Failed to resume campaign');
    }
  };

  const stopCampaign = async (campaignId) => {
    try {
      await safeFetchJson(`/api/campaigns/${campaignId}/stop`, { method: 'POST' });
      await loadAll();
    } catch (e) {
      alert(e.message || 'Failed to stop campaign');
    }
  };

  const clearCampaignLogs = async (campaignId) => {
    try {
      await safeFetchJson(`/api/campaigns/${campaignId}/clear-logs`, { method: 'POST' });
      await loadAll();
    } catch (e) {
      alert(e.message || 'Failed to clear campaign logs');
    }
  };

  const deleteCampaign = async (campaignId) => {
    if (!window.confirm('Delete this campaign? This cannot be undone.')) {
      return;
    }

    try {
      await safeFetchJson(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      await loadAll();
    } catch (e) {
      alert(e.message || 'Failed to delete campaign');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <main className="container grid">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>Email Automation Dashboard</h1>
          <p>Upload leads, run campaigns, track delivery in real-time.</p>
        </div>
        <button className="button secondary" onClick={logout}>Logout</button>
      </div>
      {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}

      <section className="grid stats-grid">
        <StatCard title="Total Emails Uploaded" value={stats.totalUploaded} />
        <StatCard title="Sent" value={stats.sent} />
        <StatCard title="Pending" value={stats.pending} />
        <StatCard title="Failed" value={stats.failed} />
      </section>

      <section className="card grid">
        <h3>Select Sender Email</h3>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <select
            className="select"
            style={{ maxWidth: 160 }}
            value={project}
            onChange={(e) => {
              setProject(e.target.value);
              setSelectedAccount("");
              setActiveAccount("");
            }}
          >
            <option value="tec">TEC</option>
            <option value="tut">TUT</option>
          </select>
          <select
            className="select"
            style={{ maxWidth: 420 }}
            value={selectedAccount}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__oauth_add__") {
                startGraphOAuth();
                return;
              }
              setSelectedAccount(v);
              const acc = accounts.find((a) => a.id === v);
              setActiveAccount(acc?.from || "");
            }}
          >
            <option value="">Select Account</option>
            {projectAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.from}
              </option>
            ))}
            <option value="__oauth_add__">Connect New Account</option>
          </select>
          <button className="button secondary" type="button" onClick={startGraphOAuth}>Login / Connect Outlook Account</button>
          <button className="button secondary" type="button" onClick={connectSelectedAccount}>Use Selected Sender</button>
          <span className="badge sent">Active Sender: {activeAccount || "none"}</span>
        </div>
        {selectedAcc ? (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <p style={{ margin: 0 }}>{selectedAcc.label} - {selectedAcc.from}</p>
            <p style={{ margin: 0 }}>Status: Connected / Active</p>
          </div>
        ) : null}
      </section>

              <section className="card grid">
        <h3>Select Email Draft</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
          <select
            className="select"
            style={{ maxWidth: 320 }}
            value={selectedDraft}
            onChange={(e) => setSelectedDraft(e.target.value)}
          >
            <option value="cover_story">Cover Story</option>
            <option value="reminder">Reminder</option>
            <option value="follow_up">Follow Up</option>
            <option value="updated_cost">Updated Cost</option>
            <option value="final_cost">Final Call</option>
          </select>
          <button
            className="button"
            type="button"
            onClick={() => setShowAddDraft((prev) => !prev)}
          >
            + Add Draft Script
          </button>
        </div>
        {showAddDraft && (
          <div className="card" style={{ marginTop: 10 }}>
            <h4>{editingDraftId ? 'Edit Draft Script' : 'Create Draft Script'}</h4>
            <select
              className="select"
              value={newDraftCategory}
              onChange={(e) => setNewDraftCategory(e.target.value)}
            >
              <option value="cover_story">Cover Story</option>
              <option value="reminder">Reminder</option>
              <option value="follow_up">Follow Up</option>
              <option value="updated_cost">Updated Cost</option>
              <option value="final_cost">Final Cost</option>
            </select>
            <p style={{ marginTop: 12, marginBottom: 6 }}>Script Title (optional)</p>
            <input
              className="input"
              value={newDraftTitle}
              onChange={(e) => setNewDraftTitle(e.target.value)}
              placeholder="Script 1, Script 2, etc."
            />
            <p style={{ marginTop: 12, marginBottom: 6 }}>Subject</p>
            <input
              className="input"
              value={newDraftSubject}
              onChange={(e) => setNewDraftSubject(e.target.value)}
              placeholder="Enter Subject"
            />
            <p style={{ marginTop: 12, marginBottom: 6 }}>Draft Body</p>
            <RichTextEditor
              value={newDraftBody}
              onChange={setNewDraftBody}
            />
            <div className="row" style={{ gap: 8, marginTop: 12 }}>
              <button className="button" type="button" onClick={addNewDraft}>
                {editingDraftId ? 'Update Draft' : 'Submit Draft'}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setShowAddDraft(false);
                  setEditingDraftId(null);
                  setNewDraftTitle('');
                  setNewDraftSubject('');
                  setNewDraftBody('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )} 
        {savedDrafts.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <h4>Saved Draft Scripts</h4>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
              {DRAFT_CATEGORIES.map((cat) => {
                const scripts = savedDrafts.filter((draft) => draft.category === cat.value);
                if (!scripts.length) return null;
                return (
                  <div
                    key={cat.value}
                    className="card"
                    style={{ padding: 14, borderRadius: 10, background: '#f4f4f4' }}
                  >
                    <strong style={{ display: 'block', marginBottom: 10 }}>{cat.label}</strong>
                    {scripts.map((draft) => {
                      const scriptId = draft._id || draft.id || `${cat.value}-${draft.title || 'script'}`;
                      const isActiveScript = scriptId === activeSavedDraftId;
                      const borderStyle = isActiveScript ? '2px solid #0ea5e9' : '1px solid #e5e7eb';
                      const bgColor = isActiveScript ? '#e0f2fe' : '#fff';
                      return (
                        <div
                          key={scriptId}
                          className="card"
                          style={{
                            marginBottom: 12,
                            cursor: 'pointer',
                            padding: 10,
                            border: borderStyle,
                            background: bgColor
                          }}
                          onClick={() => handleSavedDraftSelect(draft)}
                        >
                          <p style={{ margin: 0, fontWeight: 600 }}>{draft.title}</p>
                          <small style={{ color: 'var(--muted)' }}>{draft.subject}</small>
                          {draft.createdAt ? (
                            <p style={{ fontSize: 11, margin: '6px 0 0', color: 'var(--muted)' }}>
                              {new Date(draft.createdAt).toLocaleString()}
                            </p>
                          ) : null}
                          <div className="row" style={{ marginTop: 10, gap: 6 }}>
                            <button
                              className="button"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingDraft(draft);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="button danger"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDraft(draft);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <p style={{ fontWeight: 600, color: 'var(--text)', marginTop: 12 }}>
          Subject Line
        </p>
        <input
          className="input"
          value={draftSubject}
          onChange={(e) => setDraftSubject(e.target.value)}
          placeholder="Email Subject"
        />
        <p style={{ fontWeight: 600, color: 'var(--text)', marginTop: 12 }}>
          Draft / Email Body (HTML)
        </p>
        <RichTextEditor
          value={draftBody}
          onChange={setDraftBody}
        />
        <div className="row">
          <input
            className="input"
            style={{ maxWidth: 320 }}
            value={testEmailTo}
            onChange={(e) => setTestEmailTo(e.target.value)}
            placeholder="Test recipient email"
          />
          <button
            className="button secondary"
            onClick={sendTestEmail}
          >
            Test Email
          </button>
        </div>
      </section>

      
      <section className="card grid">
        <h3>Excel Upload (.xlsx / .csv)</h3>
        <div className="row">
          <input type="file" accept=".xlsx,.csv" onChange={onUpload} />
          {loading ? <p>Uploading...</p> : null}
        </div>
        {preview.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {(previewColumns.length ? previewColumns : Object.keys(preview[0] || {})).map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    {(previewColumns.length ? previewColumns : Object.keys(row || {})).map((column) => (
                      <td key={`${idx}-${column}`}>{row?.[column] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="card grid">
        <h3>Campaign Management</h3>
        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', alignItems: 'end' }}>
          <input className="input" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Campaign Name" />
          <select className="select" value={selectedListId} onChange={(e) => setSelectedListId(e.target.value)}>
            <option value="">Select List</option>
            {lists.map((l) => <option key={l._id} value={l._id}>{l.name} ({l.leadCount})</option>)}
          </select>
          <select className="select" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
            <option value="">Select Template</option>
            {templates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
          <input className="input" type="number" min="1" value={batchSize} onChange={(e) => setBatchSize(e.target.value)} placeholder="Batch" />
          <input className="input" type="number" min="1" value={delaySeconds} onChange={(e) => setDelaySeconds(e.target.value)} placeholder="Delay(s)" />
        </div>
        <div className="row">
          <button className="button secondary" onClick={normalizeSelectedListEmails}>Normalize List Emails</button>
          <button className="button" onClick={createCampaign}>Create Campaign</button>
        </div>
      </section>

      <section className="card grid">
        <h3>Campaigns</h3>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            className="button danger"
            type="button"
            onClick={deleteSelectedCampaigns}
            disabled={!selectedCampaignIds.length}
          >
            Delete Selected
          </button>
          <button className="button secondary" type="button" onClick={toggleSelectAllCampaigns}>
            {allCampaignsSelected ? 'Clear Selection' : 'Select All'}
          </button>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
            {selectedCampaignIds.length} selected
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 56 }}>
                  <input
                    type="checkbox"
                    checked={allCampaignsSelected}
                    onChange={toggleSelectAllCampaigns}
                  />
                </th>
                <th>Name</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Stats</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const total = c.stats?.total || 0;
                const sent = c.stats?.sent || 0;
                const percent = total ? Math.round((sent / total) * 100) : 0;
                const isChecked = selectedCampaignIds.includes(c._id);
                return (
                  <tr key={c._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCampaignSelection(c._id)}
                      />
                    </td>
                    <td>{c.name}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <div className="progress"><div style={{ width: `${percent}%` }} /></div>
                      <small>{percent}%</small>
                    </td>
                    <td>{sent}/{total} sent, {c.stats?.failed || 0} failed</td>
                    <td className="row">
                      <button className="button" onClick={() => startCampaign(c._id)}>Start</button>
                      <button className="button warn" onClick={() => pauseCampaign(c._id)}>Pause</button>
                      <button className="button danger" onClick={() => stopCampaign(c._id)}>Stop</button>
                      <button className="button secondary" onClick={() => resumeCampaign(c._id)}>Resume</button>
                      <button className="button danger" onClick={() => clearCampaignLogs(c._id)}>Clear Logs</button>
                      <button className="button danger" onClick={() => deleteCampaign(c._id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {activeCampaign ? (
        <section className="card grid">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>Live Logs: {activeCampaign.name}</h3>
            <div className="row">
              <button className="button danger" onClick={() => stopCampaign(activeCampaign._id)}>Stop</button>
              <button className="button danger" onClick={() => clearCampaignLogs(activeCampaign._id)}>Clear Logs</button>
              <button className="button danger" onClick={() => deleteCampaign(activeCampaign._id)}>Delete</button>
            </div>
          </div>
          <p>{progressText}</p>
          <div style={{ maxHeight: 220, overflow: 'auto', background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 10 }}>
            {(activeCampaign.logs || []).slice(-40).map((log, idx) => (
              <div key={idx} style={{ fontSize: 13, marginBottom: 4 }}>
                [{new Date(log.at).toLocaleTimeString()}] {log.message}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}


