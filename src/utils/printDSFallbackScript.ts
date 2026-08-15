/**
 * Generates a <script> tag to inject into print HTML windows.
 * This script intercepts broken images and attempts to load them using:
 * 1. DB fallback paths (globalFallbackMap, injected as inline JSON)
 * 2. /image/manifest.json and /DS/manifest.json
 * 3. Filename-based search in /image/ and /DS/
 * 4. /placeholder.svg as final fallback
 * 
 * Also neutralizes inline onerror="this.style.display='none'" handlers
 * to prevent images from being hidden before fallback completes.
 */
import { getGlobalFallbackMapSnapshot } from '@/utils/preloadFallbackPaths';

export function getDSFallbackScript(): string {
  // Serialize the global fallback map as inline JSON for the print window
  let mapJson = '{}';
  try {
    mapJson = JSON.stringify(getGlobalFallbackMapSnapshot());
  } catch {
    mapJson = '{}';
  }

  return `
<script>
(function() {
  // DB fallback paths: originalUrl → /DS/path
  var dbFallbackMap = ${mapJson};
  
  var dsManifest = null;
  var dsReverseMap = null;
  var imgManifest = null;
  var imgReverseMap = null;
  
  // Path normalizer: backslashes → forward slashes, ensure /DS/ prefix
  function normPath(p) {
    if (!p) return null;
    p = p.replace(/\\\\/g, '/').replace(/([^:])\\/{2,}/g, '$1/');
    if (p.indexOf('/DS/') !== 0) {
      if (p.indexOf('DS/') === 0) p = '/' + p;
      else if (p.charAt(0) === '/') p = '/DS' + p;
      else p = '/DS/' + p;
    }
    return p;
  }
  
  function buildReverseMap(entries) {
    var rev = {};
    for (var url in entries) {
      var path = entries[url];
      var fname = path.split('/').pop();
      if (fname) rev[fname] = path;
    }
    return rev;
  }
  
  // Load both manifests in parallel
  function loadManifest(folder, cb) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/' + folder + '/manifest.json', true);
      xhr.onload = function() {
        if (xhr.status === 200) {
          try {
            var json = JSON.parse(xhr.responseText);
            var entries = json.entries || {};
            cb(entries, buildReverseMap(entries));
          } catch(e) { cb(null, null); }
        } else { cb(null, null); }
      };
      xhr.onerror = function() { cb(null, null); };
      xhr.send();
    } catch(e) { cb(null, null); }
  }
  
  loadManifest('DS', function(entries, rev) { dsManifest = entries; dsReverseMap = rev; });
  loadManifest('image', function(entries, rev) { imgManifest = entries; imgReverseMap = rev; });
  
  // Track which fallback index each image is on
  var imgState = new WeakMap();
  
  function getFileName(src) {
    try {
      return decodeURIComponent(src.split('/').pop().split('?')[0].split('#')[0]);
    } catch(e) { return null; }
  }
  
  // Normalize URL key for map lookup (strip trailing slash, backslash → forward)
  function normKey(url) {
    if (!url) return '';
    var k = url.replace(/\\\\/g, '/').trim();
    if (k.charAt(k.length - 1) === '/') k = k.slice(0, -1);
    return k;
  }
  
  function lookupDb(originalSrc) {
    var direct = dbFallbackMap[originalSrc];
    if (direct) return normPath(direct);
    var normed = normKey(originalSrc);
    if (normed !== originalSrc) {
      var normedVal = dbFallbackMap[normed];
      if (normedVal) return normPath(normedVal);
    }
    return null;
  }
  
  function buildSources(originalSrc) {
    var sources = [];
    var seen = {};
    function add(s) { if (s && !seen[s]) { seen[s] = 1; sources.push(s); } }
    
    // 1. DB fallback path (normalized)
    var dbPath = lookupDb(originalSrc);
    if (dbPath) add(dbPath);
    
    // 2. /image/ manifest exact match
    if (imgManifest && imgManifest[originalSrc]) add('/image/' + imgManifest[originalSrc]);
    
    // 3. /DS/ manifest exact match
    if (dsManifest && dsManifest[originalSrc]) add('/DS/' + dsManifest[originalSrc]);
    
    // 4. Filename-based lookups
    var fname = getFileName(originalSrc);
    if (fname) {
      if (imgReverseMap && imgReverseMap[fname]) add('/image/' + imgReverseMap[fname]);
      if (dsReverseMap && dsReverseMap[fname]) add('/DS/' + dsReverseMap[fname]);
      add('/image/' + fname);
      add('/DS/' + fname);
    }
    
    // 5. Final fallback
    add('/placeholder.svg');
    
    return sources;
  }
  
  // Neutralize inline onerror handlers that hide images (e.g. onerror="this.style.display='none'")
  // This runs before error events, overriding destructive handlers
  function neutralizeInlineOnerror() {
    var imgs = document.querySelectorAll('img[onerror]');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].removeAttribute('onerror');
    }
  }
  
  // Run on DOMContentLoaded and immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', neutralizeInlineOnerror);
  } else {
    neutralizeInlineOnerror();
  }
  
  // Also observe for dynamically added images with onerror
  if (typeof MutationObserver !== 'undefined') {
    var mo = new MutationObserver(function(mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var added = mutations[m].addedNodes;
        for (var n = 0; n < added.length; n++) {
          var node = added[n];
          if (node.tagName === 'IMG' && node.hasAttribute('onerror')) {
            node.removeAttribute('onerror');
          }
          if (node.querySelectorAll) {
            var innerImgs = node.querySelectorAll('img[onerror]');
            for (var j = 0; j < innerImgs.length; j++) {
              innerImgs[j].removeAttribute('onerror');
            }
          }
        }
      }
    });
    if (document.body) {
      mo.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        if (document.body) mo.observe(document.body, { childList: true, subtree: true });
      });
    }
  }
  
  document.addEventListener('error', function(e) {
    var el = e.target;
    if (!el || el.tagName !== 'IMG') return;
    
    // Prevent hiding — ensure image stays visible during fallback
    el.style.display = '';
    el.style.visibility = 'visible';
    
    var state = imgState.get(el);
    if (!state) {
      var originalSrc = el.getAttribute('data-original-src') || el.getAttribute('data-fallback-original') || el.src;
      if (!originalSrc || originalSrc.indexOf('data:') === 0) return;
      state = { original: originalSrc, sources: buildSources(originalSrc), index: 0 };
      imgState.set(el, state);
      el.setAttribute('data-original-src', originalSrc);
    }
    
    state.index++;
    if (state.index < state.sources.length) {
      el.src = state.sources[state.index];
    }
    // If exhausted, stop (last source is placeholder.svg)
  }, true);
})();
</script>`;
}
