// Guest house gallery: taller, near-fullscreen sheet and uncropped photos. v7
(function(){
  if(window.__guestGalleryLargeV7)return;
  window.__guestGalleryLargeV7=true;

  const style=document.createElement('style');
  style.id='guest-gallery-large-v7-style';
  style.textContent=`
    /* Let the opened house sheet rise almost to the top of the screen. */
    #detail .sheet{
      max-height:calc(100dvh - 4px)!important;
      border-radius:22px 22px 0 0!important;
    }

    /* Make the gallery the visual focus of the card. */
    #detail .hero.gh-photo-hero{
      height:clamp(340px,52dvh,520px)!important;
      min-height:340px!important;
      background:#070b09!important;
    }

    /* Keep the complete source photo visible instead of cropping it. */
    #detail .gh-gallery-slide{
      background:#070b09!important;
      overflow:hidden!important;
    }
    #detail .gh-gallery-slide img{
      width:100%!important;
      height:100%!important;
      object-fit:contain!important;
      object-position:center center!important;
      background:#070b09!important;
    }

    /* The old gradient covered too much of the enlarged photo. */
    #detail .hero.gh-photo-hero:after{
      background:linear-gradient(to bottom,transparent 76%,rgba(15,22,19,.18) 88%,#0f1613 100%)!important;
    }

    /* Slightly larger controls on the taller gallery. */
    #detail .gh-gallery-nav{
      width:40px!important;
      height:48px!important;
      border-radius:14px!important;
      font-size:26px!important;
    }
    #detail .gh-gallery-prev{left:12px!important}
    #detail .gh-gallery-next{right:12px!important}

    /* Keep metadata readable but out of the way of the photo. */
    #detail .gh-gallery-meta{bottom:12px!important}
    #detail .gh-gallery-dots{bottom:44px!important}

    @media(max-height:680px){
      #detail .hero.gh-photo-hero{
        height:48dvh!important;
        min-height:300px!important;
      }
    }

    @media(min-width:760px){
      #detail .hero.gh-photo-hero{
        height:min(52vh,500px)!important;
      }
    }
  `;
  document.head.appendChild(style);
})();
