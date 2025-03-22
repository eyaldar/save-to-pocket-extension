import React, { ReactNode } from 'react';
import { AuthProvider } from '../hooks/useAuth';
import { TabProvider } from '../hooks/useTab';
import { SettingsProvider } from '../hooks/useSettings';
import { PocketApiProvider } from '../hooks/usePocketApi';
import { TagsProvider } from '../hooks/useTags';

interface ProvidersProps {
  children: ReactNode;
}

export const Providers: React.FC<ProvidersProps> = ({ children }) => {
  return (
    <SettingsProvider>
      <AuthProvider>
        <PocketApiProvider>
          <TabProvider>
            <TagsProvider>
              {children}
            </TagsProvider>
          </TabProvider>
        </PocketApiProvider>
      </AuthProvider>
    </SettingsProvider>
  );
};

export default Providers; 