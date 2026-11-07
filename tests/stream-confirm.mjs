import assert from 'node:assert/strict';
import { calls, state } from './confirm-edit.mjs';

export const streamInput = p => p.getByTestId('stream-card-title-input');
export async function selectStream(p, id) {
  await p.evaluate(async id => {
    await window.__argboardTest.setPanelPhase('wide'); // rail/contemplate is read-only
    window.__argboardTest.selectSingleCard(id);
  }, id);
  await p.waitForFunction(id => document.querySelector(`[data-testid="stream-card"][data-card-id="${id}"] [data-testid="stream-card-title-input"]`), id);
  await streamInput(p).scrollIntoViewIfNeeded();
}
export async function verifyStream(a, b, id, destination, pause = async () => {}) {
  const passed = [], input = streamInput(a);
  const read = async p => (await state(p)).cards.find(c => c.id === id);
  const original = await read(a), before = (await calls(a)).length;
  const stored = async value => {
    for (const p of [a, b].filter(Boolean)) {
      await p.waitForFunction(({ id, value }) => window.__argboardTest.getState().cards.find(c => c.id === id)?.title === value, { id, value });
      assert.deepEqual(await read(p), { ...original, title: value });
    }
    if (b) await b.waitForFunction(value => document.querySelector('[data-testid="stream-card-title-input"]')?.value === value, value);
  };
  await input.fill('Idle draft');
  await pause('Idle >400ms: A draft only; peer retains original', 2000);
  await a.waitForTimeout(650);
  assert.equal((await calls(a)).length, before);
  await stored(original.title);
  await input.press('Enter');
  await stored('Idle draft');
  assert.deepEqual((await calls(a)).slice(before), [{ id, patch: { title: 'Idle draft' } }]);
  await pause('Enter: both actual titles now Idle draft', 2000);
  passed.push('idle stays local; Enter sends one title-only patch; unrelated card fields unchanged');
  await input.focus(); await input.press('Tab');
  assert.equal((await calls(a)).length, before + 1, 'unchanged blur makes no attempt');
  await input.fill('Synthetic composition');
  const guardedEnter = async (name, init) => {
    await input.evaluate(el => el.addEventListener('keydown', e => {
      (window.__t098CompositionEvents ??= []).push({ key: e.key, keyCode: e.keyCode, isComposing: e.isComposing });
    }, { capture: true, once: true }));
    await input.dispatchEvent('keydown', init);
    const delivered = await a.evaluate(() => window.__t098CompositionEvents.at(-1));
    assert.deepEqual(delivered, { key: 'Enter', keyCode: init.keyCode ?? 0, isComposing: init.isComposing ?? false }, `${name}: delivered KeyboardEvent properties`);
    assert.equal(await input.evaluate(el => el === document.activeElement), true, `${name}: focus retained`);
    assert.equal((await calls(a)).length, before + 1, `${name}: zero update attempts`);
    await stored('Idle draft');
  };
  await input.dispatchEvent('compositionstart');
  await guardedEnter('composition ref alone', { key: 'Enter' });
  await input.dispatchEvent('compositionend');
  await guardedEnter('isComposing alone', { key: 'Enter', isComposing: true });
  await guardedEnter('key229 alone', { key: 'Enter', keyCode: 229 });
  await pause('SYNTHETIC composition + key229; NOT OS IME; Enter guarded', 2000);
  assert.equal(await input.evaluate(el => el === document.activeElement), true);
  assert.equal((await calls(a)).length, before + 1);
  await stored('Idle draft');
  await input.press('Enter'); await stored('Synthetic composition');
  passed.push('synthetic composition ref/isComposing/key229 each guard Enter; normal Enter commits');
  const escCount = (await calls(a)).length;
  await input.fill('Escape discarded draft');
  await pause('Esc BEFORE: pending draft will be discarded', 1500);
  await input.press('Escape');
  await a.waitForFunction(() => document.querySelector('[data-testid="stream-card-title-input"]')?.value === 'Synthetic composition');
  await a.waitForTimeout(650);
  await a.evaluate(() => window.__argboardTest.flushSave());
  await selectStream(a, destination); await selectStream(a, id);
  await stored('Synthetic composition');
  assert.equal((await calls(a)).length, escCount);
  await pause('Esc AFTER blur + idle: restored title; zero update attempts', 2500);
  passed.push('Esc restores actual title; blur and idle cause zero attempts');
  await input.fill('Switch saved');
  await pause('Typing before selection switch: draft still local', 1500);
  await selectStream(a, destination); // no DOM blur: unmount must flush old card
  await stored('Switch saved');
  assert.equal((await state(a)).cards.find(c => c.id === destination).title, 'Destination');
  assert.deepEqual((await calls(a)).at(-1), { id, patch: { title: 'Switch saved' } });
  await pause('Switch AFTER: peer shows old card saved; A shows Destination', 2000);
  passed.push('selection switch without DOM blur saves pending old-card draft');
  await selectStream(a, id);
  await input.fill('Blur saved'); await input.press('Tab'); await stored('Blur saved');
  passed.push('changed blur commits title only');
  await input.fill('Flush saved');
  await a.evaluate(() => window.__argboardTest.flushSave()); await stored('Flush saved');
  await input.fill('Blur saved'); await input.press('Tab'); await stored('Blur saved');
  await input.fill('Missing compositionend'); await input.dispatchEvent('compositionstart');
  await input.press('Tab'); await stored('Missing compositionend');
  await input.fill('Blur saved'); await input.press('Enter'); await stored('Blur saved');
  passed.push('focused flushSave advances baseline; refocus recovers when compositionend was missing');
  if (b) {
    const peer = streamInput(b), X = 'TITLE-X-original', Y = 'TITLE-Y-draft', Z = 'TITLE-Z-remote';
    await input.fill(X); await input.press('Enter'); await stored(X);
    await pause('B1: both actual title inputs show original X', 2000);
    const localCount = (await calls(a)).length, peerCount = (await calls(b)).length;
    await input.fill(Y);
    await pause('B1: A focused draft Y; B still displays X', 2000);
    await peer.fill(Z); await peer.press('Enter'); await stored(Z);
    assert.equal(await input.inputValue(), Y);
    assert.equal(await input.evaluate(el => el === document.activeElement), true);
    assert.equal((await calls(b)).length, peerCount + 1);
    assert.deepEqual((await calls(b)).at(-1), { id, patch: { title: Z } });
    await pause('B1: B Enter saved Z in SAME title; A still shows Y', 3000);
    await input.fill(X);
    await pause('B1: A restores original X before blur', 2000);
    await input.press('Tab');
    await a.waitForFunction(Z => document.querySelector('[data-testid="stream-card-title-input"]')?.value === Z, Z);
    await stored(Z);
    await a.waitForTimeout(650);
    assert.equal((await calls(a)).length, localCount);
    await pause('B1 AFTER: both actual inputs/store Z; zero A update attempts', 3000);
    passed.push('same-field B1 X/Y/Z: focused Y protected; restore X + blur retains Z in both displays/store, zero A attempts');
    await peer.fill('Remote after blur'); await peer.press('Enter'); await stored('Remote after blur');
    await a.waitForFunction(() => document.querySelector('[data-testid="stream-card-title-input"]')?.value === 'Remote after blur');
    await pause('After blur: later remote title reflected in both inputs', 2000);
    passed.push('later peer value follows after blur');
  }
  return passed;
}
