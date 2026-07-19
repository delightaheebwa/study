/* === Dependency Loader for Lessons === */
/* Loads Mermaid, Prism.js, and MathJax from CDN.         */
/* Include AFTER the stylesheet in <head>.                */

(function() {
  var base = document.currentScript ? document.currentScript.src.replace(/deps\.js$/, '') : '../assets/';

  // --- Prism.js (dark theme + python + bash) ---
  var prismCSS = document.createElement('link');
  prismCSS.rel = 'stylesheet';
  prismCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
  document.head.appendChild(prismCSS);

  var prismJS = document.createElement('script');
  prismJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
  prismJS.onload = function() {
    var python = document.createElement('script');
    python.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js';
    python.onload = function() {
      // Also load bash for shell snippets
      var bash = document.createElement('script');
      bash.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js';
      bash.onload = function() {
        // All components loaded — now highlight everything
        function highlight() { if (window.Prism) Prism.highlightAll(); }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', highlight);
        } else {
          highlight();
        }
      };
      document.head.appendChild(bash);
    };
    document.head.appendChild(python);
  };
  // Fallback: if DOM already loaded when Prism arrives, highlightAll
  prismJS.onerror = function() {
    console.warn('Prism CDN failed — code blocks will be plain text');
  };
  document.head.appendChild(prismJS);

  // --- Mermaid ---
  var mermaidJS = document.createElement('script');
  mermaidJS.src = 'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.9.1/mermaid.min.js';
  mermaidJS.onload = function() {
    mermaid.initialize({ startOnLoad: true, theme: 'default', securityLevel: 'loose' });
  };
  document.head.appendChild(mermaidJS);

  // --- MathJax ---
  var mathjax = document.createElement('script');
  mathjax.src = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-AMS_CHTML';
  mathjax.async = true;
  document.head.appendChild(mathjax);

  // --- MathJax config (inline before script loads) ---
  window.MathJax = {
    tex2jax: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true
    },
    TeX: { extensions: ['AMSmath.js', 'AMSsymbols.js'] }
  };

  // --- Safety net: retry highlightAll a few times ---
  var retries = 0;
  var retryInterval = setInterval(function() {
    if (window.Prism && window.Prism.languages && window.Prism.languages.python) {
      Prism.highlightAll();
      clearInterval(retryInterval);
    }
    retries++;
    if (retries > 20) clearInterval(retryInterval); // give up after ~2s
  }, 100);
})();
