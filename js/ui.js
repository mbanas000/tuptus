'use strict';
// Interfejs: HUD (gwiazdki, przyjaciele, serduszka, czas), podpowiedzi, komunikaty, menu, pauza i wyniki.
G.ui = (() => {
  const $ = (id) => document.getElementById(id);
  const HEART = '<path class="h" d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.2 0 3.6 1.3 5.4 3.3 1.8-2 3.2-3.3 5.4-3.3 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21z"/><path class="shine" d="M6.3 7.3c-1.2.3-1.9 1.4-1.8 2.5.1.6.8.7 1 .1.3-.8.8-1.3 1.4-1.5.6-.2.4-1.2-.6-1.1z"/>';
  let toastTimer = null, lastHint = null, lastTime = -1;

  function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  return {
    init(handlers) {
      const click = (id, fn) => $(id).addEventListener('click', () => { G.sfx.init(); G.sfx.play('click'); fn(); });
      click('btn-play', handlers.play);
      click('btn-help', () => show('help', true));
      click('btn-help-close', () => show('help', false));
      click('btn-resume', handlers.resume);
      click('btn-pause-help', () => show('help', true));
      click('btn-restart', handlers.restart);
      click('btn-again', handlers.restart);
      const h = $('hearts');
      h.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        s.setAttribute('viewBox', '0 0 24 24');
        s.innerHTML = HEART;
        s.classList.add('full');
        h.appendChild(s);
      }
    },
    loaded() {
      const l = $('loading');
      l.classList.add('fade');
      setTimeout(() => l.classList.add('hidden'), 700);
    },
    hud(on) { show('hud', on); },
    menu(on) { show('menu', on); },
    help(on) { show('help', on); },
    pause(on) { show('pause', on); if (!on) show('help', false); },
    isHelpOpen() { return !$('help').classList.contains('hidden'); },
    setStars(n, total, doBump) {
      $('stars-count').textContent = `${n}/${total}`;
      if (doBump) bump($('hud-stars'));
    },
    // Panel pory dnia: przełącznik cyklu, kafelki pór i napis „Teraz”.
    dayPanel(on) { show('daypanel', on); if (on) this.syncDay(); },
    isDayOpen() { return !$('daypanel').classList.contains('hidden'); },
    syncDay() {
      const D = G.daytime;
      $('day-cycle').setAttribute('aria-checked', D.cycle ? 'true' : 'false');
      $('day-now').textContent = D.name;
      const active = D.PRESETS.find((p) => p.name === D.name);
      document.querySelectorAll('.day-tile').forEach((b) => b.classList.toggle('on', !!active && b.dataset.id === active.id));
    },
    setGolds(n, total, doBump) {
      $('golds-count').textContent = `${n}/${total}`;
      if (doBump) bump($('hud-golds'));
    },
    intro(on) {
      const el = $('intro');
      if (on) { el.classList.remove('hidden', 'out'); }
      else { el.classList.add('out'); setTimeout(() => el.classList.add('hidden'), 600); }
    },
    // Ikonki przyjaciół w HUD: szare, dopóki ich nie odnajdziesz.
    setupFriends(friends) {
      const box = $('hud-friends');
      box.innerHTML = '';
      const hex = (c) => `#${new THREE.Color(c).getHexString()}`;
      friends.forEach((f) => {
        const body = hex(f.look.body ?? G.PAL.bunny), ear = hex(f.look.accent ?? G.PAL.bunnyGray);
        const el = document.createElement('div');
        el.className = 'fbunny';
        el.title = f.name;
        el.innerHTML = `<svg viewBox="0 0 24 24"><ellipse cx="8.2" cy="6.5" rx="2.4" ry="5.2" fill="${ear}"/><ellipse cx="15.8" cy="6.5" rx="2.4" ry="5.2" fill="${ear}"/>
          <ellipse cx="8.2" cy="7" rx="1.1" ry="3.6" fill="#f5b3c1"/><ellipse cx="15.8" cy="7" rx="1.1" ry="3.6" fill="#f5b3c1"/>
          <circle cx="12" cy="15" r="7.2" fill="${body}"/><circle cx="9.3" cy="14.6" r="1.05" fill="#2b2633"/><circle cx="14.7" cy="14.6" r="1.05" fill="#2b2633"/>
          <path d="M10.6 17.1q1.4 1.2 2.8 0" stroke="#2b2633" stroke-width="0.9" fill="none" stroke-linecap="round"/>
          <circle cx="7.4" cy="17" r="1.1" fill="#f7a9b8" opacity="0.8"/><circle cx="16.6" cy="17" r="1.1" fill="#f7a9b8" opacity="0.8"/></svg>`;
        f.hudEl = el;
        box.appendChild(el);
      });
    },
    friendFound(f) {
      if (!f.hudEl) return;
      f.hudEl.classList.add('found');
      bump($('hud-friends'));
    },
    // Gwiazdka „leci” z miejsca zebrania do licznika w rogu.
    flyStar(x, y, done) {
      const target = $('hud-stars').querySelector('.ico').getBoundingClientRect();
      const el = document.createElement('div');
      el.className = 'fly-star';
      el.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';
      el.style.transform = `translate(${x - 22}px, ${y - 22}px) scale(1.25)`;
      document.body.appendChild(el);
      let finished = false;
      const finish = () => { if (finished) return; finished = true; el.remove(); done(); };
      el.getBoundingClientRect();
      setTimeout(() => {
        el.style.transform = `translate(${target.left + target.width / 2 - 22}px, ${target.top + target.height / 2 - 22}px) scale(0.7) rotate(200deg)`;
      }, 16);
      el.addEventListener('transitionend', finish);
      setTimeout(finish, 800);
    },
    setHearts(n, lost) {
      [...$('hearts').children].forEach((s, i) => {
        s.classList.toggle('full', i < n);
        s.classList.toggle('empty', i >= n);
        if (lost && i === n) { s.classList.remove('lost'); void s.getBoundingClientRect(); s.classList.add('lost'); }
      });
    },
    setTime(sec) {
      const s = Math.floor(sec);
      if (s === lastTime) return;
      lastTime = s;
      $('timer').textContent = G.u.formatTime(s);
    },
    hint(html) {
      if (html === lastHint) return;
      lastHint = html;
      const el = $('hint');
      if (html) { el.innerHTML = html; el.classList.add('show'); } else el.classList.remove('show');
    },
    toast(text, ms = 2400, pink = false) {
      const el = $('toast');
      el.textContent = text;
      el.classList.toggle('pink', pink);
      el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.classList.remove('show'), ms);
    },
    results(r) {
      this.hint(null);
      $('rv1').textContent = `${r.stars}/${r.starsTotal}`;
      $('rv2').textContent = `${r.friends}/${r.friendsTotal}`;
      $('rtarget').textContent = G.u.formatTime(r.target);
      $('rv3').textContent = G.u.formatTime(r.time);
      const ok = [r.stars >= r.starsTotal, r.friends >= r.friendsTotal, r.time <= r.target];
      ok.forEach((v, i) => $(`rc${i + 1}`).classList.toggle('ok', v));
      $('rv4').textContent = `${r.golds}/${r.goldsTotal}`;
      $('rc4').classList.toggle('ok', r.golds >= r.goldsTotal);
      ['rs1', 'rs2', 'rs3'].forEach((id) => $(id).classList.remove('on'));
      show('results', true);
      let shown = 0;
      ok.forEach((v, i) => {
        if (!v) return;
        const order = shown++;
        setTimeout(() => { $(`rs${order + 1}`).classList.add('on'); G.sfx.play('resultStar', order); }, 500 + order * 450);
      });
    },
  };
})();
