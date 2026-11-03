// Personal profiles are readable only by the extension's own UI, not by injected scripts.
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
chrome.runtime.onInstalled.addListener(details=>{
  if(details.reason==='install') chrome.runtime.openOptionsPage();
});
