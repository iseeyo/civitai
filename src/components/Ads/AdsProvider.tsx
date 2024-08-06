import React, { createContext, useContext, useState } from 'react';

import { NsfwLevel } from '~/server/common/enums';
import { useGenerationStore } from '~/store/generation.store';
import { useCurrentUser } from '~/hooks/useCurrentUser';
import { env } from '~/env/client.mjs';
import { isProd } from '~/env/other';
import Script from 'next/script';
import { useConsentManager } from '~/components/Ads/ads.utils';
import { useBrowsingLevelDebounced } from '~/components/BrowsingLevel/BrowsingLevelProvider';

type AdProvider = 'ascendeum' | 'exoclick' | 'adsense' | 'pubgalaxy';
const adProviders: AdProvider[] = ['pubgalaxy'];
const AscendeumAdsContext = createContext<{
  adsBlocked: boolean;
  nsfw: boolean;
  nsfwOverride?: boolean;
  adsEnabled: boolean;
  username?: string;
  isMember: boolean;
  enabled: boolean;
  providers: readonly string[];
  cookieConsent: boolean;
} | null>(null);

export function useAdsContext() {
  const context = useContext(AscendeumAdsContext);
  if (!context) throw new Error('missing AdsProvider');
  return context;
}

export function AdsProvider({ children }: { children: React.ReactNode }) {
  const [adsBlocked, setAdsBlocked] = useState(false);
  const currentUser = useCurrentUser();
  const isMember = !!currentUser?.isMember;
  const enabled = env.NEXT_PUBLIC_ADS;
  // const enabled = false;
  const adsEnabled = enabled && !isMember;
  // const { targeting: cookieConsent = false } = useConsentManager();
  const cookieConsent = true;

  // keep track of generation panel views that are considered nsfw
  const nsfwOverride = useGenerationStore(({ view, opened }) => {
    if (!opened) return;
    else if (view === 'queue' || view === 'feed') return true;
  });

  // derived value from browsingMode and nsfwOverride
  const browsingLevel = useBrowsingLevelDebounced();
  const nsfw = browsingLevel > NsfwLevel.PG;

  // const readyRef = useRef(false);
  // useEffect(() => {
  //   if (!readyRef.current && adsEnabled && cookieConsent) {
  //     readyRef.current = true;
  //     checkAdsBlocked((blocked) => {
  //       // setAdsBlocked(blocked);
  //       setAdsBlocked(!isProd ? true : blocked);
  //     });
  //   }
  // }, [adsEnabled, cookieConsent]);

  return (
    <AscendeumAdsContext.Provider
      value={{
        adsBlocked,
        nsfw,
        adsEnabled: adsEnabled,
        username: currentUser?.username,
        nsfwOverride,
        isMember,
        enabled,
        cookieConsent,
        providers: adProviders,
      }}
    >
      {adsEnabled &&
        cookieConsent &&
        adProviders.map((provider) => (
          <LoadProviderScript
            key={provider}
            provider={provider}
            onError={() => setAdsBlocked(true)}
          />
        ))}
      {children}
      {adProviders.includes('pubgalaxy') && <div id="uniconsent-config" />}
    </AscendeumAdsContext.Provider>
  );
}

function LoadProviderScript({ provider, onError }: { provider: AdProvider; onError: () => void }) {
  switch (provider) {
    case 'ascendeum':
      return <Script src="https://ads.civitai.com/asc.civitai.js" onError={onError} />;
    case 'adsense':
      return (
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6320044818993728"
          onError={onError}
        />
      );
    case 'pubgalaxy':
      return (
        <>
          <Script src="https://cmp.uniconsent.com/v2/stub.min.js" />
          <Script src="https://cmp.uniconsent.com/v2/a635bd9830/cmp.js" async />
          <Script
            id="ads-start"
            type="text/javascript"
            dangerouslySetInnerHTML={{
              __html: `
                window.googletag = window.googletag || {};
                window.googletag.cmd = window.googletag.cmd || [];
                window.googletag.cmd.push(function () {
                    window.googletag.pubads().enableAsyncRendering();
                    window.googletag.pubads().disableInitialLoad();
                });
                (adsbygoogle = window.adsbygoogle || []).pauseAdRequests = 1;
              `,
            }}
          />
          <Script
            id="ads-init"
            type="text/javascript"
            dangerouslySetInnerHTML={{
              __html: `
__tcfapi("addEventListener", 2, function(tcData, success) {
    if (success && tcData.unicLoad  === true) {
        if(!window._initAds) {
            window._initAds = true;
            
	    var script = document.createElement('script');
            script.async = true;
            script.src = '//dsh7ky7308k4b.cloudfront.net/publishers/civitaicom.min.js';
            document.head.appendChild(script);

	    var script = document.createElement('script');
            script.async = true;
            script.src = '//btloader.com/tag?o=5184339635601408&upapi=true';
            document.head.appendChild(script);
			
        }
    }
});
              `,
            }}
          />
        </>
      );
    case 'exoclick':
    default:
      return null;
  }
}

const REQUEST_URL = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const checkAdsBlocked = (callback: (blocked: boolean) => void) => {
  fetch(REQUEST_URL, {
    method: 'HEAD',
    mode: 'no-cors',
  })
    // ads are blocked if request is redirected
    // (we assume the REQUEST_URL doesn't use redirections)
    .then((response) => {
      callback(response.redirected);
    })
    // ads are blocked if request fails
    // (we do not consider connction problems)
    .catch(() => {
      callback(true);
    });
};
