import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PUBLISHABLE_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function page() {
  const config = JSON.stringify({ url: SUPABASE_URL, key: PUBLISHABLE_KEY });
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Autoriser TodoAI</title>
  <style>
    :root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f6f7fb;color:#111827}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 0,#e0e7ff 0,transparent 38%),#f6f7fb}
    main{width:min(440px,100%);padding:28px;border:1px solid #dde3ed;border-radius:20px;background:rgba(255,255,255,.96);box-shadow:0 28px 80px rgba(30,41,59,.14)}
    .brand{display:flex;align-items:center;gap:11px;margin-bottom:26px;font-size:25px;font-weight:750;letter-spacing:-.8px}.mark{display:grid;width:34px;height:34px;place-items:center;border-radius:11px;background:#6366f1;color:white;font-size:18px;box-shadow:0 8px 22px #6366f155}
    h1{margin:0 0 8px;font-size:23px;letter-spacing:-.45px}p{margin:0;color:#64748b;line-height:1.55}.copy{margin-bottom:24px}
    form,.stack{display:grid;gap:15px}label{display:grid;gap:7px;font-size:13px;font-weight:650}input{width:100%;height:44px;padding:0 12px;border:1px solid #d5ddea;border-radius:10px;background:white;color:#111827;font:inherit;outline:none}input:focus{border-color:#6366f1;box-shadow:0 0 0 3px #6366f122}
    button{height:44px;padding:0 16px;border:0;border-radius:10px;background:#6366f1;color:white;font:inherit;font-weight:680;cursor:pointer}button:hover{background:#4f46e5}button.secondary{border:1px solid #d5ddea;background:white;color:#334155}button.secondary:hover{background:#f8fafc}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:22px}
    .client{display:grid;gap:8px;margin:20px 0;padding:16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.client strong{font-size:14px}.scopes{display:flex;flex-wrap:wrap;gap:6px}.scope{padding:4px 8px;border-radius:99px;background:#eef2ff;color:#4338ca;font-size:11px;font-weight:650}
    .message{margin-top:16px;padding:11px 12px;border-radius:10px;background:#fef2f2;color:#b91c1c;font-size:13px}.hidden{display:none!important}.secure{margin-top:20px;text-align:center;font-size:11px}
    @media(prefers-color-scheme:dark){:root{background:#0b1220;color:#f8fafc}body{background:radial-gradient(circle at 50% 0,#312e8166 0,transparent 38%),#0b1220}main{border-color:#26354b;background:#111b2e;box-shadow:0 28px 80px #0006}p{color:#94a3b8}input,.client,button.secondary{border-color:#334155;background:#172237;color:#f8fafc}button.secondary:hover{background:#1e293b}.client{background:#0f172a}.scope{background:#312e81;color:#ddd6fe}}
  </style>
</head>
<body>
  <main>
    <div class="brand"><span class="mark">✓</span>TodoAI</div>
    <section id="login" class="hidden">
      <h1>Connexion à TodoAI</h1>
      <p class="copy">Connectez-vous avec le même compte que dans l’application Linux.</p>
      <form id="login-form">
        <label>Adresse e-mail<input id="email" type="email" autocomplete="email" required /></label>
        <label>Mot de passe<input id="password" type="password" autocomplete="current-password" minlength="8" required /></label>
        <button type="submit">Se connecter et continuer</button>
      </form>
    </section>
    <section id="consent" class="hidden">
      <h1>Autoriser ChatGPT ?</h1>
      <p class="copy">ChatGPT souhaite utiliser TodoAI pour lire et gérer vos tâches.</p>
      <div class="client"><strong id="client-name">Application</strong><div id="scopes" class="scopes"></div></div>
      <p>Vous pourrez retirer cet accès ultérieurement depuis les réglages de votre compte.</p>
      <div class="actions"><button id="deny" class="secondary" type="button">Refuser</button><button id="approve" type="button">Autoriser</button></div>
    </section>
    <section id="confirmed" class="hidden">
      <h1>Compte confirmé</h1>
      <p>Votre compte TodoAI est prêt. Vous pouvez fermer cette page et vous connecter dans l’application Linux.</p>
    </section>
    <div id="error" class="message hidden" role="alert"></div>
    <p class="secure">Autorisation sécurisée par Supabase OAuth 2.1</p>
  </main>
  <script type="module">
    import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm";
    const config=${config};
    const supabase=createClient(config.url,config.key,{auth:{persistSession:true,detectSessionInUrl:true,storageKey:"todoai-web-auth-v1"}});
    const params=new URLSearchParams(location.search);
    const authorizationId=params.get("authorization_id");
    const login=document.querySelector("#login");
    const consent=document.querySelector("#consent");
    const confirmed=document.querySelector("#confirmed");
    const errorBox=document.querySelector("#error");
    const show=(node)=>{for(const section of [login,consent,confirmed])section.classList.add("hidden");node.classList.remove("hidden")};
    const fail=(message)=>{errorBox.textContent=message;errorBox.classList.remove("hidden")};
    async function render(){
      errorBox.classList.add("hidden");
      if(!authorizationId){show(confirmed);return}
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){show(login);return}
      const {data,error}=await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if(error){fail(error.message);show(consent);return}
      if(data && !("authorization_id" in data) && data.redirect_url){location.href=data.redirect_url;return}
      document.querySelector("#client-name").textContent=data?.client?.name || "ChatGPT";
      const scopes=document.querySelector("#scopes");scopes.replaceChildren();
      for(const scope of (data?.scope || "email").split(" ").filter(Boolean)){const item=document.createElement("span");item.className="scope";item.textContent=scope;scopes.append(item)}
      show(consent);
    }
    document.querySelector("#login-form").addEventListener("submit",async(event)=>{
      event.preventDefault();
      const email=document.querySelector("#email").value;
      const password=document.querySelector("#password").value;
      const {error}=await supabase.auth.signInWithPassword({email,password});
      if(error){fail(error.message);return}
      await render();
    });
    document.querySelector("#approve").addEventListener("click",async()=>{
      const {data,error}=await supabase.auth.oauth.approveAuthorization(authorizationId);
      if(error){fail(error.message);return}location.href=data.redirect_url;
    });
    document.querySelector("#deny").addEventListener("click",async()=>{
      const {data,error}=await supabase.auth.oauth.denyAuthorization(authorizationId);
      if(error){fail(error.message);return}location.href=data.redirect_url;
    });
    await render();
  </script>
</body>
</html>`;
}

Deno.serve(() => new Response(page(), {
  headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": `default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; connect-src ${SUPABASE_URL}; img-src 'self' data:`,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  },
}));
