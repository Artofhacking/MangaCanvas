import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useThemeStore } from '../stores/themeStore';
import Footer from './Footer';

interface LayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
  showFooter?: boolean;
}

/**
 * Layout 组件 - 页面统一布局框架
 * 包含导航栏、内容区、页脚
 */
const Layout: React.FC<LayoutProps> = ({ 
  children, 
  showNav = true,
  showFooter = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useThemeStore();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: '/', label: '首页' },
    { path: '/projects', label: '项目' },
    { path: '/billing', label: '账单' },
  ];

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[var(--ic-background)] flex flex-col">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl shadow-sm dark:shadow-none border-b border-[var(--ic-outline-variant)]/20">
        <nav className="flex justify-between items-center h-16 px-6 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <button 
              onClick={() => navigate('/')}
              className="text-xl font-bold tracking-tighter text-[#3755c3] dark:text-[#6d89fa] hover:opacity-80 transition-opacity"
            >
              Infinite Canvas
            </button>
            
            {/* Navigation Links */}
            <div className="hidden md:flex gap-1">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    isActive(item.path)
                      ? 'text-[#3755c3] bg-[#dde1ff] dark:text-[#6d89fa] dark:bg-[#3755c3]/20'
                      : 'text-[#445d99] hover:bg-[#eaedff] dark:text-[#98b1f2] dark:hover:bg-[#3755c3]/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Start Creating Button - Only show on homepage */}
            {location.pathname === '/' && (
              <button 
                onClick={() => navigate('/projects')}
                className="hidden sm:block bg-[#3755c3] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#2848b7] active:scale-95 transition-all shadow-lg shadow-[#3755c3]/20"
              >
                开始使用
              </button>
            )}
            
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center hover:bg-[var(--ic-surface-container)] rounded-full transition-colors text-[var(--ic-on-surface-variant)]"
              title={isDark ? '切换到亮色主题' : '切换到深色主题'}
            >
              {isDark ? <SunOutlined style={{ fontSize: 18 }} /> : <MoonOutlined style={{ fontSize: 18 }} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="pt-16 flex-1">
        {children}
      </main>

      {/* Footer */}
      <Footer show={showFooter} />
    </div>
  );
};

export default Layout;
