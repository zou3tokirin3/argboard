import assert from 'node:assert/strict';

// Exercise the real bundle; count calls before updateCard's no-op filtering.
export async function instrumentEdits(page) {
  await page.route('**/bundle.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const needle = 'async function updateCard(id, patch) {';
    assert.ok(source.includes(needle), 'updateCard instrumentation must attach');
    assert.ok(source.includes('async function updateLink(linkId, patch) {'), 'updateLink instrumentation must attach');
    await route.fulfill({ response, body: source.replace(needle,
      `${needle} (globalThis.__t098Calls ??= []).push({id, patch});`).replace('async function updateLink(linkId, patch) {', 'async function updateLink(linkId, patch) { (globalThis.__t098Calls ??= []).push({id: linkId, patch});') });
  });
}
export const state = page => page.evaluate(() => window.__argboardTest.getState());
export const calls = page => page.evaluate(() => window.__t098Calls ?? []);
export async function select(page, id) {
  await page.evaluate(id => window.__argboardTest.selectSingleCard(id), id);
  await page.waitForFunction(id => document.querySelector('[data-testid="inspector-title"]')?.value === window.__argboardTest.getState().cards.find(c => c.id === id)?.title, id);
}
export async function verifyEdits(page, origin, shot = async () => {}) {
  const passed = [];
  await instrumentEdits(page);
  await page.goto(`${origin}/?test=1`);
  await page.waitForFunction(() => window.__argboardTest?.getState()?.id);
  const [a, b] = await page.evaluate(async () => {
    const api = window.__argboardTest;
    const a = await api.addCard('確定テストA'), b = await api.addCard('切替先B');
    await api.setAppMode('contemplate');
    await api.placeCardOnBoard(a, 100, 100);
    await api.placeCardOnBoard(b, 400, 100);
    return [a, b];
  });
  await select(page, a);
  const title = page.getByTestId('inspector-title');
  const body = page.getByTestId('inspector-body');
  await title.fill('入力中・未保存');
  await page.waitForTimeout(650);
  assert.equal((await calls(page)).length, 0);
  await shot('01-idle-1280');
  passed.push('idle: zero updateCard calls after 650ms');
  // Synthetic second draft proves one blur does not flush other fields.
  await body.evaluate(el => { el.value = '別欄の下書き'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await title.press('Enter');
  await page.waitForFunction(() => window.__t098Calls?.length === 1);
  assert.deepEqual((await calls(page))[0].patch, { title: '入力中・未保存' });
  assert.equal((await state(page)).cards.find(c => c.id === a).body, undefined);
  await body.focus(); await body.press('Tab');
  await page.waitForFunction(() => window.__t098Calls?.length === 2);
  assert.deepEqual((await calls(page))[1].patch, { body: '別欄の下書き' });
  passed.push('field isolation: separate title/body patches');
  await shot('03-field-only-1280');
  for (const [testId, field, value] of [['inspector-url','url','https://example.invalid/'], ['inspector-story-when','storyWhen','12:34'], ['inspector-story-until','storyUntil','13:00']]) {
    const input = page.getByTestId(testId), before = (await calls(page)).length;
    await input.fill(value); await input.press('Enter');
    await page.waitForFunction(n => window.__t098Calls?.length === n, before + 1);
    assert.deepEqual((await calls(page)).at(-1).patch, { [field]: value });
  }
  passed.push('URL and both dates: isolated Enter commits');
  const beforeIme = (await calls(page)).length;
  await title.fill('日本語変換中');
  await title.dispatchEvent('compositionstart', { data: 'にほんご' });
  await title.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  await page.waitForTimeout(650);
  assert.equal(await title.evaluate(el => el === document.activeElement), true);
  assert.equal((await calls(page)).length, beforeIme);
  await shot('02-simulated-composition-1280');
  await title.dispatchEvent('compositionend', { data: '日本語' });
  await title.press('Enter');
  await page.waitForFunction(n => window.__t098Calls?.length === n, beforeIme + 1);
  passed.push('SIMULATED composition Enter: no commit or blur; normal Enter commits');
  await body.fill('切替で強制保存');
  await select(page, b); // programmatic selection, without a browser blur first
  await page.waitForFunction(id => window.__argboardTest.getState().cards.find(c => c.id === id)?.body === '切替で強制保存', a);
  assert.equal((await state(page)).cards.find(c => c.id === b).body, undefined);
  passed.push('card switch: pending field saved to old card only');
  await shot('04-card-switch-1280');
  await page.evaluate(async ([a, b]) => {
    await window.__argboardTest.setAppMode('contemplate');
    await window.__argboardTest.connectCards(a, b);
  }, [a, b]);
  await select(page, a);
  const link = (await state(page)).links.find(l => l.from === a && l.to === b);
  // Empty input presence cannot distinguish mount from completed link initialization.
  const initialLabel = 'fixture-initial-label';
  await page.evaluate(({ id, label }) => window.__argboardTest.updateLink(id, { label }), { id: link.id, label: initialLabel });
  await page.getByTestId('card-links').selectOption(link.id);
  const label = page.getByTestId('link-label-input');
  await page.waitForFunction(value => document.querySelector('[data-testid="link-label-input"]')?.value === value, initialLabel);
  const labelCalls = (await calls(page)).length;
  await label.fill('確定ラベル'); await page.waitForTimeout(650);
  assert.equal(await label.inputValue(), '確定ラベル', 'label draft survives idle');
  assert.equal((await calls(page)).length, labelCalls, 'label idle makes zero update attempts');
  assert.equal((await state(page)).links.find(l => l.id === link.id).label, initialLabel);
  await label.press('Enter');
  await page.waitForFunction(id => window.__argboardTest.getState().links.find(l => l.id === id)?.label === '確定ラベル', link.id);
  assert.deepEqual((await calls(page)).slice(labelCalls), [{ id: link.id, patch: { label: '確定ラベル' } }]);
  const clearCalls = (await calls(page)).length;
  await label.fill(''); await label.press('Enter');
  await page.waitForFunction(id => { const link = window.__argboardTest.getState().links.find(l => l.id === id); return !!link && link.label === undefined; }, link.id);
  assert.deepEqual((await calls(page)).slice(clearCalls), [{ id: link.id, patch: { label: '' } }]);
  passed.push('link label: idle does not save, Enter commits');
  return { passed, a, b };
}

// Called against a real local Wrangler room by phase1/evidence.mjs (two contexts).
export async function verifyPeerRestore(a, b, id, linkId, pause = async () => {}) {
  const passed = [];
  for (const kind of ['card', 'link']) {
    for (const page of [a, b]) {
      await select(page, id);
      if (kind === 'link') await page.getByTestId('card-links').selectOption(linkId);
    }
    const testId = kind === 'card' ? 'inspector-title' : 'link-label-input';
    const local = a.getByTestId(testId), peer = b.getByTestId(testId);
    const read = page => page.evaluate(({ kind, id, linkId }) => {
      const s = window.__argboardTest.getState();
      return kind === 'card' ? s.cards.find(c => c.id === id).title : s.links.find(l => l.id === linkId).label;
    }, { kind, id, linkId });
    const start = await local.inputValue(), before = (await calls(a)).length;
    await local.fill('local pending');
    await peer.fill(`peer ${kind}`); await peer.press('Enter');
    await a.waitForFunction(({ kind, id, linkId }) => {
      const s = window.__argboardTest.getState();
      return (kind === 'card' ? s.cards.find(c => c.id === id).title : s.links.find(l => l.id === linkId).label) === `peer ${kind}`;
    }, { kind, id, linkId });
    assert.equal(await local.inputValue(), 'local pending');
    if (kind === 'card') {
      await b.getByTestId('inspector-body').fill('peer body');
      await b.getByTestId('inspector-body').press('Enter');
      await a.waitForFunction(() => document.querySelector('[data-testid="inspector-body"]')?.value === 'peer body');
    }
    await pause(`${kind}: peer saved; focused draft protected; other fields follow`);
    await local.fill(start); await local.press('Tab');
    await a.waitForFunction(({ testId, kind }) => document.querySelector(`[data-testid="${testId}"]`)?.value === `peer ${kind}`, { testId, kind });
    assert.equal((await calls(a)).length, before);
    assert.equal(await read(a), `peer ${kind}`); assert.equal(await read(b), `peer ${kind}`);
    await pause(`${kind}: restored starting value + blur; peer value survives; zero local writes`);
    await local.fill(`own ${kind}`); await local.press('Enter');
    await b.waitForFunction(({ testId, kind }) => document.querySelector(`[data-testid="${testId}"]`)?.value === `own ${kind}`, { testId, kind });
    assert.equal((await calls(a)).length, before + 1);
    assert.deepEqual((await calls(a)).at(-1).patch, kind === 'card' ? { title: 'own card' } : { label: 'own link' });
    await pause(`${kind}: changed draft commits only its own field to both peers`);
    passed.push(`${kind} B1: peer retained on restore; display reset; changed draft commits`);
  }
  return passed;
}
