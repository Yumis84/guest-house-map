// Guest house chat: compact full-screen layout based on the sauna chat UI. v3
(function(){
  if(window.__guestChatCompactV3)return;
  window.__guestChatCompactV3=true;

  const style=document.createElement('style');
  style.id='guest-chat-compact-v3';
  style.textContent=`
    #assistant{
      padding:0 0 72px!important;
      overflow:hidden!important;
      background:#0b100f!important;
    }

    #assistant > .head,
    #assistant > .assistant-card{
      display:none!important;
    }

    #chatHost{
      margin:0!important;
      width:100%!important;
      height:100%!important;
      min-height:0!important;
      border:0!important;
      border-radius:0!important;
      overflow:hidden!important;
      position:relative!important;
      background:#0b100f!important;

      --chat--window--width:100%!important;
      --chat--window--height:100%!important;
      --chat--window--border:none!important;
      --chat--window--border-radius:0!important;
      --chat--window--box-shadow:none!important;

      --chat--header-height:auto!important;
      --chat--header--padding:8px 14px 7px!important;
      --chat--header--background:#0d1311!important;
      --chat--header--color:#f4f7f5!important;
      --chat--header--border-bottom:1px solid #ffffff14!important;
      --chat--heading--font-size:1.05rem!important;
      --chat--subtitle--font-size:.72rem!important;
      --chat--subtitle--line-height:1.18!important;

      --chat--messages-list--padding:12px 10px 14px!important;
      --chat--message--font-size:.92rem!important;
      --chat--message--padding:9px 11px!important;
      --chat--message--border-radius:15px!important;
      --chat--message-line-height:1.4!important;
      --chat--message--margin-bottom:7px!important;

      --chat--textarea--height:46px!important;
      --chat--textarea--max-height:120px!important;
      --chat--input--font-size:.95rem!important;
      --chat--input--padding:10px 12px!important;
      --chat--input--line-height:1.35!important;
    }

    #chatHost .chat-layout,
    #chatHost .chat-wrapper,
    #chatHost .chat-window,
    #chatHost .chat-window-wrapper{
      width:100%!important;
      height:100%!important;
      min-height:0!important;
      max-width:none!important;
      max-height:none!important;
      border:0!important;
      border-radius:0!important;
      box-shadow:none!important;
      background:#0b100f!important;
    }

    #chatHost .chat-header{
      min-height:52px!important;
      padding:8px 14px 7px!important;
      background:#0d1311!important;
      border-bottom:1px solid #ffffff14!important;
      border-radius:0!important;
      box-shadow:none!important;
    }

    #chatHost .chat-header h1,
    #chatHost .chat-header .heading{
      margin:0!important;
      color:#f4f7f5!important;
      font-size:1.05rem!important;
      line-height:1.12!important;
      font-weight:800!important;
      letter-spacing:-.015em!important;
    }

    #chatHost .chat-header p,
    #chatHost .chat-header .subtitle{
      margin:2px 0 0!important;
      color:#8e9a94!important;
      font-size:.72rem!important;
      line-height:1.18!important;
    }

    #chatHost .chat-message{
      max-width:86%!important;
      font-size:.92rem!important;
      line-height:1.4!important;
      padding:9px 11px!important;
      margin-bottom:7px!important;
      box-shadow:0 5px 16px #0002!important;
    }

    #chatHost .chat-messages-list{
      padding:12px 10px 14px!important;
    }

    #chatHost .chat-input,
    #chatHost .chat-inputs,
    #chatHost .chat-footer{
      background:#0d1311!important;
      border-top:1px solid #202c27!important;
    }

    #chatHost textarea{
      min-height:46px!important;
      font-size:.95rem!important;
      padding:10px 12px!important;
      line-height:1.35!important;
      border-radius:14px!important;
    }

    #chatHost .chat-placeholder{
      margin:0!important;
      border:0!important;
      border-radius:0!important;
    }
  `;
  document.head.appendChild(style);
})();
