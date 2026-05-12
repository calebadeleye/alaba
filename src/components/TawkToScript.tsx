/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AccountService } from '../services/api';

export const TawkToScript: React.FC = () => {
  const [propertyId, setPropertyId] = useState<string | null>(null);

  useEffect(() => {
    AccountService.getGlobalSettings().then(settings => {
      if (settings?.tawk_property_id) {
        setPropertyId(settings.tawk_property_id);
      }
    }).catch(err => console.error("Tawk.to settings fetch failed", err));
  }, []);

  useEffect(() => {
    if (!propertyId) return;

    const s1 = document.createElement("script");
    const s0 = document.getElementsByTagName("script")[0];
    s1.async = true;
    s1.src = `https://embed.tawk.to/${propertyId}/default`;
    s1.charset = 'UTF-8';
    s1.setAttribute('crossorigin', '*');
    s0.parentNode?.insertBefore(s1, s0);

    return () => {
       // Cleanup script if needed, though usually tawk.to manages its own iframe
       const scripts = document.getElementsByTagName('script');
       for (let i = 0; i < scripts.length; i++) {
         if (scripts[i].src === `https://embed.tawk.to/${propertyId}/default`) {
           scripts[i].parentNode?.removeChild(scripts[i]);
         }
       }
    };
  }, [propertyId]);

  return null;
};
