import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Settings,
} from 'lucide-react';
import type { SkillRecord, TargetStatus } from '../types';

export type ActiveView = 'skill' | 'targets' | 'settings';

interface SidebarProps {
  skills: SkillRecord[];
  targets: TargetStatus[];
  selectedSkillId: string | null;
  activeView: ActiveView;
  onSelectSkill: (skillId: string) => void;
  onSelectView: (view: ActiveView) => void;
  onOpenNewSkill: () => void;
  onRefresh: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  skills,
  targets,
  selectedSkillId,
  activeView,
  onSelectSkill,
  onSelectView,
  onOpenNewSkill,
  onRefresh,
}) => {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const enabledTargets = useMemo(() => targets.filter((t) => t.enabled), [targets]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? skills.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.folderName.toLowerCase().includes(q) ||
            s.section.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q)
        )
      : skills;

    const map = new Map<string, SkillRecord[]>();
    for (const skill of filtered) {
      const key = skill.section || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(skill);
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [skills, query]);

  const toggleSection = (sectionName: string) => {
    setCollapsed((prev) => ({ ...prev, [sectionName]: !prev[sectionName] }));
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="./icon.png" alt="LLMSkillz" className="brand-icon" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="brand-title">LLMSkillz</div>
          <div className="brand-subtitle">{skills.length} skills in library</div>
        </div>
        <button
          className="btn btn-ghost btn-xs"
          onClick={onRefresh}
          title="Rescan skills folder & targets"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="sidebar-actions">
        <div className="search-box">
          <Search size={14} />
          <input
            type="text"
            className="search-input"
            placeholder="Filter skills..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button className="btn btn-primary btn-sm" onClick={onOpenNewSkill}>
          <Plus size={14} />
          New Skill
        </button>
      </div>

      <div className="sidebar-list">
        {sections.length === 0 ? (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            {skills.length === 0 ? 'No skill folders found.' : 'No skills match your filter.'}
          </div>
        ) : (
          sections.map(([sectionName, sectionSkills]) => {
            const isCollapsed = Boolean(collapsed[sectionName]);
            return (
              <div key={sectionName} className="section-group">
                <div className="section-header" onClick={() => toggleSection(sectionName)}>
                  <span className="section-header-left">
                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                    <FolderOpen size={12} />
                    <span>{sectionName}</span>
                  </span>
                  <span className="section-count">{sectionSkills.length}</span>
                </div>

                {!isCollapsed &&
                  sectionSkills.map((skill) => {
                    const isSelected = activeView === 'skill' && selectedSkillId === skill.id;
                    return (
                      <button
                        key={skill.id}
                        className={`skill-item ${isSelected ? 'active' : ''}`}
                        onClick={() => onSelectSkill(skill.id)}
                      >
                        <div className="skill-item-main">
                          <div className="skill-item-name">{skill.name}</div>
                          <div className="skill-item-folder">{skill.folderName}</div>
                        </div>
                        <div
                          className="skill-item-dots"
                          title={enabledTargets
                            .map((t) => `${t.name}: ${skill.installStatus[t.id] || 'not-installed'}`)
                            .join('\n')}
                        >
                          {enabledTargets.map((t) => (
                            <span
                              key={t.id}
                              className={`status-dot ${skill.installStatus[t.id] || 'not-installed'}`}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>

      <div className="sidebar-footer">
        <button
          className={`nav-btn ${activeView === 'targets' ? 'active' : ''}`}
          onClick={() => onSelectView('targets')}
        >
          <span className="nav-btn-left">
            <Layers size={15} />
            <span>Targets &amp; Sync</span>
          </span>
          <span className="section-count">{enabledTargets.length}</span>
        </button>

        <button
          className={`nav-btn ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectView('settings')}
        >
          <span className="nav-btn-left">
            <Settings size={15} />
            <span>Settings</span>
          </span>
        </button>
      </div>
    </aside>
  );
};
