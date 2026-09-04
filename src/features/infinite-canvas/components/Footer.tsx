import React from 'react';

interface FooterProps {
  /** 自定义版权文字 */
  copyright?: string;
  /** 是否显示 */
  show?: boolean;
}

/**
 * Footer 组件 - 页面底部统一页脚
 */
const Footer: React.FC<FooterProps> = ({ 
  copyright = '© 2024 Infinite Canvas. 基于 React Flow 构建。',
  show = true 
}) => {
  if (!show) return null;

  const links = [
    { label: '文档', href: '#' },
    { label: 'GitHub', href: 'https://github.com', external: true },
    { label: 'React Flow', href: 'https://reactflow.dev', external: true },
  ];

  return (
    <footer className="w-full border-t border-[var(--ic-outline-variant)]/20 bg-white dark:bg-slate-950 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Copyright */}
        <p className="text-sm text-[var(--ic-on-surface-variant)]">
          {copyright}
        </p>
        
        {/* Links */}
        <nav className="flex gap-6">
          {links.map((link) => (
            <a
              key={link.label}
              className="text-sm text-[var(--ic-on-surface-variant)] hover:text-[var(--ic-primary)] transition-colors"
              href={link.href}
              {...(link.external && {
                target: '_blank',
                rel: 'noopener noreferrer',
              })}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
