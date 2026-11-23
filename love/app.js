import {localDate, randomId, parseReviewId} from './logic.js';
const $ = id => document.getElementById(id);
let data, activeId = null, activeDay = null, busy = false, latest = null;
const storageKey = 'mountain-love-v2:last-draw';
const state = () => document.querySelector('input[name="state"]:checked').value;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function text(id, value) { $(id).textContent = value; }
function storedDraw() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Number.isInteger(saved?.id) && parseReviewId(String(saved.id)) && /^\d{4}-\d{2}-\d{2}$/.test(saved.day)) return saved;
  } catch {}
  return null;
}
function remember(draw) {
  try { localStorage.setItem(storageKey, JSON.stringify(draw)); return true; } catch { return false; }
}
function setBusy(value) {
  busy = value;
  $('draw-button').disabled = value;
  $('redraw-button').disabled = value;
}
function render(id, move = true, resultDay = localDate(new Date())) {
  const stick = data.sticks.find(s => s.id === id);
  if (!stick) return;
  activeId = id; activeDay = resultDay;
  const context = stick.contexts[state()];
  text('result-mode', `${activeDay} · 留給你的一支籤`);
  text('stick-number', `第 ${id} 籤`); text('stick-grade', `${stick.grade}籤`);
  text('result-title', stick.title);
  text('poem-source', `${stick.poemType}｜${stick.poemSource}`);
  if (stick.poemSourceUrl) {
    text('poem-source', `${stick.poemType}｜`);
    const source = document.createElement('a');
    source.textContent = stick.poemSource; source.href = stick.poemSourceUrl;
    source.target = '_blank'; source.rel = 'noopener noreferrer';
    $('poem-source').append(source);
  }
  $('poem').replaceChildren(...stick.poem.map(line => { const p = document.createElement('p'); p.textContent = line; return p; }));
  text('poem-meaning', stick.poemMeaning);
  text('answer', stick.answer); text('interpretation', stick.interpretation);
  text('context-label', `給${data.states[state()]}的你`); text('context-answer', context.answer);
  text('context-reading', context.reading); text('context-action', context.action);
  $('result').hidden = false;
  if (move) { $('result').focus({preventScroll: true}); $('result').scrollIntoView({behavior: reduce ? 'instant' : 'smooth', block: 'start'}); }
}
$('draw-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!data || busy) return;
  setBusy(true); text('draw-status', '先想著心裡的事，籤筒正在輕輕搖動。');
  $('bucket').classList.add('shaking'); text('draw-button', '搖籤中');
  try {
    const id = randomId(crypto, latest?.id);
    await new Promise(resolve => setTimeout(resolve, reduce ? 0 : 900));
    latest = {id, day: localDate(new Date())};
    const saved = remember(latest);
    text('draw-note', saved
      ? '每次都能重新搖籤，連續兩次不重複。切換感情狀態會保留這支籤。'
      : '每次都能重新搖籤。目前無法儲存，關閉頁面後不會保留上次的籤。');
    text('draw-status', `第 ${id} 籤已搖出，可以慢慢讀。`);
    text('draw-button', '再搖一支籤'); render(id, true, latest.day);
  } catch {
    text('draw-status', '這次沒有成功搖出籤，請再試一次。'); text('draw-button', '搖一支籤');
  } finally { $('bucket').classList.remove('shaking'); setBusy(false); }
});
document.querySelectorAll('input[name="state"]').forEach(input => input.addEventListener('change', () => {
  if (activeId) { render(activeId, false, activeDay); text('draw-status', `已切換為${data.states[state()]}的解讀，第 ${activeId} 籤保留。`); }
}));
$('back-to-form').addEventListener('click', () => {
  document.querySelector('input[name="state"]:checked').focus({preventScroll: true});
  $('draw-form').scrollIntoView({behavior: reduce ? 'instant' : 'smooth', block: 'start'});
});
async function init() {
  try {
    const response = await fetch('./data.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('data unavailable');
    data = await response.json();
    if (data.sticks?.length !== 100 || data.sticks.some(stick => typeof stick.poemMeaning !== 'string')) throw new Error('incomplete data');
    latest = storedDraw(); setBusy(false);
    text('draw-button', latest ? '再搖一支籤' : '搖一支籤');
    if (latest) render(latest.id, false, latest.day);
  } catch {
    $('load-error').hidden = false;
    text('load-error', location.protocol === 'file:' ? '請從本機預覽網址開啟，才能載入籤文資料。' : '籤文暫時無法載入，請重新整理頁面。');
    text('draw-button', '籤文未載入'); setBusy(true);
  }
}
init();
