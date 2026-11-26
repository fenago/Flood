// Account screens: sign in, create account, forgot password, new password, signed-in view.
// Signing in is optional; nothing else in the app depends on it. All text is set with textContent (dom.js).
import { h } from '../ui/dom.js';
import * as auth from './client.js';

export const T = {
  TITLE: 'Account',
  LOADING: 'Checking your account…',
  UNAVAILABLE: 'Sign-in unavailable right now. The flood outlook and beach score still work without an account.',
  SIGNIN: 'Sign In',
  SIGNUP: 'Create Account',
  FORGOT: 'Reset Password',
  NEWPW: 'Choose a New Password',
  SIGNED_IN: 'You are signed in',
  EMAIL: 'Email',
  PASSWORD: 'Password',
  NEW_PASSWORD: 'New password',
  PW_HINT: 'At least 8 characters.',
  SHOW: 'Show', HIDE: 'Hide',
  BTN_SIGNIN: 'Sign In', BTN_SIGNING: 'Signing in…',
  BTN_SIGNUP: 'Create Account', BTN_SIGNUPING: 'Creating account…',
  BTN_RESET: 'Send Reset Link', BTN_RESETTING: 'Sending…',
  BTN_SAVE: 'Save New Password', BTN_SAVING: 'Saving…',
  BTN_GOOGLE: 'Continue with Google',
  BTN_SIGNOUT: 'Sign Out', BTN_SIGNINGOUT: 'Signing out…',
  LINK_FORGOT: 'Forgot password?',
  LINK_CREATE: 'New here? Create an account',
  LINK_HAVE: 'Already have an account? Sign in',
  LINK_BACK: 'Back to sign in',
  OR: 'or',
  OPTIONAL: 'An account is optional. Weather, flood and beach information work without one.',
  CONFIRM_TITLE: 'Check your email',
  CONFIRM_BODY: (email) => `Check your email to confirm your account. We sent a link to ${email}. Open it on this device, then sign in.`,
  RESET_SENT: (email) => `If ${email} has an account, a reset link is on its way. Open it on this device.`,
  PW_SAVED: 'Password saved. You are signed in.',
  GOOGLE_GO: 'Opening Google…',
  CALLBACK_ERR: "Sign-in didn't finish. Please try again.",
  ERR: {
    unavailable: 'Sign-in unavailable right now. The flood outlook and beach score still work without an account.',
    invalid_credentials: "That email and password don't match. Check them and try again, or reset your password.",
    email_not_confirmed: 'Check your email to confirm your account, then sign in.',
    network: "Can't reach the sign-in service. Check your connection and try again.",
    weak_password: 'Choose a stronger password. Use at least 8 characters.',
    rate_limited: 'Too many tries. Wait a minute, then try again.',
    user_exists: 'Check your email to confirm your account, or sign in if you already have one.',
    unknown: 'Something went wrong. Please try again.',
  },
  V_EMAIL: 'Enter your email address.',
  V_EMAIL_BAD: 'Enter a valid email address, like name@example.com.',
  V_PW: 'Enter your password.',
  V_PW_SHORT: 'Your password needs at least 8 characters.',
};
const errText = (code) => T.ERR[code] ?? T.ERR.unknown;
const MIN_PW = 8;

// Set by main.js when the emailed reset link brings the user back, or when a sign-in redirect fails.
let pendingRecovery = false;
let pendingError = '';
export const markRecovery = () => { pendingRecovery = true; };
export const markCallbackError = () => { pendingError = T.CALLBACK_ERR; };

/** Settings-row content: link to the account screen. */
export function accountRow(email) {
  return h('div', {},
    h('p', { class: 'lead', text: T.TITLE }),
    h('p', { class: 'muted', text: email ? `Signed in as ${email}` : 'Sign in or create a free account. It is optional.' }),
    h('a', { class: 'btn secondary link-as-btn', id: 'account-link', href: '#/account' }, email ? 'Manage Account' : 'Sign In or Create Account'));
}

