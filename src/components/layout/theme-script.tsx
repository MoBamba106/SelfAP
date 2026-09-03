/**
 * Sets the saved theme before first paint so there is no flash.
 * Inline, tiny, and the only script that runs before React hydrates.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('selfap-theme');if(t==='ink'||t==='paper'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
