(function(){
  "use strict";

  const DISMISS_KEY="askep_pwa_install_dismissed_until";
  const DISMISS_DAYS=7;
  let deferredPrompt=null;
  let banner=null;

  function isInstalled(){
    return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
  }

  function isHomePage(){
    const path=window.location.pathname.replace(/\/+$/,"");
    const file=path.split("/").pop()||"";
    return !file||file==="Askep"||file==="index.html";
  }

  function dismissed(){
    const until=Number(localStorage.getItem(DISMISS_KEY)||0);
    return until>Date.now();
  }

  function rememberDismissal(){
    const until=Date.now()+DISMISS_DAYS*24*60*60*1000;
    localStorage.setItem(DISMISS_KEY,String(until));
  }

  function hideBanner(){
    if(!banner)return;
    banner.classList.remove("show");
    window.setTimeout(()=>banner?.remove(),240);
    banner=null;
  }

  function createBanner(){
    if(banner||!isHomePage()||isInstalled()||dismissed()||!deferredPrompt)return;

    banner=document.createElement("aside");
    banner.className="pwa-install-banner";
    banner.setAttribute("role","dialog");
    banner.setAttribute("aria-label","Instal aplikasi ASKEP");
    banner.innerHTML=`
      <div class="pwa-install-icon"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i></div>
      <div class="pwa-install-copy">
        <p class="pwa-install-title">Instal aplikasi untuk pengalaman yang lebih nyaman</p>
        <p class="pwa-install-desc">Buka ASKEP lebih cepat langsung dari layar utama perangkat.</p>
      </div>
      <div class="pwa-install-actions">
        <button class="pwa-install-later" type="button">Nanti</button>
        <button class="pwa-install-btn" type="button"><i class="fa-solid fa-download" aria-hidden="true"></i> Instal</button>
      </div>`;

    document.body.appendChild(banner);
    requestAnimationFrame(()=>banner?.classList.add("show"));

    banner.querySelector(".pwa-install-later")?.addEventListener("click",()=>{
      rememberDismissal();
      hideBanner();
    });

    banner.querySelector(".pwa-install-btn")?.addEventListener("click",async()=>{
      if(!deferredPrompt)return;
      const promptEvent=deferredPrompt;
      deferredPrompt=null;
      hideBanner();
      await promptEvent.prompt();
      const choice=await promptEvent.userChoice;
      if(choice?.outcome!=="accepted")rememberDismissal();
    });
  }

  window.addEventListener("beforeinstallprompt",event=>{
    event.preventDefault();
    deferredPrompt=event;
    window.setTimeout(createBanner,1800);
  });

  window.addEventListener("appinstalled",()=>{
    deferredPrompt=null;
    localStorage.removeItem(DISMISS_KEY);
    hideBanner();
  });
})();
