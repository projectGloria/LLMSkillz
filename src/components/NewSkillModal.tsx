import React, { useState } from 'react';

interface NewSkillModalProps {
  existingSections: string[];
  onClose: () => void;
  onCreate: (payload: {
    folderName: string;
    section?: string;
    name?: string;
    description?: string;
  }) => Promise<void>;
}

export const NewSkillModal: React.FC<NewSkillModalProps> = ({
  existingSections,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [section, setSection] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setFolderName(slug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) {
      setError('Folder name is required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        folderName: folderName.trim(),
        section: section.trim() || undefined,
        name: name.trim() || folderName.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create skill.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Create New Skill</h2>
        <p className="modal-sub">
          Creates a new skill folder with a pre-formatted <code style={{ fontFamily: 'var(--font-mono)' }}>SKILL.md</code> file.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">Skill Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. code-review-checklist"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Folder Name (slug)</label>
            <input
              type="text"
              className="input input-mono"
              placeholder="code-review-checklist"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Section / Category Subfolder (optional)</label>
            <input
              type="text"
              className="input input-mono"
              list="existing-sections"
              placeholder="Leave blank for root skills/ folder"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            />
            <datalist id="existing-sections">
              {existingSections
                .filter((s) => s !== 'General')
                .map((s) => (
                  <option key={s} value={s} />
                ))}
            </datalist>
          </div>

          <div className="form-field">
            <label className="form-label">Description</label>
            <textarea
              className="input"
              rows={3}
              placeholder="When should the LLM trigger and use this skill?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Skill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
