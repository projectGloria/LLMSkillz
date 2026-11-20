import React from 'react';
import { Cpu } from 'lucide-react';
import type { TargetProvider } from '../types';

interface ProviderIconProps {
  provider: TargetProvider;
  size?: number;
}

const PROVIDER_ICON_SRC: Partial<Record<TargetProvider, string>> = {
  antigravity: './Google-Antigravity-Icon-Full-Color.svg',
  claude: './Claude-ai-icon.svg',
  codex: './ChatGPT-Logo.svg',
};

export const ProviderIcon: React.FC<ProviderIconProps> = ({ provider, size = 18 }) => {
  const src = PROVIDER_ICON_SRC[provider];

  if (!src) {
    return (
      <span
        className="provider-icon-wrap"
        style={{ width: size, height: size }}
      >
        <Cpu size={Math.max(12, size - 2)} />
      </span>
    );
  }

  return (
    <span
      className={`provider-icon-wrap provider-icon-${provider}`}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={provider}
        width={size}
        height={size}
        draggable={false}
        className={`provider-svg ${provider === 'codex' ? 'provider-svg-invert' : ''}`}
      />
    </span>
  );
};
