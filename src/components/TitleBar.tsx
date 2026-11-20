import React, { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

interface TitleBarProps {
  subtitle?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ subtitle }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.llmSkillz.isWindowMaximized().then(setIsMaximized).catch(() => {});
    const unsubscribe = window.llmSkillz.onMaximizedChanged(setIsMaximized);
    return unsubscribe;
  }, []);

  return (
    <div
      className="titlebar"
      onDoubleClick={() => window.llmSkillz.toggleMaximizeWindow()}
    >
      <div className="titlebar-left">
        <img src="./icon.png" alt="LLMSkillz" className="titlebar-icon" />
        <span className="titlebar-brand">LLMSkillz</span>
        {subtitle && (
          <>
            <span className="titlebar-sep">/</span>
            <span className="titlebar-sub">{subtitle}</span>
          </>
        )}
      </div>

      <div className="titlebar-controls">
        <button
          type="button"
          className="titlebar-btn"
          onClick={() => window.llmSkillz.minimizeWindow()}
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>

        <button
          type="button"
          className="titlebar-btn"
          onClick={() => window.llmSkillz.toggleMaximizeWindow()}
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <Copy size={12} /> : <Square size={12} />}
        </button>

        <button
          type="button"
          className="titlebar-btn titlebar-btn-close"
          onClick={() => window.llmSkillz.closeWindow()}
          title="Close"
          aria-label="Close"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
