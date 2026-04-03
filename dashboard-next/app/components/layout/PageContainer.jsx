'use client';

import { cn } from '../../lib/utils';

const sizeMap = {
  md: 'ui-page-container-md',
  lg: 'ui-page-container-lg',
  xl: 'ui-page-container-xl',
  full: 'ui-page-container-full'
};

export function PageContainer({ children, className = '', size = 'xl' }) {
  return (
    <div className={cn('container grid dashboard-main app-layout-main', sizeMap[size] || sizeMap.xl, className)}>
      {children}
    </div>
  );
}

export default PageContainer;