function field({ id, label, type = 'text', autocomplete, hint, minlength }) {
  const input = h('input', { class: 'field', id, name: id, type, autocomplete, autocapitalize: 'none', spellcheck: 'false', 'aria-describedby': hint ? `${id}-hint` : null, minlength });
  if (type === 'email') input.setAttribute('inputmode', 'email');
  const wrap = h('div', { class: 'field-row' }, h('label', { for: id, text: label }));
  if (type === 'password') {
    const toggle = h('button', { type: 'button', class: 'link-btn pw-toggle', 'aria-pressed': 'false', 'aria-controls': id, 'aria-label': `Show ${label.toLowerCase()}`, onclick: () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.textContent = show ? T.HIDE : T.SHOW;
    } }, T.SHOW);
    wrap.append(h('div', { class: 'pw-wrap' }, input, toggle));
  } else wrap.append(input);
  if (hint) wrap.append(h('p', { class: 'muted small', id: `${id}-hint`, text: hint }));
  return { wrap, input };
}

const googleMark = () => h('span', { class: 'g-mark', 'aria-hidden': 'true', text: 'G' });

export function renderAccount() {
  const root = h('section', { class: 'auth', 'aria-labelledby': 'auth-title' });
  let mode = 'loading';
  let session = null;
  let email = '';
  let off = () => {};

  const setBusy = (btn, busy, idle, working) => {
    btn.disabled = busy; btn.textContent = busy ? working : idle;
    root.querySelectorAll('.auth-extra').forEach((b) => { b.disabled = busy; });
    root.setAttribute('aria-busy', String(busy));
  };

  function show(next, { error = '', info = '' } = {}) {
    mode = next;
    root.replaceChildren();
    const title = { loading: T.TITLE, unavailable: T.TITLE, signin: T.SIGNIN, signup: T.SIGNUP, forgot: T.FORGOT, recovery: T.NEWPW, confirm: T.CONFIRM_TITLE, signedin: T.SIGNED_IN }[next];
    const heading = h('h2', { id: 'auth-title', tabindex: '-1', text: title });
    const errEl = h('p', { class: 'auth-error', id: 'auth-error', role: 'alert', text: error });
    const infoEl = h('p', { class: 'auth-info', id: 'auth-info', role: 'status', text: info });
    const setErr = (t) => { errEl.textContent = t; infoEl.textContent = ''; };
    const goto = (m) => show(m);
    const linkBtn = (text, m, id) => h('button', { type: 'button', class: 'link-btn auth-extra', id, onclick: () => goto(m) }, text);
    root.append(heading, errEl, infoEl);

    if (next === 'loading') root.append(h('p', { role: 'status', text: T.LOADING }));
    else if (next === 'unavailable') root.append(h('p', { class: 'card', id: 'auth-unavailable', text: T.UNAVAILABLE }));
    else if (next === 'confirm') {
      root.append(h('div', { class: 'card' }, h('p', { id: 'confirm-body', text: T.CONFIRM_BODY(email) }), linkBtn(T.LINK_BACK, 'signin', 'back-signin')));
    } else if (next === 'signedin') {
      const out = h('button', { type: 'button', class: 'btn', id: 'signout-btn' }, T.BTN_SIGNOUT);
      out.addEventListener('click', async () => {
        setBusy(out, true, T.BTN_SIGNOUT, T.BTN_SIGNINGOUT);
        const r = await auth.signOut();
        if (!r.ok) { setBusy(out, false, T.BTN_SIGNOUT, ''); setErr(errText(r.code)); return; }
        session = null; show('signin', { info: 'You are signed out.' });
      });
      root.append(h('div', { class: 'card' },
        h('p', { class: 'muted', text: 'Signed in as' }), h('p', { class: 'lead', id: 'account-email', text: session?.user?.email ?? email }),
        out, h('p', { class: 'muted small', text: T.OPTIONAL })));
    } else {
      const form = h('form', { class: 'card auth-form', id: `form-${next}`, novalidate: true });
      const em = field({ id: 'auth-email', label: T.EMAIL, type: 'email', autocomplete: 'email' });
      em.input.value = email;
      let pw = null;
      if (next === 'signin') pw = field({ id: 'auth-password', label: T.PASSWORD, type: 'password', autocomplete: 'current-password' });
      if (next === 'signup') pw = field({ id: 'auth-password', label: T.PASSWORD, type: 'password', autocomplete: 'new-password', hint: T.PW_HINT, minlength: MIN_PW });
      if (next === 'recovery') pw = field({ id: 'auth-password', label: T.NEW_PASSWORD, type: 'password', autocomplete: 'new-password', hint: T.PW_HINT, minlength: MIN_PW });
      const [idle, working] = { signin: [T.BTN_SIGNIN, T.BTN_SIGNING], signup: [T.BTN_SIGNUP, T.BTN_SIGNUPING], forgot: [T.BTN_RESET, T.BTN_RESETTING], recovery: [T.BTN_SAVE, T.BTN_SAVING] }[next];
      const submit = h('button', { type: 'submit', class: 'btn', id: 'auth-submit' }, idle);
      if (next !== 'recovery') form.append(em.wrap);
      if (pw) form.append(pw.wrap);
      form.append(submit);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        email = em.input.value.trim();
        if (next !== 'recovery') {
          if (!email) { setErr(T.V_EMAIL); em.input.focus(); return; }
          if (!/^\S+@\S+\.\S+$/.test(email)) { setErr(T.V_EMAIL_BAD); em.input.focus(); return; }
        }
        const pass = pw ? pw.input.value : '';
        if (pw && !pass) { setErr(T.V_PW); pw.input.focus(); return; }
        if ((next === 'signup' || next === 'recovery') && pass.length < MIN_PW) { setErr(T.V_PW_SHORT); pw.input.focus(); return; }
        setErr(''); setBusy(submit, true, idle, working);
        const r = next === 'signin' ? await auth.signIn(email, pass)
          : next === 'signup' ? await auth.signUp(email, pass)
          : next === 'recovery' ? await auth.updatePassword(pass)
          : await auth.resetPassword(email);
        if (!r.ok) {
          setBusy(submit, false, idle, working);
          if (r.code === 'unavailable') { show('unavailable'); return; }
          setErr(errText(r.code)); return;
        }
        if (next === 'signin') { session = r.session; show('signedin'); }
        else if (next === 'signup') { if (r.needsConfirmation) show('confirm'); else { session = await auth.getSession(); show('signedin'); } }
        else if (next === 'recovery') { session = await auth.getSession(); show('signedin', { info: T.PW_SAVED }); }
        else { setBusy(submit, false, idle, working); infoEl.textContent = T.RESET_SENT(email); }
      });
      root.append(form);

      if (next === 'signin' || next === 'signup') {
        const g = h('button', { type: 'button', class: 'btn secondary google-btn auth-extra', id: 'google-btn' }, googleMark(), T.BTN_GOOGLE);
        g.addEventListener('click', async () => {
          setErr(''); g.disabled = true; infoEl.textContent = T.GOOGLE_GO;
          const r = await auth.signInWithGoogle();
          if (!r.ok) { g.disabled = false; infoEl.textContent = ''; if (r.code === 'unavailable') show('unavailable'); else setErr(errText(r.code)); }
        });
        root.append(h('p', { class: 'or muted small', 'aria-hidden': 'true', text: T.OR }), g);
      }
      const links = h('div', { class: 'auth-links' });
      if (next === 'signin') links.append(linkBtn(T.LINK_FORGOT, 'forgot', 'to-forgot'), linkBtn(T.LINK_CREATE, 'signup', 'to-signup'));
      else if (next === 'signup') links.append(linkBtn(T.LINK_HAVE, 'signin', 'to-signin'));
      else if (next === 'forgot') links.append(linkBtn(T.LINK_BACK, 'signin', 'to-signin'));
      root.append(links);
      if (next === 'signin' || next === 'signup') root.append(h('p', { class: 'muted small', text: T.OPTIONAL }));
    }
  }

  async function start() {
    show('loading');
    if (!(await auth.isAvailable())) { show('unavailable'); return; }
    session = await auth.getSession();
    const err = pendingError; pendingError = '';
    if (pendingRecovery) { pendingRecovery = false; show('recovery'); }
    else if (session) show('signedin', { error: err });
    else show('signin', { error: err });
    root.querySelector('#auth-title')?.focus();
    off = auth.onAuthChange((event, s) => {
      if (!root.isConnected) { off(); return; }
      if (event === 'PASSWORD_RECOVERY') { session = s; show('recovery'); return; }
      if (mode === 'recovery' || mode === 'confirm') return;
      if (event === 'SIGNED_OUT' && mode === 'signedin') { session = null; show('signin'); }
      else if (s && mode !== 'signedin' && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) { session = s; show('signedin'); }
    });
  }
  start();
  return root;
}
