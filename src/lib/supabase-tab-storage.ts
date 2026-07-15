// Route Supabase auth-token storage to sessionStorage so each browser tab
// has its own independent Weave login. Without this, localStorage is shared
// across tabs on the same origin and signing into a second account in a new
// tab silently replaces the first tab's session, causing data from one
// account to appear inside the other.
//
// Only Supabase's auth-token keys (sb-<ref>-auth-token[.N]) are redirected;
// every other localStorage read/write is untouched.
//
// This file must be imported before `@/integrations/supabase/client` is
// first accessed. It is imported at the top of `src/router.tsx` and
// `src/routes/__root.tsx`.

if (typeof window !== "undefined" && !(window as any).__weaveTabAuthStoragePatched) {
  const ls = window.localStorage;
  const ss = window.sessionStorage;
  const isAuthKey = (k: string) => typeof k === "string" && k.startsWith("sb-") && k.includes("-auth-token");

  const origGet = ls.getItem.bind(ls);
  const origSet = ls.setItem.bind(ls);
  const origRemove = ls.removeItem.bind(ls);

  // One-time migration: if the tab currently has an auth token in
  // localStorage (from before this patch shipped), move it into sessionStorage
  // so this tab keeps its current login instead of getting kicked out.
  try {
    for (let i = ls.length - 1; i >= 0; i--) {
      const key = ls.key(i);
      if (key && isAuthKey(key)) {
        const val = origGet(key);
        if (val != null && ss.getItem(key) == null) ss.setItem(key, val);
        origRemove(key);
      }
    }
  } catch {
    // ignore storage access errors (private mode, etc.)
  }

  ls.getItem = (k: string) => (isAuthKey(k) ? ss.getItem(k) : origGet(k));
  ls.setItem = (k: string, v: string) => {
    if (isAuthKey(k)) ss.setItem(k, v);
    else origSet(k, v);
  };
  ls.removeItem = (k: string) => {
    if (isAuthKey(k)) ss.removeItem(k);
    else origRemove(k);
  };

  (window as any).__weaveTabAuthStoragePatched = true;
}

export {};
