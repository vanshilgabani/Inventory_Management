import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    companyName: 'Veeraa Impex',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/settings/companies`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch companies');
        }

        const data = await response.json();
        console.log('✅ Full API Response:', data);
        
        // ✅ FIX: Extract companies array from response
        const companiesArray = data.companies || data;
        console.log('✅ Companies Array:', companiesArray);
        
        if (Array.isArray(companiesArray) && companiesArray.length > 0) {
          const defaultCompany = companiesArray.find(c => c.isDefault) || companiesArray[0];
          console.log('✅ Default Company:', defaultCompany);
          console.log('✅ Company Name:', defaultCompany.name);
          
          setSettings(prev => ({
            ...prev,
            companyName: defaultCompany.name
          }));
        } else {
          console.log('❌ No companies found in array');
        }
      } catch (error) {
        console.error('❌ Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};
